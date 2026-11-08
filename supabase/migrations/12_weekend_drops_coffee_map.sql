-- ════════════════════════════════════════════════════════════════════
--  THE COFFEE DROP'S PIN (once)
--  Ayser, November 2026, sent the Google Maps link of Awlad Rizk café.
--  It becomes the venue's map link on the 13 November draft
--  ("Coffee with people you have not met yet") — the address the members
--  get when the place is revealed. The area name in the draft still has
--  to be written in the Studio before it can be published.
-- ════════════════════════════════════════════════════════════════════
do $do$
declare n int := 0;
begin
  if exists (select 1 from public.app_settings where key = 'drops_coffee_map_v1') then return; end if;
  insert into public.drop_venues (offer_id, name, map_url)
  select o.id, 'Awlad Rizk café', 'https://maps.app.goo.gl/ZyhDeje3kfFEpzrR8'
    from public.offers o
   where o.is_drop and o.title = 'Coffee with people you have not met yet'
  on conflict (offer_id) do update set map_url = excluded.map_url, name = coalesce(public.drop_venues.name, excluded.name);
  get diagnostics n = row_count;
  insert into public.app_settings (key, value) values ('drops_coffee_map_v1', jsonb_build_object('at', now(), 'rows', n));
end $do$;
