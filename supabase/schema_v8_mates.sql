-- ════════════════════════════════════════════════════════════════
--  MOMENTS · schema v8 — MATES (friends) + owner delete policies
--  Run AFTER schema.sql … schema_v7_music.sql. Idempotent.
-- ════════════════════════════════════════════════════════════════

-- ── MATES · the friend graph ─────────────────────────────────────
-- One row per request. status: 'pending' → 'accepted'.
-- (requester_id, addressee_id) unique so you can't spam requests.
create table if not exists public.mates (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.mates enable row level security;

drop policy if exists "mates readable by participants" on public.mates;
create policy "mates readable by participants" on public.mates
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "send own mate requests" on public.mates;
create policy "send own mate requests" on public.mates
  for insert with check (auth.uid() = requester_id);

drop policy if exists "addressee can accept" on public.mates;
create policy "addressee can accept" on public.mates
  for update using (auth.uid() = addressee_id);

drop policy if exists "participants can unmate" on public.mates;
create policy "participants can unmate" on public.mates
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

create index if not exists mates_addressee_idx on public.mates (addressee_id, status);
create index if not exists mates_requester_idx on public.mates (requester_id, status);

-- ── OWNER DELETE · you can remove your own posts & stories ───────
drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts
  for delete using (auth.uid() = user_id);

drop policy if exists "delete own stories" on public.stories;
create policy "delete own stories" on public.stories
  for delete using (auth.uid() = user_id);
