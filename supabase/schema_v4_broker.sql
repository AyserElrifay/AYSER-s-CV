-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Schema v4 — the broker layer
--  Run in: Supabase Dashboard → SQL Editor → Run (safe to re-run)
--
--  Every outbound click to a partner (Waffarha, Booking, Groupon…)
--  is logged here. This is your proof-of-referral: the data you take
--  to each partner's affiliate program to claim your 10–20%, and the
--  base for paying users their $MOMENT cashback.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.partner_clicks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  partner    text not null,          -- 'waffarha' | 'booking' | 'groupon' | ...
  deal_id    text,                   -- which card was clicked
  url        text not null,
  created_at timestamptz default now()
);

alter table public.partner_clicks enable row level security;

drop policy if exists "users log own clicks" on public.partner_clicks;
create policy "users log own clicks"
  on public.partner_clicks for insert with check (auth.uid() = user_id);
drop policy if exists "users see own clicks" on public.partner_clicks;
create policy "users see own clicks"
  on public.partner_clicks for select using (auth.uid() = user_id);
-- (You see ALL clicks from the Supabase dashboard — that's your report.)

-- Members of a gathering (join a campfire/moment on the map, for real)
create table if not exists public.campfire_members (
  campfire_id uuid references public.campfires(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  joined_at   timestamptz default now(),
  primary key (campfire_id, user_id)
);

alter table public.campfire_members enable row level security;

drop policy if exists "campfire members are viewable by everyone" on public.campfire_members;
create policy "campfire members are viewable by everyone"
  on public.campfire_members for select using (true);
drop policy if exists "users join campfires as themselves" on public.campfire_members;
create policy "users join campfires as themselves"
  on public.campfire_members for insert with check (auth.uid() = user_id);
drop policy if exists "users can leave campfires" on public.campfire_members;
create policy "users can leave campfires"
  on public.campfire_members for delete using (auth.uid() = user_id);
