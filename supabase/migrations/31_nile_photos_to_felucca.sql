-- ════════════════════════════════════════════════════════════════════
--  THE TWO NILE PHOTOS MOVE FROM THE HERO TO THE FELUCCA DROP (once)
--  Ayser, November 2026: "شيل الصور دي من هنا ممكن تحطهم في الخروجات".
--  The hero keeps the boat video; the two photos (everyone in them
--  agreed — 30_highlights_nile_night.sql) are taken out of it (live =
--  false, kept) and shown on the "Sunset felucca on the Nile" card
--  (offers.photos, drops_list 'photos').
-- ════════════════════════════════════════════════════════════════════
do $do$
begin
  if exists (select 1 from public.app_settings where key = 'nile_photos_to_felucca_v1') then return; end if;
  update public.app_highlights set live = false
   where media_url in ('https://therealmoments.com/media/nile-friends-1.webp', 'https://therealmoments.com/media/nile-friends-2.webp');
  update public.offers
     set photos = array['https://therealmoments.com/media/nile-friends-1.webp', 'https://therealmoments.com/media/nile-friends-2.webp'], updated_at = now()
   where is_drop and title = 'Sunset felucca on the Nile';
  insert into public.app_settings (key, value) values ('nile_photos_to_felucca_v1', jsonb_build_object('at', now()));
end $do$;
