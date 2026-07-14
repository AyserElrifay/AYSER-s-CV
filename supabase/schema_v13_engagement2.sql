-- ════════════════════════════════════════════════════════════════
--  MOMENTS · schema v13 — persistent REPOSTS + JOINS
--  With this, every interaction on a post survives refresh:
--  stars (v1) + comments (v1) + laughs (v9) + reposts + joins.
--  Idempotent.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.post_reposts (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reposts enable row level security;
drop policy if exists "reposts readable by everyone" on public.post_reposts;
create policy "reposts readable by everyone" on public.post_reposts for select using (true);
drop policy if exists "repost as yourself" on public.post_reposts;
create policy "repost as yourself" on public.post_reposts for insert with check (auth.uid() = user_id);
drop policy if exists "unrepost yourself" on public.post_reposts;
create policy "unrepost yourself" on public.post_reposts for delete using (auth.uid() = user_id);
create index if not exists post_reposts_post_idx on public.post_reposts (post_id);

create table if not exists public.post_joins (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_joins enable row level security;
drop policy if exists "joins readable by everyone" on public.post_joins;
create policy "joins readable by everyone" on public.post_joins for select using (true);
drop policy if exists "join as yourself" on public.post_joins;
create policy "join as yourself" on public.post_joins for insert with check (auth.uid() = user_id);
drop policy if exists "unjoin yourself" on public.post_joins;
create policy "unjoin yourself" on public.post_joins for delete using (auth.uid() = user_id);
create index if not exists post_joins_post_idx on public.post_joins (post_id);
