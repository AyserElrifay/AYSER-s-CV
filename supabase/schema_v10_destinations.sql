-- ════════════════════════════════════════════════════════════════
--  MOMENTS · schema v10 — destination reviews (community feedback
--  on the curated adventure spots). Idempotent.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.destination_reviews (
  id         uuid primary key default gen_random_uuid(),
  dest_id    text not null,                -- matches src/constants/destinations.js ids
  user_id    uuid not null references public.profiles(id) on delete cascade,
  stars      int  not null check (stars between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (dest_id, user_id)                -- one review per person per place (editable)
);

alter table public.destination_reviews enable row level security;

drop policy if exists "dest reviews readable by everyone" on public.destination_reviews;
create policy "dest reviews readable by everyone" on public.destination_reviews
  for select using (true);

drop policy if exists "review as yourself" on public.destination_reviews;
create policy "review as yourself" on public.destination_reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "edit own review" on public.destination_reviews;
create policy "edit own review" on public.destination_reviews
  for update using (auth.uid() = user_id);

drop policy if exists "delete own review" on public.destination_reviews;
create policy "delete own review" on public.destination_reviews
  for delete using (auth.uid() = user_id);

create index if not exists dest_reviews_dest_idx on public.destination_reviews (dest_id, created_at desc);
