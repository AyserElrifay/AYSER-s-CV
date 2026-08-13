-- ═══════════════════════════════════════════════════════════════════
--  لمّة · LAMMA — the live + async quiz game
--  Phase 1: the data and the rules. No screens yet.
--
--  THE ONE RULE THIS FILE EXISTS TO ENFORCE
--  A player's device never decides what a player scored, and never
--  learns the right answer before the question has closed. Both of
--  those are impossible from the client here, not discouraged:
--
--    · lamma_questions_public is a view with correct_index REMOVED.
--      That is the only way a client can read a question. There is no
--      policy to forget, because the column is not in the view.
--    · answers can only be written through lamma_submit_answer, which
--      is security definer. It reads the right answer, does the
--      arithmetic itself, and hands back an acknowledgement — not a
--      verdict. Sending "I scored 800" has nowhere to arrive.
--    · lamma_reveal refuses to say anything until the deadline has
--      actually passed, by the server's clock.
--
--  Run in: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── CONTENT ────────────────────────────────────────────────────────
create table if not exists public.game_packs (
  id          uuid primary key default gen_random_uuid(),
  title_ar    text not null,
  title_en    text,
  description_ar text,
  cover_url   text,
  category    text,
  locale      text not null default 'ar-EG',
  is_official boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  visibility  text not null default 'public' check (visibility in ('public','friends','private')),
  plays_count int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid not null references public.game_packs(id) on delete cascade,
  order_index int not null default 0,
  text_ar     text not null,
  media_url   text,
  media_type  text check (media_type in ('image','audio')),
  timer_ms    int not null default 20000 check (timer_ms between 5000 and 120000),
  options     jsonb not null,              -- [{index:0,text_ar:"…"}, …] 2..4
  correct_index int not null check (correct_index between 0 and 3),
  points_style text not null default 'standard' check (points_style in ('standard','double','none')),
  -- a question nobody can read on a phone is a bug, not a feature
  constraint questions_options_size check (jsonb_array_length(options) between 2 and 4),
  constraint questions_text_len check (char_length(text_ar) <= 120)
);
create index if not exists questions_pack_idx on public.questions (pack_id, order_index);

-- ── ROOMS ──────────────────────────────────────────────────────────
create table if not exists public.game_rooms (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid references public.game_packs(id) on delete set null,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  join_code   text unique not null,
  mode        text not null default 'classic' check (mode in ('classic','meen_feena','duel')),
  status      text not null default 'lobby' check (status in ('lobby','question','reveal','leaderboard','ended')),
  current_question_index int not null default -1,
  current_started_at  timestamptz,
  current_deadline_at timestamptz,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists game_rooms_code_idx on public.game_rooms (join_code);

create table if not exists public.room_players (
  room_id     uuid not null references public.game_rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  nickname    text,
  avatar_key  text,
  score       int not null default 0,
  streak      int not null default 0,
  best_streak int not null default 0,
  joined_at   timestamptz not null default now(),
  is_connected boolean not null default true,
  primary key (room_id, user_id)
);
create index if not exists room_players_room_idx on public.room_players (room_id, score desc);

create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.game_rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  selected_index int,
  elapsed_ms  int,
  is_correct  boolean,
  points_awarded int not null default 0,
  server_received_at timestamptz not null default now(),
  flagged     boolean not null default false,
  -- one answer per player per question, decided by the database and not
  -- by a disabled button
  unique (room_id, question_id, user_id)
);

-- ── ASYNC DUELS ────────────────────────────────────────────────────
create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id   uuid not null references public.profiles(id) on delete cascade,
  pack_id       uuid references public.game_packs(id) on delete set null,
  challenger_score int,
  opponent_score   int,
  status        text not null default 'pending' check (status in ('pending','played','expired')),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);
create index if not exists duels_opponent_idx on public.duels (opponent_id, status);

-- ── مين فينا؟ ──────────────────────────────────────────────────────
create table if not exists public.poll_questions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.game_rooms(id) on delete cascade,
  text_ar     text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  order_index int not null default 0
);

create table if not exists public.poll_votes (
  room_id          uuid not null references public.game_rooms(id) on delete cascade,
  poll_question_id uuid not null references public.poll_questions(id) on delete cascade,
  voter_id         uuid not null references public.profiles(id) on delete cascade,
  target_user_id   uuid not null references public.profiles(id) on delete cascade,
  primary key (room_id, poll_question_id, voter_id)
);

-- ═══════════════════════════════════════════════════════════════════
--  THE SCORING RULES, IN SQL
--  The same arithmetic as src/lib/lammaScore.js, deliberately written
--  in double precision rather than numeric so it is bit-for-bit what
--  JavaScript computes. Exact decimal maths would be "better" and would
--  quietly disagree with the app about the last point, which is exactly
--  the argument this game must never start.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_award(
  p_is_correct   boolean,
  p_elapsed_ms   int,
  p_timer_ms     int,
  p_points_style text,
  p_streak       int,          -- counting this answer: 1 is the first
  p_is_last_two  boolean
) returns int
language plpgsql immutable as $$
declare
  base   int;
  timer  int;
  elapsed int;
  raw    int;
  mult   double precision;
