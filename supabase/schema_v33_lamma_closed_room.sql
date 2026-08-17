-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A CLOSED ROOM, AND THE SEAT NOBODY CAN TAKE
--
--  Ayser: "Make it a close room for the Egyptian room and make my
--  account Ayser that only can control it we all enter the live
--  questions together in the same time then ranking."
--
--  Two different things were hiding in that sentence, and only one of
--  them existed.
--
--  ── THE DOOR ─────────────────────────────────────────────────────
--  Already there: a room has a code, and the host can lock it so no
--  new person walks in. That is the "closed" half, and it works.
--
--  ── THE SEAT ─────────────────────────────────────────────────────
--  This is the half that did not. lamma_claim_host exists so a room
--  survives its host's phone dying: if the host has been gone a while,
--  the longest-seated player is promoted and the night continues. That
--  is right for a game between friends and WRONG for the room Ayser is
--  describing, where he is running the evening on a shared screen. His
--  phone locking its screen for ninety seconds was enough for somebody
--  else to become host and start advancing his questions.
--
--  So a host may now BOLT THE SEAT. While it is bolted:
--    · claim_host refuses, with a reason that says why
--    · every other host power is unchanged — the host still controls
--      the clock, the door, the round and when the questions move
--
--  It is off by default. A room with the seat bolted and a host who
--  really has gone is a room nobody can advance, and that is a worse
--  evening than the one this prevents — so it is a choice made on
--  purpose by somebody sitting in front of the screen, never a default
--  somebody inherits.
--
--  ── WHY NOT "ONLY AYSER'S ACCOUNT" IN SO MANY WORDS ──────────────
--  Writing one email address into the database would give him this
--  room and nobody else a room of their own — and the moment he signed
--  in on another address, his own game would lock him out. Whoever
--  starts the room holds it; he starts the Egyptian room, so it is
--  his. Same outcome, and it cannot strand him.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists host_locked boolean not null default false;

-- ── THE SEAT ───────────────────────────────────────────────────────
-- Same promotion rule as before, with one refusal in front of it.
create or replace function public.lamma_claim_host(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  host_row public.room_players%rowtype;
  heir uuid;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then return jsonb_build_object('ok', false, 'reason', 'not_in_room'); end if;

  -- the host said this room is theirs to run, and meant it
  if r.host_locked then
    return jsonb_build_object('ok', false, 'reason', 'host_locked');
  end if;

  select * into host_row from public.room_players
   where room_id = p_room_id and user_id = r.host_user_id;

  -- still here? then there is nothing to claim
  if host_row.user_id is not null and host_row.is_connected then
    return jsonb_build_object('ok', false, 'reason', 'host_present');
  end if;

  select user_id into heir from public.room_players
   where room_id = p_room_id and is_connected and user_id <> r.host_user_id
   order by joined_at asc limit 1;

  if heir is null then return jsonb_build_object('ok', false, 'reason', 'nobody_to_promote'); end if;

  update public.game_rooms set host_user_id = heir where id = p_room_id;
  return jsonb_build_object('ok', true, 'host_user_id', heir);
end;
$$;

-- ── THE HOST'S SETTINGS, PLUS THE BOLT ─────────────────────────────
-- Dropped and recreated rather than overloaded: two functions with the
-- same name and a different number of arguments is "function is not
-- unique" at three in the morning. Same lesson as v25.
drop function if exists public.lamma_set_room(uuid, int, boolean, int, boolean);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean,
                                                 p_round int, p_read_first boolean,
                                                 p_host_locked boolean)
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
     set timer_ms    = coalesce(p_timer_ms, timer_ms),
         locked      = coalesce(p_locked, locked),
         read_first  = coalesce(p_read_first, read_first),
         host_locked = coalesce(p_host_locked, host_locked),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'read_first', r.read_first, 'host_locked', r.host_locked,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int, boolean, boolean) to authenticated;

-- ── AND EVERY PHONE IS TOLD ────────────────────────────────────────
-- A rule nobody can see is a rule that looks like a bug. The players
-- get host_locked in sync so the screen can say, in words, that this
-- room has one host and it is not up for grabs.
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
    'host_locked', r.host_locked,
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
