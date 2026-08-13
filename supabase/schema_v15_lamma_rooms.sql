-- ═══════════════════════════════════════════════════════════════════
--  لمّة · LAMMA — running a room
--  Phase 2, server half. Everything that changes a room's state lives
--  here, so a phone can ask for a change but can never make one.
--
--  Realtime is used ONLY to tell phones what already happened. Nothing
--  a client broadcasts is ever trusted, because nothing a client
--  broadcasts is ever read.
-- ═══════════════════════════════════════════════════════════════════

/* ── THE JOIN CODE ────────────────────────────────────────────────
   Six characters, read aloud across a room, usually badly. So: no O
   against 0, no I or l against 1, no S against 5. What is left cannot
   be misheard or mistyped into somebody else's game. */
create or replace function public.lamma_new_code()
returns text
language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
  code text;
  tries int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.game_rooms where join_code = code);
    tries := tries + 1;
    if tries > 50 then
      -- 29^6 codes; if fifty draws all collide something is very wrong
      raise exception 'could not find a free join code';
    end if;
  end loop;
  return code;
end;
$$;

/* ── OPENING A ROOM ──────────────────────────────────────────────── */
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

  insert into public.game_rooms (pack_id, host_user_id, join_code, mode, status)
  values (p_pack_id, me, public.lamma_new_code(), coalesce(p_mode, 'classic'), 'lobby')
  returning * into r;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'join_code', r.join_code);
end;
$$;

/* ── COMING IN ────────────────────────────────────────────────────
   By code, because that is how somebody across a room joins without
   being anybody's friend first. Joining a game already in progress is
   allowed: you start on nothing and play the rest. Being told "too
   late" by an app your friends are laughing at is a worse experience
   than losing. */
create or replace function public.lamma_join_room(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;

  select * into r from public.game_rooms where join_code = upper(trim(p_code));
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_code'); end if;
  if r.status = 'ended' then return jsonb_build_object('ok', false, 'reason', 'game_over'); end if;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me
  on conflict (room_id, user_id) do update set is_connected = true;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'status', r.status,
                            'question_index', r.current_question_index);
end;
$$;

/* ── MOVING THE GAME ON ───────────────────────────────────────────
   Only the host, and the deadline is set here from the server's own
   clock. A phone asking "start question 3" cannot decide when question
   3 ends, which is the whole reason nobody can give themselves more
   time by lying about theirs. */
create or replace function public.lamma_advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  nxt int;
  q  public.questions%rowtype;
  total int;
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

  update public.game_rooms
     set status = 'question',
         current_question_index = nxt,
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => q.timer_ms / 1000.0)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question', 'question_index', nxt,
                            'total', total, 'timer_ms', q.timer_ms,
                            'deadline_at', now() + make_interval(secs => q.timer_ms / 1000.0));
end;
$$;

/* ── A HOST WHO WALKED AWAY ───────────────────────────────────────
   Someone's battery dies and four people are left staring at a
   question that will never end. The room does not belong to the host;
   the host is just whoever is driving. Any player may hand the wheel
   to the longest-standing connected player once the host has been gone
   long enough — and the host coming back does not take it away again,
   because two hosts is worse than the wrong one. */
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

/* Leaving is a flag, not a delete: your score stays on the board and
   you can walk back in on the same phone or another one. */
create or replace function public.lamma_set_connected(p_room_id uuid, p_connected boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false); end if;
  update public.room_players set is_connected = coalesce(p_connected, true)
   where room_id = p_room_id and user_id = me;
  return jsonb_build_object('ok', found);
end;
$$;

grant execute on function public.lamma_create_room(uuid,text)   to authenticated;
grant execute on function public.lamma_join_room(text)          to authenticated;
grant execute on function public.lamma_advance(uuid)            to authenticated;
grant execute on function public.lamma_claim_host(uuid)         to authenticated;
grant execute on function public.lamma_set_connected(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
