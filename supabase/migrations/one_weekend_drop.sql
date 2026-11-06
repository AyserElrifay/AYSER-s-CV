-- ════════════════════════════════════════════════════════════════════
--  ONE WEEKEND DROP · THE OLD WEEKLY PLANS STEP ASIDE (once)
--  Ayser, November 2026: "The Together feed is diluted with too many
--  empty events … concentrate user density into a single successful
--  drop". The six weekly plans seeded in RUN_ME.sql ("The first week,
--  hosted by Ayser") stop repeating — paused, not deleted: switching
--  `active` back on in green_weekly brings any of them back.
--  Their dates still to come are called off ONLY where nobody but the
--  host has a seat; a date somebody claimed stays, and shows for them.
--  Runs once (app_settings 'one_drop_cleanup'), so a plan turned back
--  on later is never paused again by the next deploy.
-- ════════════════════════════════════════════════════════════════════

do $do$
declare titles text[] := array[
  'Morning walk & pick-up · مشي الصبح ولمّ الزبالة',
  'Language exchange circle · دايرة تبادل لغات',
  'Football in the park · كورة في الجنينة',
  'Sketching by the Nile · رسم على النيل',
  'Opera night · ليلة أوبرا',
  'Sunset walk on the corniche · تمشية الغروب على الكورنيش'];
  paused int := 0; called_off int := 0;
begin
  if exists (select 1 from public.app_settings where key = 'one_drop_cleanup') then
    raise notice 'one weekend drop: already done';
    return;
  end if;

  update public.green_weekly set active = false where title = any(titles) and active;
  get diagnostics paused = row_count;

  update public.green_gatherings g set cancelled_at = now()
   where g.cancelled_at is null
     and g.starts_at > now()
     and g.weekly_id in (select w.id from public.green_weekly w where w.title = any(titles))
     and not exists (select 1 from public.green_joins j where j.gathering_id = g.id and j.user_id <> g.host_id);
  get diagnostics called_off = row_count;

  insert into public.app_settings (key, value)
  values ('one_drop_cleanup', jsonb_build_object('at', now(), 'paused_series', paused, 'called_off_dates', called_off));
  raise notice 'one weekend drop: % series paused, % empty dates called off', paused, called_off;
end $do$;
