-- ════════════════════════════════════════════════════════════════
--  MOMENTS · schema v12 — TRIP REQUESTS (Book Trip form)
--  Far destinations get a "Book this trip" button; the form lands
--  here. You (the owner) see every request in Table Editor →
--  trip_requests, contact the person, arrange the trip, and take
--  your commission. Idempotent.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.trip_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  dest_id     text not null,          -- matches src/constants/destinations.js
  dest_name   text,
  full_name   text not null,
  phone       text not null,
  travel_date text,
  people      int  not null default 1 check (people between 1 and 50),
  notes       text,
  status      text not null default 'new' check (status in ('new','contacted','booked','cancelled')),
  created_at  timestamptz not null default now()
);

alter table public.trip_requests enable row level security;

drop policy if exists "request a trip as yourself" on public.trip_requests;
create policy "request a trip as yourself" on public.trip_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "see own trip requests" on public.trip_requests;
create policy "see own trip requests" on public.trip_requests
  for select using (auth.uid() = user_id);

create index if not exists trip_requests_status_idx on public.trip_requests (status, created_at desc);
