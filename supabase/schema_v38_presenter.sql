-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE PERSON READING IS NOT PLAYING
--
--  Ayser: "خليني أنا الي مكريت الروم أنا ما بلعبش، أنا إلي بعرض على
--  التليفون. الusers الي بيلعبو يظهرلهم شاشه تانيه يجربو فيها كلهم في
--  نفس الوقت. أنا بس بعرض الاسأله وهما يحلو كلهم في نفس الوقت. وفي
--  الاخر في تقيم حقيقي. وكل الاسأله نفس الpoints."
--
--  Three things, and they belong together.
--
--  ── ONE · THE HOST STEPS OFF THE BOARD ───────────────────────────
--  He was on the leaderboard with everybody else while holding the
--  phone that shows the questions — which is not a competition, it is
--  one person who can see the answer coming standing in the race.
--
--  So a room may say its host is presenting. Their seat stays (they
--  are in the room, they host it, the sync and the host checks all
--  need that row) but `playing` goes false, and after that:
--    · the leaderboard does not carry them
--    · the final ranking does not carry them
--    · the server refuses their answers outright, so a stray tap on a
--      phone that is being passed around cannot put them back on
--
--  It is a choice, not a rule. Somebody playing at a table with four
--  friends is the host AND a player, and that stays the default.
--
--  ── TWO · EVERY QUESTION IS WORTH THE SAME ───────────────────────
--  It was not. A question could be worth double, the last two of a
--  round were worth another half again, a streak paid a bonus of up
--  to fifty per cent, and answering fast paid more than answering
--  slowly. So the winner was whoever got the RIGHT questions right,
--  quickly, in a row — which is a real game, and not the one Ayser is
--  running.
--
--  Now a right answer is a right answer: the same points on the first
--  question and the last, for the fastest thumb and the slowest.
--
--  ── THREE · SO THE RANKING NEEDED A TIE-BREAK ────────────────────
--  Flat scoring means ties, and lots of them: fifteen questions and
--  six people will very often produce two on eleven. Ties are broken
--  by the total time the person spent answering, soonest first.
--
--  That ordering is the honest version of what speed was doing
--  before. Knowing the answer is what puts you above somebody;
--  answering quickly only separates you from the people who knew
--  exactly as much as you did.
--
--  AYSER: if you want the speed bonus back, it is one line — the
--  base is worked out in lamma_award and nowhere else.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms  add column if not exists host_plays boolean not null default true;
alter table public.room_players add column if not exists playing   boolean not null default true;

-- ── EVERY QUESTION, THE SAME ───────────────────────────────────────
-- The arguments are kept exactly as they were. Four callers pass them
-- and one of those is a view; changing the shape to drop what is no
-- longer read would be a much bigger edit than the change deserves,
-- and the next person to want the speed bonus back would have to put
-- them all back. They are ignored, and it says so.
create or replace function public.lamma_award(
  p_is_correct   boolean,
  p_elapsed_ms   int,          -- ignored: answering fast no longer pays
  p_timer_ms     int,          -- ignored, for the same reason
  p_points_style text,         -- ignored: no question is worth double
  p_streak       int,          -- ignored: a run no longer pays a bonus
  p_is_last_two  boolean       -- ignored: the end is worth the start
) returns int
language plpgsql immutable as $$
begin
  if not coalesce(p_is_correct, false) then return 0; end if;
  return 1000;
end;
$$;

-- ── THE HOST MAY PRESENT INSTEAD OF PLAY ───────────────────────────
drop function if exists public.lamma_set_room(uuid, int, boolean, int, boolean, boolean);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean,
                                                 p_round int, p_read_first boolean,
                                                 p_host_locked boolean, p_host_plays boolean)
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
         host_plays  = coalesce(p_host_plays, host_plays),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  /* Stepping off the board takes the host's score with them. Leaving
     it behind would mean a presenter who played the first three
     questions keeps three questions' worth of points on a ranking
     they are no longer on — and if they step back on, they should
     start where everybody else did. */
  if p_host_plays is not null then
    update public.room_players
       set playing = p_host_plays,
           score = case when p_host_plays then score else 0 end,
           streak = case when p_host_plays then streak else 0 end,
           best_streak = case when p_host_plays then best_streak else 0 end
     where room_id = p_room_id and user_id = me;

    if p_host_plays is false then
      delete from public.answers where room_id = p_room_id and user_id = me;
    end if;
  end if;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'read_first', r.read_first, 'host_locked', r.host_locked,
                            'host_plays', r.host_plays,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int, boolean, boolean, boolean) to authenticated;

-- ── AND THE SERVER REFUSES THEIR ANSWERS ───────────────────────────
-- The screen does not offer a presenter the four tiles, but a screen
-- is not a rule. This is the rule.
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
         best_streak = greatest(best_streak, v_streak)
   where room_id = p_room_id and user_id = me;

  return jsonb_build_object('accepted', true);
end;
$$;

grant execute on function public.lamma_submit_answer(uuid, uuid, int, int) to authenticated;

-- ── THE BOARD, WITHOUT THE PERSON READING ──────────────────────────
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
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nickname', p.nickname,
                                          'score', p.score, 'best_streak', p.best_streak,
                                          'is_connected', p.is_connected,
                                          'avatar_key', p.avatar_key)
                       order by p.score desc, t.spent asc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select coalesce(sum(a.elapsed_ms), 0) as spent
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) t
       where p.room_id = p_room_id and coalesce(p.playing, true)), '[]'::jsonb)
  );
end;
$$;

-- ── AND THE FINAL RANKING ──────────────────────────────────────────
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
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, c.spent asc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered,
                 coalesce(sum(a.elapsed_ms), 0) as spent
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id and coalesce(p.playing, true)), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
