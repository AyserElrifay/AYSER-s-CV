-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A ROOM OF SEVENTY, AND IT HOLDS
--
--  Ayser asked whether the app could take seventy people playing at
--  once. The honest answer was no — it would have come apart somewhere
--  around twenty or thirty — and this is the file that makes the
--  answer yes.
--
--  ── WHAT WAS ACTUALLY WRONG ──────────────────────────────────────
--  Not the game. The PAYLOAD.
--
--  lamma_sync returned the whole leaderboard, and every row carried
--  that player's face: a base64 JPEG of up to 26,000 characters. With
--  seventy players that is about 1.8 MB per sync. Every phone polls
--  every five seconds and re-syncs on every phase change, so a single
--  question cost the room in the order of gigabytes — to send a set of
--  pictures that had not changed since the lobby.
--
--  And underneath it, lamma_sync ran a lateral aggregate over the
--  answers table for every player on every call, to work out the
--  tie-break. Seventy players times fifteen questions times fourteen
--  syncs a second is a lot of arithmetic to redo for a number that
--  only changes when somebody answers.
--
--  ── THREE CHANGES, AND THE ARGUMENT FOR EACH ─────────────────────
--
--  1. THE FACES LEAVE THE HOT PATH. lamma_sync stops sending
--     avatar_key. A new lamma_faces() returns the pictures, and the
--     app asks for it once per room and again only when it sees a
--     face it does not know. A picture that changes once an evening
--     should not travel fourteen times a second.
--
--     The leaderboard row goes from ~26 KB to ~90 bytes. Seventy of
--     them is about 6 KB — which is the difference between "it works"
--     and "it does not".
--
--  2. THE TIE-BREAK IS STORED, NOT RECOMPUTED. room_players gains
--     spent_ms, added to as each answer lands. The aggregate over
--     answers disappears from the read path entirely. Same ordering,
--     same rule — the fastest player wins a tie — computed once when
--     it changes instead of on every read.
--
--  3. AN INDEX THE ANSWERS TABLE NEVER HAD. (room_id, user_id) —
--     used by the backfill below, by lamma_room_results, and by
--     anything else that asks what one player did in one room.
--
--  ── WHY NOT JUST SEND FEWER PLAYERS ──────────────────────────────
--  The obvious fix is to return the top twenty and stop. It is also
--  wrong: somebody in fortieth place is playing the same evening and
--  their own row has to be right, the final ranking needs everybody,
--  and a truncated board is a bug that only appears in exactly the
--  big room this file exists to support. Send everybody. Send less
--  about each of them.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.room_players add column if not exists spent_ms bigint not null default 0;

create index if not exists answers_room_user on public.answers (room_id, user_id);

-- Rooms that were played before this column existed still have a
-- correct total waiting in the answers table. One pass, and every old
-- room's tie-break survives the change.
update public.room_players p
   set spent_ms = coalesce(t.total, 0)
  from (select room_id, user_id, sum(elapsed_ms) as total
          from public.answers group by room_id, user_id) t
 where t.room_id = p.room_id and t.user_id = p.user_id
   and p.spent_ms = 0;

-- ── THE TAP, NOW KEEPING ITS OWN RUNNING TOTAL ─────────────────────
-- Identical to v38 in every rule it applies. The only difference is
-- the last line of the update: the time spent is accumulated here,
-- once, rather than summed on every read by every phone in the room.
create or replace function public.lamma_submit_answer(
  p_room_id uuid, p_question_id uuid, p_selected_index int, p_elapsed_ms int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  pl public.room_players%rowtype;
  v_correct boolean;
  v_points  int;
  v_streak  int;
  v_elapsed int;
  v_flag    boolean := false;
  v_total   int;
  v_last_two boolean;
begin
  if me is null then return jsonb_build_object('accepted', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_room'); end if;
  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'not_in_room'); end if;

  -- reading the questions out is not playing them
  if not coalesce(pl.playing, true) then
    return jsonb_build_object('accepted', false, 'reason', 'presenting');
  end if;

  if r.status <> 'question' then
    return jsonb_build_object('accepted', false, 'reason', 'not_open');
  end if;
  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_question'); end if;
  if r.current_deadline_at is not null and now() > r.current_deadline_at + interval '1500 milliseconds' then
    return jsonb_build_object('accepted', false, 'reason', 'too_late');
  end if;

  v_elapsed := least(greatest(coalesce(p_elapsed_ms, q.timer_ms), 0), q.timer_ms + 1500);

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
    return jsonb_build_object('accepted', false, 'reason', 'already_answered');
  end;

  update public.room_players
     set score = score + v_points,
         streak = v_streak,
         best_streak = greatest(best_streak, v_streak),
         spent_ms = spent_ms + v_elapsed      -- the tie-break, kept as we go
   where room_id = p_room_id and user_id = me;

  return jsonb_build_object('accepted', true);
end;
$$;

grant execute on function public.lamma_submit_answer(uuid, uuid, int, int) to authenticated;

-- ── THE FACES, ASKED FOR SEPARATELY AND RARELY ─────────────────────
-- Everything lamma_sync used to carry on its back, on its own, so a
-- phone can fetch it once and keep it. Only for somebody actually in
-- the room — a face is not public just because a room id is guessable.
create or replace function public.lamma_faces(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  if not public.lamma_in_room(p_room_id) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'avatar_key', p.avatar_key))
      from public.room_players p
     where p.room_id = p_room_id and p.avatar_key is not null), '[]'::jsonb);
end;
$$;

revoke all on function public.lamma_faces(uuid) from public;
grant execute on function public.lamma_faces(uuid) to authenticated;

-- ── AND THE BOARD, WITHOUT THE PICTURES ────────────────────────────
-- Byte for byte the same information as v38 minus avatar_key, and
-- ordered by the stored spent_ms rather than by an aggregate run
-- afresh for every player on every call.
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
    'host_plays', r.host_plays,
    'im_playing', coalesce(pl.playing, true),
    'timer_ms', r.timer_ms,
    'read_first', r.read_first,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    /* Ordered by what they knew, then by how long they took — the
       tie-break flat scoring made necessary. */
    /* No avatar_key here any more, and no aggregate: the faces come
       from lamma_faces() once per room, and the tie-break is the
       stored spent_ms. Same players, same order, ~90 bytes a row
       instead of ~26 KB. See supabase/schema_v40_big_room.sql. */
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nickname', p.nickname,
                                          'score', p.score, 'best_streak', p.best_streak,
                                          'is_connected', p.is_connected)
                       order by p.score desc, p.spent_ms asc, p.joined_at asc)
        from public.room_players p
       where p.room_id = p_room_id and coalesce(p.playing, true)), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.lamma_sync(uuid) to authenticated;

notify pgrst, 'reload schema';
