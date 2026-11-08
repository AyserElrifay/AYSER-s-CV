-- ════════════════════════════════════════════════════════════════════
--  A NIGHT ON THE NILE, IN THE HOME HERO (once)
--  Ayser, November 2026, sent his own video and two photos from a night
--  on a Nile boat, and confirmed that everyone in them agreed ("الناس
--  تمام") — the condition for app_highlights (consent_at). Served from
--  the site (public/media), location data stripped; newest first, so the
--  video leads.
-- ════════════════════════════════════════════════════════════════════
do $do$
declare owner uuid;
begin
  if exists (select 1 from public.app_settings where key = 'highlights_nile_v1') then return; end if;
  select u.id into owner from auth.users u where lower(u.email) = 'ayseryourlifecoach@gmail.com' limit 1;
  insert into public.app_highlights (media_url, poster_url, kind, caption, consent_at, added_by, live, created_at) values
    ('https://therealmoments.com/media/nile-boat.mp4',      'https://therealmoments.com/media/nile-boat.webp',      'video', 'A night on the Nile', now(), owner, true, now()),
    ('https://therealmoments.com/media/nile-friends-1.webp', 'https://therealmoments.com/media/nile-friends-1.webp', 'photo', 'A night on the Nile', now(), owner, true, now() - interval '1 second'),
    ('https://therealmoments.com/media/nile-friends-2.webp', 'https://therealmoments.com/media/nile-friends-2.webp', 'photo', 'A night on the Nile', now(), owner, true, now() - interval '2 seconds');
  insert into public.app_settings (key, value) values ('highlights_nile_v1', jsonb_build_object('at', now()));
end $do$;
