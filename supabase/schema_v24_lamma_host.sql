-- ═══════════════════════════════════════════════════════════════════
--  لمّة · ONE HOST, HOLDING THE CLOCK AND THE DOOR
--
--  A room with a code needs somebody running it, and exactly one
--  somebody. That was already half true — only the host could move the
--  game on — but the host had nothing else to decide: not how long a
--  question lasts, not who may still walk in, not what to do about
--  somebody who should not be in the room.
--
--  Three things move to the host now, and nothing moves to anybody
--  else:
--
--  THE CLOCK. A room can set its own question length — ten seconds for
--  a fast round, forty-five when the table is arguing — and it
--  overrides whatever each question was written with. It is still the
--  SERVER that stamps the deadline, from its own clock, exactly as
--  before: the host chooses the length, not the moment it ends, so a
--  phone still cannot buy itself more time by lying about its clock.
--
--  THE DOOR. Locking the room refuses new arrivals with a plain
--  "the room is closed" instead of dropping a stranger into question
--  nine. People already inside are unaffected.
--
--  AND WHO IS IN IT. The host may remove a player. Not their answers —
--  those stay recorded — just their seat.
--
--  ── WHAT IS DELIBERATELY *NOT* THE HOST'S ────────────────────────
--  The right answer, the scoring and the deadline. Those are the
--  server's, and they stay the server's, because a host who can decide
--  when a question ends is a host who can win.
--
--  ── AND EVERYBODY STILL SEES IT AT THE SAME SECOND ───────────────
--  One row moves — game_rooms — and every phone in the room is
--  watching it. The question index and the deadline arrive together,
--  so ten phones show question four with the same time left, whether
--  they were nudged or noticed by themselves.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists locked   boolean not null default false;
alter table public.game_rooms add column if not exists timer_ms int;      -- null = each question's own

-- ── THE HOST'S SETTINGS ────────────────────────────────────────────
-- Null for either argument means "leave that one alone", so the lobby
-- can change the clock without touching the door.
create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  -- a length somebody could actually play with, not any number a phone sends
  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;

  update public.game_rooms
     set timer_ms = coalesce(p_timer_ms, timer_ms),
         locked   = coalesce(p_locked, locked)
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked);
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean) to authenticated;

-- ── THE HOST MAY REMOVE SOMEBODY ───────────────────────────────────
-- The seat goes; the answers stay recorded. And the host cannot remove
-- themselves, because a room with nobody driving is the fault this
-- whole file exists to avoid.
create or replace function public.lamma_kick(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  if p_user_id = me then return jsonb_build_object('ok', false, 'reason', 'not_yourself'); end if;

  delete from public.room_players where room_id = p_room_id and user_id = p_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.lamma_kick(uuid, uuid) to authenticated;

-- ── THE DOOR ───────────────────────────────────────────────────────
-- Joining a locked room, or one that has already started, now says so
-- plainly instead of seating somebody in the middle of question nine.
-- Anybody who was already in the room can still come back — that is a
-- reconnection, not an arrival.
create or replace function public.lamma_join_room(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  seated boolean := false;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;

  select * into r from public.game_rooms where join_code = upper(trim(p_code));
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_code'); end if;
  if r.status = 'ended' then return jsonb_build_object('ok', false, 'reason', 'game_over'); end if;

  select true into seated from public.room_players where room_id = r.id and user_id = me;

  if not coalesce(seated, false) and r.locked then
    return jsonb_build_object('ok', false, 'reason', 'room_locked');
  end if;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me
  on conflict (room_id, user_id) do update set is_connected = true;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'status', r.status,
                            'pack_id', r.pack_id,
                            'question_index', r.current_question_index);
end;
$$;

-- ── THE CLOCK THE HOST CHOSE ───────────────────────────────────────
-- Same function, one line different: the deadline comes from the
-- room's length when it has one. Still stamped here, from now(), so
-- everybody's question ends at the same instant however slow their
-- phone is.
create or replace function public.lamma_advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  nxt int;
  q  public.questions%rowtype;
  total int;
  secs numeric;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  select count(*) into total from public.questions where pack_id = r.pack_id;
  nxt := r.current_question_index + 1;

  if nxt >= total then
    update public.game_rooms set status = 'ended', current_deadline_at = null where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'ended');
  end if;

  select * into q from public.questions where pack_id = r.pack_id and order_index = nxt;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  secs := coalesce(r.timer_ms, q.timer_ms) / 1000.0;

  update public.game_rooms
     set status = 'question',
         current_question_index = nxt,
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => secs)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question', 'question_index', nxt,
                            'total', total, 'timer_ms', coalesce(r.timer_ms, q.timer_ms),
                            'deadline_at', now() + make_interval(secs => secs));
end;
$$;

-- ── AND THE ROOM TELLS EVERY PHONE WHAT IT IS ──────────────────────
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
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'timer_ms', r.timer_ms,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected,
                                          'avatar_key', avatar_key)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
