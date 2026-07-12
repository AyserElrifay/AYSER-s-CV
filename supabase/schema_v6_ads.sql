-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Schema v6 — Ads, Boosts & the Feedback Factor
--  Run in: Supabase Dashboard → SQL Editor → Run (safe to re-run)
--
--  Paid Boost: a venue pays to rank first (Top of Search / Promoted
--  Pin / Featured Collection), always shown labeled "Sponsored".
--  Feedback Factor: a venue's rating changes its ad price — great
--  places pay LESS per click, bad places pay MORE or get blocked.
-- ─────────────────────────────────────────────────────────────

-- Ratings live on the venue (kept in sync by the trigger below)
alter table public.venues add column if not exists rating       numeric(3,2) default 0;
alter table public.venues add column if not exists rating_count integer default 0;

-- Reviews people leave on a venue
create table if not exists public.venue_reviews (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  body       text,
  created_at timestamptz default now(),
  unique (venue_id, user_id)   -- one review per person per venue
);

alter table public.venue_reviews enable row level security;
drop policy if exists "reviews are public" on public.venue_reviews;
create policy "reviews are public" on public.venue_reviews for select using (true);
drop policy if exists "users write own review" on public.venue_reviews;
create policy "users write own review" on public.venue_reviews for insert with check (auth.uid() = user_id);
drop policy if exists "users edit own review" on public.venue_reviews;
create policy "users edit own review" on public.venue_reviews for update using (auth.uid() = user_id);

-- Recompute a venue's rating whenever a review changes
create or replace function public.recompute_venue_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  v := coalesce(new.venue_id, old.venue_id);
  update public.venues set
    rating = coalesce((select round(avg(stars)::numeric, 2) from public.venue_reviews where venue_id = v), 0),
    rating_count = (select count(*) from public.venue_reviews where venue_id = v)
  where id = v;
  return null;
end; $$;

drop trigger if exists on_review_change on public.venue_reviews;
create trigger on_review_change
  after insert or update or delete on public.venue_reviews
  for each row execute procedure public.recompute_venue_rating();

-- Paid boosts (the ad campaigns)
create table if not exists public.boosts (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references public.venues(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  product     text not null check (product in ('top_search','promoted_pin','featured_collection')),
  budget      numeric(10,2) not null,          -- total budget in the paid currency
  currency    text default 'EGP',
  cpc         numeric(10,2) not null,          -- price per click after the Feedback Factor
  provider    text,                            -- paymob | moyasar | paytabs | paddle
  payment_ref text,                            -- gateway reference once paid
  status      text not null default 'pending' check (status in ('pending','active','paused','ended','rejected')),
  starts_at   timestamptz default now(),
  ends_at     timestamptz,
  created_at  timestamptz default now()
);

alter table public.boosts enable row level security;
drop policy if exists "active boosts are public" on public.boosts;
create policy "active boosts are public"
  on public.boosts for select using (status = 'active' or auth.uid() = owner_id);
drop policy if exists "owners create boosts" on public.boosts;
create policy "owners create boosts"
  on public.boosts for insert with check (auth.uid() = owner_id);
drop policy if exists "owners manage boosts" on public.boosts;
create policy "owners manage boosts"
  on public.boosts for update using (auth.uid() = owner_id);

-- Payments ledger (what the payment gateway confirmed → your revenue)
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  kind        text not null,          -- 'boost' | 'booking' | ...
  ref_id      uuid,                   -- boost id / booking id
  provider    text not null,          -- paymob | moyasar | paytabs | paddle
  amount      numeric(10,2) not null,
  currency    text default 'EGP',
  commission  numeric(10,2),          -- Moments' cut
  status      text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider_ref text,
  created_at  timestamptz default now()
);

alter table public.payments enable row level security;
drop policy if exists "users see own payments" on public.payments;
create policy "users see own payments" on public.payments for select using (auth.uid() = user_id);
drop policy if exists "users create own payments" on public.payments;
create policy "users create own payments" on public.payments for insert with check (auth.uid() = user_id);
-- (Status flips to 'paid' from a server-side webhook using the service key.)
