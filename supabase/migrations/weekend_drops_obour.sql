-- THE OBOUR RUN'S MEETING POINT (once) — Ayser: "اعمل انت كل حاجه".
-- No public running track in Obour could be confirmed, so the run meets at
-- the one landmark every Obour resident knows: the entrance of Avenue Mall.
do $do$
begin
  if exists (select 1 from public.app_settings where key = 'drops_obour_v1') then return; end if;
  update public.offers set neighborhood = 'El Obour — Avenue Mall entrance', neighborhood_ar = 'العبور — مدخل أفينيو مول', updated_at = now()
   where is_drop and status = 'draft' and title = 'Friday morning run & English coffee'
     and (coalesce(neighborhood, '') || ' ' || coalesce(neighborhood_ar, '')) ~ '(SET THE|CONFIRM|حدّد|أكّد)';
  insert into public.drop_venues (offer_id, name)
  select id, 'Avenue Mall entrance, El Obour' from public.offers where is_drop and title = 'Friday morning run & English coffee'
  on conflict (offer_id) do update set name = coalesce(public.drop_venues.name, excluded.name);
  insert into public.app_settings (key, value) values ('drops_obour_v1', jsonb_build_object('at', now()));
end $do$;
