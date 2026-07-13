-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Schema v7 — Indie Music Hub + country identity
--  Run in: Supabase Dashboard → SQL Editor → Run (safe to re-run)
--
--  A home for independent producers' original tracks. Per the spec,
--  tracks are categorized by their AUDITORY CHARACTERISTICS (BPM,
--  mood, key, timbre, instruments) — never by mainstream artist names,
--  so discovery is by *how it sounds and feels*, and it stays free of
--  licensed/restricted catalogues.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.tracks (
  id           uuid primary key default gen_random_uuid(),
  uploader_id  uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  audio_url    text not null,                 -- stored in R2 / Supabase Storage
  cover_emoji  text default '🎵',
  duration_sec int,
  -- auditory characteristics (the ONLY way tracks are categorized)
  bpm          int,
  music_key    text,                          -- e.g. 'A minor'
  mood         text,                          -- e.g. 'dreamy', 'hype', 'melancholic'
  timbre       text,                          -- e.g. 'warm', 'bright', 'gritty'
  instruments  text[],                        -- e.g. {guitar, synth, 808}
  genre_shape  text,                          -- descriptive, not artist: 'melodic trap', 'lo-fi', 'acoustic'
  uses_count   int default 0,
  created_at   timestamptz default now()
);

alter table public.tracks enable row level security;

drop policy if exists "tracks are public" on public.tracks;
create policy "tracks are public" on public.tracks for select using (true);
drop policy if exists "producers upload own tracks" on public.tracks;
create policy "producers upload own tracks"
  on public.tracks for insert with check (auth.uid() = uploader_id);
drop policy if exists "producers manage own tracks" on public.tracks;
create policy "producers manage own tracks"
  on public.tracks for update using (auth.uid() = uploader_id);
drop policy if exists "producers delete own tracks" on public.tracks;
create policy "producers delete own tracks"
  on public.tracks for delete using (auth.uid() = uploader_id);

-- Handy discovery indexes (by feel, not by name)
create index if not exists tracks_mood_idx on public.tracks (mood);
create index if not exists tracks_bpm_idx  on public.tracks (bpm);

-- Country identity — powers the flag on your map avatar (the light,
-- honest version of the "national outfit avatar" idea).
alter table public.profiles add column if not exists country text;      -- ISO name, e.g. 'Egypt'
alter table public.profiles add column if not exists country_flag text; -- emoji flag, e.g. '🇪🇬'
