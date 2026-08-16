-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A ROUND IS FIFTEEN QUESTIONS, NOT THE WHOLE SHELF
--
--  "Do You Know Egypt?" grew to forty-three questions, which is a good
--  library and a bad evening: half an hour of quiz is longer than the
--  reason people opened it. Ayser played it and said so.
--
--  So a ROOM now has its own list of questions, drawn from the pack
--  when the room is made:
--
--    · fifteen by default — about eight minutes, the length of the
--      thing people actually finish
--    · in a RANDOM order, drawn fresh for every room, so the second
--      game of the night is not the first one again
--    · the host can ask for ten, fifteen, twenty-five or all of them
--      while the room is still in the lobby
--
--  ── WHY THE ROOM HOLDS THE LIST ──────────────────────────────────
--  Everything downstream has to agree about what "question four" is:
--  the phone showing it, the server stamping its deadline, the reveal,
--  the scoring, and the end-of-game count. One list, on the room,
--  written once when the room is made and read by all of them. Picking
--  randomly at each step would give ten phones ten different games.
--
--  ── AND THE COUNTS FOLLOW IT ─────────────────────────────────────
--  "12 / 15" counts the round, the double-points questions are the
--  last two OF THE ROUND, and "how Egyptian are you" is out of the
--  fifteen that were actually asked — not out of a pack nobody played.
--
--  Rooms made before this still work: an empty list means the old
--  behaviour, the whole pack in written order.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists question_ids uuid[];

/* The draw. Random order, capped at n — and n of 0 (or more questions
   asked for than exist) means the whole pack. */
create or replace function public.lamma_draw_questions(p_pack_id uuid, p_n int)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}'::uuid[]) from (
    select id from public.questions
     where pack_id = p_pack_id
     order by random()
     limit (case when coalesce(p_n, 0) <= 0 then 2147483647 else p_n end)
  ) picked;
$$;

grant execute on function public.lamma_draw_questions(uuid, int) to authenticated;

-- ── A NEW ROOM DRAWS ITS ROUND ─────────────────────────────────────
create or replace function public.lamma_create_room(p_pack_id uuid, p_mode text default 'classic')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not exists (select 1 from public.game_packs where id = p_pack_id) then
    return jsonb_build_object('ok', false, 'reason', 'no_pack');
  end if;

  insert into public.game_rooms (pack_id, host_user_id, join_code, mode, status, question_ids)
  values (p_pack_id, me, public.lamma_new_code(), coalesce(p_mode, 'classic'), 'lobby',
          public.lamma_draw_questions(p_pack_id, 15))
  returning * into r;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'join_code', r.join_code,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

-- ── THE HOST'S SETTINGS, NOW INCLUDING HOW LONG THE ROUND IS ───────
-- Dropped and recreated rather than overloaded: two functions with the
-- same name and a different number of arguments is how you get
-- "function is not unique" at three in the morning.
drop function if exists public.lamma_set_room(uuid, int, boolean);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean, p_round int)
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

  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;
  if p_round is not null and p_round not in (0, 10, 15, 25) then
    return jsonb_build_object('ok', false, 'reason', 'bad_round');
  end if;
  -- the questions cannot change under a game that has started
  if p_round is not null and r.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  update public.game_rooms
     set timer_ms = coalesce(p_timer_ms, timer_ms),
         locked   = coalesce(p_locked, locked),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int) to authenticated;

-- ── MOVING ALONG THE ROOM'S OWN LIST ───────────────────────────────
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

  -- the round, or the whole pack for a room made before rounds existed
  total := coalesce(array_length(r.question_ids, 1),
                    (select count(*)::int from public.questions where pack_id = r.pack_id));
  nxt := r.current_question_index + 1;

  if nxt >= total then
    update public.game_rooms set status = 'ended', current_deadline_at = null where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'ended');
  end if;

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    select * into q from public.questions where id = r.question_ids[nxt + 1];   -- arrays start at 1
  else
    select * into q from public.questions where pack_id = r.pack_id and order_index = nxt;
  end if;
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

-- ── AND EVERY PHONE IS TOLD WHICH QUESTIONS THIS ROOM IS PLAYING ───
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

  if r.question_ids is not null and r.current_question_index >= 0
     and r.current_question_index < coalesce(array_length(r.question_ids, 1), 0) then
    qid := r.question_ids[r.current_question_index + 1];
  else
    select id into qid from public.questions
     where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;

  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'question_ids', coalesce(to_jsonb(r.question_ids), '[]'::jsonb),
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

-- ── OUT OF WHAT WAS ACTUALLY ASKED ─────────────────────────────────
-- Fifteen questions played, so fifteen is the denominator. Counting
-- against the whole pack would have told somebody who got twelve right
-- that they are 28% Egyptian.
create or replace function public.lamma_room_results(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  total int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  total := coalesce(array_length(r.question_ids, 1),
                    (select count(*)::int from public.questions where pack_id = r.pack_id));

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'country', (select country from public.game_packs where id = r.pack_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id, 'nickname', p.nickname, 'score', p.score,
               'avatar_key', p.avatar_key,
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ── DOUBLE POINTS BELONG TO THE END OF THE ROUND ───────────────────
-- The last two questions are worth double. That was worked out from
-- the question's place in the PACK, which in a fifteen-question round
-- drawn at random means the bonus lands on whichever two questions
-- happen to have been written last — usually not the two anybody is
-- still awake for. It is the round's own last two now.
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
  v_pos     int;
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

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    v_total := array_length(r.question_ids, 1);
    v_pos   := coalesce(array_position(r.question_ids, q.id), 1) - 1;   -- 0-based
  else
    select count(*) into v_total from public.questions where pack_id = q.pack_id;
    v_pos := q.order_index;
  end if;
  v_last_two := (v_pos >= v_total - 2);

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

notify pgrst, 'reload schema';
