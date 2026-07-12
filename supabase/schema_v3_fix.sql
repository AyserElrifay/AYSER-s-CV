-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Schema v3 — the posting fix
--  Run in: Supabase Dashboard → SQL Editor → Run (safe to re-run)
--
--  Problem: accounts created BEFORE the signup trigger existed have no
--  profiles row, so every insert that references it (posts, stories,
--  vibes, comments) fails → "posting doesn't respond".
--  Fix: (1) backfill profiles for all existing users,
--       (2) let users create their own profile row (self-heal),
--       (3) make sure the media bucket exists for photo/video uploads.
-- ─────────────────────────────────────────────────────────────

-- 1) Backfill: every existing auth user gets a profile right now
insert into public.profiles (id, name)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Explorer')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2) Self-heal policy: a signed-in user may insert their OWN row
drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- 3) Media bucket (photos, reels, stories) — in case v1 stopped early
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists "media is publicly readable" on storage.objects;
create policy "media is publicly readable"
  on storage.objects for select using (bucket_id = 'media');
drop policy if exists "users upload media to own folder" on storage.objects;
create policy "users upload media to own folder"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
