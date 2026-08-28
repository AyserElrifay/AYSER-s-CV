-- ═══════════════════════════════════════════════════════════════════
--  GROUPS GET A WALL
--
--  Ayser: "و خلي جروبي شبه جروبس الفيس بوك"
--
--  A group here was a name, an emoji, a sentence and a member count.
--  You could join it. Then nothing — there was nowhere for anything to
--  happen. A community with no wall is a list of names, and a list of
--  names gives nobody a reason to come back tomorrow.
--
--  ── WHAT MAKES A GROUP WORTH RETURNING TO ────────────────────────
--  Posts, from members, that other members answer. That is the whole
--  mechanism, and everything here exists to serve it:
--
--    group_posts           what somebody said, with a picture if they
--                          had one
--    group_post_comments   the answering, which is the part that keeps
--                          a group alive — a wall where nobody replies
--                          dies faster than one with no posts
--    group_post_likes      the cheap acknowledgement, for the many
--                          people who read and would never comment
--    group_reads           when you last looked, so the app can say
--                          "4 new posts" — the sentence that is the
--                          actual reason anybody opens a group again
--
--  ── TWO KINDS OF GROUP, AND ONLY TWO ─────────────────────────────
--  open      anyone can read the wall and joining is instant
--  request   only members can read the wall, and an admin lets you in
--
--  Facebook has three (public / private-visible / private-hidden) and
--  the middle one exists mostly to confuse people about what is
--  visible. Two kinds can be explained in one line each, which means
--  somebody posting knows who is going to see it. That is the only
--  thing that matters here.
--
--  ── WHY THE WRITES ARE FUNCTIONS AND NOT POLICIES ────────────────
--  Approving a member, making somebody an admin, removing somebody:
--  each of those is "am I allowed to do this TO SOMEONE ELSE", and
--  that question is answered here, by the server, in one place. A
--  policy expressive enough to cover them is a policy nobody can read
--  six months later — and an unreadable policy on somebody's private
--  group is not a risk worth taking to save three functions.
--
--  The owner's row is protected everywhere: an admin cannot demote or
--  remove the person whose group it is. Deleting the group is the
--  owner's move alone.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── THE GROUP ITSELF ───────────────────────────────────────────────
alter table public.groups add column if not exists cover_url text;
alter table public.groups add column if not exists city      text;
alter table public.groups add column if not exists rules     text;
alter table public.groups add column if not exists privacy   text not null default 'open';

alter table public.groups drop constraint if exists groups_privacy_known;
alter table public.groups add  constraint groups_privacy_known
  check (privacy in ('open', 'request'));

-- ── WHO IS IN IT, AND AS WHAT ──────────────────────────────────────
alter table public.group_members add column if not exists role   text not null default 'member';
alter table public.group_members add column if not exists status text not null default 'joined';

alter table public.group_members drop constraint if exists group_members_role_known;
alter table public.group_members add  constraint group_members_role_known
  check (role in ('owner', 'admin', 'member'));
alter table public.group_members drop constraint if exists group_members_status_known;
alter table public.group_members add  constraint group_members_status_known
  check (status in ('joined', 'requested'));

/* Everybody who made a group before this file existed is its owner and
   was stored as a plain member. Say so, once. */
update public.group_members m
   set role = 'owner'
  from public.groups g
 where g.id = m.group_id and g.owner_id = m.user_id and m.role <> 'owner';

create index if not exists group_members_user_idx  on public.group_members(user_id, status);
create index if not exists group_members_group_idx on public.group_members(group_id, status);

-- whoever makes a group is its first member, and its owner
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'joined')
  on conflict (group_id, user_id) do update set role = 'owner', status = 'joined';
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- ── THE WALL ───────────────────────────────────────────────────────
create table if not exists public.group_posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text,
  media_url  text,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);

/* A post with neither words nor a picture is not a post. */
alter table public.group_posts drop constraint if exists group_posts_says_something;
alter table public.group_posts add  constraint group_posts_says_something
  check (coalesce(nullif(btrim(body), ''), media_url) is not null);

alter table public.group_posts drop constraint if exists group_posts_body_sane;
alter table public.group_posts add  constraint group_posts_body_sane
  check (body is null or char_length(body) <= 5000);

create index if not exists group_posts_wall_idx on public.group_posts(group_id, created_at desc);

create table if not exists public.group_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.group_posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.group_post_comments drop constraint if exists group_comments_body_sane;
alter table public.group_post_comments add  constraint group_comments_body_sane
  check (btrim(body) <> '' and char_length(body) <= 2000);

create index if not exists group_comments_post_idx on public.group_post_comments(post_id, created_at);

