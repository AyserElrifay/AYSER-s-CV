-- ═══════════════════════════════════════════════════════════════════
--  MOMENTS · RUN_ME — everything pending, in ONE paste. Idempotent:
--  safe to run twice. Turns on: FRIENDS (mate up), persistent laughs,
--  destination reviews, and real notifications.
--  How: Supabase Dashboard → SQL Editor → New query → paste ALL of
--  this file → Run. Green check = done.
-- ═══════════════════════════════════════════════════════════════════

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
-- ════════════════════════════════════════════════════════════════
--  MOMENTS · schema v11 — REAL notifications
--  Rows are created by database triggers, so nothing can be faked
--  and nothing is missed: star / laugh / comment on your post,
--  mate request, mate accept. Run AFTER v8 (mates) + v9 (laughs).
--  Idempotent.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade, -- recipient
  actor_id   uuid not null references public.profiles(id) on delete cascade, -- who did it
  kind       text not null check (kind in ('vibe','laugh','comment','mate_request','mate_accept')),
  post_id    uuid references public.posts(id) on delete cascade,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "mark own notifications" on public.notifications;
create policy "mark own notifications" on public.notifications
  for update using (auth.uid() = user_id);

create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- live delivery (ignore if already in the publication)
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- ── the writer — security definer so triggers can insert past RLS ──
create or replace function public.notify(recipient uuid, actor uuid, k text, p uuid, b text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if recipient is null or actor is null or recipient = actor then return; end if;
  insert into public.notifications (user_id, actor_id, kind, post_id, body)
  values (recipient, actor, k, p, b);
end $$;

-- ── star on your post ──
create or replace function public.notify_vibe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'vibe', new.post_id, null);
  return new;
end $$;
drop trigger if exists trg_notify_vibe on public.post_vibes;
create trigger trg_notify_vibe after insert on public.post_vibes
  for each row execute procedure public.notify_vibe();

-- ── laugh on your post (needs schema_v9) ──
do $$ begin
  if to_regclass('public.post_laughs') is not null then
    create or replace function public.notify_laugh() returns trigger
    language plpgsql security definer set search_path = public as $fn$
    begin
      perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'laugh', new.post_id, null);
      return new;
    end $fn$;
    drop trigger if exists trg_notify_laugh on public.post_laughs;
    create trigger trg_notify_laugh after insert on public.post_laughs
      for each row execute procedure public.notify_laugh();
  end if;
end $$;

-- ── comment on your post ──
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'comment', new.post_id, left(new.body, 120));
  return new;
end $$;
drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments
  for each row execute procedure public.notify_comment();

-- ── mate request + accept (needs schema_v8) ──
do $$ begin
  if to_regclass('public.mates') is not null then
    create or replace function public.notify_mate_request() returns trigger
    language plpgsql security definer set search_path = public as $fn$
    begin
      perform public.notify(new.addressee_id, new.requester_id, 'mate_request', null, null);
      return new;
    end $fn$;
    drop trigger if exists trg_notify_mate_request on public.mates;
    create trigger trg_notify_mate_request after insert on public.mates
      for each row execute procedure public.notify_mate_request();

    create or replace function public.notify_mate_accept() returns trigger
    language plpgsql security definer set search_path = public as $fn$
    begin
      if new.status = 'accepted' and old.status = 'pending' then
        perform public.notify(new.requester_id, new.addressee_id, 'mate_accept', null, null);
      end if;
      return new;
    end $fn$;
    drop trigger if exists trg_notify_mate_accept on public.mates;
    create trigger trg_notify_mate_accept after update on public.mates
      for each row execute procedure public.notify_mate_accept();
  end if;
end $$;

-- ═══════════ v2 · CHAT (DMs), LIVE MAP & VENUES — folded in ═══════════
-- The reason "messages won't send": these tables come from
-- schema_v2_live.sql. Now they're here so ONE paste covers everything.
create table if not exists public.live_locations (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  doing text, updated_at timestamptz default now()
);
alter table public.live_locations enable row level security;
drop policy if exists "live locations are viewable by everyone" on public.live_locations;
create policy "live locations are viewable by everyone" on public.live_locations for select using (true);
drop policy if exists "users upsert own location" on public.live_locations;
create policy "users upsert own location" on public.live_locations for insert with check (auth.uid() = user_id);
drop policy if exists "users update own location" on public.live_locations;
create policy "users update own location" on public.live_locations for update using (auth.uid() = user_id);
drop policy if exists "users can go invisible" on public.live_locations;
create policy "users can go invisible" on public.live_locations for delete using (auth.uid() = user_id);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null, kind text, emoji text default '📍', sub text, price text,
  lat double precision, lng double precision,
  status text not null default 'pending' check (status in ('pending','live','rejected')),
  created_at timestamptz default now()
);
alter table public.venues enable row level security;
drop policy if exists "live venues are viewable by everyone" on public.venues;
create policy "live venues are viewable by everyone" on public.venues for select using (status = 'live' or auth.uid() = owner_id);
drop policy if exists "signed-in users can apply as a venue" on public.venues;
create policy "signed-in users can apply as a venue" on public.venues for insert with check (auth.uid() = owner_id);
drop policy if exists "owners can update own pending venue" on public.venues;
create policy "owners can update own pending venue" on public.venues for update using (auth.uid() = owner_id);

create table if not exists public.campfires (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, topic text, lat double precision, lng double precision,
  created_at timestamptz default now(), ended_at timestamptz
);
alter table public.campfires add column if not exists ends_at timestamptz;
alter table public.campfires enable row level security;
drop policy if exists "live campfires are viewable by everyone" on public.campfires;
create policy "live campfires are viewable by everyone" on public.campfires for select using (ended_at is null or host_id = auth.uid());
drop policy if exists "users can host a campfire" on public.campfires;
create policy "users can host a campfire" on public.campfires for insert with check (auth.uid() = host_id);
drop policy if exists "hosts can end own campfire" on public.campfires;
create policy "hosts can end own campfire" on public.campfires for update using (auth.uid() = host_id);

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);
create table if not exists public.dm_participants (
  thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  primary key (thread_id, user_id)
);
alter table public.dm_threads      enable row level security;
alter table public.dm_participants enable row level security;

-- security-definer helper — bypasses RLS internally so the policy
-- below doesn't query dm_participants THROUGH dm_participants' own
-- policy (that self-reference is what caused "infinite recursion
-- detected in policy for relation dm_participants").
create or replace function public.is_dm_participant(t_id uuid, u_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.dm_participants p where p.thread_id = t_id and p.user_id = u_id);
$$;

-- purge every legacy name these policies ever shipped under (earlier
-- chat-pasted versions used short names) — a leftover recursive copy
-- would keep recursing even after the fixed one is created
drop policy if exists "dmp_sel" on public.dm_participants;
drop policy if exists "p sel"   on public.dm_participants;
drop policy if exists "dmt_sel" on public.dm_threads;
drop policy if exists "t sel"   on public.dm_threads;

drop policy if exists "participants can view their dm threads" on public.dm_threads;
create policy "participants can view their dm threads" on public.dm_threads for select using (
  public.is_dm_participant(id, auth.uid())
);
drop policy if exists "participants are viewable by thread members" on public.dm_participants;
create policy "participants are viewable by thread members" on public.dm_participants for select using (
  public.is_dm_participant(thread_id, auth.uid())
);

create or replace function public.get_or_create_dm_thread(other_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  found_id uuid; new_id uuid;
begin
  select p1.thread_id into found_id
  from public.dm_participants p1
  join public.dm_participants p2 on p1.thread_id = p2.thread_id
  where p1.user_id = auth.uid() and p2.user_id = other_user
  limit 1;
  if found_id is not null then return found_id; end if;
  insert into public.dm_threads default values returning id into new_id;
  insert into public.dm_participants (thread_id, user_id) values (new_id, auth.uid());
  insert into public.dm_participants (thread_id, user_id) values (new_id, other_user);
  return new_id;
end $$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade,
  dm_thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null, created_at timestamptz default now(),
  constraint messages_exactly_one_thread check (
    (squad_id is not null and dm_thread_id is null) or
    (squad_id is null and dm_thread_id is not null)
  )
);
alter table public.messages enable row level security;
-- purge legacy chat-pasted policy names (recursive versions) first
drop policy if exists "msg_sel" on public.messages;
drop policy if exists "msg sel" on public.messages;
drop policy if exists "msg_ins" on public.messages;
drop policy if exists "msg ins" on public.messages;
drop policy if exists "squad members read squad messages" on public.messages;
create policy "squad members read squad messages" on public.messages for select using (
  (squad_id is not null and exists (select 1 from public.squad_members m where m.squad_id = messages.squad_id and m.user_id = auth.uid()))
  or
  (dm_thread_id is not null and exists (select 1 from public.dm_participants p where p.thread_id = messages.dm_thread_id and p.user_id = auth.uid()))
);
drop policy if exists "squad members send squad messages" on public.messages;
create policy "squad members send squad messages" on public.messages for insert with check (
  auth.uid() = user_id and (
    (squad_id is not null and exists (select 1 from public.squad_members m where m.squad_id = messages.squad_id and m.user_id = auth.uid()))
    or
    (dm_thread_id is not null and exists (select 1 from public.dm_participants p where p.thread_id = messages.dm_thread_id and p.user_id = auth.uid()))
  )
);

do $$ begin
  begin alter publication supabase_realtime add table public.live_locations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.campfires;      exception when duplicate_object then null; end;
end $$;

-- ═══════════ v16 · STORY STICKERS · poll + ask-a-question ═══════════
alter table public.stories add column if not exists sticker_type text;
alter table public.stories add column if not exists sticker_data text;
create table if not exists public.story_poll_votes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice smallint not null check (choice in (0,1)),
  created_at timestamptz default now(),
  primary key (story_id, user_id)
);
alter table public.story_poll_votes enable row level security;
drop policy if exists "spv_all" on public.story_poll_votes;
create policy "spv_all" on public.story_poll_votes for select using (true);
drop policy if exists "spv_ins" on public.story_poll_votes;
create policy "spv_ins" on public.story_poll_votes for insert with check (auth.uid()=user_id);
drop policy if exists "spv_upd" on public.story_poll_votes;
create policy "spv_upd" on public.story_poll_votes for update using (auth.uid()=user_id);

