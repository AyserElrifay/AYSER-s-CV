-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Database schema v2 — going fully live
--  Run AFTER schema.sql. Paste into: Supabase Dashboard → SQL Editor → Run.
--  Safe to re-run (every policy is dropped before it's recreated).
--
--  Adds: real live locations (the map), real venues (bookings),
--  real campfires (live rooms), real chat messages (DMs + squads),
--  and language-exchange profile fields.
-- ─────────────────────────────────────────────────────────────

-- ── LIVE LOCATIONS · one row per user = their current pin on the map ──
create table if not exists public.live_locations (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  doing      text,                    -- the activity emoji shown on the pin
  updated_at timestamptz default now()
);

alter table public.live_locations enable row level security;

drop policy if exists "live locations are viewable by everyone" on public.live_locations;
create policy "live locations are viewable by everyone"
  on public.live_locations for select using (true);
drop policy if exists "users upsert own location" on public.live_locations;
create policy "users upsert own location"
  on public.live_locations for insert with check (auth.uid() = user_id);
drop policy if exists "users update own location" on public.live_locations;
create policy "users update own location"
  on public.live_locations for update using (auth.uid() = user_id);
drop policy if exists "users can go invisible" on public.live_locations;
create policy "users can go invisible"
  on public.live_locations for delete using (auth.uid() = user_id);

-- ── VENUES · real bookings (courts, hotels, restaurants, experiences).
--    Business owners apply; status starts 'pending' and a human flips
--    it to 'live' after review — same principle as certified courses. ──
create table if not exists public.venues (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references public.profiles(id) on delete set null,
  name       text not null,
  kind       text,                    -- 'Sport' | 'Stay' | 'Experience' | 'Food'
  emoji      text default '📍',
  sub        text,                    -- e.g. 'Next slot 6PM · 4 players'
  price      text,
  lat        double precision,
  lng        double precision,
  status     text not null default 'pending' check (status in ('pending','live','rejected')),
  created_at timestamptz default now()
);

alter table public.venues enable row level security;

drop policy if exists "live venues are viewable by everyone" on public.venues;
create policy "live venues are viewable by everyone"
  on public.venues for select using (status = 'live' or auth.uid() = owner_id);
drop policy if exists "signed-in users can apply as a venue" on public.venues;
create policy "signed-in users can apply as a venue"
  on public.venues for insert with check (auth.uid() = owner_id);
drop policy if exists "owners can update own pending venue" on public.venues;
create policy "owners can update own pending venue"
  on public.venues for update using (auth.uid() = owner_id);

-- ── CAMPFIRES · real live rooms. Live = ended_at is null. ──────
create table if not exists public.campfires (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  topic      text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz default now(),
  ended_at   timestamptz
);

alter table public.campfires enable row level security;

drop policy if exists "live campfires are viewable by everyone" on public.campfires;
create policy "live campfires are viewable by everyone"
  on public.campfires for select using (ended_at is null or host_id = auth.uid());
drop policy if exists "users can host a campfire" on public.campfires;
create policy "users can host a campfire"
  on public.campfires for insert with check (auth.uid() = host_id);
drop policy if exists "hosts can end own campfire" on public.campfires;
create policy "hosts can end own campfire"
  on public.campfires for update using (auth.uid() = host_id);

-- ── DIRECT MESSAGES · thread + participants, so RLS can check
--    membership the same way squad_members already does. ──────
create table if not exists public.dm_threads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists public.dm_participants (
  thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  primary key (thread_id, user_id)
);

alter table public.dm_threads      enable row level security;
alter table public.dm_participants enable row level security;

drop policy if exists "participants can view their dm threads" on public.dm_threads;
create policy "participants can view their dm threads"
  on public.dm_threads for select using (
    exists (select 1 from public.dm_participants p where p.thread_id = id and p.user_id = auth.uid())
  );

drop policy if exists "participants are viewable by thread members" on public.dm_participants;
create policy "participants are viewable by thread members"
  on public.dm_participants for select using (
    exists (select 1 from public.dm_participants p2 where p2.thread_id = thread_id and p2.user_id = auth.uid())
  );

-- Finds (or creates) the 1:1 DM thread with another user. Security
-- definer so it can insert the thread + both participant rows safely.
create or replace function public.get_or_create_dm_thread(other_user uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  found_id uuid;
  new_id   uuid;
begin
  select p1.thread_id into found_id
  from public.dm_participants p1
  join public.dm_participants p2 on p1.thread_id = p2.thread_id
  where p1.user_id = auth.uid() and p2.user_id = other_user
  limit 1;

  if found_id is not null then
    return found_id;
  end if;

  insert into public.dm_threads default values returning id into new_id;
  insert into public.dm_participants (thread_id, user_id) values (new_id, auth.uid());
  insert into public.dm_participants (thread_id, user_id) values (new_id, other_user);
  return new_id;
end;
$$;

-- ── MESSAGES · one table for both squad chat and DMs ───────────
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  squad_id      uuid references public.squads(id) on delete cascade,
  dm_thread_id  uuid references public.dm_threads(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  body          text not null,
  created_at    timestamptz default now(),
  constraint messages_exactly_one_thread check (
    (squad_id is not null and dm_thread_id is null) or
    (squad_id is null and dm_thread_id is not null)
  )
);

alter table public.messages enable row level security;

drop policy if exists "squad members read squad messages" on public.messages;
create policy "squad members read squad messages"
  on public.messages for select using (
    (squad_id is not null and exists (
      select 1 from public.squad_members m where m.squad_id = messages.squad_id and m.user_id = auth.uid()
    ))
    or
    (dm_thread_id is not null and exists (
      select 1 from public.dm_participants p where p.thread_id = messages.dm_thread_id and p.user_id = auth.uid()
    ))
  );

drop policy if exists "squad members send squad messages" on public.messages;
create policy "squad members send squad messages"
  on public.messages for insert with check (
    auth.uid() = user_id and (
      (squad_id is not null and exists (
        select 1 from public.squad_members m where m.squad_id = messages.squad_id and m.user_id = auth.uid()
      ))
      or
      (dm_thread_id is not null and exists (
        select 1 from public.dm_participants p where p.thread_id = messages.dm_thread_id and p.user_id = auth.uid()
      ))
    )
  );

-- ── LANGUAGE EXCHANGE · opt-in fields on your own profile ──────
alter table public.profiles add column if not exists speaks_language text;
alter table public.profiles add column if not exists learning_language text;
alter table public.profiles add column if not exists learning_level text;
alter table public.profiles add column if not exists learning_visible boolean default false;

-- ── REALTIME · so the map, chat and nearby-people update live ──
-- (wrapped so re-running this script never fails if already added)
do $$
begin
  begin
    alter publication supabase_realtime add table public.live_locations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.campfires;
  exception when duplicate_object then null;
  end;
end $$;