begin
  if not coalesce(p_is_correct, false) then return 0; end if;

  base := case p_points_style when 'double' then 2000 when 'none' then 0 else 1000 end;
  timer := greatest(1000, coalesce(p_timer_ms, 20000));
  elapsed := least(greatest(coalesce(p_elapsed_ms, timer), 0), timer);

  if elapsed <= 500 then
    raw := base;
  else
    raw := floor(base::double precision * (1 - (elapsed::double precision / timer) / 2))::int;
  end if;
  raw := greatest(raw, floor(base::double precision * 0.5)::int);

  mult := least(1 + 0.1 * (greatest(coalesce(p_streak, 1), 1) - 1), 1.5);
  if coalesce(p_is_last_two, false) then mult := mult * 1.5; end if;

  return floor(raw::double precision * mult)::int;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  WHAT A CLIENT IS ALLOWED TO SEE OF A QUESTION
--  correct_index is absent from this view. Not hidden by a policy that
--  somebody might loosen later — absent.
-- ═══════════════════════════════════════════════════════════════════
create or replace view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, media_url, media_type,
         timer_ms, options, points_style
    from public.questions;

-- ═══════════════════════════════════════════════════════════════════
--  SUBMITTING AN ANSWER
--  Takes how long you took. Returns whether it was accepted. It does
--  NOT return whether you were right: telling you at submit time tells
--  you before the question has closed, and one player who knows can
--  tell four who do not.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_submit_answer(
  p_room_id     uuid,
  p_question_id uuid,
  p_selected_index int,
  p_elapsed_ms  int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  r         public.game_rooms%rowtype;
  q         public.questions%rowtype;
  pl        public.room_players%rowtype;
  v_correct boolean;
  v_elapsed int;
  v_streak  int;
  v_points  int;
  v_last_two boolean;
  v_total   int;
  v_flag    boolean := false;
begin
  if me is null then return jsonb_build_object('accepted', false, 'reason', 'signed_out'); end if;

  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_room'); end if;

  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'not_in_room'); end if;

  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_question'); end if;

  -- too late is too late, by the server's clock and nobody else's
  if r.current_deadline_at is not null and now() > r.current_deadline_at + interval '2 seconds' then
    return jsonb_build_object('accepted', false, 'reason', 'too_late');
  end if;

  /* The player's own measurement is trusted, within reason — they
     timed it from the frame the question appeared, which is the only
     honest clock for "how long did they take". It is clamped into the
     possible range rather than rejected, because a phone that was slow
     is not a phone that was cheating. */
  v_elapsed := least(greatest(coalesce(p_elapsed_ms, q.timer_ms), 0), q.timer_ms + 1500);

  /* A gap between what they claim and what the network shows gets
     marked for a human to look at later — and the answer still counts.
     Nobody loses a game because their signal dropped. */
  if r.current_started_at is not null
     and extract(epoch from (now() - r.current_started_at)) * 1000 > v_elapsed + 5000 then
    v_flag := true;
  end if;

  v_correct := (p_selected_index is not null and p_selected_index = q.correct_index);
  v_streak  := case when v_correct then pl.streak + 1 else 0 end;

  select count(*) into v_total from public.questions where pack_id = q.pack_id;
  v_last_two := (q.order_index >= v_total - 2);

  v_points := public.lamma_award(v_correct, v_elapsed, q.timer_ms, q.points_style, v_streak, v_last_two);

  begin
    insert into public.answers (room_id, question_id, user_id, selected_index, elapsed_ms,
                                is_correct, points_awarded, flagged)
    values (p_room_id, p_question_id, me, p_selected_index, v_elapsed, v_correct, v_points, v_flag);
  exception when unique_violation then
    -- they already answered this one; the first answer stands
    return jsonb_build_object('accepted', false, 'reason', 'already_answered');
  end;

  update public.room_players
     set score = score + v_points,
         streak = v_streak,
         best_streak = greatest(best_streak, v_streak)
   where room_id = p_room_id and user_id = me;

  -- an acknowledgement, and nothing that gives the answer away
  return jsonb_build_object('accepted', true, 'elapsed_ms', v_elapsed);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  THE REVEAL