-- ═══════════ v7 · INDIE MUSIC HUB (real, playable tracks) ═══════════
create table if not exists public.tracks (
  id           uuid primary key default gen_random_uuid(),
  uploader_id  uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  audio_url    text not null,
  cover_emoji  text default '🎵',
  duration_sec int,
  bpm          int,
  music_key    text,
  mood         text,
  timbre       text,
  instruments  text[],
  genre_shape  text,
  uses_count   int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.tracks enable row level security;
drop policy if exists "tracks are listenable by everyone" on public.tracks;
create policy "tracks are listenable by everyone" on public.tracks for select using (true);
drop policy if exists "producers upload own tracks" on public.tracks;
create policy "producers upload own tracks" on public.tracks for insert with check (auth.uid() = uploader_id);
drop policy if exists "producers manage own tracks" on public.tracks;
create policy "producers manage own tracks" on public.tracks for delete using (auth.uid() = uploader_id);

-- attach a song to stories & reels (URL = actually playable)
alter table public.stories add column if not exists sound_url text;
alter table public.posts   add column if not exists sound_title  text;
alter table public.posts   add column if not exists sound_artist text;
alter table public.posts   add column if not exists sound_url    text;

-- ── Curated / official music library (LICENSE-SAFE) ──
-- Official tracks have NO user uploader; they carry the license + the
-- required credit line so the app can attribute the artist in-app.
-- ONLY royalty-free / Creative-Commons / properly-licensed audio you
-- host yourself belongs here — never Spotify/Apple/commercial clips
-- baked into a video. That's the whole copyright-safety rule.
alter table public.tracks alter column uploader_id drop not null;
alter table public.tracks add column if not exists artist       text;   -- artist / producer name
alter table public.tracks add column if not exists is_official  boolean default false; -- curated by Moments
alter table public.tracks add column if not exists license      text;   -- 'CC-BY 4.0' | 'Pixabay' | 'Public Domain' | 'Licensed'
alter table public.tracks add column if not exists attribution  text;   -- credit line shown in-app (CC-BY needs this)
alter table public.tracks add column if not exists source_url   text;   -- where the file came from (proof of license)
create index if not exists tracks_official_idx on public.tracks (is_official);
-- Owner-approved distribution: a track is only public once approved (or
-- official). Uploads land as pending; the app owner approves or rejects.
alter table public.tracks add column if not exists is_approved boolean default false;
update public.tracks set is_approved = true where is_official = true and is_approved is distinct from true;

-- Seed a curated track (run from the SQL editor / dashboard, which uses
-- the service role so uploader_id may stay null). Fill in a REAL audio
-- URL you host — e.g. a Pixabay Music / FMA / your-own file in R2/Storage.
-- Example (uncomment + edit):
-- insert into public.tracks (title, artist, audio_url, cover_emoji, mood, bpm, genre_shape, license, attribution, source_url, is_official)
-- values ('Sunrise Drive', 'Alex Productions',
--         'https://YOUR-STORAGE/tracks/sunrise-drive.mp3', '🌅', 'Happy', 120, 'lofi chill',
--         'Pixabay', 'Music by Alex Productions from Pixabay', 'https://pixabay.com/music/…', true);

-- real play-count, so producers see genuine usage (not just uploads) —
-- security definer since the LISTENER (not the uploader) triggers this
create or replace function public.increment_track_use(p_track_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.tracks set uses_count = uses_count + 1 where id = p_track_id;
$$;

-- ═══════════ v14 · VENUE BOOKINGS (real reservation requests) ═══════════
create table if not exists public.venue_bookings (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid references public.venues(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  venue_name   text,
  full_name    text not null,
  phone        text not null,
  booking_date text,
  people       int not null default 2 check (people between 1 and 50),
  notes        text,
  status       text not null default 'new' check (status in ('new','confirmed','cancelled')),
  created_at   timestamptz not null default now()
);
alter table public.venue_bookings enable row level security;
drop policy if exists "book as yourself" on public.venue_bookings;
create policy "book as yourself" on public.venue_bookings for insert with check (auth.uid() = user_id);
drop policy if exists "see own or incoming bookings" on public.venue_bookings;
create policy "see own or incoming bookings" on public.venue_bookings for select using (
  auth.uid() = user_id or auth.uid() = (select owner_id from public.venues v where v.id = venue_id)
);
drop policy if exists "venue owner updates booking status" on public.venue_bookings;
create policy "venue owner updates booking status" on public.venue_bookings for update using (
  auth.uid() = (select owner_id from public.venues v where v.id = venue_id)
);

-- ═══════════════ v13 · REPOSTS + JOINS persist ═══════════════
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

-- ═══════════════ v12 · TRIP REQUESTS (Book Trip form) ═══════════════
create table if not exists public.trip_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  dest_id     text not null,
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

-- ═══════════ v15 · COMMENT REPLIES + REACTIONS ═══════════
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_likes enable row level security;
drop policy if exists "comment likes readable by everyone" on public.comment_likes;
create policy "comment likes readable by everyone" on public.comment_likes for select using (true);
drop policy if exists "like comments as yourself" on public.comment_likes;
create policy "like comments as yourself" on public.comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists "unlike comments yourself" on public.comment_likes;
create policy "unlike comments yourself" on public.comment_likes for delete using (auth.uid() = user_id);

-- ═══════════ MAP NOTES · a comment pinned at a spot for a while ═══════════
create table if not exists public.map_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  lat        double precision not null,
  lng        double precision not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.map_notes enable row level security;
drop policy if exists "map notes readable by everyone" on public.map_notes;
create policy "map notes readable by everyone" on public.map_notes for select using (true);
drop policy if exists "drop your own note" on public.map_notes;
create policy "drop your own note" on public.map_notes for insert with check (auth.uid() = user_id);
drop policy if exists "remove your own note" on public.map_notes;
create policy "remove your own note" on public.map_notes for delete using (auth.uid() = user_id);
create index if not exists map_notes_expiry_idx on public.map_notes (expires_at);

-- ═══════════ DISAPPEARING MESSAGES + SQUAD CREATE/LEAVE ═══════════
alter table public.dm_threads add column if not exists ttl_hours int;
drop policy if exists "participants can update their dm threads" on public.dm_threads;
create policy "participants can update their dm threads" on public.dm_threads
  for update using (public.is_dm_participant(id, auth.uid()));
drop policy if exists "participants can sweep expired messages" on public.messages;
create policy "participants can sweep expired messages" on public.messages
  for delete using (
    (dm_thread_id is not null and public.is_dm_participant(dm_thread_id, auth.uid()))
    or auth.uid() = user_id
  );
drop policy if exists "signed-in users can create squads" on public.squads;
create policy "signed-in users can create squads" on public.squads
  for insert with check (auth.uid() is not null);
-- squads can carry a real photo (not just an emoji)
alter table public.squads add column if not exists avatar_url text;
drop policy if exists "members can update their squad" on public.squads;
create policy "members can update their squad" on public.squads
  for update using (public.is_squad_member(id, auth.uid()));
drop policy if exists "members can leave squads" on public.squad_members;
create policy "members can leave squads" on public.squad_members
  for delete using (auth.uid() = user_id);
-- invite mates: a current member of a squad may add other people to it
-- (the old policy only let you add YOURSELF, so invites failed).
-- NOTE: the membership check MUST go through a security-definer function —
-- a plain subquery on squad_members inside its own policy triggers Postgres
-- "infinite recursion detected in policy" and breaks every insert.
create or replace function public.is_squad_member(sid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.squad_members where squad_id = sid and user_id = uid);
$$;
drop policy if exists "users join squads as themselves" on public.squad_members;
drop policy if exists "members can invite to their squads" on public.squad_members;
create policy "members can invite to their squads" on public.squad_members
  for insert with check (
    auth.uid() = user_id or public.is_squad_member(squad_members.squad_id, auth.uid())
  );

-- ═══════════ STORY CLEANUP · expired stories are really deleted ═══════════
-- The RLS policy already HIDES stories after 24h, but the rows + media
-- files stayed forever, silently eating storage. This security-definer
-- sweep lets each user delete their own expired story rows (the app
-- then removes the storage files too) — called automatically on open.
create or replace function public.sweep_my_expired_stories()
returns setof text language plpgsql security definer set search_path = public as $$
begin
  return query
  delete from public.stories
   where user_id = auth.uid() and expires_at <= now()
  returning media_url;
end $$;

-- ═══════════ MEDIA STORAGE · the bucket uploads live in ═══════════
-- THE reason stories/reels said "failed": every photo/video upload goes
-- to a Storage bucket named `media`, and that bucket was only created by
-- the old schema.sql — never by this file. One paste fixes it. Public
-- bucket (posts are public), uploads land in the uploader's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 209715200, null)
on conflict (id) do update set
  public = true,
  -- 50 MB, stated on the bucket itself rather than left to whatever the
  -- project default happens to be, and no mime allow-list: a list that
  -- silently omits video/mp4 rejects every reel with a bare "Load
  -- failed", which is indistinguishable from a bad connection.
  file_size_limit = 209715200,
  allowed_mime_types = null;

drop policy if exists "media is publicly readable" on storage.objects;
create policy "media is publicly readable"
  on storage.objects for select using (bucket_id = 'media');

drop policy if exists "users upload media to own folder" on storage.objects;
create policy "users upload media to own folder"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users manage own media" on storage.objects;
create policy "users manage own media"
  on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

-- ═══════════ BOOKING REVENUE · the platform's cut ═══════════
-- Every confirmed venue booking carries a real Moments service fee —
-- this is how the app earns from reservations (the venue pays it from
-- the booking value; you can revisit the amount any time).
alter table public.venue_bookings add column if not exists service_fee_egp int default 15;

-- ═══════════ REAL CALLS · missed-call notifications ═══════════
-- Ringing itself travels over Supabase Realtime broadcast (no rows
-- needed), but a missed call must leave a REAL notification. Widen the
-- kind check and add a security-definer writer the caller can invoke.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('vibe','laugh','comment','mate_request','mate_accept','call'));
create or replace function public.notify_call(recipient uuid, actor uuid)
returns void language sql security definer set search_path = public as $$
  select public.notify(recipient, actor, 'call', null, 'Missed call');
$$;

-- ═══════════ LEGAL SHIELD · reports & takedowns (DMCA) ═══════════
-- Every report a user files is a real row. This is what makes DMCA
-- "safe harbour" work: users flag infringing/abusive content, you get a
-- queue to act on, and you can remove it — so as the app owner you're
-- protected as long as you respond to reports.
create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.profiles(id) on delete set null,
  content_type text not null,                 -- 'track' | 'post' | 'comment' | 'story' | 'user'
  content_id   text not null,                 -- id of the reported thing
  reason       text not null,                 -- short code (copyright, abuse, …)
  detail       text,                          -- optional free text / rights-holder claim
  status       text not null default 'open',  -- 'open' | 'reviewed' | 'removed'
  created_at   timestamptz not null default now()
);
alter table public.content_reports enable row level security;
drop policy if exists "anyone signed-in can report" on public.content_reports;
create policy "anyone signed-in can report" on public.content_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists "see your own reports" on public.content_reports;
create policy "see your own reports" on public.content_reports
  for select using (auth.uid() = reporter_id);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
-- Owner (Moments Studio) can read every report and update its status.
drop policy if exists "owner reads all reports" on public.content_reports;
create policy "owner reads all reports" on public.content_reports for select using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);
drop policy if exists "owner updates reports" on public.content_reports;
create policy "owner updates reports" on public.content_reports for update using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);

-- ═══════════ GAME SCORES · real global leaderboard ═══════════
create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game       text not null,               -- 'runner' | 'stack'
  score      int  not null,
  created_at timestamptz not null default now()
);
alter table public.game_scores enable row level security;
drop policy if exists "scores readable by everyone" on public.game_scores;
create policy "scores readable by everyone" on public.game_scores for select using (true);
drop policy if exists "insert your own score" on public.game_scores;
create policy "insert your own score" on public.game_scores for insert with check (auth.uid() = user_id);
create index if not exists game_scores_board_idx on public.game_scores (game, score desc);

-- ═══════════ FEEDBACK · users → the owner's Studio inbox ═══════════
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  kind       text not null default 'idea',   -- idea | bug | love | other
  body       text not null,
  status     text not null default 'new',    -- new | seen
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert with check (auth.uid() is not null);
drop policy if exists "owner reads feedback" on public.feedback;
create policy "owner reads feedback" on public.feedback for select using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);
drop policy if exists "owner updates feedback" on public.feedback;
create policy "owner updates feedback" on public.feedback for update using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);

-- ═══════════ HELP & SUPPORT · real, owner-editable articles ═══════════
-- Everyone can read; only the owner can write — edited straight from
-- Moments Studio, no code changes needed to update an answer.
create table if not exists public.help_articles (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'General',
  title      text not null,
  body       text not null,
  icon       text default 'help-circle-outline',
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.help_articles enable row level security;
drop policy if exists "help_read_all" on public.help_articles;
create policy "help_read_all" on public.help_articles for select using (true);
drop policy if exists "help_owner_write" on public.help_articles;
create policy "help_owner_write" on public.help_articles for all using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
) with check (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);

-- seed a real starter set so Help & Support isn't empty on day one —
-- only runs once (guarded on an empty table), the owner can edit or
-- delete every word of it afterward from Moments Studio.
insert into public.help_articles (category, title, body, icon, position)
select * from (values
  ('Getting started', 'What is Moments?', 'Moments is a real, daily social app — post, chat, meet up, and play with people you actually know. Nothing on it is scripted or fake: your feed, your friends, your scores are all real.', 'sparkles-outline', 0),
  ('Getting started', 'How do I add friends (mates)?', 'Search for someone by name or @handle, open their profile, and tap Mate up. Once they accept, you''ll see each other''s Moments and can chat and call for real.', 'people-outline', 1),
  ('Privacy & safety', 'Who can see my posts?', 'Public accounts are visible to everyone on Moments. Switch to a Private account in Settings → your name → Account type to only share with your mates.', 'lock-closed-outline', 0),
  ('Privacy & safety', 'How do I report something?', 'Every post, reel and story has a Report option — pick the reason (copyright, abuse, spam, etc.) and it goes straight to the owner''s review queue. We really do review every report.', 'flag-outline', 1),
  ('Privacy & safety', 'Can I delete my content?', 'Yes — open anything you posted and you''ll find a real Delete option. It''s removed from the database, not just hidden.', 'trash-outline', 2),
  ('Music & copyright', 'Can I use any song on my Moments?', 'Only tracks from the in-app Music Hub — every one is Creative Commons, Public Domain, or properly licensed, with credit shown. This keeps your posts copyright-safe.', 'musical-notes-outline', 0),
  ('Account', 'How do I get verified?', 'Verification is for real artists and musicians right now — switch your account type to Artist or Musician in your profile menu, then tap Request verification. A real person reviews every request.', 'shield-checkmark-outline', 0),
  ('Account', 'How do I delete my account?', 'Email us (below) and we''ll delete your account and everything tied to it — for real, not just deactivate it.', 'person-remove-outline', 1)
) as v(category, title, body, icon, position)
where not exists (select 1 from public.help_articles limit 1);

notify pgrst, 'reload schema';

-- ═══════════ BARDI BRAIN · owner-controlled persona + knowledge ═══════════
-- The owner's Bardi portal (in Moments Studio) writes here; every user's
-- Bardi reads it and feeds it into the model, so the owner can steer
-- Bardi and teach it from books/content WITHOUT any code change.

-- one editable instruction block that tunes Bardi's persona/knowledge
create table if not exists public.bardi_config (
  id           int primary key default 1,
  instructions text not null default '',
  updated_at   timestamptz not null default now(),
  constraint bardi_config_singleton check (id = 1)
);
alter table public.bardi_config enable row level security;
drop policy if exists "bardi_config_read" on public.bardi_config;
create policy "bardi_config_read" on public.bardi_config for select using (true);
drop policy if exists "bardi_config_owner" on public.bardi_config;
create policy "bardi_config_owner" on public.bardi_config for all using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
) with check (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);
insert into public.bardi_config (id, instructions) values (1, '')
  on conflict (id) do nothing;

-- the "books" / knowledge the owner feeds Bardi to learn from
create table if not exists public.bardi_knowledge (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null,
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.bardi_knowledge enable row level security;
drop policy if exists "bardi_knowledge_read" on public.bardi_knowledge;
create policy "bardi_knowledge_read" on public.bardi_knowledge for select using (true);
drop policy if exists "bardi_knowledge_owner" on public.bardi_knowledge;
create policy "bardi_knowledge_owner" on public.bardi_knowledge for all using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
) with check (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);

-- per-user memory — Bardi remembers each user from THEIR OWN chats with
-- Bardi (consented). Strictly private: a user only ever sees/writes their
-- own rows. Other people's private chats are never fed to Bardi.
create table if not exists public.bardi_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now()
);
alter table public.bardi_memory enable row level security;
drop policy if exists "bardi_memory_own" on public.bardi_memory;
create policy "bardi_memory_own" on public.bardi_memory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ═══════════════ PROFILE COLUMNS SELF-HEAL ═══════════════
-- Columns added by earlier schema files (v2 languages, v7 country)
-- that may be missing — safe to re-add, they no-op if present.
-- Fixes: "Could not find the 'country' column of 'profiles'".
alter table public.profiles add column if not exists country           text;
alter table public.profiles add column if not exists country_flag      text;
alter table public.profiles add column if not exists speaks_language   text;
alter table public.profiles add column if not exists learning_language text;
alter table public.profiles add column if not exists learning_level    text;
alter table public.profiles add column if not exists learning_visible  boolean default false;
alter table public.profiles add column if not exists language          text;
alter table public.profiles add column if not exists hobbies           text;
alter table public.profiles add column if not exists avatar_dna       text;
alter table public.profiles add column if not exists last_active_at   timestamptz;
alter table public.profiles add column if not exists cover_url        text;
alter table public.profiles add column if not exists tos_accepted_at  timestamptz; -- accepted the Terms + rights policy
alter table public.profiles add column if not exists age         int;   -- optional, shown on profile
alter table public.profiles add column if not exists occupation  text;  -- "what you do"
alter table public.profiles add column if not exists education   text;  -- "what you studied"
alter table public.profiles add column if not exists account_type text default 'public'; -- public|private|professional|artist|musician
alter table public.profiles add column if not exists artist_genre text; -- for artist/musician profiles