create table if not exists public.group_post_likes (
  post_id    uuid not null references public.group_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

/* When you last looked. One row per person per group; the only reason
   it exists is to be able to say "4 new posts" truthfully. */
create table if not exists public.group_reads (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  seen_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ── WHO MAY SEE AND DO WHAT ────────────────────────────────────────
/* Both of these are security definer for the same reason the squad
   one is: a policy on group_members that reads group_members sends
   Postgres round in a circle. */
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
     where group_id = gid and user_id = uid and status = 'joined'
  );
$$;

create or replace function public.is_group_admin(gid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
     where group_id = gid and user_id = uid and status = 'joined'
       and role in ('owner', 'admin')
  );
$$;

create or replace function public.group_is_open(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups where id = gid and privacy = 'open');
$$;

alter table public.group_posts         enable row level security;
alter table public.group_post_comments enable row level security;
alter table public.group_post_likes    enable row level security;
alter table public.group_reads         enable row level security;

/* An open group's wall is readable by anyone — that is what open
   means, and it is how somebody decides whether to join. A request
   group's wall is readable by its members and nobody else. */
drop policy if exists "group wall is readable" on public.group_posts;
create policy "group wall is readable" on public.group_posts for select using (
  public.group_is_open(group_id) or public.is_group_member(group_id, auth.uid())
);

drop policy if exists "members post to their group" on public.group_posts;
create policy "members post to their group" on public.group_posts for insert with check (
  auth.uid() = author_id and public.is_group_member(group_id, auth.uid())
);

drop policy if exists "authors edit their own post" on public.group_posts;
create policy "authors edit their own post" on public.group_posts for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

/* Your own post is yours to take down. An admin can take down anything
   on their own wall — moderating a group you run is the job. */
drop policy if exists "authors and admins remove posts" on public.group_posts;
create policy "authors and admins remove posts" on public.group_posts for delete using (
  auth.uid() = author_id or public.is_group_admin(group_id, auth.uid())
);

drop policy if exists "comments follow the post" on public.group_post_comments;
create policy "comments follow the post" on public.group_post_comments for select using (
  exists (
    select 1 from public.group_posts p
     where p.id = post_id
       and (public.group_is_open(p.group_id) or public.is_group_member(p.group_id, auth.uid()))
  )
);

/* Reading an open group's wall without joining is fine. Answering on
   it is not — replying is taking part, and taking part is what joining
   is for. */
drop policy if exists "members comment" on public.group_post_comments;
create policy "members comment" on public.group_post_comments for insert with check (
  auth.uid() = author_id and exists (
    select 1 from public.group_posts p
     where p.id = post_id and public.is_group_member(p.group_id, auth.uid())
  )
);

drop policy if exists "authors and admins remove comments" on public.group_post_comments;
create policy "authors and admins remove comments" on public.group_post_comments for delete using (
  auth.uid() = author_id or exists (
    select 1 from public.group_posts p
     where p.id = post_id and public.is_group_admin(p.group_id, auth.uid())
  )
);

drop policy if exists "likes are visible with the post" on public.group_post_likes;
create policy "likes are visible with the post" on public.group_post_likes for select using (
  exists (
    select 1 from public.group_posts p
     where p.id = post_id
       and (public.group_is_open(p.group_id) or public.is_group_member(p.group_id, auth.uid()))
  )
);

drop policy if exists "members like" on public.group_post_likes;
create policy "members like" on public.group_post_likes for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.group_posts p
     where p.id = post_id and public.is_group_member(p.group_id, auth.uid())
  )
);

drop policy if exists "unlike your own like" on public.group_post_likes;
create policy "unlike your own like" on public.group_post_likes for delete using (auth.uid() = user_id);

/* Where you got to is nobody's business but yours. */
drop policy if exists "your own read marks" on public.group_reads;
create policy "your own read marks" on public.group_reads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── MEMBERSHIP ─────────────────────────────────────────────────────
/* A pending request is visible to the person who made it and to the
   people who can act on it. Nobody else needs to know somebody asked
   and is waiting. */
drop policy if exists "group members are viewable by everyone" on public.group_members;
drop policy if exists "members and requests are visible to the right people" on public.group_members;
create policy "members and requests are visible to the right people"
  on public.group_members for select using (
    status = 'joined'
    or user_id = auth.uid()
    or public.is_group_admin(group_id, auth.uid())
  );

/* Joining an open group is joining. Asking to join a request group is
   asking — you may write yourself in as 'requested' and nothing else.
   Neither path can hand itself a role. */
drop policy if exists "users join groups as themselves" on public.group_members;
drop policy if exists "you join, or you ask" on public.group_members;
create policy "you join, or you ask" on public.group_members for insert with check (
  auth.uid() = user_id and role = 'member' and (
    (status = 'joined'    and public.group_is_open(group_id)) or
    (status = 'requested' and not public.group_is_open(group_id))
  )
);

/* Leaving is always yours. Everything else that touches somebody
   else's row goes through the functions below. */
