-- ═══════════════════════════════════════════════════════════════════
--  لمّة · READ IT OUT FIRST, THEN SHOW THE CHOICES
--
--  Ayser hosts on a shared screen and asked for the thing every real
--  quiz night does: put the question up on its own, read it out loud,
--  let people think — and only then show the four answers and start
--  the clock.
--
--  That cannot be done on the phone alone. If the deadline is stamped
--  when the question appears, the twenty seconds are already draining
--  while the host is still reading, and the people on the call lose
--  the time it took him to say it.
--
--  So a question now has TWO moments, and the server knows about both:
--
--    reading   the question is up. No options anywhere, no deadline,
--              no clock. Everybody reads or listens.
--    question  the choices appear and the clock starts — stamped by
--              the server, at that instant, for everybody at once.
--
--  ── ONLY WHEN THE ROOM ASKS FOR IT ───────────────────────────────
--  read_first is off by default, because somebody playing alone on a
--  phone does not want to tap twice for every question. The presenter
--  screen turns it on for the room it is hosting.
--
--  ── AND THE CLOCK IS STILL THE SERVER'S ──────────────────────────
--  The host decides WHEN the choices appear. The deadline is stamped
--  from the server's own now() at that moment, so the length is the
--  room's chosen length and everybody's question ends together, however
--  slow anybody's phone is.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists read_first boolean not null default false;

-- ── A ROOM MAY NOW BE "READING" ────────────────────────────────────
-- The status list is widened by dropping the old constraint and adding
-- a wider one NOT VALID: an existing room is in one of the old states
-- and re-validating a table mid-game is a lock nobody asked for. The
-- same lesson as scripts/check-sql-twice.sh — a constraint that
-- validates against rows written later is how this file broke twice.
do $$
begin
  alter table public.game_rooms drop constraint if exists game_rooms_status_check;
  alter table public.game_rooms add constraint game_rooms_status_check
    check (status in ('lobby','reading','question','reveal','leaderboard','ended')) not valid;
exception when others then null;
end $$;

-- ── ADVANCE: TO THE READING, OR STRAIGHT TO THE QUESTION ───────────
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

  total := coalesce(array_length(r.question_ids, 1),
                    (select count(*)::int from public.questions where pack_id = r.pack_id));
  nxt := r.current_question_index + 1;

  if nxt >= total then
    update public.game_rooms set status = 'ended', current_deadline_at = null where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'ended');
  end if;

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    select * into q from public.questions where id = r.question_ids[nxt + 1];
  else
    select * into q from public.questions where pack_id = r.pack_id and order_index = nxt;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  /* Reading first: the question goes up with NO deadline at all. A
     null deadline is what tells every phone not to start a clock and
     not to show a tile. */
  if r.read_first then
    update public.game_rooms
       set status = 'reading',
           current_question_index = nxt,
           current_started_at = now(),
           current_deadline_at = null
     where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'reading', 'question_index', nxt, 'total', total);
  end if;

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

-- ── AND THE MOMENT THE CHOICES APPEAR ──────────────────────────────
-- Host only, and only out of 'reading'. Asking twice is harmless: the
-- second call finds the room already on the question and says so
-- rather than restarting the clock somebody is already answering
-- against.
create or replace function public.lamma_show_options(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  secs numeric;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  if r.status <> 'reading' then return jsonb_build_object('ok', false, 'reason', 'not_reading'); end if;

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    select * into q from public.questions where id = r.question_ids[r.current_question_index + 1];
  else
    select * into q from public.questions where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  secs := coalesce(r.timer_ms, q.timer_ms) / 1000.0;
  update public.game_rooms
     set status = 'question',
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => secs)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question',
                            'timer_ms', coalesce(r.timer_ms, q.timer_ms),
                            'deadline_at', now() + make_interval(secs => secs));
end;
$$;

grant execute on function public.lamma_show_options(uuid) to authenticated;

-- ── THE HOST'S SETTINGS, PLUS "READ IT FIRST" ──────────────────────
drop function if exists public.lamma_set_room(uuid, int, boolean, int);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean,
                                                 p_round int, p_read_first boolean)
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
  if p_round is not null and r.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  update public.game_rooms
     set timer_ms   = coalesce(p_timer_ms, timer_ms),
         locked     = coalesce(p_locked, locked),
         read_first = coalesce(p_read_first, read_first),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'read_first', r.read_first,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int, boolean) to authenticated;

-- ── AND EVERY PHONE IS TOLD WHICH MOMENT IT IS ─────────────────────
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
    'read_first', r.read_first,
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
