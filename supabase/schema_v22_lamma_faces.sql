-- ═══════════════════════════════════════════════════════════════════
--  لمّة · YOUR OWN FACE ON THE SCOREBOARD
--
--  A letter in a circle is not a player. Everybody in a room together
--  already knows what everybody else looks like, and the half second
--  after a question is funnier when the board is faces.
--
--  So a player can put ONE photo on their seat in a room — taken in
--  the app, with a nemes headcloth or Nefertiti's crown drawn on it
--  (see src/components/lamma/PharaohCam.js).
--
--  ── WHERE IT LIVES AND WHY ───────────────────────────────────────
--  On the seat, not on the profile. It belongs to that room and that
--  night: it goes to the people playing, and it is deleted with the
--  room. Nobody's profile picture changes because they put a crown on
--  for one game.
--
--  ── WHAT THE SERVER WILL ACCEPT ──────────────────────────────────
--  A small JPEG data URL, from somebody who is actually in the room,
--  about themselves. Anything else is refused here rather than
--  trusted from the phone:
--
--    · you must be in the room            (lamma_in_room)
--    · you may only write your own seat   (user_id = auth.uid())
--    · it must be a jpeg data URL         (no svg, no html, no link)
--    · it must be small                   (26 KB of text, about 8 KB
--                                          of picture)
--
--  The size limit is not tidiness. Every phone in the room reads the
--  player list on every refresh, so a photograph on a seat is a
--  photograph downloaded again and again by everybody.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.lamma_set_face(p_room_id uuid, p_face text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  if p_face is not null then
    if length(p_face) > 26000 then
      return jsonb_build_object('ok', false, 'reason', 'too_big');
    end if;
    if p_face not like 'data:image/jpeg;base64,%' then
      return jsonb_build_object('ok', false, 'reason', 'not_a_photo');
    end if;
  end if;

  update public.room_players
     set avatar_key = p_face
   where room_id = p_room_id and user_id = me;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.lamma_set_face(uuid, text) to authenticated;

-- ── AND THE ROOM HANDS THE FACES ROUND ─────────────────────────────
-- sync() is what every phone reads to know who is in the room and
-- where they stand, so that is where a face has to appear. Without
-- this the photo would exist and nobody would ever see it.
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

-- The end-of-game table carries them too, so the podium is faces.
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

  select count(*) into total from public.questions where pack_id = r.pack_id;

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

notify pgrst, 'reload schema';
