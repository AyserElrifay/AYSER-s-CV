-- ════════════════════════════════════════════════════════════════════
--  THE PLACES, CHOSEN (once)
--  Ayser, November 2026: "اعمله انت". The drafts that still said
--  "SET THE …"/"CONFIRM …" get a place, so drops_autopublish() opens each
--  on the Monday before its Friday:
--    13 Nov coffee     — Awlad Rizk café (his Google Maps pin is on it)
--    20 Nov felucca    — Zamalek corniche (same side as his Nile clip)
--     4 Dec escape room — Trapped Egypt, Mohandeseen (central for Cairo & Giza)
--    25 Dec trampoline — Bounce, Cairo Festival City (New Cairo)
--  The Obour run keeps "SET THE MEETING POINT": nobody here knows a real
--  one, and a made-up meeting point is worse than none.
-- ════════════════════════════════════════════════════════════════════
do $do$
declare r record;
begin
  if exists (select 1 from public.app_settings where key = 'drops_places_v1') then return; end if;
  for r in select * from (values
    ('Coffee with people you have not met yet', 'Awlad Rizk café',                    'كافيه أولاد رزق',                     null),
    ('Sunset felucca on the Nile',              'Zamalek — Nile corniche',            'الزمالك — كورنيش النيل',              'Felucca from the Zamalek corniche'),
    ('Escape room night (two rooms)',           'Mohandeseen — Trapped Egypt',        'المهندسين — Trapped Egypt',           'Trapped Egypt, Mohandeseen'),
    ('Trampoline park',                         'New Cairo — Bounce, Cairo Festival City', 'القاهرة الجديدة — Bounce، كايرو فستيفال سيتي', 'Bounce, Cairo Festival City Mall')
  ) as v(title, hood, hood_ar, venue)
  loop
    update public.offers set neighborhood = r.hood, neighborhood_ar = r.hood_ar, updated_at = now()
     where is_drop and status = 'draft' and title = r.title
       and (coalesce(neighborhood, '') || ' ' || coalesce(neighborhood_ar, '')) ~ '(SET THE|CONFIRM|حدّد|أكّد)';
    if r.venue is not null then
      insert into public.drop_venues (offer_id, name)
      select id, r.venue from public.offers where is_drop and title = r.title
      on conflict (offer_id) do update set name = coalesce(public.drop_venues.name, excluded.name);
    end if;
  end loop;
  insert into public.app_settings (key, value) values ('drops_places_v1', jsonb_build_object('at', now()));
end $do$;
