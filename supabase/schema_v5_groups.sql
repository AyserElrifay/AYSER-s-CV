-- ─────────────────────────────────────────────────────────────
--  MOMENTS · Schema v5 — real Groups (create / join / leave)
--  Run in: Supabase Dashboard → SQL Editor → Run (safe to re-run)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  emoji       text default '🌐',
  about       text,
  created_at  timestamptz default now()
);

create table if not exists public.group_members (
  group_id  uuid references public.groups(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- Anyone can discover groups
drop policy if exists "groups are viewable by everyone" on public.groups;
create policy "groups are viewable by everyone"
  on public.groups for select using (true);
drop policy if exists "signed-in users create groups" on public.groups;
create policy "signed-in users create groups"
  on public.groups for insert with check (auth.uid() = owner_id);
drop policy if exists "owners update own group" on public.groups;
create policy "owners update own group"
  on public.groups for update using (auth.uid() = owner_id);
drop policy if exists "owners delete own group" on public.groups;
create policy "owners delete own group"
  on public.groups for delete using (auth.uid() = owner_id);

-- Membership: public read, join/leave only as yourself
drop policy if exists "group members are viewable by everyone" on public.group_members;
create policy "group members are viewable by everyone"
  on public.group_members for select using (true);
drop policy if exists "users join groups as themselves" on public.group_members;
create policy "users join groups as themselves"
  on public.group_members for insert with check (auth.uid() = user_id);
drop policy if exists "users leave groups" on public.group_members;
create policy "users leave groups"
  on public.group_members for delete using (auth.uid() = user_id);

-- Auto-add the creator as the first member
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- Live member counts for the discovery list
create or replace view public.groups_with_counts as
  select g.*, coalesce(m.cnt, 0) as members_count
  from public.groups g
  left join (
    select group_id, count(*) as cnt from public.group_members group by group_id
  ) m on m.group_id = g.id;
