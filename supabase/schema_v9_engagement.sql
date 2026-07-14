-- ════════════════════════════════════════════════════════════════
--  MOMENTS · schema v9 — persistent 😂 laughs
--  Stars (post_vibes) and comments already persist; this adds laughs
--  so every reaction survives refresh. Idempotent.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.post_laughs (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_laughs enable row level security;

drop policy if exists "laughs readable by everyone" on public.post_laughs;
create policy "laughs readable by everyone" on public.post_laughs
  for select using (true);

drop policy if exists "laugh as yourself" on public.post_laughs;
create policy "laugh as yourself" on public.post_laughs
  for insert with check (auth.uid() = user_id);

drop policy if exists "unlaugh yourself" on public.post_laughs;
create policy "unlaugh yourself" on public.post_laughs
  for delete using (auth.uid() = user_id);

create index if not exists post_laughs_post_idx on public.post_laughs (post_id);
