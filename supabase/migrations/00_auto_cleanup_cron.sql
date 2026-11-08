-- ════════════════════════════════════════════════════════════════════
--  AUTO CLEANUP · WHAT IS OVER, GOES (pg_cron, every day at 03:00 UTC)
--  Ayser, November 2026: "Supabase & Cloudflare stay inside the free tier
--  forever". Runs after RUN_ME.sql (.github/workflows/setup-backend.yml
--  applies every file in supabase/migrations/). Each rule deletes only
--  what nobody can see or use any more:
--   1. a table chat (a Drop's, a booked trip's, a plan's) — its messages,
--      photos and voice notes — 48 hours after its window closed
--      (event_window in RUN_ME.sql). Friends' chats (dm threads) are kept.
--      Their files go to storage_trash; the daily storage sweep deletes them.
--   2. notifications already read, after 14 days (unread ones keep the
--      90 days tidy_up already gives them).
--   3. events that never happened: a draft offer that has passed, with no
--      booking and nothing hanging under it; a plan that passed (or was
--      called off) more than two days ago with nobody but its host in it
--      and no passport stamp from it.
--   4. Lamma game rooms older than 12 hours (their players, answers and
--      votes go with them).
--  Returns how many of each it removed. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.auto_cleanup()
returns jsonb language plpgsql security definer set search_path = public as $$
declare c int := 0; f int := 0; n int := 0; o int := 0; g int := 0; r int := 0; m record;
begin
  -- 1 · table chats, 48 hours after they closed
  for m in
    select x.id, x.media_url
      from public.messages x
     where x.squad_id is not null
       and exists (select 1 from public.event_window(x.squad_id) w where w.closes < now() - interval '48 hours')
  loop
    if m.media_url is not null then perform public.trash_media(m.media_url); f := f + 1; end if;
    delete from public.messages where id = m.id;
    c := c + 1;
  end loop;

  -- 2 · read notifications, after two weeks
  delete from public.notifications where read and created_at < now() - interval '14 days';
  get diagnostics n = row_count;

  -- 3a · draft offers that passed with nobody booked and nothing under them
  delete from public.offers o
   where o.status = 'draft' and o.starts_at is not null and o.starts_at < now() - interval '2 days'
     and not exists (select 1 from public.bookings b where b.offer_id = o.id)
     and not exists (select 1 from public.offers k where k.parent_id = o.id)
     and not exists (select 1 from public.passport_stamps s where s.kind = 'offer' and s.event_id = o.id);
  get diagnostics o = row_count;

  -- 3b · plans that passed (or were called off) with only their host in them
  delete from public.green_gatherings x
   where coalesce(x.cancelled_at, x.starts_at + make_interval(mins => coalesce(x.minutes, 120))) < now() - interval '2 days'
     and not exists (select 1 from public.green_joins j where j.gathering_id = x.id and j.user_id <> x.host_id)
     and not exists (select 1 from public.passport_stamps s where s.kind = 'gathering' and s.event_id = x.id);
  get diagnostics g = row_count;

  -- 4 · Lamma rooms after 12 hours
  delete from public.game_rooms where created_at < now() - interval '12 hours';
  get diagnostics r = row_count;

  return jsonb_build_object('table_chat_messages', c, 'table_chat_files', f, 'read_notifications', n,
                            'draft_offers', o, 'empty_plans', g, 'lamma_rooms', r);
end $$;
revoke all on function public.auto_cleanup() from public, anon, authenticated;

do $do$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'auto-cleanup';
  perform cron.schedule('auto-cleanup', '0 3 * * *', 'select public.auto_cleanup()');
exception when others then raise notice 'pg_cron skipped: %', sqlerrm;
end $do$;