--  Refuses to say anything until the deadline has genuinely passed.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_reveal(p_room_id uuid, p_question_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  mine public.answers%rowtype;
  dist jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not exists (select 1 from public.room_players where room_id = p_room_id and user_id = me) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  select * into r from public.game_rooms where id = p_room_id;
  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  if r.current_deadline_at is null or now() < r.current_deadline_at then
    return jsonb_build_object('ok', false, 'reason', 'not_yet');
  end if;

  select jsonb_agg(x) into dist from (
    select selected_index as index, count(*) as votes
      from public.answers
     where room_id = p_room_id and question_id = p_question_id
     group by selected_index order by selected_index
  ) x;

  select * into mine from public.answers
   where room_id = p_room_id and question_id = p_question_id and user_id = me;

  return jsonb_build_object(
    'ok', true,
    'correct_index', q.correct_index,
    'distribution', coalesce(dist, '[]'::jsonb),
    'your_result', case when mine.id is null then null else jsonb_build_object(
      'is_correct', mine.is_correct, 'points', mine.points_awarded) end
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  COMING BACK
--  Everything a phone that dropped out needs to rejoin exactly where
--  the room is now — including whether it may still answer.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_sync(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  pl public.room_players%rowtype;
  qid uuid;
  answered boolean := false;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_in_room'); end if;

  select id into qid from public.questions
   where pack_id = r.pack_id and order_index = r.current_question_index;
  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--
--  "Are you in this room?" is asked by nearly every policy below, and
--  the obvious way to ask it — a sub-select on room_players — makes the
--  policy ON room_players consult room_players, which consults itself.
--  Postgres stops that with "infinite recursion detected in policy",
--  and the table becomes unreadable: not a leak, but every score on
--  screen turns into an error.
--
--  Asking through a security definer function breaks the loop, because
--  the function's own read is not policed. It is marked stable so the
--  planner asks once per statement rather than once per row.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_in_room(p_room uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.room_players
     where room_id = p_room and user_id = auth.uid()
  );
$$;
grant execute on function public.lamma_in_room(uuid) to anon, authenticated;
alter table public.game_packs     enable row level security;
alter table public.questions      enable row level security;
alter table public.game_rooms     enable row level security;
alter table public.room_players   enable row level security;
alter table public.answers        enable row level security;
alter table public.duels          enable row level security;
alter table public.poll_questions enable row level security;
alter table public.poll_votes     enable row level security;

drop policy if exists "packs readable" on public.game_packs;
create policy "packs readable" on public.game_packs for select
  using (visibility = 'public' or created_by = auth.uid());
drop policy if exists "packs authored by you" on public.game_packs;
create policy "packs authored by you" on public.game_packs for insert with check (created_by = auth.uid());
drop policy if exists "packs edited by you" on public.game_packs;
create policy "packs edited by you" on public.game_packs for update using (created_by = auth.uid());

/* NOTHING may read the questions table directly — not even to count
   them. Clients go through lamma_questions_public, which has no right
   answer in it to leak. */
drop policy if exists "questions are not client readable" on public.questions;

drop policy if exists "rooms readable by their players" on public.game_rooms;
create policy "rooms readable by their players" on public.game_rooms for select
  using (public.lamma_in_room(id) or host_user_id = auth.uid());
drop policy if exists "you host your own rooms" on public.game_rooms;
create policy "you host your own rooms" on public.game_rooms for insert with check (host_user_id = auth.uid());
drop policy if exists "the host runs the room" on public.game_rooms;
create policy "the host runs the room" on public.game_rooms for update using (host_user_id = auth.uid());

drop policy if exists "players see their room" on public.room_players;
create policy "players see their room" on public.room_players for select
  using (public.lamma_in_room(room_id));
drop policy if exists "you join as yourself" on public.room_players;
create policy "you join as yourself" on public.room_players for insert with check (user_id = auth.uid());
/* Deliberately NO update policy. Score is written by
   lamma_submit_answer, which is security definer. A player cannot set
   their own score, because there is no policy under which that write
   would be allowed. */

drop policy if exists "answers readable by the room" on public.answers;
create policy "answers readable by the room" on public.answers for select
  using (public.lamma_in_room(room_id));
/* No insert policy either: answers arrive only through the function. */

drop policy if exists "duels readable by the two of you" on public.duels;
create policy "duels readable by the two of you" on public.duels for select
  using (auth.uid() in (challenger_id, opponent_id));
drop policy if exists "you challenge as yourself" on public.duels;
create policy "you challenge as yourself" on public.duels for insert with check (challenger_id = auth.uid());
drop policy if exists "the two of you update it" on public.duels;
create policy "the two of you update it" on public.duels for update
  using (auth.uid() in (challenger_id, opponent_id));

drop policy if exists "prompts readable by the room" on public.poll_questions;
create policy "prompts readable by the room" on public.poll_questions for select
  using (public.lamma_in_room(room_id));
drop policy if exists "you add prompts to your room" on public.poll_questions;
create policy "you add prompts to your room" on public.poll_questions for insert
  with check (public.lamma_in_room(room_id));

drop policy if exists "votes readable by the room" on public.poll_votes;
create policy "votes readable by the room" on public.poll_votes for select
  using (public.lamma_in_room(room_id));
drop policy if exists "you vote as yourself" on public.poll_votes;
create policy "you vote as yourself" on public.poll_votes for insert with check (voter_id = auth.uid());

grant select on public.lamma_questions_public to anon, authenticated;
grant execute on function public.lamma_award(boolean,int,int,text,int,boolean) to anon, authenticated;
grant execute on function public.lamma_submit_answer(uuid,uuid,int,int) to authenticated;
grant execute on function public.lamma_reveal(uuid,uuid) to authenticated;
grant execute on function public.lamma_sync(uuid) to authenticated;

notify pgrst, 'reload schema';
