-- ════════════════════════════════════════════════════════════════════
--  THIS FRIDAY'S DROP OPENS BY ITSELF (pg_cron, every day 07:00 UTC)
--  Ayser, November 2026: "أي حاجة ممكن تعملها أوتوماتيك اعملها". The
--  weeks ahead wait as drafts (10_weekend_drops_plan.sql). Every day (it was
--  Mondays; "فين الخروجة" on a Sunday said that was too late) the
--  draft Drops of the next 7 days whose place is written (no "SET THE",
--  "CONFIRM", "حدّد", "أكّد") are published — so the only thing left to
--  do by hand is to write the place. A draft still missing its place
--  stays a draft and nobody sees it. Everybody in the Drop's country gets
--  one "a Drop opened" notification. Returns what it published and told.
--  Also: the kayak draft gets the place Ayser chose (Zamalek), once.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.drops_autopublish()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ids uuid[]; told int := 0;
begin
  with up as (
    update public.offers o set status = 'live', updated_at = now()
     where o.is_drop and o.status = 'draft' and o.parent_id is null
       and o.starts_at > now() + interval '12 hours' and o.starts_at < now() + interval '7 days'
       and coalesce(o.neighborhood, '') <> ''
       and (coalesce(o.neighborhood, '') || ' ' || coalesce(o.neighborhood_ar, '')) !~ '(SET THE|CONFIRM|حدّد|أكّد)'
    returning o.id)
  select array_agg(id) into ids from up;
  /* and everybody in that country hears it once — the same "a Drop
     opened" the waitlist gets (kind drop_open, opens Together); not who
     already holds a seat, never twice for one Drop */
  insert into public.notifications (user_id, actor_id, kind, body)
  select p.id, p.id, 'drop_open', o.id::text || '|' || left(coalesce(o.title_ar, o.title, ''), 80) || '|new'
    from public.offers o
    join public.profiles p on (p.country is null or upper(p.country) in (upper(coalesce(o.country, 'EG')), 'EGYPT', 'مصر'))
   where o.id = any(coalesce(ids, '{}'::uuid[]))
     and not exists (select 1 from public.notifications n where n.user_id = p.id and n.kind = 'drop_open' and n.body like o.id::text || '|%')
     and not exists (select 1 from public.bookings b where b.offer_id = o.id and b.user_id = p.id and b.status in ('reserved','paid','attended'));
  get diagnostics told = row_count;
  /* the owner, a week ahead (and at once for one closer than that): book
     the place for ten. Once per Drop. Draft or live — the table has to be
     booked either way. */
  insert into public.notifications (user_id, actor_id, kind, body)
  select ow.id, ow.id, 'drop_open',
         o.id::text || '|' || left(coalesce(o.title_ar, o.title, ''), 60) || ' — ' || left(coalesce(v.name, o.neighborhood_ar, o.neighborhood, ''), 60)
           || '، ' || to_char(o.starts_at at time zone 'Africa/Cairo', 'DD/MM HH24:MI') || '|book'
    from public.offers o
    left join public.drop_venues v on v.offer_id = o.id
    cross join (select u.id from auth.users u where lower(u.email) = 'ayseryourlifecoach@gmail.com' limit 1) ow
   where o.is_drop and o.parent_id is null and o.status in ('draft', 'live')
     and o.starts_at > now() + interval '12 hours' and o.starts_at < now() + interval '8 days'
     and not exists (select 1 from public.notifications n where n.user_id = ow.id and n.kind = 'drop_open' and n.body like o.id::text || '|%|book');
  -- and the morning after a Drop: how was it, and your photos (RUN_ME.sql "AFTER THE DROP")
  begin perform public.drops_after_ask(); exception when undefined_function then null; end;
  return jsonb_build_object('published', coalesce(array_length(ids, 1), 0), 'told', told, 'ids', to_jsonb(coalesce(ids, '{}'::uuid[])));
end $$;
revoke all on function public.drops_autopublish() from public, anon, authenticated;

do $do$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'drops-autopublish';
  perform cron.schedule('drops-autopublish', '0 7 * * *', 'select public.drops_autopublish()');
exception when others then raise notice 'pg_cron skipped: %', sqlerrm;
end $do$;

-- the kayak Friday: Zamalek (Ayser's choice), once
do $do$
begin
  if exists (select 1 from public.app_settings where key = 'drops_kayak_place_v1') then return; end if;
  update public.offers
     set neighborhood = 'Zamalek — Zamalek Kayak, Tala''ea El Gaish club',
         neighborhood_ar = 'الزمالك — Zamalek Kayak، نادي طلائع الجيش', updated_at = now()
   where is_drop and status = 'draft' and title = 'Kayak on the Nile';
  insert into public.drop_venues (offer_id, name)
  select id, 'Zamalek Kayak — Tala''ea El Gaish club, Abu El Feda St., Zamalek' from public.offers where is_drop and title = 'Kayak on the Nile'
  on conflict (offer_id) do update set name = excluded.name;
  insert into public.app_settings (key, value) values ('drops_kayak_place_v1', jsonb_build_object('at', now()));
end $do$;

-- and once now, on every deploy: what is due opens straight away (idempotent —
-- only drafts of the next 7 days with a place; nobody is told twice)
select public.drops_autopublish();
