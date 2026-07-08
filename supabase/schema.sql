-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Database schema v1
--  Paste this whole file into: Supabase Dashboard → SQL Editor → Run
--  Covers phase 1 (auth + profiles) and the tables the app will
--  grow into next (posts, squads).
-- ─────────────────────────────────────────────────────────────

-- ── PROFILES · one row per auth user ─────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  handle     text unique,
  emoji      text default '🧿',
  avatar_url text,
  bio        text,
  intent     text,                       -- shows on the live-map pin, e.g. 'Yala Hike! ⛰️'
  verified   boolean default false,
  lat        double precision,           -- live map pin
  lng        double precision,
  created_at timestamptz default now()
);

-- Auto-create a profile whenever someone signs up.
-- The app passes { name } in auth metadata (see src/services/auth.js).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Explorer'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── POSTS · the feed (phase 3) ────────────────────────────────
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'post' check (type in ('post','reel','vod')),
  media_url  text,
  text_bg    text,                     -- colored canvas id for text-only posts
  caption    text,
  place      text,
  lat        double precision,
  lng        double precision,
  starts_at  timestamptz,
  squad_name text,
  created_at timestamptz default now()
);

-- Safe upgrade for databases created before text backgrounds existed.
alter table public.posts add column if not exists text_bg text;

-- ── SQUADS · created by "JOIN THE VIBE" (phase 4) ────────────
create table if not exists public.squads (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts(id) on delete set null,
  name       text not null,
  emoji      text default '🏕️',
  created_at timestamptz default now()
);

create table if not exists public.squad_members (
  squad_id  uuid references public.squads(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (squad_id, user_id)
);

-- ── VIBES · one tap per user per post (the ⚡ reaction) ───────
create table if not exists public.post_vibes (
  post_id    uuid references public.posts(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- ── COMMENTS · what people write under a post ────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- The golden rule: everyone can look, only owners can touch.

alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.squads        enable row level security;
alter table public.squad_members enable row level security;
alter table public.post_vibes    enable row level security;
alter table public.comments      enable row level security;

-- Profiles: public read, self-service write
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Posts: public read, author-only write
create policy "posts are viewable by everyone"
  on public.posts for select using (true);
create policy "users can create own posts"
  on public.posts for insert with check (auth.uid() = user_id);
create policy "users can update own posts"
  on public.posts for update using (auth.uid() = user_id);
create policy "users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Squads: public read; any signed-in user can create one
create policy "squads are viewable by everyone"
  on public.squads for select using (true);
create policy "signed-in users can create squads"
  on public.squads for insert with check (auth.uid() is not null);

-- Membership: public read; you can only join/leave as yourself
create policy "squad members are viewable by everyone"
  on public.squad_members for select using (true);
create policy "users join squads as themselves"
  on public.squad_members for insert with check (auth.uid() = user_id);
create policy "users can leave squads"
  on public.squad_members for delete using (auth.uid() = user_id);

-- Vibes: public read; react/unreact only as yourself
create policy "vibes are viewable by everyone"
  on public.post_vibes for select using (true);
create policy "users vibe as themselves"
  on public.post_vibes for insert with check (auth.uid() = user_id);
create policy "users can remove own vibe"
  on public.post_vibes for delete using (auth.uid() = user_id);

-- Comments: public read; write/delete only your own
create policy "comments are viewable by everyone"
  on public.comments for select using (true);
create policy "users comment as themselves"
  on public.comments for insert with check (auth.uid() = user_id);
create policy "users can delete own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- ── STORAGE · photos for posts ────────────────────────────────
-- Create a PUBLIC bucket named  media  (Dashboard → Storage → New bucket),
-- then run these policies so users can upload into their own folder:
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

create policy "media is publicly readable"
  on storage.objects for select using (bucket_id = 'media');
create policy "users upload media to own folder"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