-- ═══════════ VERIFICATION · artists & musicians get the tick ═══════════
-- Real, owner-reviewed: a creator requests, the app owner approves, and a
-- security-definer function flips profiles.verified. No self-verification.
create table if not exists public.verification_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'artist',   -- artist | musician | professional
  note       text,
  status     text not null default 'pending',  -- pending | approved | rejected
  created_at timestamptz not null default now(),
  unique (user_id)
);
alter table public.verification_requests enable row level security;
drop policy if exists "vr insert own" on public.verification_requests;
create policy "vr insert own" on public.verification_requests for insert with check (auth.uid() = user_id);
drop policy if exists "vr select own or owner" on public.verification_requests;
create policy "vr select own or owner" on public.verification_requests for select using (
  auth.uid() = user_id or (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);
drop policy if exists "vr update owner" on public.verification_requests;
create policy "vr update owner" on public.verification_requests for update using (
  (auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com'
);
-- owner-only approval: flips the profile's verified flag + marks the request
create or replace function public.approve_verification(target uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (auth.jwt() ->> 'email') <> 'ayseryourlifecoach@gmail.com' then
    raise exception 'not authorized';
  end if;
  update public.profiles set verified = approve where id = target;
  update public.verification_requests set status = case when approve then 'approved' else 'rejected' end where user_id = target;
end; $$;

-- ═══════════════ MOMENTS IN CHAT (streaks) ═══════════════
-- Send each other photo/video "Moments" right inside a chat, like
-- Snapchat streaks. A moment is a normal message row with media
-- attached and kind='moment'. body stays NOT NULL (holds the caption
-- or a 🔥 fallback), so nothing about existing chat breaks.
alter table public.messages add column if not exists media_url  text;
alter table public.messages add column if not exists media_kind text;   -- 'photo' | 'video'
alter table public.messages add column if not exists kind       text default 'text'; -- 'text' | 'moment'

-- PostgREST caches the schema — reload it so the new columns are
-- visible to the app immediately, no waiting.
notify pgrst, 'reload schema';

-- ═══════════ REAL MULTIPLAYER · Catch Your Mate live duels ═══════════
-- A match is a real row two real accounts share (RLS: only the two of
-- them can ever see or touch it). The actual race is never stored tick
-- by tick — that rides a Supabase Realtime broadcast channel between
-- the two browsers, live — only the final result lands here.
create table if not exists public.game_matches (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'catch',
  host_id     uuid not null references public.profiles(id) on delete cascade,
  guest_id    uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending', -- pending | active | done | declined
  host_score  int,
  guest_score int,
  winner_id   uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  ended_at    timestamptz
);
alter table public.game_matches enable row level security;
drop policy if exists "gm_sel" on public.game_matches;
create policy "gm_sel" on public.game_matches for select using (auth.uid() in (host_id, guest_id));
drop policy if exists "gm_ins" on public.game_matches;
create policy "gm_ins" on public.game_matches for insert with check (auth.uid() = host_id);
drop policy if exists "gm_upd" on public.game_matches;
create policy "gm_upd" on public.game_matches for update using (auth.uid() in (host_id, guest_id));

-- a match invite is a real message that lives in the chat history
alter table public.messages add column if not exists game_match_id uuid references public.game_matches(id);

notify pgrst, 'reload schema';

-- ═══════════ STORY VIEWS + REACTIONS · real "who watched" ═══════════
-- A view is recorded once per viewer per story (upsert keeps re-opens
-- from double-counting). Owners can see the full viewer list on their
-- own story; everyone else only ever sees their own view row — never
-- someone else's, so watching a story stays private the way it should.
create table if not exists public.story_views (
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists "sv_ins" on public.story_views;
create policy "sv_ins" on public.story_views for insert with check (auth.uid() = viewer_id);
drop policy if exists "sv_upd" on public.story_views;
create policy "sv_upd" on public.story_views for update using (auth.uid() = viewer_id);
drop policy if exists "sv_sel" on public.story_views;
create policy "sv_sel" on public.story_views for select using (
  auth.uid() = viewer_id
  or auth.uid() = (select user_id from public.stories where id = story_id)
);

-- A tap-emoji reaction ("sticker"), one per viewer per story — tapping
-- a different emoji just replaces your last one (upsert). Same privacy
-- shape as views: the story's owner sees every reaction on their
-- story, everyone else only sees their own.
create table if not exists public.story_reactions (
  story_id    uuid not null references public.stories(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null default '❤️',
  created_at  timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_reactions enable row level security;
drop policy if exists "sr_ins" on public.story_reactions;
create policy "sr_ins" on public.story_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "sr_upd" on public.story_reactions;
create policy "sr_upd" on public.story_reactions for update using (auth.uid() = user_id);
drop policy if exists "sr_sel" on public.story_reactions;
create policy "sr_sel" on public.story_reactions for select using (
  auth.uid() = user_id
  or auth.uid() = (select user_id from public.stories where id = story_id)
);

-- ═══════════ ONE NOTIFICATION PER PERSON, PER THING ═══════════
-- Instagram behaviour: if the same person stars the same moment again
-- (un-star, re-star, un-star…) you get ONE notification that moves back
-- to the top — not a wall of identical rows. Comments stay separate,
-- because every comment really is its own event.
-- ═══════════ MAP COVER · your place instead of a photo ═══════════
-- Rather than a cover photo you can show WHERE you are as your header,
-- with a pin on a real map. It's a choice, and it's yours to undo:
-- these are only ever written when you pick it.
alter table public.profiles add column if not exists cover_kind  text;   -- null | 'photo' | 'map'
alter table public.profiles add column if not exists cover_lat   double precision;
alter table public.profiles add column if not exists cover_lng   double precision;
alter table public.profiles add column if not exists cover_place text;

-- ═══════════ STORY COMMENTS (and the owner's off switch) ═══════════
-- Comments sit under the story for everyone watching it, and they're
-- saved — reopen the story and they're still there. Whoever posted the
-- story can switch comments off for it, and then nobody can add one:
-- that rule lives in the database, not just in the UI.
alter table public.stories add column if not exists comments_off boolean not null default false;

create table if not exists public.story_comments (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists story_comments_idx on public.story_comments (story_id, created_at);
alter table public.story_comments enable row level security;

drop policy if exists "sc_sel" on public.story_comments;
create policy "sc_sel" on public.story_comments for select
  using (auth.uid() is not null);

-- you can only comment as yourself, and only while the owner allows it
drop policy if exists "sc_ins" on public.story_comments;
create policy "sc_ins" on public.story_comments for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.stories s
     where s.id = story_id
       and coalesce(s.comments_off, false) = false
       and s.expires_at > now()
  )
);

-- remove your own comment; the story's owner can remove any on theirs
drop policy if exists "sc_del" on public.story_comments;
create policy "sc_del" on public.story_comments for delete using (
  auth.uid() = user_id
  or auth.uid() = (select user_id from public.stories where id = story_id)
);

-- ═══════════ STORIES ON THE MAP ═══════════
-- A story shared with a location shows up where it happened, the way
-- a moment already does — and disappears with the story after 24h.
alter table public.stories add column if not exists place text;
alter table public.stories add column if not exists lat double precision;
alter table public.stories add column if not exists lng double precision;
create index if not exists stories_geo_idx on public.stories (lat, lng)
  where lat is not null and lng is not null;
-- moments are already geotagged; this just makes the map layer fast
create index if not exists posts_geo_idx on public.posts (created_at desc)
  where lat is not null and lng is not null;

-- 1) collapse the duplicates already sitting in the inbox, keeping the
--    newest row of each (recipient, actor, kind, post) group
delete from public.notifications n
 using public.notifications keep
 where n.kind <> 'comment'
   and n.user_id  = keep.user_id
   and n.actor_id = keep.actor_id
   and n.kind     = keep.kind
   and n.post_id is not distinct from keep.post_id
   and (n.created_at < keep.created_at
        or (n.created_at = keep.created_at and n.id < keep.id));

-- 2) make the collapse a rule the database enforces
create unique index if not exists notifications_one_per_thing_idx
  on public.notifications (user_id, actor_id, kind, post_id)
  where kind <> 'comment' and post_id is not null;

-- 3) the writer: bump the existing row instead of piling up new ones
create or replace function public.notify(recipient uuid, actor uuid, k text, p uuid, b text)
returns void language plpgsql security definer set search_path = public as $$
declare hit uuid;
begin
  if recipient is null or actor is null or recipient = actor then return; end if;

  -- events with no post (mate request/accept, missed call) aren't covered
  -- by the index, so collapse those by hand
  if k <> 'comment' and p is null then
    select id into hit
      from public.notifications
     where user_id = recipient and actor_id = actor and kind = k and post_id is null
     order by created_at desc limit 1;
    if hit is not null then
      update public.notifications
         set created_at = now(), read = false, body = coalesce(b, body)
       where id = hit;
      return;
    end if;
  end if;

  insert into public.notifications (user_id, actor_id, kind, post_id, body)
  values (recipient, actor, k, p, b)
  on conflict (user_id, actor_id, kind, post_id)
    where kind <> 'comment' and post_id is not null
  do update set created_at = now(), read = false,
                body = coalesce(excluded.body, public.notifications.body);
end $$;

notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
--  DISCOVER PEOPLE — browsing real accounts instead of a search box
--  City, plus a friends-of-friends function. Idempotent.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists city text;

create index if not exists profiles_country_idx on public.profiles (country);
create index if not exists profiles_city_idx    on public.profiles (city);

/* People you may know = mates of your mates, minus you, minus anyone
   you already have any relationship with, ranked by how many mutual
   friends you share. Security definer so the count is honest even
   though row-level security hides other people's friend rows from
   you — the function returns the tally, never the rows themselves. */
create or replace function public.people_you_may_know(uid uuid, lim int default 30)
returns table (id uuid, name text, avatar_url text, country_flag text, country text, city text, mutuals bigint)
language sql stable security definer set search_path = public as $fn$
  with my_mates as (
    select case when requester_id = uid then addressee_id else requester_id end as mate_id
    from mates
    where status = 'accepted' and (requester_id = uid or addressee_id = uid)
  ),
  candidates as (
    select case when m.requester_id = mm.mate_id then m.addressee_id else m.requester_id end as cand,
           mm.mate_id as via
    from mates m
    join my_mates mm on (m.requester_id = mm.mate_id or m.addressee_id = mm.mate_id)
    where m.status = 'accepted'
  )
  select p.id, p.name, p.avatar_url, p.country_flag, p.country, p.city,
         count(distinct c.via) as mutuals
  from candidates c
  join profiles p on p.id = c.cand
  where c.cand <> uid
    and c.cand not in (select mate_id from my_mates)
    and not exists (
      select 1 from mates x
      where (x.requester_id = uid and x.addressee_id = c.cand)
         or (x.requester_id = c.cand and x.addressee_id = uid))
  group by p.id, p.name, p.avatar_url, p.country_flag, p.country, p.city
  order by mutuals desc, p.name
  limit lim;
$fn$;

grant execute on function public.people_you_may_know(uuid, int) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════
--  PRIVACY & TRUST — enforced by the database, not by the screen
-- ════════════════════════════════════════════════════════════════

/* The blue tick was forgeable. "users can update own profile" allows a
   row update with no column restriction, so any signed-in account could
   set verified = true on itself with a single API call. A trigger keeps
   the column owner-only; it quietly restores the old value instead of
   failing the whole save, so an ordinary edit still goes through. */
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.verified is distinct from old.verified
     and coalesce(auth.jwt() ->> 'email', '') <> 'ayseryourlifecoach@gmail.com' then
    new.verified := old.verified;
  end if;
  return new;
end $fn$;

drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns before update on public.profiles
  for each row execute function public.guard_profile_columns();

/* PRIVATE means private. Until now account_type = 'private' was a label
   on a settings screen: the posts and stories of a private account were
   still readable by anyone, because the read policy said "true". Now the
   database decides, so it holds even for someone calling the API
   directly with their own key. */
create or replace function public.can_see_profile(target uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select case
    when target is null then false
    when target = auth.uid() then true
    when coalesce((select account_type from profiles where id = target), 'public') <> 'private' then true
    else exists (
      select 1 from mates m
      where m.status = 'accepted'
        and ((m.requester_id = auth.uid() and m.addressee_id = target)
          or (m.requester_id = target      and m.addressee_id = auth.uid())))
  end;
$fn$;

grant execute on function public.can_see_profile(uuid) to anon, authenticated;

drop policy if exists "posts are readable by everyone" on public.posts;
drop policy if exists "posts readable by everyone"     on public.posts;
drop policy if exists "read posts you are allowed to see" on public.posts;
create policy "read posts you are allowed to see" on public.posts
  for select using (public.can_see_profile(user_id));

do $do$
begin
  if to_regclass('public.stories') is not null then
    execute 'drop policy if exists "stories are readable by everyone" on public.stories';
    execute 'drop policy if exists "stories readable by everyone"     on public.stories';
    execute 'drop policy if exists "read stories you are allowed to see" on public.stories';
    execute 'create policy "read stories you are allowed to see" on public.stories
             for select using (public.can_see_profile(user_id))';
  end if;
end $do$;

-- ════════════════════════════════════════════════════════════════
--  WHAT PEOPLE ACTUALLY SEARCH FOR — trending's missing signal
-- ════════════════════════════════════════════════════════════════

/* Deliberately anonymous: a row is a term and a timestamp, with no
   user id and no way to add one. Nobody's search history exists to be
   leaked, subpoenaed or sold, and the trending list is still real
   because volume is all it needs. Rows older than 7 days are deleted
   on every write, so this never becomes a pile of stored behaviour. */
create table if not exists public.search_terms (
  id         bigserial primary key,
  term       text not null,
  created_at timestamptz not null default now()
);

create index if not exists search_terms_recent_idx on public.search_terms (created_at desc);
create index if not exists search_terms_term_idx   on public.search_terms (term);

alter table public.search_terms enable row level security;

drop policy if exists "anyone can log a search" on public.search_terms;
create policy "anyone can log a search" on public.search_terms
  for insert with check (char_length(term) between 2 and 40);

-- nobody reads the rows directly; only the aggregate below is exposed
drop policy if exists "search rows are not readable" on public.search_terms;

create or replace function public.trending_searches(lim int default 10)
returns table (term text, searches bigint)
-- volatile on purpose: it prunes before it counts, and a STABLE function
-- may not run DML
language sql volatile security definer set search_path = public as $fn$
  delete from search_terms where created_at < now() - interval '7 days';
  select term, count(*) as searches
  from search_terms
  where created_at > now() - interval '3 days'
  group by term
  having count(*) >= 2          -- one person typing once is not a trend
  order by searches desc, term
  limit lim;
$fn$;

grant execute on function public.trending_searches(int) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════
--  PLAYLISTS — save what you like, the way every music app works
-- ════════════════════════════════════════════════════════════════

create table if not exists public.playlists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  emoji      text default '🎧',
  is_public  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id    uuid not null references public.tracks(id)    on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

create index if not exists playlists_owner_idx        on public.playlists (owner_id);
create index if not exists playlist_tracks_pl_idx     on public.playlist_tracks (playlist_id);

alter table public.playlists       enable row level security;
alter table public.playlist_tracks enable row level security;

drop policy if exists "read own or public playlists" on public.playlists;
create policy "read own or public playlists" on public.playlists
  for select using (owner_id = auth.uid() or is_public);

drop policy if exists "create own playlists" on public.playlists;
create policy "create own playlists" on public.playlists
  for insert with check (owner_id = auth.uid());

drop policy if exists "change own playlists" on public.playlists;
create policy "change own playlists" on public.playlists
  for update using (owner_id = auth.uid());

drop policy if exists "delete own playlists" on public.playlists;
create policy "delete own playlists" on public.playlists
  for delete using (owner_id = auth.uid());

drop policy if exists "read tracks of playlists you can see" on public.playlist_tracks;
create policy "read tracks of playlists you can see" on public.playlist_tracks
  for select using (exists (
    select 1 from playlists p where p.id = playlist_id
      and (p.owner_id = auth.uid() or p.is_public)));

drop policy if exists "add to your own playlists" on public.playlist_tracks;
create policy "add to your own playlists" on public.playlist_tracks
  for insert with check (exists (
    select 1 from playlists p where p.id = playlist_id and p.owner_id = auth.uid()));

drop policy if exists "remove from your own playlists" on public.playlist_tracks;
create policy "remove from your own playlists" on public.playlist_tracks
  for delete using (exists (
    select 1 from playlists p where p.id = playlist_id and p.owner_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════
--  EDITING YOUR OWN COMMENT
--  Deleting one was already allowed; changing one was not, so a typo
--  meant delete and repost, which loses the replies underneath it.
-- ════════════════════════════════════════════════════════════════

alter table public.comments add column if not exists edited_at timestamptz;

drop policy if exists "users can edit own comments" on public.comments;
create policy "users can edit own comments" on public.comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* An edit must not be able to rewrite history: only the text and the
   edited stamp may move. Without this you could re-point a comment at
   another post or another author after the fact. */
create or replace function public.guard_comment_edit()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  new.post_id    := old.post_id;
  new.user_id    := old.user_id;
  new.parent_id  := old.parent_id;
  new.created_at := old.created_at;
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end $fn$;

drop trigger if exists comments_guard_edit on public.comments;
create trigger comments_guard_edit before update on public.comments
  for each row execute function public.guard_comment_edit();

-- ════════════════════════════════════════════════════════════════
--  A MESSAGE SHOULD REACH YOU
--  Realtime already carried a DM to a screen that was open and
--  looking at that thread. Anywhere else — another tab, the app
--  closed, the phone in a pocket — nothing happened at all, so
--  "someone messaged me and it never arrived" was exactly right.
-- ════════════════════════════════════════════════════════════════

/* NOT VALID, and wrapped.

   Adding this constraint the ordinary way asks Postgres to re-check
   every notification ever written, and one legacy row with a kind
   nobody uses any more aborted the entire file — every statement
   after it, including the sounds columns and the storage bucket,
   never ran. A schema change should not be able to take the rest of
   the schema down with it.

   NOT VALID applies the rule to new rows only, which is the whole
   point: it is here to stop bad data arriving, not to litigate old
   data. The DO block means even that cannot break anything else. */
do $do$
begin
  alter table public.notifications drop constraint if exists notifications_kind_check;
  alter table public.notifications add constraint notifications_kind_check
    check (kind in ('vibe','laugh','comment','mate_request','mate_accept','message'))
    not valid;
exception when others then
  raise notice 'notifications kind constraint skipped: %', sqlerrm;
end $do$;

create or replace function public.notify_dm() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare r record;
begin
  if new.dm_thread_id is null then return new; end if;   -- squad chats are noisy enough
  -- every participant except the sender; notify() already ignores self
  for r in
    select user_id from public.dm_participants
    where thread_id = new.dm_thread_id and user_id <> new.user_id
  loop
    perform public.notify(r.user_id, new.user_id, 'message', null,
      case when new.media_url is not null then '📷 sent you a moment'
           else left(coalesce(new.body, ''), 90) end);
  end loop;
  return new;
end $fn$;

drop trigger if exists trg_notify_dm on public.messages;
create trigger trg_notify_dm after insert on public.messages
  for each row execute function public.notify_dm();

-- ════════════════════════════════════════════════════════════════
--  YOUR OWN SOUNDS — the TikTok half of a music library
--
--  A song is something we licensed or that is out of copyright.
--  A SOUND is something a person recorded themselves. They are not
--  the same thing and should not pretend to be, so they get their own
--  kind, their own shelf, and their own rules:
--
--    • a sound you upload is yours alone until you post with it —
--      nobody browses a stranger's voice memos
--    • the moment it carries a reel or a story it becomes usable by
--      anyone, because that is what putting it out in public means
--    • and it is free for reels and stories only. Using someone's
--      voice or recording in an advert is a different act entirely,
--      and it needs their say-so first.
-- ════════════════════════════════════════════════════════════════

alter table public.tracks add column if not exists kind          text    not null default 'song';
alter table public.tracks add column if not exists visibility    text    not null default 'public';
alter table public.tracks add column if not exists commercial_ok boolean not null default false;

alter table public.tracks drop constraint if exists tracks_kind_check;
alter table public.tracks add constraint tracks_kind_check check (kind in ('song','sound'));
alter table public.tracks drop constraint if exists tracks_visibility_check;
alter table public.tracks add constraint tracks_visibility_check check (visibility in ('private','public'));

create index if not exists tracks_kind_idx on public.tracks (kind, visibility);

/* A private sound is visible to the person who recorded it and nobody
   else — enforced here, not by the screen that lists them. */
drop policy if exists "tracks are listenable by everyone" on public.tracks;
create policy "tracks are listenable by everyone" on public.tracks
  for select using (visibility = 'public' or uploader_id = auth.uid());

drop policy if exists "producers update own tracks" on public.tracks;
create policy "producers update own tracks" on public.tracks
  for update using (auth.uid() = uploader_id) with check (auth.uid() = uploader_id);

/* Posting with a sound is what publishes it. Security definer so the
   flip happens even though the poster does not own the sound row —
   and it only ever moves private → public for a sound, never touches
   a song and never takes anything back down. */
create or replace function public.publish_sound(track uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.tracks
     set visibility = 'public'
   where id = track and kind = 'sound' and visibility = 'private';
end $fn$;

grant execute on function public.publish_sound(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
--  FILMS — real titles, real posters, and what people here think
--  We host nothing and stream nothing. A film row is a catalogue
--  entry that points at the services that legally carry it, and the
--  opinions underneath it belong to the people who wrote them.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.films (
  id           bigint primary key,          -- the catalogue's own id
  title        text not null,
  year         int,
  overview     text,
  poster_url   text,
  backdrop_url text,
  genres       text[],
  rating       numeric(3,1),                -- the catalogue's score, not ours
  language     text,
  popularity   numeric,
  updated_at   timestamptz not null default now()
);

create index if not exists films_pop_idx  on public.films (popularity desc);
create index if not exists films_year_idx on public.films (year desc);

alter table public.films enable row level security;
drop policy if exists "films readable by everyone" on public.films;
create policy "films readable by everyone" on public.films for select using (true);

/* One opinion per person per film — you can change your mind, you
   cannot stack five ratings on the same title. */
create table if not exists public.film_reviews (
  film_id    bigint not null references public.films(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  stars      int    not null check (stars between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  primary key (film_id, user_id)
);

create index if not exists film_reviews_film_idx on public.film_reviews (film_id, created_at desc);

alter table public.film_reviews enable row level security;

drop policy if exists "reviews readable by everyone" on public.film_reviews;
create policy "reviews readable by everyone" on public.film_reviews for select using (true);

drop policy if exists "write your own review" on public.film_reviews;
create policy "write your own review" on public.film_reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "change your own review" on public.film_reviews;
create policy "change your own review" on public.film_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete your own review" on public.film_reviews;
create policy "delete your own review" on public.film_reviews
  for delete using (auth.uid() = user_id);

/* What THIS crowd thinks, separate from the catalogue's global score —
   the two are different things and should never be shown as one. */
create or replace function public.film_scores(ids bigint[])
returns table (film_id bigint, avg_stars numeric, votes bigint)
language sql stable security definer set search_path = public as $fn$
  select film_id, round(avg(stars)::numeric, 1), count(*)
  from film_reviews where film_id = any(ids)
  group by film_id;
$fn$;

grant execute on function public.film_scores(bigint[]) to anon, authenticated;


-- ═══════════ TAGGING PEOPLE · and reposts that mean something ═══════════
-- Two small tables' worth of truth. A tag is a row that says "this
-- person is in this moment", written by whoever shared the moment; the
-- tagged person can always take themselves out of it. A repost already
-- had a row — what it never had was an effect, so it gets a
-- notification and a place in the feed like every other real action.

create table if not exists public.post_tags (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tagged_by  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_tags_user_idx on public.post_tags(user_id, created_at desc);
alter table public.post_tags enable row level security;

drop policy if exists "tags readable by everyone" on public.post_tags;
create policy "tags readable by everyone" on public.post_tags for select using (true);

-- only the post's author can tag people in it
drop policy if exists "the author tags" on public.post_tags;
create policy "the author tags" on public.post_tags for insert
  with check (
    auth.uid() = tagged_by
    and exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- the author can untag; so can the person who was tagged (always)
drop policy if exists "untag" on public.post_tags;
create policy "untag" on public.post_tags for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- 'tag' and 'repost' become real notification kinds. NOT VALID so a
-- legacy row can never abort the rest of this file again.
do $do$
begin
  alter table public.notifications drop constraint if exists notifications_kind_check;
  alter table public.notifications add constraint notifications_kind_check
    check (kind in ('vibe','laugh','comment','mate_request','mate_accept','message','call','tag','repost'))
    not valid;
exception when others then
  raise notice 'notifications kind constraint skipped: %', sqlerrm;
end $do$;

create or replace function public.notify_tag() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  perform public.notify(new.user_id, coalesce(new.tagged_by, new.user_id), 'tag', new.post_id, null);
  return new;
end $fn$;

drop trigger if exists trg_notify_tag on public.post_tags;
create trigger trg_notify_tag after insert on public.post_tags
  for each row execute procedure public.notify_tag();

create or replace function public.notify_repost() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  perform public.notify(
    (select user_id from public.posts where id = new.post_id),
    new.user_id, 'repost', new.post_id, null);
  return new;
end $fn$;

drop trigger if exists trg_notify_repost on public.post_reposts;
create trigger trg_notify_repost after insert on public.post_reposts
  for each row execute procedure public.notify_repost();

notify pgrst, 'reload schema';



















-- ═══════════ HIGHLIGHTS · the stories you refuse to lose ═══════════
-- A story dies after 24 hours; a highlight is the copy you kept. The
-- media URL is copied into the item rather than pointed at the story
-- row, so tomorrow's sweep of expired stories can't quietly empty
-- somebody's profile.

create table if not exists public.highlights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null default 'Highlight',
  cover_url  text,
  created_at timestamptz not null default now()
);
create index if not exists highlights_user_idx on public.highlights(user_id, created_at desc);
alter table public.highlights enable row level security;

drop policy if exists "highlights readable by everyone" on public.highlights;
create policy "highlights readable by everyone" on public.highlights for select using (true);
drop policy if exists "your own highlights" on public.highlights;
create policy "your own highlights" on public.highlights for insert with check (auth.uid() = user_id);
drop policy if exists "rename your highlight" on public.highlights;
create policy "rename your highlight" on public.highlights for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete your highlight" on public.highlights;
create policy "delete your highlight" on public.highlights for delete using (auth.uid() = user_id);

create table if not exists public.highlight_items (
  id           uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  media_url    text not null,
  caption      text,
  created_at   timestamptz not null default now()
);
create index if not exists highlight_items_idx on public.highlight_items(highlight_id, created_at);
alter table public.highlight_items enable row level security;

drop policy if exists "highlight items readable by everyone" on public.highlight_items;
create policy "highlight items readable by everyone" on public.highlight_items for select using (true);

drop policy if exists "add to your own highlight" on public.highlight_items;
create policy "add to your own highlight" on public.highlight_items for insert
  with check (exists (select 1 from public.highlights h where h.id = highlight_id and h.user_id = auth.uid()));

drop policy if exists "remove from your own highlight" on public.highlight_items;
create policy "remove from your own highlight" on public.highlight_items for delete
  using (exists (select 1 from public.highlights h where h.id = highlight_id and h.user_id = auth.uid()));

notify pgrst, 'reload schema';



-- ═══════════ TOPICS · somewhere for a moment to belong ═══════════
-- A topic is a real hashtag with a name, a category and a cover we
-- drew ourselves (an emoji on a gradient — nothing licensed). What it
-- is NOT is a number we made up: every count below is a live count of
-- posts that actually carry the tag, so a quiet topic reads as quiet.

create table if not exists public.topics (
  slug       text primary key,
  tag        text not null,                  -- what goes in the caption
  title      text not null,
  category   text not null,
  blurb      text,
  emoji      text,
  tint       text,                           -- the gradient we paint behind it
  featured   boolean not null default false,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.topics enable row level security;

drop policy if exists "topics readable by everyone" on public.topics;
create policy "topics readable by everyone" on public.topics for select using (true);

drop policy if exists "only the owner curates topics" on public.topics;
create policy "only the owner curates topics" on public.topics for all
  using ((auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com');

/* The real numbers: how many moments carry the tag, and how many
   different people wrote them. Nothing here is stored — it is counted
   at the moment you ask, off the posts table itself. */
create or replace function public.topic_counts()
returns table (slug text, moments bigint, people bigint)
language sql stable security definer set search_path = public as $fn$
  select t.slug,
         count(p.id),
         count(distinct p.user_id)
    from public.topics t
    left join public.posts p
      on p.caption ilike '%' || t.tag || '%'
   group by t.slug;
$fn$;

grant execute on function public.topic_counts() to anon, authenticated;

/* The starting set. Half of them are the things this crowd actually
   does — Egypt, food, the ahwa, the gym — and the rest are the ones
   every app this size needs. They are invitations, not decoration:
   each one opens on real posts or an honest empty page. */
insert into public.topics (slug, tag, title, category, blurb, emoji, tint, featured, sort) values
  ('travel-with-friends', '#TravelWithFriends', 'Travel with friends', 'Travel',
   'Hit the road with people you like and turn an ordinary week into a story.', '🧳', 'violet', true, 1),
  ('egypt-now', '#EgyptNow', 'Egypt right now', 'Travel',
   'Where you are, today — the street, the sea, the desert, the traffic.', '🇪🇬', 'amber', true, 2),
  ('cairo-nights', '#CairoNights', 'Cairo nights', 'Lifestyle',
   'The city after dark, from a balcony or a bridge.', '🌃', 'indigo', false, 3),
  ('ahwa', '#Ahwa', 'On the ahwa', 'Foodie',
   'Tea, shisha, backgammon and the argument that comes with them.', '☕', 'brown', true, 4),
  ('my-cooking', '#MyCooking', 'My cooking', 'Foodie',
   'What came out of your kitchen — good or catastrophic.', '🍳', 'orange', false, 5),
  ('food-here', '#FoodHere', 'Food worth the trip', 'Foodie',
   'The place you would send a friend to, with directions.', '🍽️', 'rose', false, 6),
  ('gym-day', '#GymDay', 'Gym day', 'Lifestyle',
   'Showing up, on the days you did not feel like it.', '🏋️', 'green', false, 7),
  ('sunset', '#Sunset', 'Sunset', 'Lifestyle',
   'One photo, no filter needed. The sky does the work.', '🌇', 'coral', false, 8),
  ('learning-english', '#LearningEnglish', 'Learning English', 'Learning',
   'A sentence a day, and people to correct it.', '📚', 'sky', true, 9),
  ('please-correct-me', '#PleaseCorrectMe', 'Please correct me', 'Learning',
   'Write it wrong on purpose. Somebody here will fix it kindly.', '✍️', 'sky', false, 10),
  ('daily-sentence', '#DailySentence', 'Daily sentence', 'Learning',
   'One line in the language you are learning, every day.', '🗒️', 'teal', false, 11),
  ('help-me', '#HelpMe', 'Help me', 'Help Me',
   'Ask the room. Somebody has done this before.', '🆘', 'red', false, 12),
  ('recommend-me', '#RecommendMe', 'Recommend me', 'Help Me',
   'A film, a book, a barber, a place to sit for three hours.', '💡', 'amber', false, 13),
  ('football', '#Football', 'Football', 'Events',
   'The match, the argument about the match, the aftermath.', '⚽', 'green', false, 14),
  ('first-moment', '#FirstMoment', 'My first moment', 'Events',
   'New here? Post one thing. Somebody will say hello.', '👋', 'violet', true, 15),
  ('meet-up', '#MeetUp', 'Meet up', 'Events',
   'A real plan with a real time and a real place.', '📍', 'indigo', false, 16),
  ('my-street', '#MyStreet', 'My street', 'Lifestyle',
   'The five minutes around your door, wherever that is on Earth.', '🏘️', 'teal', false, 17),
  ('pets', '#Pets', 'The animal in my house', 'Lifestyle',
   'It runs the place and you know it.', '🐈', 'rose', false, 18)
on conflict (slug) do update set
  tag = excluded.tag, title = excluded.title, category = excluded.category,
  blurb = excluded.blurb, emoji = excluded.emoji, tint = excluded.tint,
  featured = excluded.featured, sort = excluded.sort;

notify pgrst, 'reload schema';



-- ═══════════ YOUR LIBRARY · upload once, post whenever ═══════════
-- Uploading at the moment you post is the worst possible time to do
-- it: you are standing there watching a bar, and on a bad connection
-- the whole thing fails and takes the caption with it. A library moves
-- the wait to a moment nobody is waiting — you add clips and photos
-- when you have signal, and posting later is instant because the file
-- is already up there.
--
-- It is YOURS: the read policy is your own rows only. Nobody browses
-- anybody else's library, ever.

create table if not exists public.media_library (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  url        text not null,
  kind       text not null default 'photo' check (kind in ('photo','video')),
  bytes      bigint,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists media_library_user_idx on public.media_library(user_id, created_at desc);
alter table public.media_library enable row level security;

drop policy if exists "your library is yours" on public.media_library;
create policy "your library is yours" on public.media_library
  for select using (auth.uid() = user_id);

drop policy if exists "add to your library" on public.media_library;
create policy "add to your library" on public.media_library
  for insert with check (auth.uid() = user_id);

drop policy if exists "tidy your library" on public.media_library;
create policy "tidy your library" on public.media_library
  for delete using (auth.uid() = user_id);

drop policy if exists "count your own uses" on public.media_library;
create policy "count your own uses" on public.media_library
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';



-- ═══════════ TAKEDOWNS · somebody has to be able to act ═══════════
-- People can report a story or a moment, and that only means something
-- if one account can actually remove it. That account is the one that
-- runs Moments — nobody else gains anything here.

drop policy if exists "the owner can take a story down" on public.stories;
create policy "the owner can take a story down" on public.stories for delete
  using ((auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com');

drop policy if exists "the owner can take a post down" on public.posts;
create policy "the owner can take a post down" on public.posts for delete
  using ((auth.jwt() ->> 'email') = 'ayseryourlifecoach@gmail.com');

notify pgrst, 'reload schema';



-- ═══════════ STORIES · owned by this file, not by luck ═══════════
-- The stories table was only ever created by schema.sql, which this
-- file does not run. If a project had never had that file pasted into
-- it, every story anybody posted went nowhere — the insert failed and
-- the rail forgot it on the next refresh. It lives here now, with the
-- columns the app actually sends, so a story cannot half-exist.

create table if not exists public.stories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  media_url    text not null,
  caption      text,
  sound_title  text,
  sound_artist text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '24 hours')
);

alter table public.stories add column if not exists sound_url    text;
alter table public.stories add column if not exists place        text;
alter table public.stories add column if not exists lat          double precision;
alter table public.stories add column if not exists lng          double precision;
alter table public.stories add column if not exists sticker_type text;
alter table public.stories add column if not exists sticker_data text;
alter table public.stories add column if not exists comments_off boolean not null default false;

create index if not exists stories_live_idx on public.stories (expires_at desc);
create index if not exists stories_user_idx on public.stories (user_id, created_at desc);

alter table public.stories enable row level security;

drop policy if exists "users create own stories" on public.stories;
create policy "users create own stories" on public.stories
  for insert with check (auth.uid() = user_id);

drop policy if exists "users delete own stories" on public.stories;
create policy "users delete own stories" on public.stories
  for delete using (auth.uid() = user_id);

drop policy if exists "change your own story" on public.stories;
create policy "change your own story" on public.stories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';


-- ═══════════ TURN-BASED BOARD GAMES · two people, one board ═══════════
-- The live arcade duels ride a broadcast channel and keep no state, which
-- is right for a 30-second race: if you reload mid-race, the race is over.
-- A board game is the opposite — you might take a turn, put the phone
-- down, and come back an hour later. So the board itself lives in the row.
-- Broadcast still fires on every move for the instant feel; the row is
-- what makes it survive a reload, a dead battery, or a flight.
alter table public.game_matches add column if not exists state   jsonb;
alter table public.game_matches add column if not exists turn    uuid references public.profiles(id);
alter table public.game_matches add column if not exists move_no int not null default 0;

-- Realtime needs the whole row on update so a client can tell what moved.
alter table public.game_matches replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.game_matches;
exception when duplicate_object then null;
     when undefined_object then null;
end $$;

notify pgrst, 'reload schema';


-- ═══════════ WHO YOU ARE · one self-declared field ═══════════
-- Set in the character studio ("Body → who are you?"). It exists for one
-- reason: girls-only trips. It is the person's own answer about
-- themselves, nobody else can write it, and nothing else in the app
-- reads it.
alter table public.profiles add column if not exists gender text
  check (gender is null or gender in ('m', 'f', 'n'));


-- ═══════════ TRIPS · plans other people can actually join ═══════════
-- A campfire is "I am here now". A trip is "I am going there, come with
-- me" — a date, a destination, a number of seats. It shows on the map as
-- a plan you can join, and it disappears on its own once it's over.
--
-- `girls_only` is enforced in the policy, not in the UI: the database
-- refuses the join, so it holds even if someone talks to the API
-- directly. That is the difference between a promise and a rule.
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  destination text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  seats       int not null default 6,
  girls_only  boolean not null default false,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists trips_starts_idx on public.trips (starts_at desc);
alter table public.trips enable row level security;

drop policy if exists "trips_sel" on public.trips;
create policy "trips_sel" on public.trips for select using (true);
drop policy if exists "trips_ins" on public.trips;
create policy "trips_ins" on public.trips for insert with check (auth.uid() = host_id);
drop policy if exists "trips_upd" on public.trips;
create policy "trips_upd" on public.trips for update using (auth.uid() = host_id);
drop policy if exists "trips_del" on public.trips;
create policy "trips_del" on public.trips for delete using (
  auth.uid() = host_id
  or auth.jwt() ->> 'email' = 'ayseryourlifecoach@gmail.com'
);

create table if not exists public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_members enable row level security;

drop policy if exists "tm_sel" on public.trip_members;
create policy "tm_sel" on public.trip_members for select using (true);

-- You may join a trip if it isn't full, and — when it is girls-only —
-- only if your own profile says so. Both halves are checked here, in the
-- database, where they cannot be skipped.
drop policy if exists "tm_ins" on public.trip_members;
create policy "tm_ins" on public.trip_members for insert with check (
  auth.uid() = user_id
  and (
    select count(*) from public.trip_members m where m.trip_id = trip_members.trip_id
  ) < (select seats from public.trips t where t.id = trip_members.trip_id)
  and (
    not (select girls_only from public.trips t where t.id = trip_members.trip_id)
    or (select gender from public.profiles p where p.id = auth.uid()) = 'f'
  )
);

drop policy if exists "tm_del" on public.trip_members;
create policy "tm_del" on public.trip_members for delete using (
  auth.uid() = user_id
  or auth.uid() = (select host_id from public.trips t where t.id = trip_members.trip_id)
);

-- A host is on their own trip from the moment it exists.
create or replace function public.trip_host_joins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id) values (new.id, new.host_id)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trips_host_joins on public.trips;
create trigger trips_host_joins after insert on public.trips
  for each row execute function public.trip_host_joins();

notify pgrst, 'reload schema';


-- ═══════════ CLOSE FRIENDS · the smaller circle ═══════════
-- One list, yours, private. Nobody is told they're on it and nobody is
-- told they're not — that discretion is the entire point, and it is
-- enforced here rather than by leaving a button out of the UI.
create table if not exists public.close_friends (
  owner_id  uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (owner_id, friend_id)
);
alter table public.close_friends enable row level security;

-- You can read YOUR list. You cannot read anyone else's, and you cannot
-- find out whose list you are on — that would defeat the whole idea.
drop policy if exists "cf_sel" on public.close_friends;
create policy "cf_sel" on public.close_friends for select using (auth.uid() = owner_id);
drop policy if exists "cf_ins" on public.close_friends;
create policy "cf_ins" on public.close_friends for insert with check (auth.uid() = owner_id);
drop policy if exists "cf_del" on public.close_friends;
create policy "cf_del" on public.close_friends for delete using (auth.uid() = owner_id);

-- A story or a moment can be for the smaller circle only.
alter table public.stories add column if not exists close_only boolean not null default false;
alter table public.posts   add column if not exists close_only boolean not null default false;

/* Is `viewer` on `owner`'s list? Security definer so the check can see
   a list the viewer isn't allowed to read — which is what lets us
   filter without ever handing anyone the list itself. */
create or replace function public.is_close_friend(owner uuid, viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.close_friends
    where owner_id = owner and friend_id = viewer
  );
$$;

-- Close-only stories are visible to the author and to the circle. This
-- replaces the open read policy, so the restriction is real: it holds
-- against the API, not just against our own screens.
drop policy if exists "stories_sel" on public.stories;
drop policy if exists "stories_select" on public.stories;
create policy "stories_sel" on public.stories for select using (
  not close_only
  or auth.uid() = user_id
  or public.is_close_friend(user_id, auth.uid())
);

drop policy if exists "posts_close_sel" on public.posts;
create policy "posts_close_sel" on public.posts for select using (
  not close_only
  or auth.uid() = user_id
  or public.is_close_friend(user_id, auth.uid())
);

notify pgrst, 'reload schema';


-- ═══════════ FOLLOWS · who you follow, who follows you ═══════════
-- Mates are mutual and always were. Following is the other thing: one
-- direction, no permission needed, and the two counts on a profile can
-- differ — which is the only reason showing both is worth anything.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;
drop policy if exists "fl_sel" on public.follows;
create policy "fl_sel" on public.follows for select using (true);
drop policy if exists "fl_ins" on public.follows;
create policy "fl_ins" on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "fl_del" on public.follows;
create policy "fl_del" on public.follows for delete using (auth.uid() = follower_id);


-- ═══════════ MESSAGE REQUESTS · a stranger has to be let in ═══════════
-- Anyone can write to you. What they cannot do is land in your inbox
-- uninvited, keep going when you haven't answered, or send you a
-- picture before you've agreed to hear from them.
--
-- That last rule is the one that matters. Almost every unwanted image
-- somebody receives comes from an account they have never spoken to,
-- and no filter catches those reliably. Not accepting media from
-- strangers does — completely, and without having to inspect anybody's
-- photos.
alter table public.dm_participants add column if not exists accepted boolean;
alter table public.dm_participants add column if not exists invited_by uuid references public.profiles(id);

/* Have these two agreed to talk? True when both sides have either
   accepted or started the thread. Security definer so it can read the
   whole thread without handing the caller everyone's rows. */
create or replace function public.dm_is_open(thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(bool_and(coalesce(accepted, true)), true)
  from public.dm_participants where thread_id = thread;
$$;

/* An unanswered request gets a few lines to say who you are — not an
   open channel. Media is refused outright until it's accepted. */
create or replace function public.dm_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  open_thread boolean;
  sent_count  int;
begin
  if new.dm_thread_id is null then return new; end if;
  select public.dm_is_open(new.dm_thread_id) into open_thread;
  if open_thread then return new; end if;

  if new.media_url is not null or new.kind in ('moment', 'game_invite') then
    raise exception 'Photos and games only after they accept your request.'
      using errcode = 'check_violation';
  end if;

  select count(*) into sent_count
  from public.messages
  where dm_thread_id = new.dm_thread_id and user_id = new.user_id;
  if sent_count >= 3 then
    raise exception 'Wait until they accept before sending more.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists messages_dm_guard on public.messages;
create trigger messages_dm_guard before insert on public.messages
  for each row execute function public.dm_guard();


-- ═══════════ SQUAD INVITES · nobody gets dropped into a room ═══════════
-- Being added to a group without a say is exactly the thing people
-- hate. An invite now sits pending until the person accepts it, and
-- until then the squad does not appear in their list.
alter table public.squad_members add column if not exists accepted boolean not null default true;
alter table public.squad_members add column if not exists invited_by uuid references public.profiles(id);

notify pgrst, 'reload schema';


-- ═══════════════════ READINESS CHECKLIST ═══════════════════
-- Every column below should say TRUE. If chat_ready is FALSE,
-- also run supabase/schema_v2_live.sql (messages & live map).
select
  (to_regclass('public.mates')                is not null) as friends_ready,
  (to_regclass('public.post_laughs')          is not null) as laughs_ready,
  (to_regclass('public.destination_reviews')  is not null) as destination_reviews_ready,
  (to_regclass('public.notifications')        is not null) as notifications_ready,
  (to_regclass('public.dm_threads')           is not null) as chat_ready,
  (to_regclass('public.profiles')             is not null) as profiles_ready,
  (to_regclass('public.posts')                is not null) as posts_ready,
  (to_regclass('public.trip_requests')        is not null) as book_trip_ready,
  (to_regclass('public.tracks')               is not null) as real_songs_ready,
  (to_regclass('public.venue_bookings')       is not null) as venue_bookings_ready,
  (to_regclass('public.post_reposts')         is not null) as reposts_ready,
  (to_regclass('public.story_poll_votes')     is not null) as story_polls_ready,
  (to_regclass('public.story_views')          is not null) as story_views_ready,
  (to_regclass('public.story_reactions')      is not null) as story_reactions_ready,
  (to_regclass('public.story_comments')       is not null) as story_comments_ready,
  (to_regclass('public.game_matches')         is not null) as multiplayer_ready,
  (to_regclass('public.help_articles')        is not null) as help_articles_ready,
  (to_regclass('public.bardi_config')         is not null) as bardi_portal_ready,
  (to_regclass('public.bardi_knowledge')      is not null) as bardi_knowledge_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'country')                    as country_column_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'avatar_dna')                  as avatar_builder_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'city')                        as discover_ready,
  (select file_size_limit from storage.buckets where id = 'media') as media_size_limit,
  (select coalesce(array_to_string(allowed_mime_types, ','), 'any')
     from storage.buckets where id = 'media')                      as media_mime_types,
  (to_regclass('public.playlists')            is not null) as playlists_ready,
  (to_regclass('public.post_tags')            is not null) as tagging_ready,
  (to_regclass('public.highlights')           is not null) as highlights_ready,
  (to_regclass('public.topics')               is not null) as topics_ready,
  (to_regclass('public.media_library')        is not null) as library_ready,
  (to_regclass('public.stories')              is not null) as stories_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'stories'
            and column_name = 'sticker_type')                as story_stickers_ready,
  (to_regclass('public.films')                is not null) as films_ready,
  (to_regclass('public.follows')              is not null) as follows_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'dm_participants'
            and column_name = 'accepted')                    as message_requests_ready,
  (to_regclass('public.close_friends')        is not null) as close_friends_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'stories'
            and column_name = 'close_only')                  as close_stories_ready,
  (to_regclass('public.trips')                is not null) as trips_ready,
  (to_regclass('public.trip_members')         is not null) as trip_members_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'gender')                      as gender_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'game_matches'
            and column_name = 'state')                       as board_games_ready;


-- ═══════════ SETTINGS THAT FOLLOW YOU, NOT THE PHONE ═══════════
-- Preferences lived in one phone's local storage, so signing in
-- somewhere else handed you a stranger's version of your own app:
-- light mode again, message timer back to the default. These two
-- belong to the person, not the device.
--
-- message_ttl_hours: how long your messages live, in hours.
--   NULL = never chosen, so the app's default (48) applies.
--   0    = keep them until you delete them.
alter table public.profiles add column if not exists theme_pref        text
  check (theme_pref in ('auto', 'light', 'dark'));
alter table public.profiles add column if not exists message_ttl_hours int
  check (message_ttl_hours is null or message_ttl_hours >= 0);

notify pgrst, 'reload schema';


-- ═══════════ A STILL FOR EVERY VIDEO ═══════════
-- A posted reel was a blank white tile in the profile grid: there was
-- nowhere to keep the frame, so nothing could be drawn. The capture
-- screen already pulls a frame out for its own preview; this is where
-- it lives.
alter table public.posts add column if not exists thumb_url text;

notify pgrst, 'reload schema';


-- ═══════════ TRAVEL PLANS ═══════════
-- "I'm in Romania this August, who's around?" — a post whose point is
-- the trip behind it. Everything a plan needs beyond a normal moment
-- rides in one JSON column: the headline, when it starts and ends, and
-- what the person is up for while they're there. One column instead of
-- five keeps the posts table honest and lets the plan grow later
-- without another migration.
--
-- Shape:
--   { "title": "Solo traveler exploring Romania",
--     "from": "2026-08", "to": "2026-09",
--     "upFor": ["coffee","hiking","live music"] }
alter table public.posts add column if not exists plan jsonb;

-- Anyone can read a travel plan, the same as any other post; only its
-- owner can write it. That is already the posts policy, so there is no
-- new policy here — the column simply inherits it.

notify pgrst, 'reload schema';


-- ═══════════ BARDI REMEMBERS THE CONVERSATION ═══════════
-- The chat with Bardi lived in the screen and nowhere else, so closing
-- the sheet threw the whole conversation away — you came back to an
-- empty screen every time. It is kept on the device regardless; this
-- table is what makes the same conversation appear on a laptop as on a
-- phone.
--
-- One row per person. Nobody can read or write anybody else's.
create table if not exists public.bardi_chats (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bardi_chats enable row level security;

drop policy if exists "bardi_chat_own_select" on public.bardi_chats;
create policy "bardi_chat_own_select" on public.bardi_chats
  for select using (auth.uid() = user_id);

drop policy if exists "bardi_chat_own_insert" on public.bardi_chats;
create policy "bardi_chat_own_insert" on public.bardi_chats
  for insert with check (auth.uid() = user_id);

drop policy if exists "bardi_chat_own_update" on public.bardi_chats;
create policy "bardi_chat_own_update" on public.bardi_chats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bardi_chat_own_delete" on public.bardi_chats;
create policy "bardi_chat_own_delete" on public.bardi_chats
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
--  GROUPS — create, discover, join, leave
--  These tables were only ever in schema_v5_groups.sql, which is not
--  the file anybody actually runs. So "Create a group" pressed a
--  button against a table that was not there: nothing was made, and
--  nothing said why. Here they are, in the one file you paste.
--  Idempotent — safe to run over an installation that already has it.
-- ════════════════════════════════════════════════════════════════

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

create index if not exists groups_created_idx       on public.groups(created_at desc);
create index if not exists group_members_joined_idx on public.group_members(joined_at desc);

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

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

drop policy if exists "group members are viewable by everyone" on public.group_members;
create policy "group members are viewable by everyone"
  on public.group_members for select using (true);
drop policy if exists "users join groups as themselves" on public.group_members;
create policy "users join groups as themselves"
  on public.group_members for insert with check (auth.uid() = user_id);
drop policy if exists "users leave groups" on public.group_members;
create policy "users leave groups"
  on public.group_members for delete using (auth.uid() = user_id);

-- whoever makes a group is its first member
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

-- live member counts for the discovery list
create or replace view public.groups_with_counts as
  select g.*, coalesce(m.cnt, 0) as members_count
  from public.groups g
  left join (
    select group_id, count(*) as cnt from public.group_members group by group_id
  ) m on m.group_id = g.id;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · LAMMA — the live + async quiz game
--  Phase 1: the data and the rules. No screens yet.
--
--  THE ONE RULE THIS FILE EXISTS TO ENFORCE
--  A player's device never decides what a player scored, and never
--  learns the right answer before the question has closed. Both of
--  those are impossible from the client here, not discouraged:
--
--    · lamma_questions_public is a view with correct_index REMOVED.
--      That is the only way a client can read a question. There is no
--      policy to forget, because the column is not in the view.
--    · answers can only be written through lamma_submit_answer, which
--      is security definer. It reads the right answer, does the
--      arithmetic itself, and hands back an acknowledgement — not a
--      verdict. Sending "I scored 800" has nowhere to arrive.
--    · lamma_reveal refuses to say anything until the deadline has
--      actually passed, by the server's clock.
--
--  Run in: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── CONTENT ────────────────────────────────────────────────────────
create table if not exists public.game_packs (
  id          uuid primary key default gen_random_uuid(),
  title_ar    text not null,
  title_en    text,
  description_ar text,
  cover_url   text,
  category    text,
  locale      text not null default 'ar-EG',
  is_official boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  visibility  text not null default 'public' check (visibility in ('public','friends','private')),
  plays_count int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid not null references public.game_packs(id) on delete cascade,
  order_index int not null default 0,
  text_ar     text not null,
  media_url   text,
  media_type  text check (media_type in ('image','audio')),
  timer_ms    int not null default 20000 check (timer_ms between 5000 and 120000),
  options     jsonb not null,              -- [{index:0,text_ar:"…"}, …] 2..4
  correct_index int not null check (correct_index between 0 and 3),
  points_style text not null default 'standard' check (points_style in ('standard','double','none')),
  -- a question nobody can read on a phone is a bug, not a feature
  constraint questions_options_size check (jsonb_array_length(options) between 2 and 4),
  constraint questions_text_len check (char_length(text_ar) <= 120)
);
create index if not exists questions_pack_idx on public.questions (pack_id, order_index);

-- ── ROOMS ──────────────────────────────────────────────────────────
create table if not exists public.game_rooms (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid references public.game_packs(id) on delete set null,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  join_code   text unique not null,
  mode        text not null default 'classic' check (mode in ('classic','meen_feena','duel')),
  status      text not null default 'lobby' check (status in ('lobby','question','reveal','leaderboard','ended')),
  current_question_index int not null default -1,
  current_started_at  timestamptz,
  current_deadline_at timestamptz,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists game_rooms_code_idx on public.game_rooms (join_code);

create table if not exists public.room_players (
  room_id     uuid not null references public.game_rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  nickname    text,
  avatar_key  text,
  score       int not null default 0,
  streak      int not null default 0,
  best_streak int not null default 0,
  joined_at   timestamptz not null default now(),
  is_connected boolean not null default true,
  primary key (room_id, user_id)
);
create index if not exists room_players_room_idx on public.room_players (room_id, score desc);

create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.game_rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  selected_index int,
  elapsed_ms  int,
  is_correct  boolean,
  points_awarded int not null default 0,
  server_received_at timestamptz not null default now(),
  flagged     boolean not null default false,
  -- one answer per player per question, decided by the database and not
  -- by a disabled button
  unique (room_id, question_id, user_id)
);

-- ── ASYNC DUELS ────────────────────────────────────────────────────
create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id   uuid not null references public.profiles(id) on delete cascade,
  pack_id       uuid references public.game_packs(id) on delete set null,
  challenger_score int,
  opponent_score   int,
  status        text not null default 'pending' check (status in ('pending','played','expired')),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);
create index if not exists duels_opponent_idx on public.duels (opponent_id, status);

-- ── مين فينا؟ ──────────────────────────────────────────────────────
create table if not exists public.poll_questions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.game_rooms(id) on delete cascade,
  text_ar     text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  order_index int not null default 0
);

create table if not exists public.poll_votes (
  room_id          uuid not null references public.game_rooms(id) on delete cascade,
  poll_question_id uuid not null references public.poll_questions(id) on delete cascade,
  voter_id         uuid not null references public.profiles(id) on delete cascade,
  target_user_id   uuid not null references public.profiles(id) on delete cascade,
  primary key (room_id, poll_question_id, voter_id)
);

-- ═══════════════════════════════════════════════════════════════════
--  THE SCORING RULES, IN SQL
--  The same arithmetic as src/lib/lammaScore.js, deliberately written
--  in double precision rather than numeric so it is bit-for-bit what
--  JavaScript computes. Exact decimal maths would be "better" and would
--  quietly disagree with the app about the last point, which is exactly
--  the argument this game must never start.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_award(
  p_is_correct   boolean,
  p_elapsed_ms   int,
  p_timer_ms     int,
  p_points_style text,
  p_streak       int,          -- counting this answer: 1 is the first
  p_is_last_two  boolean
) returns int
language plpgsql immutable as $$
declare
  base   int;
  timer  int;
  elapsed int;
  raw    int;
  mult   double precision;
begin
  if not coalesce(p_is_correct, false) then return 0; end if;

  base := case p_points_style when 'double' then 2000 when 'none' then 0 else 1000 end;
  timer := greatest(1000, coalesce(p_timer_ms, 20000));
  elapsed := least(greatest(coalesce(p_elapsed_ms, timer), 0), timer);

  if elapsed <= 500 then
    raw := base;
  else
    raw := floor(base::double precision * (1 - (elapsed::double precision / timer) / 2))::int;
  end if;
  raw := greatest(raw, floor(base::double precision * 0.5)::int);

  mult := least(1 + 0.1 * (greatest(coalesce(p_streak, 1), 1) - 1), 1.5);
  if coalesce(p_is_last_two, false) then mult := mult * 1.5; end if;
  mult := round(mult::numeric, 2)::double precision;

  return floor(raw::double precision * mult)::int;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  WHAT A CLIENT IS ALLOWED TO SEE OF A QUESTION
--  correct_index is absent from this view. Not hidden by a policy that
--  somebody might loosen later — absent.
-- ═══════════════════════════════════════════════════════════════════
create or replace view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, media_url, media_type,
         timer_ms, options, points_style
    from public.questions;

-- ═══════════════════════════════════════════════════════════════════
--  SUBMITTING AN ANSWER
--  Takes how long you took. Returns whether it was accepted. It does
--  NOT return whether you were right: telling you at submit time tells
--  you before the question has closed, and one player who knows can
--  tell four who do not.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_submit_answer(
  p_room_id     uuid,
  p_question_id uuid,
  p_selected_index int,
  p_elapsed_ms  int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  r         public.game_rooms%rowtype;
  q         public.questions%rowtype;
  pl        public.room_players%rowtype;
  v_correct boolean;
  v_elapsed int;
  v_streak  int;
  v_points  int;
  v_last_two boolean;
  v_total   int;
  v_flag    boolean := false;
begin
  if me is null then return jsonb_build_object('accepted', false, 'reason', 'signed_out'); end if;

  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_room'); end if;

  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'not_in_room'); end if;

  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_question'); end if;

  -- too late is too late, by the server's clock and nobody else's
  if r.current_deadline_at is not null and now() > r.current_deadline_at + interval '2 seconds' then
    return jsonb_build_object('accepted', false, 'reason', 'too_late');
  end if;

  /* The player's own measurement is trusted, within reason — they
     timed it from the frame the question appeared, which is the only
     honest clock for "how long did they take". It is clamped into the
     possible range rather than rejected, because a phone that was slow
     is not a phone that was cheating. */
  v_elapsed := least(greatest(coalesce(p_elapsed_ms, q.timer_ms), 0), q.timer_ms + 1500);

  /* A gap between what they claim and what the network shows gets
     marked for a human to look at later — and the answer still counts.
     Nobody loses a game because their signal dropped. */
  if r.current_started_at is not null
     and extract(epoch from (now() - r.current_started_at)) * 1000 > v_elapsed + 5000 then
    v_flag := true;
  end if;

  v_correct := (p_selected_index is not null and p_selected_index = q.correct_index);
  v_streak  := case when v_correct then pl.streak + 1 else 0 end;

  select count(*) into v_total from public.questions where pack_id = q.pack_id;
  v_last_two := (q.order_index >= v_total - 2);

  v_points := public.lamma_award(v_correct, v_elapsed, q.timer_ms, q.points_style, v_streak, v_last_two);

  begin
    insert into public.answers (room_id, question_id, user_id, selected_index, elapsed_ms,
                                is_correct, points_awarded, flagged)
    values (p_room_id, p_question_id, me, p_selected_index, v_elapsed, v_correct, v_points, v_flag);
  exception when unique_violation then
    -- they already answered this one; the first answer stands
    return jsonb_build_object('accepted', false, 'reason', 'already_answered');
  end;

  update public.room_players
     set score = score + v_points,
         streak = v_streak,
         best_streak = greatest(best_streak, v_streak)
   where room_id = p_room_id and user_id = me;

  -- an acknowledgement, and nothing that gives the answer away
  return jsonb_build_object('accepted', true, 'elapsed_ms', v_elapsed);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  THE REVEAL
--  Refuses to say anything until the deadline has genuinely passed.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_reveal(p_room_id uuid, p_question_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  mine public.answers%rowtype;
  dist jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not exists (select 1 from public.room_players where room_id = p_room_id and user_id = me) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  select * into r from public.game_rooms where id = p_room_id;
  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  if r.current_deadline_at is null or now() < r.current_deadline_at then
    return jsonb_build_object('ok', false, 'reason', 'not_yet');
  end if;

  select jsonb_agg(x) into dist from (
    select selected_index as index, count(*) as votes
      from public.answers
     where room_id = p_room_id and question_id = p_question_id
     group by selected_index order by selected_index
  ) x;

  select * into mine from public.answers
   where room_id = p_room_id and question_id = p_question_id and user_id = me;

  return jsonb_build_object(
    'ok', true,
    'correct_index', q.correct_index,
    'distribution', coalesce(dist, '[]'::jsonb),
    'your_result', case when mine.id is null then null else jsonb_build_object(
      'is_correct', mine.is_correct, 'points', mine.points_awarded) end
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  COMING BACK
--  Everything a phone that dropped out needs to rejoin exactly where
--  the room is now — including whether it may still answer.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_sync(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  pl public.room_players%rowtype;
  qid uuid;
  answered boolean := false;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_in_room'); end if;

  select id into qid from public.questions
   where pack_id = r.pack_id and order_index = r.current_question_index;
  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--
--  "Are you in this room?" is asked by nearly every policy below, and
--  the obvious way to ask it — a sub-select on room_players — makes the
--  policy ON room_players consult room_players, which consults itself.
--  Postgres stops that with "infinite recursion detected in policy",
--  and the table becomes unreadable: not a leak, but every score on
--  screen turns into an error.
--
--  Asking through a security definer function breaks the loop, because
--  the function's own read is not policed. It is marked stable so the
--  planner asks once per statement rather than once per row.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.lamma_in_room(p_room uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.room_players
     where room_id = p_room and user_id = auth.uid()
  );
$$;
grant execute on function public.lamma_in_room(uuid) to anon, authenticated;
alter table public.game_packs     enable row level security;
alter table public.questions      enable row level security;
alter table public.game_rooms     enable row level security;
alter table public.room_players   enable row level security;
alter table public.answers        enable row level security;
alter table public.duels          enable row level security;
alter table public.poll_questions enable row level security;
alter table public.poll_votes     enable row level security;

drop policy if exists "packs readable" on public.game_packs;
create policy "packs readable" on public.game_packs for select
  using (visibility = 'public' or created_by = auth.uid());
drop policy if exists "packs authored by you" on public.game_packs;
create policy "packs authored by you" on public.game_packs for insert with check (created_by = auth.uid());
drop policy if exists "packs edited by you" on public.game_packs;
create policy "packs edited by you" on public.game_packs for update using (created_by = auth.uid());

/* NOTHING may read the questions table directly — not even to count
   them. Clients go through lamma_questions_public, which has no right
   answer in it to leak. */
drop policy if exists "questions are not client readable" on public.questions;

drop policy if exists "rooms readable by their players" on public.game_rooms;
create policy "rooms readable by their players" on public.game_rooms for select
  using (public.lamma_in_room(id) or host_user_id = auth.uid());
drop policy if exists "you host your own rooms" on public.game_rooms;
create policy "you host your own rooms" on public.game_rooms for insert with check (host_user_id = auth.uid());
drop policy if exists "the host runs the room" on public.game_rooms;
create policy "the host runs the room" on public.game_rooms for update using (host_user_id = auth.uid());

drop policy if exists "players see their room" on public.room_players;
create policy "players see their room" on public.room_players for select
  using (public.lamma_in_room(room_id));
drop policy if exists "you join as yourself" on public.room_players;
create policy "you join as yourself" on public.room_players for insert with check (user_id = auth.uid());
/* Deliberately NO update policy. Score is written by
   lamma_submit_answer, which is security definer. A player cannot set
   their own score, because there is no policy under which that write
   would be allowed. */

drop policy if exists "answers readable by the room" on public.answers;
create policy "answers readable by the room" on public.answers for select
  using (public.lamma_in_room(room_id));
/* No insert policy either: answers arrive only through the function. */

drop policy if exists "duels readable by the two of you" on public.duels;
create policy "duels readable by the two of you" on public.duels for select
  using (auth.uid() in (challenger_id, opponent_id));
drop policy if exists "you challenge as yourself" on public.duels;
create policy "you challenge as yourself" on public.duels for insert with check (challenger_id = auth.uid());
drop policy if exists "the two of you update it" on public.duels;
create policy "the two of you update it" on public.duels for update
  using (auth.uid() in (challenger_id, opponent_id));

drop policy if exists "prompts readable by the room" on public.poll_questions;
create policy "prompts readable by the room" on public.poll_questions for select
  using (public.lamma_in_room(room_id));
drop policy if exists "you add prompts to your room" on public.poll_questions;
create policy "you add prompts to your room" on public.poll_questions for insert
  with check (public.lamma_in_room(room_id));

drop policy if exists "votes readable by the room" on public.poll_votes;
create policy "votes readable by the room" on public.poll_votes for select
  using (public.lamma_in_room(room_id));
drop policy if exists "you vote as yourself" on public.poll_votes;
create policy "you vote as yourself" on public.poll_votes for insert with check (voter_id = auth.uid());

grant select on public.lamma_questions_public to anon, authenticated;
grant execute on function public.lamma_award(boolean,int,int,text,int,boolean) to anon, authenticated;
grant execute on function public.lamma_submit_answer(uuid,uuid,int,int) to authenticated;
grant execute on function public.lamma_reveal(uuid,uuid) to authenticated;
grant execute on function public.lamma_sync(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · LAMMA — running a room
--  Phase 2, server half. Everything that changes a room's state lives
--  here, so a phone can ask for a change but can never make one.
--
--  Realtime is used ONLY to tell phones what already happened. Nothing
--  a client broadcasts is ever trusted, because nothing a client
--  broadcasts is ever read.
-- ═══════════════════════════════════════════════════════════════════

/* ── THE JOIN CODE ────────────────────────────────────────────────
   Six characters, read aloud across a room, usually badly. So: no O
   against 0, no I or l against 1, no S against 5. What is left cannot
   be misheard or mistyped into somebody else's game. */
create or replace function public.lamma_new_code()
returns text
language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
  code text;
  tries int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.game_rooms where join_code = code);
    tries := tries + 1;
    if tries > 50 then
      -- 29^6 codes; if fifty draws all collide something is very wrong
      raise exception 'could not find a free join code';
    end if;
  end loop;
  return code;
end;
$$;

/* ── OPENING A ROOM ──────────────────────────────────────────────── */
create or replace function public.lamma_create_room(p_pack_id uuid, p_mode text default 'classic')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not exists (select 1 from public.game_packs where id = p_pack_id) then
    return jsonb_build_object('ok', false, 'reason', 'no_pack');
  end if;

  insert into public.game_rooms (pack_id, host_user_id, join_code, mode, status)
  values (p_pack_id, me, public.lamma_new_code(), coalesce(p_mode, 'classic'), 'lobby')
  returning * into r;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'join_code', r.join_code);
end;
$$;

/* ── COMING IN ────────────────────────────────────────────────────
   By code, because that is how somebody across a room joins without
   being anybody's friend first. Joining a game already in progress is
   allowed: you start on nothing and play the rest. Being told "too
   late" by an app your friends are laughing at is a worse experience
   than losing. */
create or replace function public.lamma_join_room(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;

  select * into r from public.game_rooms where join_code = upper(trim(p_code));
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_code'); end if;
  if r.status = 'ended' then return jsonb_build_object('ok', false, 'reason', 'game_over'); end if;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me
  on conflict (room_id, user_id) do update set is_connected = true;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'status', r.status,
                            'question_index', r.current_question_index);
end;
$$;

/* ── MOVING THE GAME ON ───────────────────────────────────────────
   Only the host, and the deadline is set here from the server's own
   clock. A phone asking "start question 3" cannot decide when question
   3 ends, which is the whole reason nobody can give themselves more
   time by lying about theirs. */
create or replace function public.lamma_advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  nxt int;
  q  public.questions%rowtype;
  total int;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  select count(*) into total from public.questions where pack_id = r.pack_id;
  nxt := r.current_question_index + 1;

  if nxt >= total then
    update public.game_rooms set status = 'ended', current_deadline_at = null where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'ended');
  end if;

  select * into q from public.questions where pack_id = r.pack_id and order_index = nxt;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  update public.game_rooms
     set status = 'question',
         current_question_index = nxt,
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => q.timer_ms / 1000.0)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question', 'question_index', nxt,
                            'total', total, 'timer_ms', q.timer_ms,
                            'deadline_at', now() + make_interval(secs => q.timer_ms / 1000.0));
end;
$$;

/* ── A HOST WHO WALKED AWAY ───────────────────────────────────────
   Someone's battery dies and four people are left staring at a
   question that will never end. The room does not belong to the host;
   the host is just whoever is driving. Any player may hand the wheel
   to the longest-standing connected player once the host has been gone
   long enough — and the host coming back does not take it away again,
   because two hosts is worse than the wrong one. */
create or replace function public.lamma_claim_host(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  host_row public.room_players%rowtype;
  heir uuid;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then return jsonb_build_object('ok', false, 'reason', 'not_in_room'); end if;

  select * into host_row from public.room_players
   where room_id = p_room_id and user_id = r.host_user_id;

  -- still here? then there is nothing to claim
  if host_row.user_id is not null and host_row.is_connected then
    return jsonb_build_object('ok', false, 'reason', 'host_present');
  end if;

  select user_id into heir from public.room_players
   where room_id = p_room_id and is_connected and user_id <> r.host_user_id
   order by joined_at asc limit 1;

  if heir is null then return jsonb_build_object('ok', false, 'reason', 'nobody_to_promote'); end if;

  update public.game_rooms set host_user_id = heir where id = p_room_id;
  return jsonb_build_object('ok', true, 'host_user_id', heir);
end;
$$;

/* Leaving is a flag, not a delete: your score stays on the board and
   you can walk back in on the same phone or another one. */
create or replace function public.lamma_set_connected(p_room_id uuid, p_connected boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false); end if;
  update public.room_players set is_connected = coalesce(p_connected, true)
   where room_id = p_room_id and user_id = me;
  return jsonb_build_object('ok', found);
end;
$$;

grant execute on function public.lamma_create_room(uuid,text)   to authenticated;
grant execute on function public.lamma_join_room(text)          to authenticated;
grant execute on function public.lamma_advance(uuid)            to authenticated;
grant execute on function public.lamma_claim_host(uuid)         to authenticated;
grant execute on function public.lamma_set_connected(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE THREE PACKS IT SHIPS WITH
--  أفلام مصرية · أغاني تسعينات · كورة مصرية — fifteen questions each.
--
--  These are FACTS, written from scratch: who directed what, who
--  scored when, which year an album came out. No lyrics, no cover art,
--  no text lifted from a quiz that already exists. A fact is nobody's
--  property; a paragraph about it is.
--
--  Every question is kept under 120 characters on purpose. It is a
--  real constraint on a phone, and it forces the question to be sharp
--  rather than a paragraph with a question mark at the end.
--
--  AYSER: read these before anybody plays them. I am confident in
--  them, but a quiz that is confidently wrong is worse than no quiz,
--  and you know this material better than I do.
--  Safe to re-run — it replaces its own three packs and nothing else.
-- ═══════════════════════════════════════════════════════════════════

delete from public.game_packs where id in (
  'aaaa1111-0000-4000-8000-000000000001',
  'aaaa1111-0000-4000-8000-000000000002',
  'aaaa1111-0000-4000-8000-000000000003');

insert into public.game_packs (id, title_ar, title_en, description_ar, category, is_official, visibility) values
 ('aaaa1111-0000-4000-8000-000000000001','أفلام مصرية','Egyptian Films','من الأبيض والأسود لحد النهاردة','film',true,'public'),
 ('aaaa1111-0000-4000-8000-000000000002','أغاني تسعينات','90s Songs','الأغاني اللي كبرنا عليها','music',true,'public'),
 ('aaaa1111-0000-4000-8000-000000000003','كورة مصرية','Egyptian Football','الأهلي والزمالك والمنتخب','sport',true,'public');

-- ── أفلام مصرية ────────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, timer_ms, options, correct_index, points_style) values
('aaaa1111-0000-4000-8000-000000000001',0,'مين بطل فيلم «الكيت كات»؟',20000,'[{"index":0,"text_ar":"محمود عبد العزيز"},{"index":1,"text_ar":"عادل إمام"},{"index":2,"text_ar":"أحمد زكي"},{"index":3,"text_ar":"نور الشريف"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',1,'مين مخرج فيلم «الأرض»؟',20000,'[{"index":0,"text_ar":"يوسف شاهين"},{"index":1,"text_ar":"صلاح أبو سيف"},{"index":2,"text_ar":"كمال الشيخ"},{"index":3,"text_ar":"حسين كمال"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',2,'مين بطل «الإرهاب والكباب»؟',20000,'[{"index":0,"text_ar":"عادل إمام"},{"index":1,"text_ar":"أحمد زكي"},{"index":2,"text_ar":"محمود عبد العزيز"},{"index":3,"text_ar":"يحيى الفخراني"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',3,'مين مخرج «المومياء»؟',20000,'[{"index":0,"text_ar":"شادي عبد السلام"},{"index":1,"text_ar":"يوسف شاهين"},{"index":2,"text_ar":"توفيق صالح"},{"index":3,"text_ar":"صلاح أبو سيف"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',4,'مين بطلة «دعاء الكروان»؟',20000,'[{"index":0,"text_ar":"فاتن حمامة"},{"index":1,"text_ar":"سعاد حسني"},{"index":2,"text_ar":"شادية"},{"index":3,"text_ar":"ماجدة"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',5,'مين بطل «اللص والكلاب»؟',20000,'[{"index":0,"text_ar":"شكري سرحان"},{"index":1,"text_ar":"رشدي أباظة"},{"index":2,"text_ar":"أحمد مظهر"},{"index":3,"text_ar":"عماد حمدي"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',6,'مين مخرج «باب الحديد»؟',20000,'[{"index":0,"text_ar":"يوسف شاهين"},{"index":1,"text_ar":"صلاح أبو سيف"},{"index":2,"text_ar":"كمال الشيخ"},{"index":3,"text_ar":"عاطف الطيب"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',7,'مين بطل «زوجة رجل مهم»؟',20000,'[{"index":0,"text_ar":"أحمد زكي"},{"index":1,"text_ar":"نور الشريف"},{"index":2,"text_ar":"محمود عبد العزيز"},{"index":3,"text_ar":"محمود ياسين"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',8,'مين مخرج «الناصر صلاح الدين»؟',20000,'[{"index":0,"text_ar":"يوسف شاهين"},{"index":1,"text_ar":"شادي عبد السلام"},{"index":2,"text_ar":"حسام الدين مصطفى"},{"index":3,"text_ar":"عز الدين ذو الفقار"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',9,'مين بطل «عمارة يعقوبيان»؟',20000,'[{"index":0,"text_ar":"عادل إمام"},{"index":1,"text_ar":"خالد صالح"},{"index":2,"text_ar":"نور الشريف"},{"index":3,"text_ar":"يحيى الفخراني"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',10,'مين بطلة «أريد حلاً»؟',20000,'[{"index":0,"text_ar":"فاتن حمامة"},{"index":1,"text_ar":"سعاد حسني"},{"index":2,"text_ar":"نادية لطفي"},{"index":3,"text_ar":"ميرفت أمين"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',11,'مين مخرج «إسكندرية… ليه؟»',20000,'[{"index":0,"text_ar":"يوسف شاهين"},{"index":1,"text_ar":"داود عبد السيد"},{"index":2,"text_ar":"محمد خان"},{"index":3,"text_ar":"عاطف الطيب"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',12,'مين بطل «البريء»؟',20000,'[{"index":0,"text_ar":"أحمد زكي"},{"index":1,"text_ar":"محمود عبد العزيز"},{"index":2,"text_ar":"نور الشريف"},{"index":3,"text_ar":"عادل إمام"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',13,'مين بطل «الكرنك»؟',20000,'[{"index":0,"text_ar":"نور الشريف"},{"index":1,"text_ar":"أحمد زكي"},{"index":2,"text_ar":"محمود ياسين"},{"index":3,"text_ar":"حسين فهمي"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000001',14,'مين مخرج «الكيت كات»؟',20000,'[{"index":0,"text_ar":"داود عبد السيد"},{"index":1,"text_ar":"محمد خان"},{"index":2,"text_ar":"خيري بشارة"},{"index":3,"text_ar":"عاطف الطيب"}]',0,'double');

-- ── أغاني تسعينات ──────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, timer_ms, options, correct_index, points_style) values
('aaaa1111-0000-4000-8000-000000000002',0,'مين غنى «نور العين»؟',20000,'[{"index":0,"text_ar":"عمرو دياب"},{"index":1,"text_ar":"محمد فؤاد"},{"index":2,"text_ar":"مصطفى قمر"},{"index":3,"text_ar":"إيهاب توفيق"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',1,'ألبوم «نور العين» نزل سنة كام؟',20000,'[{"index":0,"text_ar":"1996"},{"index":1,"text_ar":"1992"},{"index":2,"text_ar":"1999"},{"index":3,"text_ar":"2001"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',2,'مين الملقب بـ«الكينج» في الغنا المصري؟',20000,'[{"index":0,"text_ar":"محمد منير"},{"index":1,"text_ar":"عمرو دياب"},{"index":2,"text_ar":"على الحجار"},{"index":3,"text_ar":"مدحت صالح"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',3,'مين غنى «نارى نارى»؟',20000,'[{"index":0,"text_ar":"هشام عباس"},{"index":1,"text_ar":"مصطفى قمر"},{"index":2,"text_ar":"حميد الشاعري"},{"index":3,"text_ar":"إيهاب توفيق"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',4,'مين غنى «زيديني عشقاً»؟',20000,'[{"index":0,"text_ar":"كاظم الساهر"},{"index":1,"text_ar":"جورج وسوف"},{"index":2,"text_ar":"راغب علامة"},{"index":3,"text_ar":"وليد توفيق"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',5,'مين الملقب بـ«سلطان الطرب»؟',20000,'[{"index":0,"text_ar":"جورج وسوف"},{"index":1,"text_ar":"كاظم الساهر"},{"index":2,"text_ar":"عاصي الحلاني"},{"index":3,"text_ar":"ملحم بركات"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',6,'مين المعروف بأبو الموسيقى الشبابية في مصر؟',20000,'[{"index":0,"text_ar":"حميد الشاعري"},{"index":1,"text_ar":"هاني شنودة"},{"index":2,"text_ar":"عمار الشريعي"},{"index":3,"text_ar":"يحيى خليل"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',7,'«الحلم العربي» اتغنت بمشاركة كام فنان تقريباً؟',20000,'[{"index":0,"text_ar":"أكتر من 20"},{"index":1,"text_ar":"5"},{"index":2,"text_ar":"10"},{"index":3,"text_ar":"3"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',8,'مين غنى «قلبي دق»؟',20000,'[{"index":0,"text_ar":"محمد فؤاد"},{"index":1,"text_ar":"مصطفى قمر"},{"index":2,"text_ar":"هشام عباس"},{"index":3,"text_ar":"علاء عبد الخالق"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',9,'محمد منير أصله منين؟',20000,'[{"index":0,"text_ar":"أسوان"},{"index":1,"text_ar":"القاهرة"},{"index":2,"text_ar":"الإسكندرية"},{"index":3,"text_ar":"بورسعيد"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',10,'مين غنى «يا حبيبي يا عيني»؟',20000,'[{"index":0,"text_ar":"إيهاب توفيق"},{"index":1,"text_ar":"عمرو دياب"},{"index":2,"text_ar":"مصطفى قمر"},{"index":3,"text_ar":"هشام عباس"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',11,'كاظم الساهر من أي بلد؟',20000,'[{"index":0,"text_ar":"العراق"},{"index":1,"text_ar":"سوريا"},{"index":2,"text_ar":"لبنان"},{"index":3,"text_ar":"الأردن"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',12,'أغاني كاظم الساهر الشهيرة كلماتها لمين؟',20000,'[{"index":0,"text_ar":"نزار قباني"},{"index":1,"text_ar":"محمود درويش"},{"index":2,"text_ar":"أحمد شوقي"},{"index":3,"text_ar":"صلاح جاهين"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',13,'عمرو دياب اتولد فين؟',20000,'[{"index":0,"text_ar":"بورسعيد"},{"index":1,"text_ar":"القاهرة"},{"index":2,"text_ar":"الإسكندرية"},{"index":3,"text_ar":"المنصورة"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000002',14,'جورج وسوف من أي بلد؟',20000,'[{"index":0,"text_ar":"سوريا"},{"index":1,"text_ar":"لبنان"},{"index":2,"text_ar":"مصر"},{"index":3,"text_ar":"العراق"}]',0,'double');

-- ── كورة مصرية ─────────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, timer_ms, options, correct_index, points_style) values
('aaaa1111-0000-4000-8000-000000000003',0,'مصر كسبت كأس أمم أفريقيا كام مرة؟',20000,'[{"index":0,"text_ar":"7"},{"index":1,"text_ar":"5"},{"index":2,"text_ar":"6"},{"index":3,"text_ar":"8"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',1,'نادي الأهلي اتأسس سنة كام؟',20000,'[{"index":0,"text_ar":"1907"},{"index":1,"text_ar":"1911"},{"index":2,"text_ar":"1920"},{"index":3,"text_ar":"1900"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',2,'نادي الزمالك اتأسس سنة كام؟',20000,'[{"index":0,"text_ar":"1911"},{"index":1,"text_ar":"1907"},{"index":2,"text_ar":"1925"},{"index":3,"text_ar":"1930"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',3,'أول مونديال لمصر كان سنة كام؟',20000,'[{"index":0,"text_ar":"1934"},{"index":1,"text_ar":"1950"},{"index":2,"text_ar":"1990"},{"index":3,"text_ar":"1930"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',4,'مصر لعبت كام كأس عالم لحد 2022؟',20000,'[{"index":0,"text_ar":"3"},{"index":1,"text_ar":"2"},{"index":2,"text_ar":"4"},{"index":3,"text_ar":"5"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',5,'محمد صلاح لعب لأي نادي إنجليزي قبل ليفربول؟',20000,'[{"index":0,"text_ar":"تشيلسي"},{"index":1,"text_ar":"أرسنال"},{"index":2,"text_ar":"مانشستر سيتي"},{"index":3,"text_ar":"توتنهام"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',6,'محمد صلاح لعب في إيطاليا لأي ناديين؟',20000,'[{"index":0,"text_ar":"فيورنتينا وروما"},{"index":1,"text_ar":"يوفنتوس وميلان"},{"index":2,"text_ar":"إنتر ونابولي"},{"index":3,"text_ar":"لاتسيو وروما"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',7,'مصر كسبت أمم أفريقيا 2006 و2008 و2010 — الميزة إيه؟',20000,'[{"index":0,"text_ar":"3 مرات ورا بعض"},{"index":1,"text_ar":"كلها برا مصر"},{"index":2,"text_ar":"من غير ما تستقبل هدف"},{"index":3,"text_ar":"بنفس المدرب دايماً"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',8,'مين مدرب مصر في مونديال 2018؟',20000,'[{"index":0,"text_ar":"هيكتور كوبر"},{"index":1,"text_ar":"حسن شحاتة"},{"index":2,"text_ar":"خافيير أغيري"},{"index":3,"text_ar":"كارلوس كيروش"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',9,'مين مدرب مصر في الثلاثية 2006-2010؟',20000,'[{"index":0,"text_ar":"حسن شحاتة"},{"index":1,"text_ar":"محمود الجوهري"},{"index":2,"text_ar":"هيكتور كوبر"},{"index":3,"text_ar":"شوقي غريب"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',10,'مصر أهلت لمونديال 2018 بهدف مين في الكونغو؟',20000,'[{"index":0,"text_ar":"محمد صلاح"},{"index":1,"text_ar":"محمود كهربا"},{"index":2,"text_ar":"مروان محسن"},{"index":3,"text_ar":"عبد الله السعيد"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',11,'أمم أفريقيا 2019 اتلعبت فين؟',20000,'[{"index":0,"text_ar":"مصر"},{"index":1,"text_ar":"الكاميرون"},{"index":2,"text_ar":"الجابون"},{"index":3,"text_ar":"جنوب أفريقيا"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',12,'الأهلي والزمالك ماتشهم اسمه إيه؟',20000,'[{"index":0,"text_ar":"القمة"},{"index":1,"text_ar":"الديربي الأحمر"},{"index":2,"text_ar":"الكلاسيكو"},{"index":3,"text_ar":"المواجهة"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',13,'محمد صلاح بيلعب في أي مركز أساساً؟',20000,'[{"index":0,"text_ar":"جناح"},{"index":1,"text_ar":"مدافع"},{"index":2,"text_ar":"حارس"},{"index":3,"text_ar":"ظهير"}]',0,'standard'),
('aaaa1111-0000-4000-8000-000000000003',14,'أبو تريكة لعب لأي نادي مصري؟',20000,'[{"index":0,"text_ar":"الأهلي"},{"index":1,"text_ar":"الزمالك"},{"index":2,"text_ar":"الإسماعيلي"},{"index":3,"text_ar":"المصري"}]',0,'double');

notify pgrst, 'reload schema';
