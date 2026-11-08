-- ════════════════════════════════════════════════════════════════════
--  THE FELUCCA DROP GETS A REAL EVENING ON THE NILE (once)
--  Ayser, November 2026, sent his own clip of the Nile at night — water
--  and the far bank, nobody in it (public/media/nile-night.mp4, 5 s,
--  location data stripped). It plays behind the "Sunset felucca" draft
--  from weekend_drops_plan.sql. The other clip from that night shows
--  people's faces and is NOT used until each of them has agreed.
-- ════════════════════════════════════════════════════════════════════
do $do$
declare n int;
begin
  if exists (select 1 from public.app_settings where key = 'drops_nile_clip_v1') then return; end if;
  update public.offers set video_url = 'https://therealmoments.com/media/nile-night.mp4', updated_at = now()
   where is_drop and title = 'Sunset felucca on the Nile' and video_url is null;
  get diagnostics n = row_count;
  insert into public.app_settings (key, value) values ('drops_nile_clip_v1', jsonb_build_object('at', now(), 'rows', n));
end $do$;