drop policy if exists "users leave groups" on public.group_members;
drop policy if exists "you can always leave" on public.group_members;
create policy "you can always leave" on public.group_members for delete using (
  auth.uid() = user_id and role <> 'owner'
);

-- ── THE THREE THINGS AN ADMIN DOES ─────────────────────────────────
create or replace function public.group_approve(gid uuid, uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(gid, auth.uid()) then
    raise exception 'not an admin of this group';
  end if;
  update public.group_members
     set status = 'joined'
   where group_id = gid and user_id = uid and status = 'requested';
end;
$$;

create or replace function public.group_set_role(gid uuid, uid uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if new_role not in ('admin', 'member') then
    raise exception 'a role is admin or member';
  end if;
  select owner_id into v_owner from public.groups where id = gid;
  -- only the owner hands out or takes back the keys
  if v_owner is distinct from auth.uid() then
    raise exception 'only the owner changes roles';
  end if;
  -- and the owner's own row is not a role you can set
  if uid = v_owner then
    raise exception 'the owner stays the owner';
  end if;
  update public.group_members
     set role = new_role
   where group_id = gid and user_id = uid and status = 'joined';
end;
$$;

create or replace function public.group_remove_member(gid uuid, uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.is_group_admin(gid, auth.uid()) then
    raise exception 'not an admin of this group';
  end if;
  select owner_id into v_owner from public.groups where id = gid;
  if uid = v_owner then
    raise exception 'the owner cannot be removed from their own group';
  end if;
  delete from public.group_members where group_id = gid and user_id = uid;
end;
$$;

-- ── THE WALL, IN ONE ROUND TRIP ────────────────────────────────────
/* Author, words, picture, how many liked it, how many answered, and
   whether YOU liked it — all of it in one answer, because six requests
   to paint one screen is what makes a feed feel slow on a phone.

   It is security definer, so it checks for itself who is allowed to
   read this wall rather than trusting that a policy somewhere did. */
create or replace function public.group_wall(gid uuid, before_ts timestamptz default null, lim int default 20)
returns table (
  id uuid, author_id uuid, author_name text, author_avatar text,
  body text, media_url text, created_at timestamptz, edited_at timestamptz,
  likes int, comments int, liked boolean, mine boolean, can_remove boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.author_id,
         coalesce(pr.name, 'Someone'), pr.avatar_url,
         p.body, p.media_url, p.created_at, p.edited_at,
         (select count(*)::int from public.group_post_likes l where l.post_id = p.id),
         (select count(*)::int from public.group_post_comments c where c.post_id = p.id),
         exists (select 1 from public.group_post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         p.author_id = auth.uid(),
         p.author_id = auth.uid() or public.is_group_admin(p.group_id, auth.uid())
    from public.group_posts p
    left join public.profiles pr on pr.id = p.author_id
   where p.group_id = gid
     and (public.group_is_open(gid) or public.is_group_member(gid, auth.uid()))
     and (before_ts is null or p.created_at < before_ts)
   order by p.created_at desc
   limit least(greatest(coalesce(lim, 20), 1), 50);
$$;

/* The sentence that brings people back. Counts only what arrived after
   you last looked, and never counts your own posts — being told you
   have one new post and finding it is yours is the app wasting your
   time. */
create or replace function public.group_unread()
returns table (group_id uuid, unread int)
language sql stable security definer set search_path = public as $$
  select m.group_id,
         (select count(*)::int
            from public.group_posts p
           where p.group_id = m.group_id
             and p.author_id <> m.user_id
             and p.created_at > coalesce(r.seen_at, m.joined_at, '-infinity'::timestamptz))
    from public.group_members m
    left join public.group_reads r on r.group_id = m.group_id and r.user_id = m.user_id
   where m.user_id = auth.uid() and m.status = 'joined';
$$;

create or replace function public.group_seen(gid uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.group_reads (group_id, user_id, seen_at)
  values (gid, auth.uid(), now())
  on conflict (group_id, user_id) do update set seen_at = now();
$$;

/* The discovery list needs to count JOINED members, not everyone who
   ever asked.

   Dropped and rebuilt rather than replaced, and that is not a
   preference. `groups` just gained four columns, so `g.*` expands
   wider than it did, which pushes members_count from the seventh
   column to the eleventh — and CREATE OR REPLACE VIEW can only append
   columns, never move one. Replacing in place fails with "cannot
   change name of view column", and one failed statement takes the
   rest of the file with it. */
drop view if exists public.groups_with_counts;
create view public.groups_with_counts as
  select g.*, coalesce(m.cnt, 0) as members_count
  from public.groups g
  left join (
    select group_id, count(*) as cnt
      from public.group_members
     where status = 'joined'
     group by group_id
  ) m on m.group_id = g.id;

notify pgrst, 'reload schema';
