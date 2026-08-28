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
/* THIS LINE USED TO ABORT THE WHOLE FILE ON A SECOND RUN.
   It re-added a NARROW list of notification kinds and validated it
   against every row already in the table. Further down, the same
   constraint is widened to include 'message', 'tag' and 'repost' — so
   after one successful run, real rows of those kinds exist, and the
   next run hit:

     ERROR: check constraint "notifications_kind_check" of relation
            "notifications" is violated by some row

   One statement failing takes the entire file with it, so everything
   below this point silently never applied — which is why لمّة kept
   saying it was not switched on.

   Now: the full list, NOT VALID (the rule is here to stop bad data
   arriving, not to argue with old data), inside a DO block so it can
   never abort anything again. */
do $do$
begin
  alter table public.notifications drop constraint if exists notifications_kind_check;
  alter table public.notifications add constraint notifications_kind_check
    check (kind in ('vibe','laugh','comment','mate_request','mate_accept','call','message','tag','repost'))
    not valid;
exception when others then
  raise notice 'notifications kind constraint skipped: %', sqlerrm;
end $do$;
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

/* NOT VALID and wrapped, for the same reason as the notification kinds
   above: one legacy row must never be able to abort this file. */
do $do$
begin
  alter table public.tracks drop constraint if exists tracks_kind_check;
  alter table public.tracks add constraint tracks_kind_check
    check (kind in ('song','sound')) not valid;
  alter table public.tracks drop constraint if exists tracks_visibility_check;
  alter table public.tracks add constraint tracks_visibility_check
    check (visibility in ('private','public')) not valid;
exception when others then
  raise notice 'tracks constraints skipped: %', sqlerrm;
end $do$;

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
/* DROP first, for the same reason the constraints above are NOT VALID:
   this file has to survive being run twice. Further down, this view is
   widened to carry text_en as well. CREATE OR REPLACE cannot remove a
   column from an existing view, so on the second run this line hit the
   already-widened view and failed with

     ERROR: 42P16: cannot drop columns from view

   which stopped the file — and everything below it — dead. */
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
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

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · PLAYABLE BY PEOPLE WHO ARE NOT EGYPTIAN
--
--  The first three packs are about Egyptian films, Egyptian songs and
--  Egyptian football. They are good packs and they stay. But somebody
--  in Bucharest or Berlin cannot answer a single question in them, and
--  a quiz you cannot answer is not a hard quiz — it is a closed door.
--
--  Two changes:
--
--  1. A QUESTION CAN SPEAK TWO LANGUAGES. text_en beside text_ar, and
--     every option carries both. The app shows whichever the player has
--     chosen and falls back rather than blanking, so no question is
--     ever empty on screen. Nothing is translated automatically — a
--     machine-translated quiz answer is a wrong answer waiting to
--     happen.
--
--  2. THREE PACKS ANYBODY CAN PLAY. World football, European cities,
--     and general knowledge — facts a person in Cairo and a person in
--     Lisbon both have a fair chance at. Not "easy": shared.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.questions add column if not exists text_en text;
alter table public.game_packs add column if not exists description_en text;

-- the constraint has to cover the English side too, for the same reason
do $do$
begin
  alter table public.questions drop constraint if exists questions_text_en_len;
  alter table public.questions add constraint questions_text_en_len
    check (text_en is null or char_length(text_en) <= 120) not valid;
exception when others then
  raise notice 'questions text_en length constraint skipped: %', sqlerrm;
end $do$;

-- The answer-free view has to carry the English text as well, or an
-- English player gets a blank question.
--
-- DROPPED AND REBUILT, NOT REPLACED. "create or replace view" can only
-- change what the existing columns select — it cannot add one in the
-- middle, and Postgres refuses with "cannot change name of view column".
-- Adding text_en after text_ar is exactly that, so the view goes and
-- comes back. Nothing depends on it in SQL; the app reads it by name.
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, text_en, media_url, media_type,
         timer_ms, options, points_style
    from public.questions;
grant select on public.lamma_questions_public to anon, authenticated;

-- ── English titles for the Egyptian packs ──────────────────────────
update public.game_packs set title_en = 'Egyptian Films',   description_en = 'From black and white to now'
 where id = 'aaaa1111-0000-4000-8000-000000000001';
update public.game_packs set title_en = '90s Songs',        description_en = 'The songs we grew up on'
 where id = 'aaaa1111-0000-4000-8000-000000000002';
update public.game_packs set title_en = 'Egyptian Football', description_en = 'Ahly, Zamalek and the national team'
 where id = 'aaaa1111-0000-4000-8000-000000000003';

-- ═══════════════════════════════════════════════════════════════════
--  THREE PACKS ANYBODY CAN PLAY
-- ═══════════════════════════════════════════════════════════════════
delete from public.game_packs where id in (
  'bbbb2222-0000-4000-8000-000000000001',
  'bbbb2222-0000-4000-8000-000000000002',
  'bbbb2222-0000-4000-8000-000000000003');

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, locale, is_official, visibility) values
 ('bbbb2222-0000-4000-8000-000000000001','كورة عالمية','World Football','من المونديال للدوريات','World Cups, clubs and the big nights','sport','en',true,'public'),
 ('bbbb2222-0000-4000-8000-000000000002','مدن أوروبا','Europe','عواصم وأنهار وجبال','Capitals, rivers and borders','geography','en',true,'public'),
 ('bbbb2222-0000-4000-8000-000000000003','معلومات عامة','General Knowledge','حاجات المفروض كلنا نعرفها','Things most people know, and a few they do not','general','en',true,'public');

-- ── World Football ─────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('bbbb2222-0000-4000-8000-000000000001',0,'مين كسب كأس العالم 2018؟','Which country won the 2018 World Cup?',20000,'[{"index":0,"text_ar":"فرنسا","text_en":"France"},{"index":1,"text_ar":"كرواتيا","text_en":"Croatia"},{"index":2,"text_ar":"البرازيل","text_en":"Brazil"},{"index":3,"text_ar":"ألمانيا","text_en":"Germany"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',1,'مين كسب كأس العالم 2022؟','Which country won the 2022 World Cup?',20000,'[{"index":0,"text_ar":"الأرجنتين","text_en":"Argentina"},{"index":1,"text_ar":"فرنسا","text_en":"France"},{"index":2,"text_ar":"البرازيل","text_en":"Brazil"},{"index":3,"text_ar":"إسبانيا","text_en":"Spain"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',2,'أكتر نادي كسب دوري أبطال أوروبا؟','Which club has won the most European Cups?',20000,'[{"index":0,"text_ar":"ريال مدريد","text_en":"Real Madrid"},{"index":1,"text_ar":"ميلان","text_en":"AC Milan"},{"index":2,"text_ar":"بايرن ميونخ","text_en":"Bayern Munich"},{"index":3,"text_ar":"ليفربول","text_en":"Liverpool"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',3,'أكتر منتخب كسب كأس العالم؟','Which nation has won the most World Cups?',20000,'[{"index":0,"text_ar":"البرازيل","text_en":"Brazil"},{"index":1,"text_ar":"ألمانيا","text_en":"Germany"},{"index":2,"text_ar":"إيطاليا","text_en":"Italy"},{"index":3,"text_ar":"الأرجنتين","text_en":"Argentina"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',4,'مين كسب يورو 2020؟','Which country won Euro 2020?',20000,'[{"index":0,"text_ar":"إيطاليا","text_en":"Italy"},{"index":1,"text_ar":"إنجلترا","text_en":"England"},{"index":2,"text_ar":"إسبانيا","text_en":"Spain"},{"index":3,"text_ar":"الدنمارك","text_en":"Denmark"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',5,'كأس العالم 1930 كسبها مين؟','Who won the first World Cup, in 1930?',20000,'[{"index":0,"text_ar":"أوروجواي","text_en":"Uruguay"},{"index":1,"text_ar":"الأرجنتين","text_en":"Argentina"},{"index":2,"text_ar":"البرازيل","text_en":"Brazil"},{"index":3,"text_ar":"إيطاليا","text_en":"Italy"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',6,'ستاد الكامب نو في أي مدينة؟','Which city is home to the Camp Nou?',20000,'[{"index":0,"text_ar":"برشلونة","text_en":"Barcelona"},{"index":1,"text_ar":"مدريد","text_en":"Madrid"},{"index":2,"text_ar":"لشبونة","text_en":"Lisbon"},{"index":3,"text_ar":"فالنسيا","text_en":"Valencia"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',7,'ستاد السان سيرو في أي مدينة؟','Which city is home to the San Siro?',20000,'[{"index":0,"text_ar":"ميلانو","text_en":"Milan"},{"index":1,"text_ar":"روما","text_en":"Rome"},{"index":2,"text_ar":"تورينو","text_en":"Turin"},{"index":3,"text_ar":"نابولي","text_en":"Naples"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',8,'كام لاعب في الملعب لكل فريق؟','How many players per team are on the pitch?',20000,'[{"index":0,"text_ar":"11","text_en":"11"},{"index":1,"text_ar":"10","text_en":"10"},{"index":2,"text_ar":"12","text_en":"12"},{"index":3,"text_ar":"9","text_en":"9"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',9,'الكارت الأحمر معناه إيه؟','What does a red card mean?',20000,'[{"index":0,"text_ar":"طرد","text_en":"Sent off"},{"index":1,"text_ar":"إنذار","text_en":"A warning"},{"index":2,"text_ar":"ضربة جزاء","text_en":"A penalty"},{"index":3,"text_ar":"تبديل","text_en":"A substitution"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',10,'الماتش الرسمي مدته كام دقيقة؟','How long is a match, before stoppage time?',20000,'[{"index":0,"text_ar":"90","text_en":"90 minutes"},{"index":1,"text_ar":"80","text_en":"80 minutes"},{"index":2,"text_ar":"100","text_en":"100 minutes"},{"index":3,"text_ar":"60","text_en":"60 minutes"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',11,'البوندسليجا دوري أي بلد؟','The Bundesliga is the top league of which country?',20000,'[{"index":0,"text_ar":"ألمانيا","text_en":"Germany"},{"index":1,"text_ar":"النمسا","text_en":"Austria"},{"index":2,"text_ar":"هولندا","text_en":"Netherlands"},{"index":3,"text_ar":"سويسرا","text_en":"Switzerland"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',12,'ملعب آنفيلد بتاع أي نادي؟','Anfield is the home of which club?',20000,'[{"index":0,"text_ar":"ليفربول","text_en":"Liverpool"},{"index":1,"text_ar":"إيفرتون","text_en":"Everton"},{"index":2,"text_ar":"مانشستر يونايتد","text_en":"Manchester United"},{"index":3,"text_ar":"أرسنال","text_en":"Arsenal"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',13,'يورو 2024 اتلعبت فين؟','Which country hosted Euro 2024?',20000,'[{"index":0,"text_ar":"ألمانيا","text_en":"Germany"},{"index":1,"text_ar":"فرنسا","text_en":"France"},{"index":2,"text_ar":"إنجلترا","text_en":"England"},{"index":3,"text_ar":"إيطاليا","text_en":"Italy"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',14,'كأس العالم 2006 اتلعبت فين؟','Which country hosted the 2006 World Cup?',20000,'[{"index":0,"text_ar":"ألمانيا","text_en":"Germany"},{"index":1,"text_ar":"اليابان","text_en":"Japan"},{"index":2,"text_ar":"جنوب أفريقيا","text_en":"South Africa"},{"index":3,"text_ar":"البرازيل","text_en":"Brazil"}]',0,'double');

-- ── Europe ─────────────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('bbbb2222-0000-4000-8000-000000000002',0,'عاصمة البرتغال؟','What is the capital of Portugal?',20000,'[{"index":0,"text_ar":"لشبونة","text_en":"Lisbon"},{"index":1,"text_ar":"بورتو","text_en":"Porto"},{"index":2,"text_ar":"مدريد","text_en":"Madrid"},{"index":3,"text_ar":"براغا","text_en":"Braga"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',1,'أي نهر بيعدي في باريس؟','Which river runs through Paris?',20000,'[{"index":0,"text_ar":"السين","text_en":"The Seine"},{"index":1,"text_ar":"الراين","text_en":"The Rhine"},{"index":2,"text_ar":"الدانوب","text_en":"The Danube"},{"index":3,"text_ar":"اللوار","text_en":"The Loire"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',2,'عاصمة النرويج؟','What is the capital of Norway?',20000,'[{"index":0,"text_ar":"أوسلو","text_en":"Oslo"},{"index":1,"text_ar":"بيرغن","text_en":"Bergen"},{"index":2,"text_ar":"ستوكهولم","text_en":"Stockholm"},{"index":3,"text_ar":"كوبنهاغن","text_en":"Copenhagen"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',3,'بودابست عاصمة أي بلد؟','Budapest is the capital of which country?',20000,'[{"index":0,"text_ar":"المجر","text_en":"Hungary"},{"index":1,"text_ar":"النمسا","text_en":"Austria"},{"index":2,"text_ar":"رومانيا","text_en":"Romania"},{"index":3,"text_ar":"سلوفاكيا","text_en":"Slovakia"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',4,'عاصمة رومانيا؟','What is the capital of Romania?',20000,'[{"index":0,"text_ar":"بوخارست","text_en":"Bucharest"},{"index":1,"text_ar":"كلوج","text_en":"Cluj"},{"index":2,"text_ar":"صوفيا","text_en":"Sofia"},{"index":3,"text_ar":"بلغراد","text_en":"Belgrade"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',5,'أي جبال بتفصل فرنسا عن إسبانيا؟','Which mountains separate France and Spain?',20000,'[{"index":0,"text_ar":"البرانس","text_en":"The Pyrenees"},{"index":1,"text_ar":"الألب","text_en":"The Alps"},{"index":2,"text_ar":"الكاربات","text_en":"The Carpathians"},{"index":3,"text_ar":"الأبنين","text_en":"The Apennines"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',6,'عاصمة كرواتيا؟','What is the capital of Croatia?',20000,'[{"index":0,"text_ar":"زغرب","text_en":"Zagreb"},{"index":1,"text_ar":"سبليت","text_en":"Split"},{"index":2,"text_ar":"ليوبليانا","text_en":"Ljubljana"},{"index":3,"text_ar":"سراييفو","text_en":"Sarajevo"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',7,'أمستردام في أي بلد؟','Amsterdam is in which country?',20000,'[{"index":0,"text_ar":"هولندا","text_en":"The Netherlands"},{"index":1,"text_ar":"بلجيكا","text_en":"Belgium"},{"index":2,"text_ar":"ألمانيا","text_en":"Germany"},{"index":3,"text_ar":"الدنمارك","text_en":"Denmark"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',8,'أي مدينة اسمها «المدينة الخالدة»؟','Which city is known as the Eternal City?',20000,'[{"index":0,"text_ar":"روما","text_en":"Rome"},{"index":1,"text_ar":"أثينا","text_en":"Athens"},{"index":2,"text_ar":"باريس","text_en":"Paris"},{"index":3,"text_ar":"إسطنبول","text_en":"Istanbul"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',9,'عاصمة فنلندا؟','What is the capital of Finland?',20000,'[{"index":0,"text_ar":"هلسنكي","text_en":"Helsinki"},{"index":1,"text_ar":"تامبيري","text_en":"Tampere"},{"index":2,"text_ar":"أوسلو","text_en":"Oslo"},{"index":3,"text_ar":"تالين","text_en":"Tallinn"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',10,'براغ عاصمة أي بلد؟','Prague is the capital of which country?',20000,'[{"index":0,"text_ar":"التشيك","text_en":"Czechia"},{"index":1,"text_ar":"بولندا","text_en":"Poland"},{"index":2,"text_ar":"سلوفاكيا","text_en":"Slovakia"},{"index":3,"text_ar":"النمسا","text_en":"Austria"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',11,'فيينا عاصمة أي بلد؟','Vienna is the capital of which country?',20000,'[{"index":0,"text_ar":"النمسا","text_en":"Austria"},{"index":1,"text_ar":"ألمانيا","text_en":"Germany"},{"index":2,"text_ar":"سويسرا","text_en":"Switzerland"},{"index":3,"text_ar":"المجر","text_en":"Hungary"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',12,'عملة بولندا إيه؟','What is the currency of Poland?',20000,'[{"index":0,"text_ar":"الزلوتي","text_en":"The złoty"},{"index":1,"text_ar":"اليورو","text_en":"The euro"},{"index":2,"text_ar":"الكرونة","text_en":"The krona"},{"index":3,"text_ar":"الفورنت","text_en":"The forint"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',13,'أي مضيق بيفصل أوروبا عن أفريقيا؟','Which strait separates Europe from Africa?',20000,'[{"index":0,"text_ar":"جبل طارق","text_en":"Gibraltar"},{"index":1,"text_ar":"البوسفور","text_en":"The Bosphorus"},{"index":2,"text_ar":"المانش","text_en":"The Channel"},{"index":3,"text_ar":"مسينا","text_en":"Messina"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',14,'أي بلدين بيتقاسموا جزيرة أيرلندا؟','Which two states share the island of Ireland?',20000,'[{"index":0,"text_ar":"أيرلندا وبريطانيا","text_en":"Ireland and the UK"},{"index":1,"text_ar":"أيرلندا فقط","text_en":"Ireland only"},{"index":2,"text_ar":"أيرلندا وأيسلندا","text_en":"Ireland and Iceland"},{"index":3,"text_ar":"أيرلندا وفرنسا","text_en":"Ireland and France"}]',0,'double');

-- ── General Knowledge ──────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('bbbb2222-0000-4000-8000-000000000003',0,'كام قارة في العالم؟','How many continents are there?',20000,'[{"index":0,"text_ar":"7","text_en":"7"},{"index":1,"text_ar":"5","text_en":"5"},{"index":2,"text_ar":"6","text_en":"6"},{"index":3,"text_ar":"8","text_en":"8"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',1,'أكبر محيط في العالم؟','What is the largest ocean?',20000,'[{"index":0,"text_ar":"الهادي","text_en":"The Pacific"},{"index":1,"text_ar":"الأطلنطي","text_en":"The Atlantic"},{"index":2,"text_ar":"الهندي","text_en":"The Indian"},{"index":3,"text_ar":"المتجمد الشمالي","text_en":"The Arctic"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',2,'أي كوكب اسمه «الكوكب الأحمر»؟','Which planet is called the Red Planet?',20000,'[{"index":0,"text_ar":"المريخ","text_en":"Mars"},{"index":1,"text_ar":"الزهرة","text_en":"Venus"},{"index":2,"text_ar":"المشتري","text_en":"Jupiter"},{"index":3,"text_ar":"عطارد","text_en":"Mercury"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',3,'الرمز الكيميائي للذهب؟','What is the chemical symbol for gold?',20000,'[{"index":0,"text_ar":"Au","text_en":"Au"},{"index":1,"text_ar":"Ag","text_en":"Ag"},{"index":2,"text_ar":"Go","text_en":"Go"},{"index":3,"text_ar":"Gd","text_en":"Gd"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',4,'الجيتار العادي فيه كام وتر؟','How many strings does a standard guitar have?',20000,'[{"index":0,"text_ar":"6","text_en":"6"},{"index":1,"text_ar":"4","text_en":"4"},{"index":2,"text_ar":"7","text_en":"7"},{"index":3,"text_ar":"12","text_en":"12"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',5,'أعلى قمة فوق سطح البحر؟','What is the highest mountain above sea level?',20000,'[{"index":0,"text_ar":"إيفرست","text_en":"Everest"},{"index":1,"text_ar":"K2","text_en":"K2"},{"index":2,"text_ar":"مونت بلانك","text_en":"Mont Blanc"},{"index":3,"text_ar":"كليمنجارو","text_en":"Kilimanjaro"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',6,'المسدس له كام ضلع؟ السداسي يعني','How many sides does a hexagon have?',20000,'[{"index":0,"text_ar":"6","text_en":"6"},{"index":1,"text_ar":"5","text_en":"5"},{"index":2,"text_ar":"7","text_en":"7"},{"index":3,"text_ar":"8","text_en":"8"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',7,'أكبر كائن ثديي؟','What is the largest mammal?',20000,'[{"index":0,"text_ar":"الحوت الأزرق","text_en":"The blue whale"},{"index":1,"text_ar":"الفيل","text_en":"The elephant"},{"index":2,"text_ar":"الزرافة","text_en":"The giraffe"},{"index":3,"text_ar":"وحيد القرن","text_en":"The rhino"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',8,'النباتات بتمتص أي غاز؟','Which gas do plants absorb?',20000,'[{"index":0,"text_ar":"ثاني أكسيد الكربون","text_en":"Carbon dioxide"},{"index":1,"text_ar":"الأكسجين","text_en":"Oxygen"},{"index":2,"text_ar":"النيتروجين","text_en":"Nitrogen"},{"index":3,"text_ar":"الهيدروجين","text_en":"Hydrogen"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',9,'كام لاعب في فريق السلة في الملعب؟','How many basketball players per team are on court?',20000,'[{"index":0,"text_ar":"5","text_en":"5"},{"index":1,"text_ar":"6","text_en":"6"},{"index":2,"text_ar":"7","text_en":"7"},{"index":3,"text_ar":"4","text_en":"4"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',10,'المياه بتتجمد عند كام درجة مئوية؟','Water freezes at what temperature in Celsius?',20000,'[{"index":0,"text_ar":"0","text_en":"0"},{"index":1,"text_ar":"10","text_en":"10"},{"index":2,"text_ar":"-10","text_en":"-10"},{"index":3,"text_ar":"32","text_en":"32"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',11,'أكبر صحراء حارة في العالم؟','What is the largest hot desert in the world?',20000,'[{"index":0,"text_ar":"الصحراء الكبرى","text_en":"The Sahara"},{"index":1,"text_ar":"جوبي","text_en":"The Gobi"},{"index":2,"text_ar":"كالاهاري","text_en":"The Kalahari"},{"index":3,"text_ar":"أتاكاما","text_en":"The Atacama"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',12,'قوس قزح فيه كام لون تقليدياً؟','How many colours are traditionally in a rainbow?',20000,'[{"index":0,"text_ar":"7","text_en":"7"},{"index":1,"text_ar":"5","text_en":"5"},{"index":2,"text_ar":"6","text_en":"6"},{"index":3,"text_ar":"9","text_en":"9"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',13,'عاصمة اليابان؟','What is the capital of Japan?',20000,'[{"index":0,"text_ar":"طوكيو","text_en":"Tokyo"},{"index":1,"text_ar":"أوساكا","text_en":"Osaka"},{"index":2,"text_ar":"كيوتو","text_en":"Kyoto"},{"index":3,"text_ar":"سيول","text_en":"Seoul"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',14,'البيتزا أصلها من أي بلد؟','Pizza originated in which country?',20000,'[{"index":0,"text_ar":"إيطاليا","text_en":"Italy"},{"index":1,"text_ar":"اليونان","text_en":"Greece"},{"index":2,"text_ar":"فرنسا","text_en":"France"},{"index":3,"text_ar":"إسبانيا","text_en":"Spain"}]',0,'double');

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A KAHOOT PER COUNTRY — starting with Egypt
--
--  A pack now belongs to a place. Egypt first, because that is where
--  the people are, and because a quiz written by somebody who lives
--  somewhere is always better than a quiz written about it.
--
--  Two kinds of pack, and the difference matters:
--    country = 'EG'  → for people who know Egypt
--    country = null  → everybody, everywhere (World Football, Europe…)
--  The hub shows your country's packs first and the worldwide ones
--  always, so a room with an Egyptian and a Romanian in it still has
--  something both of them can win.
--
--  ── ON MAKING IT FUNNY ──────────────────────────────────────────
--  A quiz still has to have a right answer, so the joke cannot live in
--  the question — a question with four defensible answers is not funny,
--  it is broken, and the argument afterwards is not the good kind.
--
--  So the fact is real and the WRONG answers are the joke. You read
--  four options, three of them are ridiculous, and the laugh happens
--  before you tap. Kahoot works exactly this way and it is the only
--  version of "funny quiz" that survives contact with a scoreboard.
--
--  Nothing here is at anybody's expense. No weight, no money, no
--  religion, no families, no accents, nobody's mother. Egyptians
--  laughing at microbuses and at how long "بكرة" really takes is a
--  joke everybody in the room is inside. That line is deliberate and
--  it stays.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_packs add column if not exists country text;
create index if not exists game_packs_country_idx on public.game_packs (country, is_official);

-- where the existing packs belong
update public.game_packs set country = 'EG'
 where id::text like 'aaaa1111%';
update public.game_packs set country = null
 where id::text like 'bbbb2222%';        -- everybody

-- ── مصر · بجد؟ / Egypt, honestly ────────────────────────────────────
delete from public.game_packs where id = 'cccc3333-0000-4000-8000-000000000001';

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, country, locale, is_official, visibility) values
 ('cccc3333-0000-4000-8000-000000000001','مصر… بجد؟','Egypt, honestly',
  'أسئلة سهلة وإجابات غلط مضحكة','Real questions. Three ridiculous answers and one true one.',
  'fun','EG','ar-EG',true,'public');

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('cccc3333-0000-4000-8000-000000000001',0,'الكشري فيه إيه؟','What is in koshari?',20000,
 '[{"index":0,"text_ar":"رز وعدس ومكرونة","text_en":"Rice, lentils and pasta"},{"index":1,"text_ar":"سوشي وصويا","text_en":"Sushi and soy sauce"},{"index":2,"text_ar":"جبنة موتزاريلا وريحان","text_en":"Mozzarella and basil"},{"index":3,"text_ar":"أي حاجة لقيتها في المطبخ","text_en":"Whatever was in the kitchen"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',1,'الأهرامات موجودة فين؟','Where are the pyramids?',20000,
 '[{"index":0,"text_ar":"الجيزة","text_en":"Giza"},{"index":1,"text_ar":"شرم الشيخ","text_en":"Sharm El-Sheikh"},{"index":2,"text_ar":"في الصور بس","text_en":"Only in photos"},{"index":3,"text_ar":"ورا بيتنا","text_en":"Behind our house"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',2,'النيل بيصب في إيه؟','Where does the Nile empty into?',20000,
 '[{"index":0,"text_ar":"البحر المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"المحيط الهادي","text_en":"The Pacific"},{"index":2,"text_ar":"حمام سباحة كبير","text_en":"A very large swimming pool"},{"index":3,"text_ar":"محدش يعرف","text_en":"Nobody knows"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',3,'قمر الدين معمول من إيه؟','What is qamar al-din made from?',20000,
 '[{"index":0,"text_ar":"مشمش","text_en":"Apricots"},{"index":1,"text_ar":"طوب أحمر","text_en":"Red bricks"},{"index":2,"text_ar":"بطيخ","text_en":"Watermelon"},{"index":3,"text_ar":"القمر نفسه","text_en":"The actual moon"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',4,'شم النسيم بياكلوا فيه إيه؟','What do people eat on Sham El-Nessim?',20000,
 '[{"index":0,"text_ar":"فسيخ ورنجة","text_en":"Feseekh and herring"},{"index":1,"text_ar":"سوشي","text_en":"Sushi"},{"index":2,"text_ar":"كورن فليكس","text_en":"Cornflakes"},{"index":3,"text_ar":"أي حاجة ريحتها أهدى","text_en":"Anything that smells calmer"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',5,'برج القاهرة في أي جزيرة؟','Which island is the Cairo Tower on?',20000,
 '[{"index":0,"text_ar":"الزمالك","text_en":"Zamalek"},{"index":1,"text_ar":"هاواي","text_en":"Hawaii"},{"index":2,"text_ar":"جزيرة الكنز","text_en":"Treasure Island"},{"index":3,"text_ar":"مش جزيرة أصلاً","text_en":"It is not on an island"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',6,'المولد بياكلوا فيه إيه؟','What sweets are eaten at the Mawlid?',20000,
 '[{"index":0,"text_ar":"حلاوة المولد","text_en":"Mawlid sweets"},{"index":1,"text_ar":"مكرونة بشاميل","text_en":"Béchamel pasta"},{"index":2,"text_ar":"سلطة خضرا","text_en":"A green salad"},{"index":3,"text_ar":"ولا حاجة، إحنا بنتفرج","text_en":"Nothing, we just watch"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',7,'مترو القاهرة فيه كام خط شغال؟','How many metro lines run in Cairo?',20000,
 '[{"index":0,"text_ar":"3","text_en":"3"},{"index":1,"text_ar":"47","text_en":"47"},{"index":2,"text_ar":"واحد وبنتخانق عليه","text_en":"One, and we fight over it"},{"index":3,"text_ar":"مفيش مترو","text_en":"There is no metro"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',8,'التوك توك بيمشي بإيه؟','What does a tuk-tuk run on?',20000,
 '[{"index":0,"text_ar":"بنزين","text_en":"Petrol"},{"index":1,"text_ar":"طاقة شمسية","text_en":"Solar power"},{"index":2,"text_ar":"أغاني مزيكا عالية","text_en":"Very loud music"},{"index":3,"text_ar":"الأمل","text_en":"Hope"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',9,'الإسكندرية على أي بحر؟','Alexandria sits on which sea?',20000,
 '[{"index":0,"text_ar":"المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"الأحمر","text_en":"The Red Sea"},{"index":2,"text_ar":"الكاريبي","text_en":"The Caribbean"},{"index":3,"text_ar":"بحر من الزحمة","text_en":"A sea of traffic"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',10,'أسوان مشهورة بإيه؟','What is Aswan known for?',20000,
 '[{"index":0,"text_ar":"السد العالي","text_en":"The High Dam"},{"index":1,"text_ar":"التزلج على الجليد","text_en":"Ice skating"},{"index":2,"text_ar":"الضباب","text_en":"Fog"},{"index":3,"text_ar":"البطاطس","text_en":"Potatoes"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',11,'الفول والطعمية بياكلوهم إمتى غالباً؟','When is fuul and taameya usually eaten?',20000,
 '[{"index":0,"text_ar":"الفطار","text_en":"Breakfast"},{"index":1,"text_ar":"مرة في السنة","text_en":"Once a year"},{"index":2,"text_ar":"في الفضا","text_en":"In space"},{"index":3,"text_ar":"ممنوع أكلهم","text_en":"They are banned"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',12,'خان الخليلي إيه؟','What is Khan El-Khalili?',20000,
 '[{"index":0,"text_ar":"سوق قديم","text_en":"An old market"},{"index":1,"text_ar":"مطار","text_en":"An airport"},{"index":2,"text_ar":"لاعب كورة","text_en":"A footballer"},{"index":3,"text_ar":"نوع مكرونة","text_en":"A kind of pasta"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',13,'الساحل الشمالي على أي بحر؟','The North Coast is on which sea?',20000,
 '[{"index":0,"text_ar":"المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"الأحمر","text_en":"The Red Sea"},{"index":2,"text_ar":"بحر الرمال","text_en":"The Sand Sea"},{"index":3,"text_ar":"مفيش بحر، صور بس","text_en":"No sea, just photos"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',14,'«بكرة» في مصر معناها إيه بالظبط؟','In Egypt, "bukra" (tomorrow) means exactly what?',20000,
 '[{"index":0,"text_ar":"بكرة","text_en":"Tomorrow"},{"index":1,"text_ar":"الأسبوع الجاي","text_en":"Next week"},{"index":2,"text_ar":"لما ربنا يسهّل","text_en":"When it works out"},{"index":3,"text_ar":"محدش يعرف","text_en":"Nobody knows"}]',0,'double');

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  لمّة · MORE EGYPT, AND FUNNIER
--
--  Four new packs, all country = 'EG'. The three original Egyptian
--  packs (films, 90s songs, football) are straight trivia and stay that
--  way — a quiz night needs something you can actually be good at.
--  These four are the other half of the evening.
--
--  ── THE RULE THE JOKES FOLLOW ────────────────────────────────────
--  A quiz still has to have a right answer, so the joke cannot live in
--  the question. Four defensible answers is not funny, it is broken,
--  and the argument afterwards is the bad kind.
--
--  So the FACT is real and the WRONG answers are the joke. You read
--  four options, three of them are ridiculous, and the laugh happens
--  before you tap. Sometimes the true answer is the funny one — the
--  sewing kit in the biscuit tin is a real fact about real Egyptian
--  houses — and that is the best case of all, because the laugh is
--  recognition rather than a punchline.
--
--  ── AND WHO IT IS NEVER AT ───────────────────────────────────────
--  Nothing here is at anybody's expense. No weight, no money, no
--  religion as a target, no families, no accents, no regions, nobody's
--  mother. Egyptians laughing at microbuses, at how long "بكرة" takes
--  and at the tin of biscuits that has never once contained biscuits
--  is a joke everybody in the room is inside. That line is deliberate
--  and it stays.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.game_packs where id in (
  'dddd4444-0000-4000-8000-000000000001',
  'dddd4444-0000-4000-8000-000000000002',
  'dddd4444-0000-4000-8000-000000000003',
  'dddd4444-0000-4000-8000-000000000004'
);

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, country, locale, is_official, visibility) values
 ('dddd4444-0000-4000-8000-000000000001','مواصلات مصر','Getting around Egypt',
  'ميكروباص وتوك توك ومترو','Microbuses, tuk-tuks and one very busy metro.','fun','EG','ar-EG',true,'public'),
 ('dddd4444-0000-4000-8000-000000000002','البيت المصري','An Egyptian house',
  'علبة البسكوت اللي مفيهاش بسكوت','The biscuit tin that has never contained biscuits.','fun','EG','ar-EG',true,'public'),
 ('dddd4444-0000-4000-8000-000000000003','رمضان في مصر','Ramadan in Egypt',
  'فوانيس وقطايف ومدفع','Lanterns, qatayef and a cannon.','fun','EG','ar-EG',true,'public'),
 ('dddd4444-0000-4000-8000-000000000004','أيام المدرسة','School days in Egypt',
  'الطابور والكانتين والحصة الأخيرة','The morning line-up, the canteen, the last period.','fun','EG','ar-EG',true,'public');

-- ── مواصلات مصر ────────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000001',0,'عايز تنزل من الميكروباص، بتقول إيه؟','You want to get off the microbus. What do you say?',20000,
 '[{"index":0,"text_ar":"على جنب لو سمحت","text_en":"Pull over, please"},{"index":1,"text_ar":"افتح يا سمسم","text_en":"Open sesame"},{"index":2,"text_ar":"أنا وصلت، مع السلامة يا جماعة","text_en":"I have arrived, farewell everyone"},{"index":3,"text_ar":"مش هنزل، أنا عايش هنا دلوقتي","text_en":"I am not getting off. I live here now"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',1,'«الأسطى» في الميكروباص هو مين؟','Who is the "usta" on a microbus?',20000,
 '[{"index":0,"text_ar":"السواق","text_en":"The driver"},{"index":1,"text_ar":"أكبر واحد سنًا في العربية","text_en":"The oldest passenger aboard"},{"index":2,"text_ar":"اللي قاعد جنب الشباك","text_en":"Whoever got the window seat"},{"index":3,"text_ar":"محدش، دي رتبة شرفية","text_en":"Nobody. It is an honorary title"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',2,'التوك توك أصله جاي من بلد إيه؟','Which country is the tuk-tuk originally from?',20000,
 '[{"index":0,"text_ar":"الهند","text_en":"India"},{"index":1,"text_ar":"المنصورة","text_en":"Mansoura"},{"index":2,"text_ar":"النرويج","text_en":"Norway"},{"index":3,"text_ar":"اتولد لوحده في شارع","text_en":"It formed spontaneously in a side street"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',3,'الترام في الإسكندرية الناس بتقول عليه إيه؟','What do people in Alexandria call the tram?',20000,
 '[{"index":0,"text_ar":"الترماي","text_en":"El-tormay"},{"index":1,"text_ar":"الصاروخ","text_en":"The rocket"},{"index":2,"text_ar":"المترو الطائر","text_en":"The flying metro"},{"index":3,"text_ar":"الأتوبيس اللي على قضبان","text_en":"The bus that got railings"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',4,'عربية الأجرة القديمة في القاهرة كان لونها إيه؟','What colour were the old Cairo taxis?',20000,
 '[{"index":0,"text_ar":"أبيض وأسود","text_en":"Black and white"},{"index":1,"text_ar":"أحمر ومنقّط","text_en":"Red with spots"},{"index":2,"text_ar":"شفاف","text_en":"Transparent"},{"index":3,"text_ar":"كل واحدة على مزاجها","text_en":"Whatever the driver felt like"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',5,'المترو فيه عربية مخصصة لمين؟','The metro has carriages reserved for whom?',20000,
 '[{"index":0,"text_ar":"السيدات","text_en":"Women"},{"index":1,"text_ar":"اللي معاهم فكة","text_en":"People with exact change"},{"index":2,"text_ar":"اللي صاحيين بدري","text_en":"People who woke up early"},{"index":3,"text_ar":"القطط","text_en":"Cats"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',6,'كوبري قصر النيل عليه تماثيل إيه؟','What statues sit on Qasr El-Nil Bridge?',20000,
 '[{"index":0,"text_ar":"أسود","text_en":"Lions"},{"index":1,"text_ar":"بطاريق","text_en":"Penguins"},{"index":2,"text_ar":"سواقين ميكروباص","text_en":"Microbus drivers"},{"index":3,"text_ar":"مفيش، دي شائعة","text_en":"None. That is a rumour"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',7,'«العدّاد» في التاكسي بيقيس إيه؟','What does a taxi meter measure?',20000,
 '[{"index":0,"text_ar":"المسافة والوقت","text_en":"Distance and time"},{"index":1,"text_ar":"مزاج السواق","text_en":"The driver’s mood"},{"index":2,"text_ar":"صوت الراديو","text_en":"The volume of the radio"},{"index":3,"text_ar":"مفيش، ده للزينة","text_en":"Nothing. It is decorative"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',8,'الطريق الدائري بيلف حوالين إيه؟','What does the Ring Road go around?',20000,
 '[{"index":0,"text_ar":"القاهرة الكبرى","text_en":"Greater Cairo"},{"index":1,"text_ar":"نفسه","text_en":"Itself"},{"index":2,"text_ar":"برج القاهرة بس","text_en":"Just the Cairo Tower"},{"index":3,"text_ar":"محدش يعرف، مفيش حد وصل لآخره","text_en":"Nobody knows. No one has reached the end"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',9,'«اركب يا بلدنا» بيقولها مين؟','Who shouts "erkab ya baladna"?',20000,
 '[{"index":0,"text_ar":"الكمسري أو السواق عشان يجمّع ركاب","text_en":"The conductor or driver, rounding up passengers"},{"index":1,"text_ar":"الراكب لما يفرح","text_en":"A passenger who is happy"},{"index":2,"text_ar":"العدّاد","text_en":"The meter"},{"index":3,"text_ar":"الإشارة الحمرا","text_en":"The red light"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',10,'قناة السويس بتوصل بين أنهي بحرين؟','The Suez Canal connects which two seas?',20000,
 '[{"index":0,"text_ar":"المتوسط والأحمر","text_en":"The Mediterranean and the Red Sea"},{"index":1,"text_ar":"الأحمر والكاريبي","text_en":"The Red Sea and the Caribbean"},{"index":2,"text_ar":"بحر الزحمة وبحر الزحمة","text_en":"The sea of traffic and the sea of traffic"},{"index":3,"text_ar":"مفيش، دي بحيرة طويلة","text_en":"Neither. It is a long lake"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',11,'قد إيه بياخد الميكروباص عشان يتحرك؟','How long does a microbus wait before it moves?',20000,
 '[{"index":0,"text_ar":"لحد ما يملا","text_en":"Until it is full"},{"index":1,"text_ar":"دقيقتين بالظبط","text_en":"Exactly two minutes"},{"index":2,"text_ar":"لما السواق يخلص الشاي","text_en":"Until the driver finishes his tea"},{"index":3,"text_ar":"لما ربنا يسهّل","text_en":"Whenever it works out"}]',0,'double');

-- ── البيت المصري ───────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000002',0,'علبة البسكوت المعدنية اللي في البيت جوّاها إيه؟','What is inside the metal biscuit tin at home?',20000,
 '[{"index":0,"text_ar":"خيط وإبر","text_en":"Thread and needles"},{"index":1,"text_ar":"بسكوت","text_en":"Biscuits"},{"index":2,"text_ar":"علبة بسكوت أصغر","text_en":"A smaller biscuit tin"},{"index":3,"text_ar":"محدش فتحها من ٢٠٠٤","text_en":"Nobody has opened it since 2004"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',1,'الفوط الحلوة في الدولاب بتتستعمل إمتى؟','When do the nice towels come out of the cupboard?',20000,
 '[{"index":0,"text_ar":"لما ييجي ضيوف","text_en":"When guests come"},{"index":1,"text_ar":"كل يوم عادي","text_en":"Every ordinary day"},{"index":2,"text_ar":"في الأعياد بس","text_en":"Only on holidays"},{"index":3,"text_ar":"أبدًا، دي للعرض","text_en":"Never. They are for display"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',2,'الشنطة البلاستيك اللي في المطبخ جوّاها إيه؟','What is in the plastic bag in the kitchen?',20000,
 '[{"index":0,"text_ar":"شنط بلاستيك تانية","text_en":"More plastic bags"},{"index":1,"text_ar":"فلوس","text_en":"Money"},{"index":2,"text_ar":"الريموت","text_en":"The remote"},{"index":3,"text_ar":"خريطة كنز","text_en":"A treasure map"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',3,'«الصالون» في البيت المصري بيتقعد فيه إمتى؟','When does anyone sit in the formal living room?',20000,
 '[{"index":0,"text_ar":"لما ييجي ضيوف مهمين","text_en":"When important guests come"},{"index":1,"text_ar":"كل يوم","text_en":"Every day"},{"index":2,"text_ar":"الصبح بس","text_en":"Only in the morning"},{"index":3,"text_ar":"ممنوع دخوله نهائي","text_en":"Entry is strictly forbidden"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',4,'الشاي المصري بيتقدّم إزاي غالبًا؟','How is Egyptian tea usually served?',20000,
 '[{"index":0,"text_ar":"في كوباية صغيرة وسكر","text_en":"In a small glass, with sugar"},{"index":1,"text_ar":"بارد في زجاجة","text_en":"Cold, in a bottle"},{"index":2,"text_ar":"في طبق","text_en":"On a plate"},{"index":3,"text_ar":"مع شوكة","text_en":"With a fork"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',5,'الكنبة اللي عليها «الكوفرتة» بتتغطي ليه؟','Why is the sofa kept under a cover?',20000,
 '[{"index":0,"text_ar":"عشان تفضل نضيفة","text_en":"To keep it clean"},{"index":1,"text_ar":"عشان تنام","text_en":"So it can sleep"},{"index":2,"text_ar":"عشان محدش يشوف لونها","text_en":"So nobody learns its colour"},{"index":3,"text_ar":"دي مش كنبة أصلاً","text_en":"It is not a sofa at all"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',6,'«الشبشب» بيتستعمل في إيه؟','What are slippers used for?',20000,
 '[{"index":0,"text_ar":"المشي في البيت","text_en":"Walking around the house"},{"index":1,"text_ar":"الرياضة","text_en":"Sport"},{"index":2,"text_ar":"الزينة","text_en":"Decoration"},{"index":3,"text_ar":"محدش يعرف","text_en":"Nobody knows"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',7,'الملوخية بتتاكل مع إيه غالبًا؟','What is molokhia usually eaten with?',20000,
 '[{"index":0,"text_ar":"رز وفراخ","text_en":"Rice and chicken"},{"index":1,"text_ar":"آيس كريم","text_en":"Ice cream"},{"index":2,"text_ar":"كورن فليكس","text_en":"Cornflakes"},{"index":3,"text_ar":"لوحدها بالشوكة","text_en":"On its own, with a fork"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',8,'لما الكهربا تقطع، أول حاجة بتحصل إيه؟','When the power cuts, what happens first?',20000,
 '[{"index":0,"text_ar":"الكل يقول «آآه» في نفس اللحظة","text_en":"Everyone says “aah” at the same instant"},{"index":1,"text_ar":"سكوت تام","text_en":"Total silence"},{"index":2,"text_ar":"الكل ينام","text_en":"Everyone goes to sleep"},{"index":3,"text_ar":"محدش يلاحظ","text_en":"Nobody notices"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',9,'«العيش» في مصر معناه إيه بالظبط؟','What does "eish" mean in Egypt?',20000,
 '[{"index":0,"text_ar":"الخبز — وكمان الحياة","text_en":"Bread — and also life"},{"index":1,"text_ar":"الميّة","text_en":"Water"},{"index":2,"text_ar":"الشباك","text_en":"A window"},{"index":3,"text_ar":"نوع عربية","text_en":"A kind of car"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',10,'البقّال بيكتب الحساب فين؟','Where does the corner shop keep your tab?',20000,
 '[{"index":0,"text_ar":"في كشكول","text_en":"In a notebook"},{"index":1,"text_ar":"في تطبيق","text_en":"In an app"},{"index":2,"text_ar":"على الحيطة","text_en":"On the wall"},{"index":3,"text_ar":"في دماغه بس","text_en":"Purely from memory"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',11,'«تعالى اتغدى معانا» معناها إيه؟','What does "come and have lunch with us" mean?',20000,
 '[{"index":0,"text_ar":"دعوة حقيقية، وهتاكل","text_en":"A real invitation, and you will be fed"},{"index":1,"text_ar":"مجاملة بس","text_en":"Politeness, nothing more"},{"index":2,"text_ar":"تحية زي صباح الخير","text_en":"A greeting, like good morning"},{"index":3,"text_ar":"معناها امشي","text_en":"It means please leave"}]',0,'double');

-- ── رمضان في مصر ───────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000003',0,'المسحراتي بيصحّي الناس عشان إيه؟','Why does the mesaharaty wake people up?',20000,
 '[{"index":0,"text_ar":"السحور","text_en":"For suhoor"},{"index":1,"text_ar":"عشان يسلّم عليهم","text_en":"To say hello"},{"index":2,"text_ar":"عشان محدش يفوّت الشغل","text_en":"So nobody is late for work"},{"index":3,"text_ar":"مالوش سبب","text_en":"No reason at all"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',1,'مدفع الإفطار بيضرب إمتى؟','When does the iftar cannon fire?',20000,
 '[{"index":0,"text_ar":"عند المغرب","text_en":"At sunset"},{"index":1,"text_ar":"الساعة ٣ الفجر","text_en":"At 3 in the morning"},{"index":2,"text_ar":"لما الأكل يخلص","text_en":"When the food runs out"},{"index":3,"text_ar":"كل ساعة","text_en":"Every hour"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',2,'القطايف بتتحشى بإيه غالبًا؟','What is qatayef usually filled with?',20000,
 '[{"index":0,"text_ar":"مكسرات أو قشطة","text_en":"Nuts or cream"},{"index":1,"text_ar":"مكرونة","text_en":"Pasta"},{"index":2,"text_ar":"شوربة","text_en":"Soup"},{"index":3,"text_ar":"قطايف أصغر","text_en":"Smaller qatayef"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',3,'مائدة الرحمن إيه؟','What is a maidet rahman?',20000,
 '[{"index":0,"text_ar":"إفطار مجاني للناس في الشارع","text_en":"A free street iftar for anyone"},{"index":1,"text_ar":"مطعم غالي","text_en":"An expensive restaurant"},{"index":2,"text_ar":"نوع حلويات","text_en":"A kind of dessert"},{"index":3,"text_ar":"برنامج تليفزيوني","text_en":"A television show"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',4,'الفانوس بيتعلق فين؟','Where does the fanous get hung?',20000,
 '[{"index":0,"text_ar":"في البلكونة والشارع","text_en":"On balconies and in the street"},{"index":1,"text_ar":"في التلاجة","text_en":"In the fridge"},{"index":2,"text_ar":"تحت السرير","text_en":"Under the bed"},{"index":3,"text_ar":"في الشنطة","text_en":"In a bag"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',5,'ياميش رمضان فيه إيه؟','What is in yamish Ramadan?',20000,
 '[{"index":0,"text_ar":"تمر ومكسرات وقمر الدين","text_en":"Dates, nuts and apricot sheets"},{"index":1,"text_ar":"جبنة رومي بس","text_en":"Only Roumi cheese"},{"index":2,"text_ar":"شيبسي","text_en":"Crisps"},{"index":3,"text_ar":"بطاطس محمرة","text_en":"Fried potatoes"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',6,'الزحمة في الشارع بتوصل لأقصاها إمتى؟','When does the traffic peak?',20000,
 '[{"index":0,"text_ar":"قبل المغرب بشوية","text_en":"Just before sunset"},{"index":1,"text_ar":"الفجر","text_en":"At dawn"},{"index":2,"text_ar":"وقت الإفطار بالظبط","text_en":"Exactly at iftar time"},{"index":3,"text_ar":"مفيش زحمة في رمضان","text_en":"There is no traffic in Ramadan"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',7,'الكنافة بتتعمل من إيه؟','What is konafa made from?',20000,
 '[{"index":0,"text_ar":"عجينة رفيعة زي الشعر","text_en":"Fine, hair-like pastry"},{"index":1,"text_ar":"رز","text_en":"Rice"},{"index":2,"text_ar":"خيط حقيقي","text_en":"Actual thread"},{"index":3,"text_ar":"مكرونة اسباجتي","text_en":"Spaghetti"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',8,'«وحوي يا وحوي» دي إيه؟','What is "wahawi ya wahawi"?',20000,
 '[{"index":0,"text_ar":"أغنية رمضان قديمة للأطفال","text_en":"An old Ramadan children’s song"},{"index":1,"text_ar":"نوع أكل","text_en":"A kind of food"},{"index":2,"text_ar":"اسم شارع","text_en":"A street name"},{"index":3,"text_ar":"تحية بين السواقين","text_en":"A greeting between drivers"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',9,'الخشاف معمول من إيه؟','What is khoshaf made of?',20000,
 '[{"index":0,"text_ar":"فواكه مجففة منقوعة","text_en":"Soaked dried fruit"},{"index":1,"text_ar":"لبن وشيكولاتة","text_en":"Milk and chocolate"},{"index":2,"text_ar":"شوربة عدس","text_en":"Lentil soup"},{"index":3,"text_ar":"ميّة وسكر بس","text_en":"Just water and sugar"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',10,'المسلسلات بتتعرض بكثافة إمتى؟','When are all the TV series shown?',20000,
 '[{"index":0,"text_ar":"في رمضان","text_en":"In Ramadan"},{"index":1,"text_ar":"في الصيف","text_en":"In the summer"},{"index":2,"text_ar":"يوم الجمعة بس","text_en":"Only on Fridays"},{"index":3,"text_ar":"مرة كل سنتين","text_en":"Once every two years"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',11,'بعد الإفطار مباشرة بيحصل إيه في أغلب البيوت؟','Right after iftar, what happens in most homes?',20000,
 '[{"index":0,"text_ar":"شاي وحلويات وقعدة","text_en":"Tea, sweets and sitting around"},{"index":1,"text_ar":"الجري في الشارع","text_en":"Running laps outside"},{"index":2,"text_ar":"امتحان مفاجئ","text_en":"A surprise exam"},{"index":3,"text_ar":"إفطار تاني","text_en":"A second iftar"}]',0,'double');

-- ── أيام المدرسة ───────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000004',0,'طابور الصباح بيبدأ بإيه؟','How does the morning line-up start?',20000,
 '[{"index":0,"text_ar":"السلام الوطني","text_en":"The national anthem"},{"index":1,"text_ar":"أغنية مهرجانات","text_en":"A mahraganat track"},{"index":2,"text_ar":"امتحان","text_en":"An exam"},{"index":3,"text_ar":"مفيش، الكل بيدخل على طول","text_en":"It does not. Everyone just walks in"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',1,'الكانتين بيبيع إيه أكتر حاجة؟','What does the school canteen sell most of?',20000,
 '[{"index":0,"text_ar":"شيبسي وسندوتشات","text_en":"Crisps and sandwiches"},{"index":1,"text_ar":"كتب","text_en":"Books"},{"index":2,"text_ar":"تذاكر طيران","text_en":"Plane tickets"},{"index":3,"text_ar":"نصايح","text_en":"Advice"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',2,'«الحصة الأخيرة» مشهورة بإيه؟','What is the last period famous for?',20000,
 '[{"index":0,"text_ar":"إن محدش مركّز فيها","text_en":"Nobody concentrating in it"},{"index":1,"text_ar":"إنها أطول حصة","text_en":"Being the longest period"},{"index":2,"text_ar":"إنها بالإنجليزي دايمًا","text_en":"Always being in English"},{"index":3,"text_ar":"إنها اختيارية","text_en":"Being optional"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',3,'الكشكول بيتستعمل في إيه؟','What is a kashkool used for?',20000,
 '[{"index":0,"text_ar":"الكتابة","text_en":"Writing"},{"index":1,"text_ar":"المروحة","text_en":"Fanning yourself"},{"index":2,"text_ar":"الأكل","text_en":"Eating"},{"index":3,"text_ar":"القعدة عليه","text_en":"Sitting on it"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',4,'المسطرة بتتستعمل في إيه أكتر حاجة جوّا الفصل؟','What does a ruler mostly get used for in class?',20000,
 '[{"index":0,"text_ar":"رسم خطوط","text_en":"Drawing straight lines"},{"index":1,"text_ar":"قياس الفصل","text_en":"Measuring the classroom"},{"index":2,"text_ar":"الطبخ","text_en":"Cooking"},{"index":3,"text_ar":"محدش استعملها ولا مرة","text_en":"Nobody has ever used one"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',5,'الثانوية العامة بتيجي في أنهي سنة؟','Which year is the Thanaweya Amma?',20000,
 '[{"index":0,"text_ar":"آخر سنة في الثانوي","text_en":"The final year of secondary school"},{"index":1,"text_ar":"أول سنة ابتدائي","text_en":"The first year of primary"},{"index":2,"text_ar":"بعد الجامعة","text_en":"After university"},{"index":3,"text_ar":"كل سنة","text_en":"Every single year"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',6,'«الحضور والغياب» بيتعمل إمتى؟','When is the register taken?',20000,
 '[{"index":0,"text_ar":"أول الحصة","text_en":"At the start of the lesson"},{"index":1,"text_ar":"بعد ما الكل يمشي","text_en":"After everyone has left"},{"index":2,"text_ar":"مرة في السنة","text_en":"Once a year"},{"index":3,"text_ar":"في البيت","text_en":"At home"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',7,'الفسحة بتتستعمل في إيه؟','What is break time for?',20000,
 '[{"index":0,"text_ar":"الأكل واللعب","text_en":"Eating and playing"},{"index":1,"text_ar":"حصة زيادة","text_en":"An extra lesson"},{"index":2,"text_ar":"النوم في الفصل","text_en":"Sleeping in class"},{"index":3,"text_ar":"مفيش فسحة","text_en":"There is no break"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',8,'«الشنطة» يوم الأحد بتبقى إزاي؟','How heavy is the bag on Sunday?',20000,
 '[{"index":0,"text_ar":"أتقل يوم في الأسبوع","text_en":"The heaviest day of the week"},{"index":1,"text_ar":"فاضية","text_en":"Empty"},{"index":2,"text_ar":"بتطير","text_en":"It floats"},{"index":3,"text_ar":"زي أي يوم","text_en":"Same as any other day"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',9,'الكتاب المدرسي بيتغلّف بإيه؟','What do you cover a schoolbook with?',20000,
 '[{"index":0,"text_ar":"ورق لاصق أو ورق بني","text_en":"Sticky film or brown paper"},{"index":1,"text_ar":"قماش","text_en":"Cloth"},{"index":2,"text_ar":"ألومنيوم","text_en":"Foil"},{"index":3,"text_ar":"محدش بيغلّف","text_en":"Nobody covers them"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',10,'أجازة نص السنة بتيجي إمتى؟','When is the mid-year holiday?',20000,
 '[{"index":0,"text_ar":"في الشتا","text_en":"In winter"},{"index":1,"text_ar":"في أغسطس","text_en":"In August"},{"index":2,"text_ar":"في رمضان دايمًا","text_en":"Always in Ramadan"},{"index":3,"text_ar":"مفيش أجازة نص سنة","text_en":"There is no mid-year holiday"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',11,'«الجرس» لما يرن آخر اليوم بيحصل إيه؟','What happens when the final bell rings?',20000,
 '[{"index":0,"text_ar":"الكل يقوم في نفس اللحظة","text_en":"Everyone stands up at the same instant"},{"index":1,"text_ar":"محدش يتحرك","text_en":"Nobody moves"},{"index":2,"text_ar":"تبدأ حصة جديدة","text_en":"A new lesson begins"},{"index":3,"text_ar":"الجرس بيرن تاني","text_en":"The bell rings again"}]',0,'double');

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  لمّة · EGYPT, IN ONE PACK, PLAYABLE BY ANYONE
--
--  Egypt had eight packs. Now it has one.
--
--  ── WHY THEY WERE MERGED ─────────────────────────────────────────
--  Eight cards for one country is a filing cabinet, not a game. You
--  open لمّة to play, not to choose between "Egyptian Films" and
--  "90s Songs" before you have even started.
--
--  ── WHY MOST OF THE OLD QUESTIONS COULD NOT COME ─────────────────
--  Counted before rewriting: of 63 Egyptian questions, 11 were
--  recognisable outside Egypt. Seventeen per cent. The rest asked what
--  you shout to get off a microbus, what the morning line-up at school
--  starts with, what el-tormay is — questions where somebody in Berlin
--  or Bucharest cannot even make an educated guess. That is not a hard
--  question, it is a closed door, and a room with one Egyptian and
--  three Europeans in it stops being a game.
--
--  So this pack is built from the Egypt the whole world already has a
--  picture of: the pyramids, the Nile, Tutankhamun, Cleopatra, the
--  Sphinx, the Suez Canal, the Red Sea, Alexandria, koshari. A European
--  who has never been can answer most of it. An Egyptian should get
--  every single one — and that asymmetry is the point, because it is
--  their pack.
--
--  ── THE JOKES ────────────────────────────────────────────────────
--  Unchanged rule: the FACT is real, the WRONG answers are the joke.
--  And every wrong answer is CLEARLY wrong. A funny option that might
--  actually be true is not a joke, it is a second right answer — which
--  is why the Sphinx is not offered "a very large cat, which is close
--  enough", and why nobody is asked which continent Egypt is on.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- The eight separate Egyptian packs become one. Questions go with them
-- (questions.pack_id cascades on delete).
delete from public.game_packs where id in (
  'aaaa1111-0000-4000-8000-000000000001',   -- Egyptian Films
  'aaaa1111-0000-4000-8000-000000000002',   -- 90s Songs
  'aaaa1111-0000-4000-8000-000000000003',   -- Egyptian Football
  'cccc3333-0000-4000-8000-000000000001',   -- مصر… بجد؟
  'dddd4444-0000-4000-8000-000000000001',   -- مواصلات مصر
  'dddd4444-0000-4000-8000-000000000002',   -- البيت المصري
  'dddd4444-0000-4000-8000-000000000003',   -- رمضان في مصر
  'dddd4444-0000-4000-8000-000000000004'    -- أيام المدرسة
);

delete from public.game_packs where id = 'eeee5555-0000-4000-8000-000000000001';

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, country, locale, is_official, visibility) values
 ('eeee5555-0000-4000-8000-000000000001','تعرف مصر؟','Do You Know Egypt?',
  'كل حاجة عن مصر في مكان واحد — والعالم كله يقدر يلعبها',
  'All of Egypt in one place — and the whole table can play.',
  'fun','EG','ar-EG',true,'public');

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',0,'الأهرامات اتبنت أصلاً عشان إيه؟','What were the pyramids originally built as?',20000,
 '[{"index":0,"text_ar":"مقابر للملوك","text_en":"Tombs for kings"},{"index":1,"text_ar":"مخازن قمح","text_en":"Grain warehouses"},{"index":2,"text_ar":"بيوت للمصيف","text_en":"Holiday homes"},{"index":3,"text_ar":"جراج متعدد الطوابق","text_en":"A multi-storey car park"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',1,'أنهي نهر بيعدي في مصر؟','Which river runs through Egypt?',20000,
 '[{"index":0,"text_ar":"النيل","text_en":"The Nile"},{"index":1,"text_ar":"الأمازون","text_en":"The Amazon"},{"index":2,"text_ar":"التيمز","text_en":"The Thames"},{"index":3,"text_ar":"الدانوب","text_en":"The Danube"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',2,'عاصمة مصر إيه؟','What is the capital of Egypt?',20000,
 '[{"index":0,"text_ar":"القاهرة","text_en":"Cairo"},{"index":1,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":2,"text_ar":"الأقصر","text_en":"Luxor"},{"index":3,"text_ar":"شرم الشيخ","text_en":"Sharm El-Sheikh"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',3,'توت عنخ آمون كان مين؟','Who was Tutankhamun?',20000,
 '[{"index":0,"text_ar":"فرعون بقى ملك وهو صغير","text_en":"A pharaoh who became king as a boy"},{"index":1,"text_ar":"شاعر يوناني","text_en":"A Greek poet"},{"index":2,"text_ar":"رحّالة إيطالي","text_en":"An Italian explorer"},{"index":3,"text_ar":"ماركة صنادل","text_en":"A brand of sandals"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',4,'مين اللي لقى مقبرة توت عنخ آمون سنة ١٩٢٢؟','Who found Tutankhamun''s tomb in 1922?',20000,
 '[{"index":0,"text_ar":"هوارد كارتر","text_en":"Howard Carter"},{"index":1,"text_ar":"نابليون","text_en":"Napoleon"},{"index":2,"text_ar":"ماركو بولو","text_en":"Marco Polo"},{"index":3,"text_ar":"لسه محدش لقاها","text_en":"Nobody. It is still missing"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',5,'كليوباترا كانت آخر إيه؟','Cleopatra was the last what?',20000,
 '[{"index":0,"text_ar":"حاكمة لمصر القديمة","text_en":"Ruler of ancient Egypt"},{"index":1,"text_ar":"إمبراطورة رومانية","text_en":"Roman empress"},{"index":2,"text_ar":"ملكة إسبانيا","text_en":"Queen of Spain"},{"index":3,"text_ar":"واحدة ترد على الرسايل","text_en":"Person to answer her messages"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',6,'أبو الهول جسمه جسم إيه؟','The Sphinx has the body of which animal?',20000,
 '[{"index":0,"text_ar":"أسد","text_en":"A lion"},{"index":1,"text_ar":"حصان","text_en":"A horse"},{"index":2,"text_ar":"سمكة","text_en":"A fish"},{"index":3,"text_ar":"بطريق","text_en":"A penguin"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',7,'الهيروغليفية إيه؟','What are hieroglyphs?',20000,
 '[{"index":0,"text_ar":"كتابة مصرية قديمة","text_en":"Ancient Egyptian writing"},{"index":1,"text_ar":"نوع مكرونة","text_en":"A kind of pasta"},{"index":2,"text_ar":"رقصة","text_en":"A dance"},{"index":3,"text_ar":"آلة موسيقية","text_en":"A musical instrument"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',8,'حجر رشيد ساعد العلماء في إيه؟','What did the Rosetta Stone help scholars do?',20000,
 '[{"index":0,"text_ar":"يقروا الهيروغليفية","text_en":"Read hieroglyphs"},{"index":1,"text_ar":"يبنوا الأهرامات","text_en":"Build the pyramids"},{"index":2,"text_ar":"يلاقوا منبع النيل","text_en":"Find the source of the Nile"},{"index":3,"text_ar":"يحلوا خلاف على ماتش","text_en":"Settle an argument about a football match"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',9,'قناة السويس بتوصل بين إيه وإيه؟','The Suez Canal connects what to what?',20000,
 '[{"index":0,"text_ar":"البحر المتوسط والبحر الأحمر","text_en":"The Mediterranean and the Red Sea"},{"index":1,"text_ar":"الأطلنطي والهادي","text_en":"The Atlantic and the Pacific"},{"index":2,"text_ar":"بحيرتين","text_en":"Two lakes"},{"index":3,"text_ar":"مفيش، دي للزينة","text_en":"Nothing. It is decorative"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',10,'شرم الشيخ مشهورة بإيه؟','What is Sharm El-Sheikh famous for?',20000,
 '[{"index":0,"text_ar":"الغطس في البحر الأحمر","text_en":"Diving in the Red Sea"},{"index":1,"text_ar":"التزلج على الجليد","text_en":"Skiing"},{"index":2,"text_ar":"غاباتها المطيرة","text_en":"Its rainforests"},{"index":3,"text_ar":"الشفق القطبي","text_en":"The northern lights"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',11,'مين اللي أسّس الإسكندرية؟','Who founded Alexandria?',20000,
 '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great"},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar"},{"index":2,"text_ar":"نابليون","text_en":"Napoleon"},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',12,'فنار الإسكندرية القديم كان واحد من إيه؟','The ancient Lighthouse of Alexandria was one of what?',20000,
 '[{"index":0,"text_ar":"عجائب الدنيا السبع القديمة","text_en":"The Seven Wonders of the Ancient World"},{"index":1,"text_ar":"جبال الألب","text_en":"The Alps"},{"index":2,"text_ar":"الأهرامات","text_en":"The pyramids"},{"index":3,"text_ar":"سلسلة فنادق","text_en":"A chain of hotels"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',13,'محمد صلاح بيلعب لمنتخب أنهي بلد؟','Mohamed Salah plays for which national team?',20000,
 '[{"index":0,"text_ar":"مصر","text_en":"Egypt"},{"index":1,"text_ar":"البرازيل","text_en":"Brazil"},{"index":2,"text_ar":"البرتغال","text_en":"Portugal"},{"index":3,"text_ar":"كل بلد على حسب اليوم","text_en":"A different one each week"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',14,'الكشري فيه إيه؟','What is in koshari, Egypt''s national dish?',20000,
 '[{"index":0,"text_ar":"رز وعدس ومكرونة","text_en":"Rice, lentils and pasta"},{"index":1,"text_ar":"سوشي وصويا","text_en":"Sushi and soy sauce"},{"index":2,"text_ar":"جبنة وريحان","text_en":"Cheese and basil"},{"index":3,"text_ar":"أي حاجة لقيتها في المطبخ","text_en":"Whatever was in the kitchen"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',15,'البردي كان بيتعمل منه إيه؟','What was papyrus used to make?',20000,
 '[{"index":0,"text_ar":"ورق للكتابة","text_en":"Paper to write on"},{"index":1,"text_ar":"زجاج","text_en":"Glass"},{"index":2,"text_ar":"حديد","text_en":"Iron"},{"index":3,"text_ar":"مطر","text_en":"Rain"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',16,'أغلب أرض مصر عبارة عن إيه؟','Most of Egypt''s land is what?',20000,
 '[{"index":0,"text_ar":"صحرا","text_en":"Desert"},{"index":1,"text_ar":"غابات","text_en":"Forest"},{"index":2,"text_ar":"جليد","text_en":"Ice"},{"index":3,"text_ar":"مدن ملاهي مائية","text_en":"Water parks"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',17,'السد العالي في أسوان عمل إيه؟','What did the Aswan High Dam create?',20000,
 '[{"index":0,"text_ar":"بحيرة ناصر","text_en":"Lake Nasser"},{"index":1,"text_ar":"نهر النيل","text_en":"The river Nile"},{"index":2,"text_ar":"البحر الأحمر","text_en":"The Red Sea"},{"index":3,"text_ar":"زحمة لسه مخلصتش","text_en":"A traffic jam that never ended"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',18,'معابد أبو سمبل اتبنت لمين؟','The temples at Abu Simbel were built for whom?',20000,
 '[{"index":0,"text_ar":"رمسيس التاني","text_en":"Ramses II"},{"index":1,"text_ar":"نابليون","text_en":"Napoleon"},{"index":2,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great"},{"index":3,"text_ar":"أول واحد طلب","text_en":"Whoever asked first"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',19,'عملة مصر اسمها إيه؟','What is Egypt''s currency called?',20000,
 '[{"index":0,"text_ar":"الجنيه المصري","text_en":"The Egyptian pound"},{"index":1,"text_ar":"اليورو","text_en":"The euro"},{"index":2,"text_ar":"الين","text_en":"The yen"},{"index":3,"text_ar":"جمال، بالكيلو","text_en":"Camels, by weight"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',20,'الهرم الأكبر في الجيزة اتبنى لمين؟','The Great Pyramid of Giza was built for whom?',20000,
 '[{"index":0,"text_ar":"خوفو","text_en":"Khufu"},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra"},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',21,'اللغة الرسمية في مصر إيه؟','What is the official language of Egypt?',20000,
 '[{"index":0,"text_ar":"العربية","text_en":"Arabic"},{"index":1,"text_ar":"اللاتينية","text_en":"Latin"},{"index":2,"text_ar":"الهيروغليفية، لسه","text_en":"Hieroglyphs, still"},{"index":3,"text_ar":"الإيموچي","text_en":"Emoji"}]',0,'double');

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · EGYPT IN SIX LANGUAGES, AND A HONEST SCORE OUT OF IT
--
--  ── THE PROBLEM ──────────────────────────────────────────────────
--  "Do You Know Egypt?" existed in Arabic and English. A room with a
--  Romanian, a Spaniard and a French speaker in it played in their
--  second or third language, against Egyptians playing in their first.
--  That is not a hard game, it is an unfair one, and the fun goes out
--  of it by question three.
--
--  So the whole pack — every question and all four options of each —
--  is now written in French, Spanish and Romanian too. Written, not
--  machine-translated: a quiz option that drifts a shade in meaning is
--  a second right answer, and the argument afterwards is the bad kind.
--
--  Six choices, and why there are not seven: Moldova's official
--  language IS Romanian. Offering "Moldovan" as a separate button
--  would show the identical words twice and pretend otherwise, so the
--  Romanian option is labelled for both and means it.
--
--  ── HOW A LANGUAGE IS STORED ─────────────────────────────────────
--  text_ar and text_en are columns because they came first and half
--  the app reads them by name. Everything after them lives in one
--  jsonb — text_i18n {"fr":…,"es":…,"ro":…} — on the question and
--  inside each option. A seventh language is then a row update and no
--  migration at all, which is the whole point.
--
--  Resolution order, in the app: your language → English → Arabic.
--  A pack written in only one language still PLAYS rather than showing
--  a blank question over four blank tiles.
--
--  ── AND THE RANKING HE ASKED FOR ─────────────────────────────────
--  lamma_room_results returns, for everybody in the room, how many
--  they actually got RIGHT out of how many the pack asked. Not the
--  score — the score rewards being fast, and being fast is not the
--  same as being Egyptian. Right answers out of total questions, from
--  answers.is_correct, which the server wrote and no phone can touch.
--
--  Missing a question counts against you, because the denominator is
--  the pack and not what you happened to answer. Walking in late
--  should not make you more Egyptian.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── A LANGUAGE IS A KEY, NOT A COLUMN ──────────────────────────────
alter table public.questions add column if not exists text_i18n jsonb;

update public.questions set
  text_i18n = '{"fr": "À quoi servaient les pyramides à l''origine ?", "es": "¿Para qué se construyeron las pirámides?", "ro": "Pentru ce au fost construite piramidele?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"مقابر للملوك","text_en":"Tombs for kings","text_i18n":{"fr":"Des tombeaux pour les rois","es":"Tumbas para los reyes","ro":"Morminte pentru regi"}},{"index":1,"text_ar":"مخازن قمح","text_en":"Grain warehouses","text_i18n":{"fr":"Des entrepôts à grain","es":"Almacenes de grano","ro":"Depozite de grâne"}},{"index":2,"text_ar":"بيوت للمصيف","text_en":"Holiday homes","text_i18n":{"fr":"Des maisons de vacances","es":"Casas de vacaciones","ro":"Case de vacanță"}},{"index":3,"text_ar":"جراج متعدد الطوابق","text_en":"A multi-storey car park","text_i18n":{"fr":"Un parking à étages","es":"Un aparcamiento de varias plantas","ro":"O parcare supraetajată"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 0;

update public.questions set
  text_i18n = '{"fr": "Quel fleuve traverse l''Égypte ?", "es": "¿Qué río pasa por Egipto?", "ro": "Ce râu trece prin Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"النيل","text_en":"The Nile","text_i18n":{"fr":"Le Nil","es":"El Nilo","ro":"Nilul"}},{"index":1,"text_ar":"الأمازون","text_en":"The Amazon","text_i18n":{"fr":"L''Amazone","es":"El Amazonas","ro":"Amazonul"}},{"index":2,"text_ar":"التيمز","text_en":"The Thames","text_i18n":{"fr":"La Tamise","es":"El Támesis","ro":"Tamisa"}},{"index":3,"text_ar":"الدانوب","text_en":"The Danube","text_i18n":{"fr":"Le Danube","es":"El Danubio","ro":"Dunărea"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr": "Quelle est la capitale de l''Égypte ?", "es": "¿Cuál es la capital de Egipto?", "ro": "Care e capitala Egiptului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"القاهرة","text_en":"Cairo","text_i18n":{"fr":"Le Caire","es":"El Cairo","ro":"Cairo"}},{"index":1,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":2,"text_ar":"الأقصر","text_en":"Luxor","text_i18n":{"fr":"Louxor","es":"Luxor","ro":"Luxor"}},{"index":3,"text_ar":"شرم الشيخ","text_en":"Sharm El-Sheikh","text_i18n":{"fr":"Charm el-Cheikh","es":"Sharm el-Sheij","ro":"Sharm El-Sheikh"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr": "Qui était Toutânkhamon ?", "es": "¿Quién fue Tutankamón?", "ro": "Cine a fost Tutankhamon?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"فرعون بقى ملك وهو صغير","text_en":"A pharaoh who became king as a boy","text_i18n":{"fr":"Un pharaon devenu roi enfant","es":"Un faraón que fue rey siendo niño","ro":"Un faraon care a devenit rege de copil"}},{"index":1,"text_ar":"شاعر يوناني","text_en":"A Greek poet","text_i18n":{"fr":"Un poète grec","es":"Un poeta griego","ro":"Un poet grec"}},{"index":2,"text_ar":"رحّالة إيطالي","text_en":"An Italian explorer","text_i18n":{"fr":"Un explorateur italien","es":"Un explorador italiano","ro":"Un explorator italian"}},{"index":3,"text_ar":"ماركة صنادل","text_en":"A brand of sandals","text_i18n":{"fr":"Une marque de sandales","es":"Una marca de sandalias","ro":"O marcă de sandale"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 3;

update public.questions set
  text_i18n = '{"fr": "Qui a trouvé le tombeau de Toutânkhamon en 1922 ?", "es": "¿Quién encontró la tumba de Tutankamón en 1922?", "ro": "Cine a găsit mormântul lui Tutankhamon în 1922?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"هوارد كارتر","text_en":"Howard Carter","text_i18n":{"fr":"Howard Carter","es":"Howard Carter","ro":"Howard Carter"}},{"index":1,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":2,"text_ar":"ماركو بولو","text_en":"Marco Polo","text_i18n":{"fr":"Marco Polo","es":"Marco Polo","ro":"Marco Polo"}},{"index":3,"text_ar":"لسه محدش لقاها","text_en":"Nobody. It is still missing","text_i18n":{"fr":"Personne, il manque toujours","es":"Nadie, sigue perdida","ro":"Nimeni, încă lipsește"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 4;

update public.questions set
  text_i18n = '{"fr": "Cléopâtre fut la dernière quoi ?", "es": "¿Cleopatra fue la última qué?", "ro": "Cleopatra a fost ultima ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حاكمة لمصر القديمة","text_en":"Ruler of ancient Egypt","text_i18n":{"fr":"Souveraine de l''Égypte antique","es":"Gobernante del antiguo Egipto","ro":"Conducătoare a Egiptului antic"}},{"index":1,"text_ar":"إمبراطورة رومانية","text_en":"Roman empress","text_i18n":{"fr":"Impératrice romaine","es":"Emperatriz romana","ro":"Împărăteasă romană"}},{"index":2,"text_ar":"ملكة إسبانيا","text_en":"Queen of Spain","text_i18n":{"fr":"Reine d''Espagne","es":"Reina de España","ro":"Regină a Spaniei"}},{"index":3,"text_ar":"واحدة ترد على الرسايل","text_en":"Person to answer her messages","text_i18n":{"fr":"Personne à répondre à ses messages","es":"Persona en responder sus mensajes","ro":"Persoană care să-și citească mesajele"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 5;

update public.questions set
  text_i18n = '{"fr": "Le Sphinx a le corps de quel animal ?", "es": "¿El cuerpo de la Esfinge es de qué animal?", "ro": "Sfinxul are corpul cărui animal?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أسد","text_en":"A lion","text_i18n":{"fr":"Un lion","es":"Un león","ro":"Un leu"}},{"index":1,"text_ar":"حصان","text_en":"A horse","text_i18n":{"fr":"Un cheval","es":"Un caballo","ro":"Un cal"}},{"index":2,"text_ar":"سمكة","text_en":"A fish","text_i18n":{"fr":"Un poisson","es":"Un pez","ro":"Un pește"}},{"index":3,"text_ar":"بطريق","text_en":"A penguin","text_i18n":{"fr":"Un pingouin","es":"Un pingüino","ro":"Un pinguin"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 6;

update public.questions set
  text_i18n = '{"fr": "Que sont les hiéroglyphes ?", "es": "¿Qué son los jeroglíficos?", "ro": "Ce sunt hieroglifele?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"كتابة مصرية قديمة","text_en":"Ancient Egyptian writing","text_i18n":{"fr":"L''écriture de l''Égypte antique","es":"La escritura del antiguo Egipto","ro":"Scrierea Egiptului antic"}},{"index":1,"text_ar":"نوع مكرونة","text_en":"A kind of pasta","text_i18n":{"fr":"Une sorte de pâtes","es":"Un tipo de pasta","ro":"Un fel de paste"}},{"index":2,"text_ar":"رقصة","text_en":"A dance","text_i18n":{"fr":"Une danse","es":"Un baile","ro":"Un dans"}},{"index":3,"text_ar":"آلة موسيقية","text_en":"A musical instrument","text_i18n":{"fr":"Un instrument de musique","es":"Un instrumento musical","ro":"Un instrument muzical"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 7;

update public.questions set
  text_i18n = '{"fr": "À quoi la pierre de Rosette a-t-elle servi ?", "es": "¿Para qué sirvió la piedra de Rosetta?", "ro": "La ce a ajutat Piatra din Rosetta?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"يقروا الهيروغليفية","text_en":"Read hieroglyphs","text_i18n":{"fr":"À lire les hiéroglyphes","es":"A leer los jeroglíficos","ro":"La citirea hieroglifelor"}},{"index":1,"text_ar":"يبنوا الأهرامات","text_en":"Build the pyramids","text_i18n":{"fr":"À bâtir les pyramides","es":"A construir las pirámides","ro":"La construirea piramidelor"}},{"index":2,"text_ar":"يلاقوا منبع النيل","text_en":"Find the source of the Nile","text_i18n":{"fr":"À trouver la source du Nil","es":"A hallar la fuente del Nilo","ro":"La găsirea izvorului Nilului"}},{"index":3,"text_ar":"يحلوا خلاف على ماتش","text_en":"Settle an argument about a football match","text_i18n":{"fr":"À trancher une dispute sur un match","es":"A zanjar una discusión sobre un partido","ro":"La încheierea unei certe despre un meci"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 8;

update public.questions set
  text_i18n = '{"fr": "Le canal de Suez relie quoi à quoi ?", "es": "¿El canal de Suez conecta qué con qué?", "ro": "Canalul Suez leagă ce de ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البحر المتوسط والبحر الأحمر","text_en":"The Mediterranean and the Red Sea","text_i18n":{"fr":"La Méditerranée et la mer Rouge","es":"El Mediterráneo y el mar Rojo","ro":"Marea Mediterană și Marea Roșie"}},{"index":1,"text_ar":"الأطلنطي والهادي","text_en":"The Atlantic and the Pacific","text_i18n":{"fr":"L''Atlantique et le Pacifique","es":"El Atlántico y el Pacífico","ro":"Atlanticul și Pacificul"}},{"index":2,"text_ar":"بحيرتين","text_en":"Two lakes","text_i18n":{"fr":"Deux lacs","es":"Dos lagos","ro":"Două lacuri"}},{"index":3,"text_ar":"مفيش، دي للزينة","text_en":"Nothing. It is decorative","text_i18n":{"fr":"Rien, c''est décoratif","es":"Nada, es decorativo","ro":"Nimic, e decorativ"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 9;

update public.questions set
  text_i18n = '{"fr": "Charm el-Cheikh est connue pour quoi ?", "es": "¿Por qué es famosa Sharm el-Sheij?", "ro": "Pentru ce e cunoscut Sharm El-Sheikh?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الغطس في البحر الأحمر","text_en":"Diving in the Red Sea","text_i18n":{"fr":"La plongée en mer Rouge","es":"El buceo en el mar Rojo","ro":"Scufundările în Marea Roșie"}},{"index":1,"text_ar":"التزلج على الجليد","text_en":"Skiing","text_i18n":{"fr":"Le ski","es":"El esquí","ro":"Schi"}},{"index":2,"text_ar":"غاباتها المطيرة","text_en":"Its rainforests","text_i18n":{"fr":"Ses forêts tropicales","es":"Sus selvas tropicales","ro":"Pădurile ei tropicale"}},{"index":3,"text_ar":"الشفق القطبي","text_en":"The northern lights","text_i18n":{"fr":"Les aurores boréales","es":"Las auroras boreales","ro":"Aurora boreală"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 10;

update public.questions set
  text_i18n = '{"fr": "Qui a fondé Alexandrie ?", "es": "¿Quién fundó Alejandría?", "ro": "Cine a fondat Alexandria?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great","text_i18n":{"fr":"Alexandre le Grand","es":"Alejandro Magno","ro":"Alexandru cel Mare"}},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar","text_i18n":{"fr":"Jules César","es":"Julio César","ro":"Iulius Cezar"}},{"index":2,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously","text_i18n":{"fr":"Un type qui s''appelait Alex, évidemment","es":"Un tal Alex, claro","ro":"Un tip pe nume Alex, evident"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 11;

update public.questions set
  text_i18n = '{"fr": "Le phare d''Alexandrie était l''une de quoi ?", "es": "¿El faro de Alejandría era una de qué?", "ro": "Farul din Alexandria era una dintre ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"عجائب الدنيا السبع القديمة","text_en":"The Seven Wonders of the Ancient World","text_i18n":{"fr":"Les sept merveilles du monde antique","es":"Las siete maravillas del mundo antiguo","ro":"Cele șapte minuni ale lumii antice"}},{"index":1,"text_ar":"جبال الألب","text_en":"The Alps","text_i18n":{"fr":"Les Alpes","es":"Los Alpes","ro":"Alpii"}},{"index":2,"text_ar":"الأهرامات","text_en":"The pyramids","text_i18n":{"fr":"Les pyramides","es":"Las pirámides","ro":"Piramidele"}},{"index":3,"text_ar":"سلسلة فنادق","text_en":"A chain of hotels","text_i18n":{"fr":"Une chaîne d''hôtels","es":"Una cadena de hoteles","ro":"Un lanț de hoteluri"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 12;

update public.questions set
  text_i18n = '{"fr": "Mohamed Salah joue pour quelle sélection ?", "es": "¿Mohamed Salah juega en qué selección?", "ro": "Mohamed Salah joacă la ce națională?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"مصر","text_en":"Egypt","text_i18n":{"fr":"L''Égypte","es":"Egipto","ro":"Egipt"}},{"index":1,"text_ar":"البرازيل","text_en":"Brazil","text_i18n":{"fr":"Le Brésil","es":"Brasil","ro":"Brazilia"}},{"index":2,"text_ar":"البرتغال","text_en":"Portugal","text_i18n":{"fr":"Le Portugal","es":"Portugal","ro":"Portugalia"}},{"index":3,"text_ar":"كل بلد على حسب اليوم","text_en":"A different one each week","text_i18n":{"fr":"Une différente chaque semaine","es":"Una distinta cada semana","ro":"Alta în fiecare săptămână"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 13;

update public.questions set
  text_i18n = '{"fr": "Que contient le koshari, le plat national ?", "es": "¿Qué lleva el koshari, el plato nacional?", "ro": "Ce conține koshari, felul național?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رز وعدس ومكرونة","text_en":"Rice, lentils and pasta","text_i18n":{"fr":"Du riz, des lentilles et des pâtes","es":"Arroz, lentejas y pasta","ro":"Orez, linte și paste"}},{"index":1,"text_ar":"سوشي وصويا","text_en":"Sushi and soy sauce","text_i18n":{"fr":"Des sushis et de la sauce soja","es":"Sushi y salsa de soja","ro":"Sushi și sos de soia"}},{"index":2,"text_ar":"جبنة وريحان","text_en":"Cheese and basil","text_i18n":{"fr":"Du fromage et du basilic","es":"Queso y albahaca","ro":"Brânză și busuioc"}},{"index":3,"text_ar":"أي حاجة لقيتها في المطبخ","text_en":"Whatever was in the kitchen","text_i18n":{"fr":"Ce qui traînait dans la cuisine","es":"Lo que hubiera en la cocina","ro":"Ce era prin bucătărie"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 14;

update public.questions set
  text_i18n = '{"fr": "À quoi servait le papyrus ?", "es": "¿Para qué se usaba el papiro?", "ro": "La ce se folosea papirusul?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"ورق للكتابة","text_en":"Paper to write on","text_i18n":{"fr":"À faire du papier pour écrire","es":"Para hacer papel de escribir","ro":"La făcut hârtie de scris"}},{"index":1,"text_ar":"زجاج","text_en":"Glass","text_i18n":{"fr":"Du verre","es":"Vidrio","ro":"Sticlă"}},{"index":2,"text_ar":"حديد","text_en":"Iron","text_i18n":{"fr":"Du fer","es":"Hierro","ro":"Fier"}},{"index":3,"text_ar":"مطر","text_en":"Rain","text_i18n":{"fr":"De la pluie","es":"Lluvia","ro":"Ploaie"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 15;

update public.questions set
  text_i18n = '{"fr": "La plus grande partie de l''Égypte, c''est quoi ?", "es": "¿La mayor parte de Egipto es qué?", "ro": "Cea mai mare parte a Egiptului este ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"صحرا","text_en":"Desert","text_i18n":{"fr":"Du désert","es":"Desierto","ro":"Deșert"}},{"index":1,"text_ar":"غابات","text_en":"Forest","text_i18n":{"fr":"De la forêt","es":"Bosque","ro":"Pădure"}},{"index":2,"text_ar":"جليد","text_en":"Ice","text_i18n":{"fr":"De la glace","es":"Hielo","ro":"Gheață"}},{"index":3,"text_ar":"مدن ملاهي مائية","text_en":"Water parks","text_i18n":{"fr":"Des parcs aquatiques","es":"Parques acuáticos","ro":"Parcuri acvatice"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 16;

update public.questions set
  text_i18n = '{"fr": "Qu''a créé le haut barrage d''Assouan ?", "es": "¿Qué creó la presa de Asuán?", "ro": "Ce a creat Barajul Aswan?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"بحيرة ناصر","text_en":"Lake Nasser","text_i18n":{"fr":"Le lac Nasser","es":"El lago Nasser","ro":"Lacul Nasser"}},{"index":1,"text_ar":"نهر النيل","text_en":"The river Nile","text_i18n":{"fr":"Le Nil","es":"El río Nilo","ro":"Râul Nil"}},{"index":2,"text_ar":"البحر الأحمر","text_en":"The Red Sea","text_i18n":{"fr":"La mer Rouge","es":"El mar Rojo","ro":"Marea Roșie"}},{"index":3,"text_ar":"زحمة لسه مخلصتش","text_en":"A traffic jam that never ended","text_i18n":{"fr":"Un embouteillage sans fin","es":"Un atasco que no terminó nunca","ro":"Un ambuteiaj care nu s-a mai terminat"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 17;

update public.questions set
  text_i18n = '{"fr": "Les temples d''Abou Simbel ont été bâtis pour qui ?", "es": "¿Para quién se construyeron los templos de Abu Simbel?", "ro": "Pentru cine au fost construite templele de la Abu Simbel?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رمسيس التاني","text_en":"Ramses II","text_i18n":{"fr":"Ramsès II","es":"Ramsés II","ro":"Ramses al II-lea"}},{"index":1,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":2,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great","text_i18n":{"fr":"Alexandre le Grand","es":"Alejandro Magno","ro":"Alexandru cel Mare"}},{"index":3,"text_ar":"أول واحد طلب","text_en":"Whoever asked first","text_i18n":{"fr":"Le premier qui a demandé","es":"El primero que lo pidió","ro":"Primul care a cerut"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 18;

update public.questions set
  text_i18n = '{"fr": "Comment s''appelle la monnaie égyptienne ?", "es": "¿Cómo se llama la moneda de Egipto?", "ro": "Cum se numește moneda Egiptului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الجنيه المصري","text_en":"The Egyptian pound","text_i18n":{"fr":"La livre égyptienne","es":"La libra egipcia","ro":"Lira egipteană"}},{"index":1,"text_ar":"اليورو","text_en":"The euro","text_i18n":{"fr":"L''euro","es":"El euro","ro":"Euro"}},{"index":2,"text_ar":"الين","text_en":"The yen","text_i18n":{"fr":"Le yen","es":"El yen","ro":"Yenul"}},{"index":3,"text_ar":"جمال، بالكيلو","text_en":"Camels, by weight","text_i18n":{"fr":"Des chameaux, au kilo","es":"Camellos, al peso","ro":"Cămile, la kilogram"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 19;

update public.questions set
  text_i18n = '{"fr": "La grande pyramide de Gizeh a été bâtie pour qui ?", "es": "¿Para quién se construyó la Gran Pirámide de Guiza?", "ro": "Pentru cine a fost construită Marea Piramidă din Giza?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"خوفو","text_en":"Khufu","text_i18n":{"fr":"Khéops","es":"Keops","ro":"Keops"}},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra","text_i18n":{"fr":"Cléopâtre","es":"Cleopatra","ro":"Cleopatra"}},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client","text_i18n":{"fr":"Un client très exigeant","es":"Un cliente muy exigente","ro":"Un client foarte pretențios"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 20;

update public.questions set
  text_i18n = '{"fr": "Quelle est la langue officielle de l''Égypte ?", "es": "¿Cuál es el idioma oficial de Egipto?", "ro": "Care e limba oficială a Egiptului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"العربية","text_en":"Arabic","text_i18n":{"fr":"L''arabe","es":"El árabe","ro":"Araba"}},{"index":1,"text_ar":"اللاتينية","text_en":"Latin","text_i18n":{"fr":"Le latin","es":"El latín","ro":"Latina"}},{"index":2,"text_ar":"الهيروغليفية، لسه","text_en":"Hieroglyphs, still","text_i18n":{"fr":"Les hiéroglyphes, encore","es":"Los jeroglíficos, todavía","ro":"Hieroglifele, încă"}},{"index":3,"text_ar":"الإيموچي","text_en":"Emoji","text_i18n":{"fr":"Les emojis","es":"Los emojis","ro":"Emoji"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;

-- ── THE ANSWER-FREE VIEW CARRIES THE NEW LANGUAGES ─────────────────
-- Dropped and rebuilt rather than replaced: "create or replace view"
-- cannot add a column in the middle, and text_i18n belongs next to the
-- other two texts. Nothing in SQL depends on this view; the app reads
-- it by name.
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, text_en, text_i18n,
         media_url, media_type, timer_ms, options, points_style
    from public.questions;
grant select on public.lamma_questions_public to anon, authenticated;

-- ── WHAT THE ROOM IS, TOLD PROPERLY ────────────────────────────────
-- sync() described the game but never said who was running it, so the
-- screen fell back to whatever it believed when it opened: a phone
-- that joined and was later promoted still showed no Start button, and
-- every other phone quietly asked to take the room over every ten
-- seconds because the host it was looking for was not in the list.
-- (The server refused each time, so nothing broke. It was still wrong.)
--
-- It now also says which pack is being played and which country that
-- pack belongs to, so the end of a game can say something true about
-- the country instead of guessing from a title.
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
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ── RIGHT ANSWERS, NOT POINTS ──────────────────────────────────────
-- Only for people who were in the room, and only about that room.
create or replace function public.lamma_room_results(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  total int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  select count(*) into total from public.questions where pack_id = r.pack_id;

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'country', (select country from public.game_packs where id = r.pack_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id, 'nickname', p.nickname, 'score', p.score,
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.lamma_room_results(uuid) to authenticated;

-- ── AND THE SHELF SAYS SO ──────────────────────────────────────────
-- A picker nobody knows about is a picker nobody uses. The pack card
-- in the hub now carries the flags of the languages the pack is really
-- written in, so the choice is visible before anybody starts a room.
--
-- Only packs that make the claim carry it. Everything else stays null
-- and shows nothing, because "we have not said" is honest and "written
-- in Arabic and English" would be a guess about sixty questions
-- somebody else wrote.
alter table public.game_packs add column if not exists languages text[];

update public.game_packs
   set languages = array['ar','en','fr','es','ro']
 where id = 'eeee5555-0000-4000-8000-000000000001';

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · YOUR OWN FACE ON THE SCOREBOARD
--
--  A letter in a circle is not a player. Everybody in a room together
--  already knows what everybody else looks like, and the half second
--  after a question is funnier when the board is faces.
--
--  So a player can put ONE photo on their seat in a room — taken in
--  the app, with a nemes headcloth or Nefertiti's crown drawn on it
--  (see src/components/lamma/PharaohCam.js).
--
--  ── WHERE IT LIVES AND WHY ───────────────────────────────────────
--  On the seat, not on the profile. It belongs to that room and that
--  night: it goes to the people playing, and it is deleted with the
--  room. Nobody's profile picture changes because they put a crown on
--  for one game.
--
--  ── WHAT THE SERVER WILL ACCEPT ──────────────────────────────────
--  A small JPEG data URL, from somebody who is actually in the room,
--  about themselves. Anything else is refused here rather than
--  trusted from the phone:
--
--    · you must be in the room            (lamma_in_room)
--    · you may only write your own seat   (user_id = auth.uid())
--    · it must be a jpeg data URL         (no svg, no html, no link)
--    · it must be small                   (26 KB of text, about 8 KB
--                                          of picture)
--
--  The size limit is not tidiness. Every phone in the room reads the
--  player list on every refresh, so a photograph on a seat is a
--  photograph downloaded again and again by everybody.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.lamma_set_face(p_room_id uuid, p_face text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  if p_face is not null then
    if length(p_face) > 26000 then
      return jsonb_build_object('ok', false, 'reason', 'too_big');
    end if;
    if p_face not like 'data:image/jpeg;base64,%' then
      return jsonb_build_object('ok', false, 'reason', 'not_a_photo');
    end if;
  end if;

  update public.room_players
     set avatar_key = p_face
   where room_id = p_room_id and user_id = me;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.lamma_set_face(uuid, text) to authenticated;

-- ── AND THE ROOM HANDS THE FACES ROUND ─────────────────────────────
-- sync() is what every phone reads to know who is in the room and
-- where they stand, so that is where a face has to appear. Without
-- this the photo would exist and nobody would ever see it.
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
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected,
                                          'avatar_key', avatar_key)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- The end-of-game table carries them too, so the podium is faces.
create or replace function public.lamma_room_results(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  total int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  select count(*) into total from public.questions where pack_id = r.pack_id;

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'country', (select country from public.game_packs where id = r.pack_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id, 'nickname', p.nickname, 'score', p.score,
               'avatar_key', p.avatar_key,
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · MORE EGYPT: WHERE IT HAS BEEN, WHERE IT IS, AND WHAT IT SAYS
--
--  Twenty-one more questions in the one portal, in the five languages
--  the pack is written in. Three kinds, and each is there for a reason:
--
--  HISTORY, the parts of it the rest of the world already half knows —
--  Cleopatra and Rome, the Suez Canal, the library at Alexandria, 1952.
--  A question only somebody from Cairo could answer is not a quiz for a
--  mixed room, it is a wall.
--
--  GEOGRAPHY, which is the fastest way for somebody who has never been
--  to end the night knowing where Egypt actually is: which seas, which
--  neighbours, why nearly everybody lives along one river.
--
--  AND THE PROVERBS, which are the reason this is Egyptian and not a
--  textbook. They are translated LITERALLY on purpose — "a monkey is a
--  gazelle in his mother's eyes" lands in French and Romanian exactly
--  the way it lands in Arabic, because the picture inside it is the
--  joke. The question is what it MEANS, so an Egyptian answers from
--  having heard it all their life and everybody else answers by working
--  it out, and both of those are a good moment at a table.
--
--  Nobody is the butt of any of them. They are about mothers, patience,
--  hunger and staying out of other people's marriages.
--
--  The pack is 43 questions now. Written the same two-step way as the
--  first 22 — Arabic and English in the insert, the other three in
--  text_i18n — so the language check reads all of them alike.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index >= 22;

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',22,'الأهرامات في الجيزة عمرها حوالي قد إيه؟','Roughly how old are the pyramids of Giza?',20000,
 '[{"index":0,"text_ar":"حوالي ٤٥٠٠ سنة","text_en":"About 4,500 years"},{"index":1,"text_ar":"حوالي ٥٠٠ سنة","text_en":"About 500 years"},{"index":2,"text_ar":"اتبنت في العصر الروماني","text_en":"They were built in Roman times"},{"index":3,"text_ar":"اتبنت في القرن التسعتاشر","text_en":"They were built in the 1800s"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',23,'بعد كليوباترا، مصر بقت جزء من أنهي إمبراطورية؟','After Cleopatra, Egypt became part of which empire?',20000,
 '[{"index":0,"text_ar":"الإمبراطورية الرومانية","text_en":"The Roman Empire"},{"index":1,"text_ar":"الإمبراطورية الفارسية","text_en":"The Persian Empire"},{"index":2,"text_ar":"الإمبراطورية الإسبانية","text_en":"The Spanish Empire"},{"index":3,"text_ar":"مبقتش جزء من حاجة","text_en":"None — it stayed on its own"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',24,'قناة السويس اتفتحت في أنهي قرن؟','In which century did the Suez Canal open?',20000,
 '[{"index":0,"text_ar":"القرن التسعتاشر","text_en":"The 19th century"},{"index":1,"text_ar":"القرن الخمستاشر","text_en":"The 15th century"},{"index":2,"text_ar":"القرن العشرين","text_en":"The 20th century"},{"index":3,"text_ar":"القرن الواحد والعشرين","text_en":"The 21st century"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',25,'مصر بقت جمهورية بعد ثورة سنة كام؟','Egypt became a republic after the revolution of which year?',20000,
 '[{"index":0,"text_ar":"١٩٥٢","text_en":"1952"},{"index":1,"text_ar":"١٧٨٩","text_en":"1789"},{"index":2,"text_ar":"١٨٤٨","text_en":"1848"},{"index":3,"text_ar":"١٩٩١","text_en":"1991"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',26,'مين كان رئيس مصر وقت بناء السد العالي؟','Who was Egypt’s president when the Aswan High Dam was built?',20000,
 '[{"index":0,"text_ar":"جمال عبد الناصر","text_en":"Gamal Abdel Nasser"},{"index":1,"text_ar":"أنور السادات","text_en":"Anwar Sadat"},{"index":2,"text_ar":"محمد علي","text_en":"Muhammad Ali Pasha"},{"index":3,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',27,'أشهر مكتبة في العالم القديم كانت في أنهي مدينة؟','The most famous library of the ancient world was in which city?',20000,
 '[{"index":0,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":1,"text_ar":"روما","text_en":"Rome"},{"index":2,"text_ar":"أثينا","text_en":"Athens"},{"index":3,"text_ar":"باريس","text_en":"Paris"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',28,'في التحنيط، الأعضاء كانت بتتحط في إيه؟','In mummification, the organs were kept in what?',20000,
 '[{"index":0,"text_ar":"أواني كانوبية","text_en":"Canopic jars"},{"index":1,"text_ar":"في التابوت مع الجسم","text_en":"In the coffin with the body"},{"index":2,"text_ar":"في النيل","text_en":"In the Nile"},{"index":3,"text_ar":"في صندوق تحت السرير","text_en":"In a box under the bed"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',29,'أنهي بحر شمال مصر؟','Which sea is to the north of Egypt?',20000,
 '[{"index":0,"text_ar":"البحر المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"بحر البلطيق","text_en":"The Baltic"},{"index":2,"text_ar":"البحر الأسود","text_en":"The Black Sea"},{"index":3,"text_ar":"بحر الشمال","text_en":"The North Sea"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',30,'أنهي بحر شرق مصر؟','Which sea is to the east of Egypt?',20000,
 '[{"index":0,"text_ar":"البحر الأحمر","text_en":"The Red Sea"},{"index":1,"text_ar":"البحر الكاريبي","text_en":"The Caribbean"},{"index":2,"text_ar":"بحر قزوين","text_en":"The Caspian"},{"index":3,"text_ar":"البحر الأدرياتيكي","text_en":"The Adriatic"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',31,'سينا عبارة عن إيه؟','Sinai is what?',20000,
 '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula"},{"index":1,"text_ar":"جزيرة","text_en":"An island"},{"index":2,"text_ar":"بحيرة","text_en":"A lake"},{"index":3,"text_ar":"مدينة","text_en":"A city"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',32,'أنهي بلد غرب مصر؟','Which country borders Egypt to the west?',20000,
 '[{"index":0,"text_ar":"ليبيا","text_en":"Libya"},{"index":1,"text_ar":"المغرب","text_en":"Morocco"},{"index":2,"text_ar":"الجزائر","text_en":"Algeria"},{"index":3,"text_ar":"تونس","text_en":"Tunisia"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',33,'أنهي بلد جنوب مصر؟','Which country borders Egypt to the south?',20000,
 '[{"index":0,"text_ar":"السودان","text_en":"Sudan"},{"index":1,"text_ar":"إثيوبيا","text_en":"Ethiopia"},{"index":2,"text_ar":"كينيا","text_en":"Kenya"},{"index":3,"text_ar":"تشاد","text_en":"Chad"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',34,'النيل قبل ما يصب في البحر بيعمل إيه؟','Before it reaches the sea, the Nile spreads into what?',20000,
 '[{"index":0,"text_ar":"دلتا","text_en":"A delta"},{"index":1,"text_ar":"شلال","text_en":"A waterfall"},{"index":2,"text_ar":"نفق","text_en":"A tunnel"},{"index":3,"text_ar":"بحيرة جليدية","text_en":"A glacier lake"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',35,'أغلب المصريين ساكنين جنب إيه؟','Most Egyptians live close to what?',20000,
 '[{"index":0,"text_ar":"النيل","text_en":"The Nile"},{"index":1,"text_ar":"الحدود الغربية","text_en":"The western border"},{"index":2,"text_ar":"جبال سينا","text_en":"The Sinai mountains"},{"index":3,"text_ar":"الواحات في الصحرا","text_en":"The desert oases"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',36,'«القرد في عين أمه غزال» — المثل ده معناه إيه؟','“A monkey is a gazelle in his mother’s eyes” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful"},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests"},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging"},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',37,'«اللي فات مات» — معناه إيه؟','“What has passed is dead” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on"},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter"},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead"},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',38,'«إيد واحدة ما تسقفش» — معناه إيه؟','“One hand does not clap” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"محدش بيعمل حاجة لوحده","text_en":"Nothing gets done alone"},{"index":1,"text_ar":"التصفيق مش مهذب","text_en":"Clapping is rude"},{"index":2,"text_ar":"استخدم إيدك الشمال","text_en":"Use your left hand"},{"index":3,"text_ar":"الموسيقى محتاجة ناس","text_en":"Music needs an audience"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',39,'«الصبر مفتاح الفرج» — معناه إيه؟','“Patience is the key to relief” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"استنى وهتتحل","text_en":"Wait, and things work out"},{"index":1,"text_ar":"خد نسخة من المفتاح","text_en":"Keep a spare key"},{"index":2,"text_ar":"اقفل الباب ورا نفسك","text_en":"Lock the door behind you"},{"index":3,"text_ar":"الاستعجال بيوفر وقت","text_en":"Hurrying saves time"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',40,'«الجعان يحلم بسوق العيش» — معناه إيه؟','“A hungry man dreams of the bread market” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"اللي ناقصك هو اللي بتفكر فيه","text_en":"You think about whatever you are short of"},{"index":1,"text_ar":"الأسواق بتفتح بدري","text_en":"Markets open early"},{"index":2,"text_ar":"العيش أحسن أكل","text_en":"Bread is the best food"},{"index":3,"text_ar":"الأحلام بتتحقق","text_en":"Dreams come true"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',41,'«الباب اللي يجيلك منه الريح سده واستريح» — معناه إيه؟','“Block the door the wind comes from, and rest” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble"},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night"},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing"},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',42,'«امشي في جنازة ولا تمشي في جوازة» — معناه إيه؟','“Walk in a funeral rather than arrange a marriage” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"ما تتدخلش في جواز حد، هتتلام","text_en":"Do not get involved in matchmaking — you will get the blame"},{"index":1,"text_ar":"الجنازات أرخص","text_en":"Funerals are cheaper"},{"index":2,"text_ar":"الجواز مش مهم","text_en":"Marriage does not matter"},{"index":3,"text_ar":"امشي كتير عشان صحتك","text_en":"Walking is good for your health"}]',0,'double');

update public.questions set
  text_i18n = '{"fr": "Les pyramides de Gizeh ont à peu près quel âge ?", "es": "¿Qué edad tienen más o menos las pirámides de Guiza?", "ro": "Cam ce vechime au piramidele din Giza?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي ٤٥٠٠ سنة","text_en":"About 4,500 years","text_i18n":{"fr":"Environ 4 500 ans","es":"Unos 4.500 años","ro":"Cam 4.500 de ani"}},{"index":1,"text_ar":"حوالي ٥٠٠ سنة","text_en":"About 500 years","text_i18n":{"fr":"Environ 500 ans","es":"Unos 500 años","ro":"Cam 500 de ani"}},{"index":2,"text_ar":"اتبنت في العصر الروماني","text_en":"They were built in Roman times","text_i18n":{"fr":"Elles datent de l’époque romaine","es":"Se construyeron en época romana","ro":"Au fost construite în epoca romană"}},{"index":3,"text_ar":"اتبنت في القرن التسعتاشر","text_en":"They were built in the 1800s","text_i18n":{"fr":"Elles datent du XIXᵉ siècle","es":"Se construyeron en el siglo XIX","ro":"Au fost construite în secolul al XIX-lea"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 22;

update public.questions set
  text_i18n = '{"fr": "Après Cléopâtre, l’Égypte est devenue partie de quel empire ?", "es": "Tras Cleopatra, Egipto pasó a formar parte de qué imperio?", "ro": "După Cleopatra, Egiptul a intrat în ce imperiu?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإمبراطورية الرومانية","text_en":"The Roman Empire","text_i18n":{"fr":"L’Empire romain","es":"El Imperio romano","ro":"Imperiul Roman"}},{"index":1,"text_ar":"الإمبراطورية الفارسية","text_en":"The Persian Empire","text_i18n":{"fr":"L’Empire perse","es":"El Imperio persa","ro":"Imperiul Persan"}},{"index":2,"text_ar":"الإمبراطورية الإسبانية","text_en":"The Spanish Empire","text_i18n":{"fr":"L’Empire espagnol","es":"El Imperio español","ro":"Imperiul Spaniol"}},{"index":3,"text_ar":"مبقتش جزء من حاجة","text_en":"None — it stayed on its own","text_i18n":{"fr":"Aucun, elle est restée seule","es":"Ninguno, siguió por su cuenta","ro":"Niciunul, a rămas de capul ei"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 23;

update public.questions set
  text_i18n = '{"fr": "Le canal de Suez a été ouvert à quel siècle ?", "es": "¿En qué siglo se abrió el canal de Suez?", "ro": "În ce secol a fost deschis Canalul Suez?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"القرن التسعتاشر","text_en":"The 19th century","text_i18n":{"fr":"Le XIXᵉ siècle","es":"El siglo XIX","ro":"Secolul al XIX-lea"}},{"index":1,"text_ar":"القرن الخمستاشر","text_en":"The 15th century","text_i18n":{"fr":"Le XVᵉ siècle","es":"El siglo XV","ro":"Secolul al XV-lea"}},{"index":2,"text_ar":"القرن العشرين","text_en":"The 20th century","text_i18n":{"fr":"Le XXᵉ siècle","es":"El siglo XX","ro":"Secolul al XX-lea"}},{"index":3,"text_ar":"القرن الواحد والعشرين","text_en":"The 21st century","text_i18n":{"fr":"Le XXIᵉ siècle","es":"El siglo XXI","ro":"Secolul al XXI-lea"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;

update public.questions set
  text_i18n = '{"fr": "L’Égypte est devenue une république après la révolution de quelle année ?", "es": "Egipto se hizo república tras la revolución de qué año?", "ro": "Egiptul a devenit republică după revoluția din ce an?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"١٩٥٢","text_en":"1952","text_i18n":{"fr":"1952","es":"1952","ro":"1952"}},{"index":1,"text_ar":"١٧٨٩","text_en":"1789","text_i18n":{"fr":"1789","es":"1789","ro":"1789"}},{"index":2,"text_ar":"١٨٤٨","text_en":"1848","text_i18n":{"fr":"1848","es":"1848","ro":"1848"}},{"index":3,"text_ar":"١٩٩١","text_en":"1991","text_i18n":{"fr":"1991","es":"1991","ro":"1991"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 25;

update public.questions set
  text_i18n = '{"fr": "Qui était président de l’Égypte quand le haut barrage d’Assouan a été construit ?", "es": "¿Quién era presidente de Egipto cuando se construyó la presa de Asuán?", "ro": "Cine era președintele Egiptului când s-a construit Barajul Aswan?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"جمال عبد الناصر","text_en":"Gamal Abdel Nasser","text_i18n":{"fr":"Gamal Abdel Nasser","es":"Gamal Abdel Nasser","ro":"Gamal Abdel Nasser"}},{"index":1,"text_ar":"أنور السادات","text_en":"Anwar Sadat","text_i18n":{"fr":"Anouar el-Sadate","es":"Anwar el-Sadat","ro":"Anwar Sadat"}},{"index":2,"text_ar":"محمد علي","text_en":"Muhammad Ali Pasha","text_i18n":{"fr":"Méhémet Ali","es":"Mehmet Alí","ro":"Mehmet Ali"}},{"index":3,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 26;

update public.questions set
  text_i18n = '{"fr": "La plus célèbre bibliothèque de l’Antiquité était dans quelle ville ?", "es": "¿En qué ciudad estaba la biblioteca más famosa del mundo antiguo?", "ro": "Cea mai faimoasă bibliotecă a lumii antice era în ce oraș?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":1,"text_ar":"روما","text_en":"Rome","text_i18n":{"fr":"Rome","es":"Roma","ro":"Roma"}},{"index":2,"text_ar":"أثينا","text_en":"Athens","text_i18n":{"fr":"Athènes","es":"Atenas","ro":"Atena"}},{"index":3,"text_ar":"باريس","text_en":"Paris","text_i18n":{"fr":"Paris","es":"París","ro":"Paris"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 27;

update public.questions set
  text_i18n = '{"fr": "Lors de la momification, les organes étaient conservés dans quoi ?", "es": "En la momificación, ¿dónde se guardaban los órganos?", "ro": "La mumificare, organele erau păstrate în ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أواني كانوبية","text_en":"Canopic jars","text_i18n":{"fr":"Des vases canopes","es":"Vasos canopos","ro":"Vase canope"}},{"index":1,"text_ar":"في التابوت مع الجسم","text_en":"In the coffin with the body","text_i18n":{"fr":"Dans le cercueil avec le corps","es":"En el ataúd con el cuerpo","ro":"În sicriu, lângă corp"}},{"index":2,"text_ar":"في النيل","text_en":"In the Nile","text_i18n":{"fr":"Dans le Nil","es":"En el Nilo","ro":"În Nil"}},{"index":3,"text_ar":"في صندوق تحت السرير","text_en":"In a box under the bed","text_i18n":{"fr":"Dans une boîte sous le lit","es":"En una caja bajo la cama","ro":"Într-o cutie sub pat"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 28;

update public.questions set
  text_i18n = '{"fr": "Quelle mer se trouve au nord de l’Égypte ?", "es": "¿Qué mar está al norte de Egipto?", "ro": "Ce mare este la nord de Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البحر المتوسط","text_en":"The Mediterranean","text_i18n":{"fr":"La Méditerranée","es":"El Mediterráneo","ro":"Marea Mediterană"}},{"index":1,"text_ar":"بحر البلطيق","text_en":"The Baltic","text_i18n":{"fr":"La Baltique","es":"El Báltico","ro":"Marea Baltică"}},{"index":2,"text_ar":"البحر الأسود","text_en":"The Black Sea","text_i18n":{"fr":"La mer Noire","es":"El mar Negro","ro":"Marea Neagră"}},{"index":3,"text_ar":"بحر الشمال","text_en":"The North Sea","text_i18n":{"fr":"La mer du Nord","es":"El mar del Norte","ro":"Marea Nordului"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 29;

update public.questions set
  text_i18n = '{"fr": "Quelle mer se trouve à l’est de l’Égypte ?", "es": "¿Qué mar está al este de Egipto?", "ro": "Ce mare este la est de Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البحر الأحمر","text_en":"The Red Sea","text_i18n":{"fr":"La mer Rouge","es":"El mar Rojo","ro":"Marea Roșie"}},{"index":1,"text_ar":"البحر الكاريبي","text_en":"The Caribbean","text_i18n":{"fr":"La mer des Caraïbes","es":"El Caribe","ro":"Marea Caraibilor"}},{"index":2,"text_ar":"بحر قزوين","text_en":"The Caspian","text_i18n":{"fr":"La mer Caspienne","es":"El Caspio","ro":"Marea Caspică"}},{"index":3,"text_ar":"البحر الأدرياتيكي","text_en":"The Adriatic","text_i18n":{"fr":"L’Adriatique","es":"El Adriático","ro":"Marea Adriatică"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 30;

update public.questions set
  text_i18n = '{"fr": "Le Sinaï, c’est quoi ?", "es": "¿Qué es el Sinaí?", "ro": "Ce este Sinai?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula","text_i18n":{"fr":"Une péninsule","es":"Una península","ro":"O peninsulă"}},{"index":1,"text_ar":"جزيرة","text_en":"An island","text_i18n":{"fr":"Une île","es":"Una isla","ro":"O insulă"}},{"index":2,"text_ar":"بحيرة","text_en":"A lake","text_i18n":{"fr":"Un lac","es":"Un lago","ro":"Un lac"}},{"index":3,"text_ar":"مدينة","text_en":"A city","text_i18n":{"fr":"Une ville","es":"Una ciudad","ro":"Un oraș"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 31;

update public.questions set
  text_i18n = '{"fr": "Quel pays borde l’Égypte à l’ouest ?", "es": "¿Qué país limita con Egipto al oeste?", "ro": "Ce țară se învecinează cu Egiptul la vest?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"ليبيا","text_en":"Libya","text_i18n":{"fr":"La Libye","es":"Libia","ro":"Libia"}},{"index":1,"text_ar":"المغرب","text_en":"Morocco","text_i18n":{"fr":"Le Maroc","es":"Marruecos","ro":"Maroc"}},{"index":2,"text_ar":"الجزائر","text_en":"Algeria","text_i18n":{"fr":"L’Algérie","es":"Argelia","ro":"Algeria"}},{"index":3,"text_ar":"تونس","text_en":"Tunisia","text_i18n":{"fr":"La Tunisie","es":"Túnez","ro":"Tunisia"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 32;

update public.questions set
  text_i18n = '{"fr": "Quel pays borde l’Égypte au sud ?", "es": "¿Qué país limita con Egipto al sur?", "ro": "Ce țară se învecinează cu Egiptul la sud?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"السودان","text_en":"Sudan","text_i18n":{"fr":"Le Soudan","es":"Sudán","ro":"Sudan"}},{"index":1,"text_ar":"إثيوبيا","text_en":"Ethiopia","text_i18n":{"fr":"L’Éthiopie","es":"Etiopía","ro":"Etiopia"}},{"index":2,"text_ar":"كينيا","text_en":"Kenya","text_i18n":{"fr":"Le Kenya","es":"Kenia","ro":"Kenya"}},{"index":3,"text_ar":"تشاد","text_en":"Chad","text_i18n":{"fr":"Le Tchad","es":"Chad","ro":"Ciad"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 33;

update public.questions set
  text_i18n = '{"fr": "Avant d’atteindre la mer, le Nil forme quoi ?", "es": "Antes de llegar al mar, el Nilo forma qué?", "ro": "Înainte să ajungă la mare, Nilul formează ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"دلتا","text_en":"A delta","text_i18n":{"fr":"Un delta","es":"Un delta","ro":"O deltă"}},{"index":1,"text_ar":"شلال","text_en":"A waterfall","text_i18n":{"fr":"Une cascade","es":"Una cascada","ro":"O cascadă"}},{"index":2,"text_ar":"نفق","text_en":"A tunnel","text_i18n":{"fr":"Un tunnel","es":"Un túnel","ro":"Un tunel"}},{"index":3,"text_ar":"بحيرة جليدية","text_en":"A glacier lake","text_i18n":{"fr":"Un lac glaciaire","es":"Un lago glaciar","ro":"Un lac glaciar"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 34;

update public.questions set
  text_i18n = '{"fr": "La plupart des Égyptiens vivent près de quoi ?", "es": "¿Cerca de qué vive la mayoría de los egipcios?", "ro": "Cei mai mulți egipteni locuiesc aproape de ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"النيل","text_en":"The Nile","text_i18n":{"fr":"Le Nil","es":"El Nilo","ro":"Nil"}},{"index":1,"text_ar":"الحدود الغربية","text_en":"The western border","text_i18n":{"fr":"La frontière ouest","es":"La frontera occidental","ro":"Granița de vest"}},{"index":2,"text_ar":"جبال سينا","text_en":"The Sinai mountains","text_i18n":{"fr":"Les montagnes du Sinaï","es":"Las montañas del Sinaí","ro":"Munții Sinai"}},{"index":3,"text_ar":"الواحات في الصحرا","text_en":"The desert oases","text_i18n":{"fr":"Les oasis du désert","es":"Los oasis del desierto","ro":"Oazele din deșert"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 35;

update public.questions set
  text_i18n = '{"fr": "« Un singe est une gazelle aux yeux de sa mère » — que veut dire ce proverbe égyptien ?", "es": "“Un mono es una gacela a los ojos de su madre” — ¿qué significa este dicho egipcio?", "ro": "„O maimuță e o gazelă în ochii mamei ei” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful","text_i18n":{"fr":"Une mère trouve toujours son enfant beau","es":"Una madre siempre ve guapo a su hijo","ro":"O mamă își vede mereu copilul frumos"}},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests","text_i18n":{"fr":"Les singes vivent en forêt","es":"Los monos viven en el bosque","ro":"Maimuțele trăiesc în pădure"}},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging","text_i18n":{"fr":"Faites vérifier vos yeux avant de juger","es":"Hazte una revisión de la vista antes de juzgar","ro":"Verifică-ți vederea înainte să judeci"}},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey","text_i18n":{"fr":"La gazelle court plus vite que le singe","es":"La gacela es más rápida que el mono","ro":"Gazela e mai rapidă decât maimuța"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 36;

update public.questions set
  text_i18n = '{"fr": "« Ce qui est passé est mort » — que veut dire ce proverbe égyptien ?", "es": "“Lo que pasó, murió” — ¿qué significa este dicho egipcio?", "ro": "„Ce-a trecut a murit” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on","text_i18n":{"fr":"Laisse le passé et avance","es":"Deja atrás el pasado y sigue","ro":"Lasă trecutul și mergi mai departe"}},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter","text_i18n":{"fr":"L’histoire n’a pas d’importance","es":"La historia no importa","ro":"Istoria nu contează"}},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead","text_i18n":{"fr":"Ne parle jamais des morts","es":"No hables de los muertos","ro":"Nu vorbi despre cei morți"}},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly","text_i18n":{"fr":"Le temps passe vite","es":"El tiempo pasa rápido","ro":"Timpul trece repede"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 37;

update public.questions set
  text_i18n = '{"fr": "« Une seule main n’applaudit pas » — que veut dire ce proverbe égyptien ?", "es": "“Una sola mano no aplaude” — ¿qué significa este dicho egipcio?", "ro": "„O singură mână nu aplaudă” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"محدش بيعمل حاجة لوحده","text_en":"Nothing gets done alone","text_i18n":{"fr":"On ne fait rien tout seul","es":"Solo no se consigue nada","ro":"Singur nu faci nimic"}},{"index":1,"text_ar":"التصفيق مش مهذب","text_en":"Clapping is rude","text_i18n":{"fr":"Applaudir est impoli","es":"Aplaudir es de mala educación","ro":"Aplauzele sunt nepoliticoase"}},{"index":2,"text_ar":"استخدم إيدك الشمال","text_en":"Use your left hand","text_i18n":{"fr":"Utilise ta main gauche","es":"Usa la mano izquierda","ro":"Folosește mâna stângă"}},{"index":3,"text_ar":"الموسيقى محتاجة ناس","text_en":"Music needs an audience","text_i18n":{"fr":"La musique a besoin de public","es":"La música necesita público","ro":"Muzica are nevoie de public"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 38;

update public.questions set
  text_i18n = '{"fr": "« La patience est la clé du soulagement » — que veut dire ce proverbe égyptien ?", "es": "“La paciencia es la llave del alivio” — ¿qué significa este dicho egipcio?", "ro": "„Răbdarea e cheia ușurării” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"استنى وهتتحل","text_en":"Wait, and things work out","text_i18n":{"fr":"Patiente, et les choses s’arrangent","es":"Espera y las cosas se arreglan","ro":"Ai răbdare și lucrurile se rezolvă"}},{"index":1,"text_ar":"خد نسخة من المفتاح","text_en":"Keep a spare key","text_i18n":{"fr":"Garde un double des clés","es":"Ten una copia de la llave","ro":"Ține o cheie de rezervă"}},{"index":2,"text_ar":"اقفل الباب ورا نفسك","text_en":"Lock the door behind you","text_i18n":{"fr":"Ferme la porte derrière toi","es":"Cierra la puerta al salir","ro":"Închide ușa după tine"}},{"index":3,"text_ar":"الاستعجال بيوفر وقت","text_en":"Hurrying saves time","text_i18n":{"fr":"Se dépêcher fait gagner du temps","es":"Correr ahorra tiempo","ro":"Graba economisește timp"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 39;

update public.questions set
  text_i18n = '{"fr": "« L’affamé rêve du marché au pain » — que veut dire ce proverbe égyptien ?", "es": "“El hambriento sueña con el mercado del pan” — ¿qué significa este dicho egipcio?", "ro": "„Flămândul visează piața de pâine” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اللي ناقصك هو اللي بتفكر فيه","text_en":"You think about whatever you are short of","text_i18n":{"fr":"On pense à ce qui nous manque","es":"Piensas en lo que te falta","ro":"Te gândești la ce îți lipsește"}},{"index":1,"text_ar":"الأسواق بتفتح بدري","text_en":"Markets open early","text_i18n":{"fr":"Les marchés ouvrent tôt","es":"Los mercados abren temprano","ro":"Piețele se deschid devreme"}},{"index":2,"text_ar":"العيش أحسن أكل","text_en":"Bread is the best food","text_i18n":{"fr":"Le pain est le meilleur des aliments","es":"El pan es la mejor comida","ro":"Pâinea e cea mai bună mâncare"}},{"index":3,"text_ar":"الأحلام بتتحقق","text_en":"Dreams come true","text_i18n":{"fr":"Les rêves se réalisent","es":"Los sueños se cumplen","ro":"Visele se împlinesc"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 40;

update public.questions set
  text_i18n = '{"fr": "« Bouche la porte d’où vient le vent, et repose-toi » — que veut dire ce proverbe égyptien ?", "es": "“Tapa la puerta por donde entra el viento y descansa” — ¿qué significa este dicho egipcio?", "ro": "„Astupă ușa de unde vine vântul și odihnește-te” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble","text_i18n":{"fr":"Coupe court à ce qui te cause du souci","es":"Corta de raíz lo que te causa problemas","ro":"Taie de la rădăcină ce îți face probleme"}},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night","text_i18n":{"fr":"Ferme les fenêtres la nuit","es":"Cierra las ventanas de noche","ro":"Închide ferestrele noaptea"}},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing","text_i18n":{"fr":"Dormir est ce qu’il y a de mieux","es":"Dormir es lo mejor","ro":"Somnul e cel mai bun lucru"}},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you","text_i18n":{"fr":"L’air frais fait du bien","es":"El aire fresco es bueno","ro":"Aerul curat îți face bine"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 41;

update public.questions set
  text_i18n = '{"fr": "« Marche dans un enterrement plutôt que d’arranger un mariage » — que veut dire ce proverbe égyptien ?", "es": "“Ve a un funeral antes que arreglar una boda” — ¿qué significa este dicho egipcio?", "ro": "„Mai bine mergi la o înmormântare decât să pui la cale o nuntă” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"ما تتدخلش في جواز حد، هتتلام","text_en":"Do not get involved in matchmaking — you will get the blame","text_i18n":{"fr":"Ne joue pas les entremetteurs : on t’en tiendra rigueur","es":"No hagas de casamentero: te echarán la culpa","ro":"Nu te băga pețitor — tot pe tine dau vina"}},{"index":1,"text_ar":"الجنازات أرخص","text_en":"Funerals are cheaper","text_i18n":{"fr":"Les enterrements coûtent moins cher","es":"Los funerales son más baratos","ro":"Înmormântările sunt mai ieftine"}},{"index":2,"text_ar":"الجواز مش مهم","text_en":"Marriage does not matter","text_i18n":{"fr":"Le mariage n’a pas d’importance","es":"El matrimonio no importa","ro":"Căsătoria nu contează"}},{"index":3,"text_ar":"امشي كتير عشان صحتك","text_en":"Walking is good for your health","text_i18n":{"fr":"Marcher est bon pour la santé","es":"Caminar es bueno para la salud","ro":"Mersul pe jos e bun pentru sănătate"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 42;

-- ── AND THE SHELF SAYS WHAT IS IN IT ───────────────────────────────
-- "From the pharaohs to Mo Salah" was true of 22 questions. It is now
-- three times the evening, and the card should say so before somebody
-- starts a room expecting five minutes.
update public.game_packs set
  description_ar = 'تاريخ وجغرافيا وأكل وكورة وأمثال — ٤٣ سؤال',
  description_en = 'History, geography, food, football and the sayings — 43 questions'
 where id = 'eeee5555-0000-4000-8000-000000000001';

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · ONE HOST, HOLDING THE CLOCK AND THE DOOR
--
--  A room with a code needs somebody running it, and exactly one
--  somebody. That was already half true — only the host could move the
--  game on — but the host had nothing else to decide: not how long a
--  question lasts, not who may still walk in, not what to do about
--  somebody who should not be in the room.
--
--  Three things move to the host now, and nothing moves to anybody
--  else:
--
--  THE CLOCK. A room can set its own question length — ten seconds for
--  a fast round, forty-five when the table is arguing — and it
--  overrides whatever each question was written with. It is still the
--  SERVER that stamps the deadline, from its own clock, exactly as
--  before: the host chooses the length, not the moment it ends, so a
--  phone still cannot buy itself more time by lying about its clock.
--
--  THE DOOR. Locking the room refuses new arrivals with a plain
--  "the room is closed" instead of dropping a stranger into question
--  nine. People already inside are unaffected.
--
--  AND WHO IS IN IT. The host may remove a player. Not their answers —
--  those stay recorded — just their seat.
--
--  ── WHAT IS DELIBERATELY *NOT* THE HOST'S ────────────────────────
--  The right answer, the scoring and the deadline. Those are the
--  server's, and they stay the server's, because a host who can decide
--  when a question ends is a host who can win.
--
--  ── AND EVERYBODY STILL SEES IT AT THE SAME SECOND ───────────────
--  One row moves — game_rooms — and every phone in the room is
--  watching it. The question index and the deadline arrive together,
--  so ten phones show question four with the same time left, whether
--  they were nudged or noticed by themselves.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists locked   boolean not null default false;
alter table public.game_rooms add column if not exists timer_ms int;      -- null = each question's own

-- ── THE HOST'S SETTINGS ────────────────────────────────────────────
-- Null for either argument means "leave that one alone", so the lobby
-- can change the clock without touching the door.
create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  -- a length somebody could actually play with, not any number a phone sends
  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;

  update public.game_rooms
     set timer_ms = coalesce(p_timer_ms, timer_ms),
         locked   = coalesce(p_locked, locked)
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked);
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean) to authenticated;

-- ── THE HOST MAY REMOVE SOMEBODY ───────────────────────────────────
-- The seat goes; the answers stay recorded. And the host cannot remove
-- themselves, because a room with nobody driving is the fault this
-- whole file exists to avoid.
create or replace function public.lamma_kick(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  if p_user_id = me then return jsonb_build_object('ok', false, 'reason', 'not_yourself'); end if;

  delete from public.room_players where room_id = p_room_id and user_id = p_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.lamma_kick(uuid, uuid) to authenticated;

-- ── THE DOOR ───────────────────────────────────────────────────────
-- Joining a locked room, or one that has already started, now says so
-- plainly instead of seating somebody in the middle of question nine.
-- Anybody who was already in the room can still come back — that is a
-- reconnection, not an arrival.
create or replace function public.lamma_join_room(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  seated boolean := false;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;

  select * into r from public.game_rooms where join_code = upper(trim(p_code));
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_code'); end if;
  if r.status = 'ended' then return jsonb_build_object('ok', false, 'reason', 'game_over'); end if;

  select true into seated from public.room_players where room_id = r.id and user_id = me;

  if not coalesce(seated, false) and r.locked then
    return jsonb_build_object('ok', false, 'reason', 'room_locked');
  end if;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me
  on conflict (room_id, user_id) do update set is_connected = true;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'status', r.status,
                            'pack_id', r.pack_id,
                            'question_index', r.current_question_index);
end;
$$;

-- ── THE CLOCK THE HOST CHOSE ───────────────────────────────────────
-- Same function, one line different: the deadline comes from the
-- room's length when it has one. Still stamped here, from now(), so
-- everybody's question ends at the same instant however slow their
-- phone is.
create or replace function public.lamma_advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  nxt int;
  q  public.questions%rowtype;
  total int;
  secs numeric;
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

  secs := coalesce(r.timer_ms, q.timer_ms) / 1000.0;

  update public.game_rooms
     set status = 'question',
         current_question_index = nxt,
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => secs)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question', 'question_index', nxt,
                            'total', total, 'timer_ms', coalesce(r.timer_ms, q.timer_ms),
                            'deadline_at', now() + make_interval(secs => secs));
end;
$$;

-- ── AND THE ROOM TELLS EVERY PHONE WHAT IT IS ──────────────────────
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
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'timer_ms', r.timer_ms,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected,
                                          'avatar_key', avatar_key)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A ROUND IS FIFTEEN QUESTIONS, NOT THE WHOLE SHELF
--
--  "Do You Know Egypt?" grew to forty-three questions, which is a good
--  library and a bad evening: half an hour of quiz is longer than the
--  reason people opened it. Ayser played it and said so.
--
--  So a ROOM now has its own list of questions, drawn from the pack
--  when the room is made:
--
--    · fifteen by default — about eight minutes, the length of the
--      thing people actually finish
--    · in a RANDOM order, drawn fresh for every room, so the second
--      game of the night is not the first one again
--    · the host can ask for ten, fifteen, twenty-five or all of them
--      while the room is still in the lobby
--
--  ── WHY THE ROOM HOLDS THE LIST ──────────────────────────────────
--  Everything downstream has to agree about what "question four" is:
--  the phone showing it, the server stamping its deadline, the reveal,
--  the scoring, and the end-of-game count. One list, on the room,
--  written once when the room is made and read by all of them. Picking
--  randomly at each step would give ten phones ten different games.
--
--  ── AND THE COUNTS FOLLOW IT ─────────────────────────────────────
--  "12 / 15" counts the round, the double-points questions are the
--  last two OF THE ROUND, and "how Egyptian are you" is out of the
--  fifteen that were actually asked — not out of a pack nobody played.
--
--  Rooms made before this still work: an empty list means the old
--  behaviour, the whole pack in written order.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists question_ids uuid[];

/* The draw. Random order, capped at n — and n of 0 (or more questions
   asked for than exist) means the whole pack. */
create or replace function public.lamma_draw_questions(p_pack_id uuid, p_n int)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}'::uuid[]) from (
    select id from public.questions
     where pack_id = p_pack_id
     order by random()
     limit (case when coalesce(p_n, 0) <= 0 then 2147483647 else p_n end)
  ) picked;
$$;

grant execute on function public.lamma_draw_questions(uuid, int) to authenticated;

-- ── A NEW ROOM DRAWS ITS ROUND ─────────────────────────────────────
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

  insert into public.game_rooms (pack_id, host_user_id, join_code, mode, status, question_ids)
  values (p_pack_id, me, public.lamma_new_code(), coalesce(p_mode, 'classic'), 'lobby',
          public.lamma_draw_questions(p_pack_id, 15))
  returning * into r;

  insert into public.room_players (room_id, user_id, nickname)
  select r.id, me, coalesce(p.name, 'Explorer') from public.profiles p where p.id = me;

  return jsonb_build_object('ok', true, 'room_id', r.id, 'join_code', r.join_code,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

-- ── THE HOST'S SETTINGS, NOW INCLUDING HOW LONG THE ROUND IS ───────
-- Dropped and recreated rather than overloaded: two functions with the
-- same name and a different number of arguments is how you get
-- "function is not unique" at three in the morning.
drop function if exists public.lamma_set_room(uuid, int, boolean);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean, p_round int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;
  if p_round is not null and p_round not in (0, 10, 15, 25) then
    return jsonb_build_object('ok', false, 'reason', 'bad_round');
  end if;
  -- the questions cannot change under a game that has started
  if p_round is not null and r.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  update public.game_rooms
     set timer_ms = coalesce(p_timer_ms, timer_ms),
         locked   = coalesce(p_locked, locked),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int) to authenticated;

-- ── MOVING ALONG THE ROOM'S OWN LIST ───────────────────────────────
create or replace function public.lamma_advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  nxt int;
  q  public.questions%rowtype;
  total int;
  secs numeric;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  -- the round, or the whole pack for a room made before rounds existed
  total := coalesce(array_length(r.question_ids, 1),
                    (select count(*)::int from public.questions where pack_id = r.pack_id));
  nxt := r.current_question_index + 1;

  if nxt >= total then
    update public.game_rooms set status = 'ended', current_deadline_at = null where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'ended');
  end if;

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    select * into q from public.questions where id = r.question_ids[nxt + 1];   -- arrays start at 1
  else
    select * into q from public.questions where pack_id = r.pack_id and order_index = nxt;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  secs := coalesce(r.timer_ms, q.timer_ms) / 1000.0;

  update public.game_rooms
     set status = 'question',
         current_question_index = nxt,
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => secs)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question', 'question_index', nxt,
                            'total', total, 'timer_ms', coalesce(r.timer_ms, q.timer_ms),
                            'deadline_at', now() + make_interval(secs => secs));
end;
$$;

-- ── AND EVERY PHONE IS TOLD WHICH QUESTIONS THIS ROOM IS PLAYING ───
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

  if r.question_ids is not null and r.current_question_index >= 0
     and r.current_question_index < coalesce(array_length(r.question_ids, 1), 0) then
    qid := r.question_ids[r.current_question_index + 1];
  else
    select id into qid from public.questions
     where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;

  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'question_ids', coalesce(to_jsonb(r.question_ids), '[]'::jsonb),
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'timer_ms', r.timer_ms,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected,
                                          'avatar_key', avatar_key)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ── OUT OF WHAT WAS ACTUALLY ASKED ─────────────────────────────────
-- Fifteen questions played, so fifteen is the denominator. Counting
-- against the whole pack would have told somebody who got twelve right
-- that they are 28% Egyptian.
create or replace function public.lamma_room_results(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  total int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  total := coalesce(array_length(r.question_ids, 1),
                    (select count(*)::int from public.questions where pack_id = r.pack_id));

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'country', (select country from public.game_packs where id = r.pack_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id, 'nickname', p.nickname, 'score', p.score,
               'avatar_key', p.avatar_key,
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ── DOUBLE POINTS BELONG TO THE END OF THE ROUND ───────────────────
-- The last two questions are worth double. That was worked out from
-- the question's place in the PACK, which in a fifteen-question round
-- drawn at random means the bonus lands on whichever two questions
-- happen to have been written last — usually not the two anybody is
-- still awake for. It is the round's own last two now.
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
  v_pos     int;
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

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    v_total := array_length(r.question_ids, 1);
    v_pos   := coalesce(array_position(r.question_ids, q.id), 1) - 1;   -- 0-based
  else
    select count(*) into v_total from public.questions where pack_id = q.pack_id;
    v_pos := q.order_index;
  end if;
  v_last_two := (v_pos >= v_total - 2);

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

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · GETTING IT WRONG SHOULD TEACH YOU SOMETHING
--
--  Ayser: "خلي لما حد يجاوب غلط يصلحله عشان يعرف" — when somebody gets
--  it wrong, put them right, so they learn.
--
--  Marking the correct tile says WHICH one was right. It does not say
--  why, and "why" is the whole reason to play a quiz about a country
--  rather than about football scores. So every question can carry one
--  short line that appears after the reveal — the fact behind the
--  answer, in a sentence, for everybody in the room and not only the
--  people who got it wrong.
--
--  ── THE RULES THESE LINES FOLLOW ─────────────────────────────────
--  ONE SENTENCE. It is read in the four seconds before the next
--  question, out loud, over people talking. Two sentences is a lecture.
--
--  IT ADDS SOMETHING. "The answer is the Nile" is not a note, it is
--  the answer again. "Ninety-five per cent of Egyptians live within a
--  few kilometres of it" is a note.
--
--  IT IS TRUE, and where a number is disputed it is written as "about".
--
--  ── SAME SHAPE AS EVERYTHING ELSE HERE ───────────────────────────
--  note_ar and note_en are columns; every other language lives in
--  note_i18n, exactly like the question text. The app's resolver reads
--  them with the same function.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.questions add column if not exists note_ar   text;
alter table public.questions add column if not exists note_en   text;
alter table public.questions add column if not exists note_i18n jsonb;

-- The answer-free view carries the note as well. It gives nothing
-- away: it is only ever shown after the reveal, and the reveal already
-- says which option was right.
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, text_en, text_i18n,
         note_ar, note_en, note_i18n,
         media_url, media_type, timer_ms, options, points_style
    from public.questions;
grant select on public.lamma_questions_public to anon, authenticated;

notify pgrst, 'reload schema';

-- ── THE LINES THEMSELVES ───────────────────────────────────────────
-- Arabic and English for all forty-three. The other three languages
-- fall back to English for now rather than being machine-translated:
-- a note that says something slightly different in French is worse
-- than one everybody reads in English.
update public.questions set note_ar = 'الهرم كان مقبرة، والملك كان بيتدفن جواه بكل حاجته للرحلة التانية.', note_en = 'A pyramid was a tomb — the king was buried inside with everything he needed next.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 0;
update public.questions set note_ar = 'النيل أطول نهر في أفريقيا، وبيعدي في إحدى عشرة دولة قبل ما يوصل مصر.', note_en = 'The Nile runs through eleven countries before it reaches Egypt.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;
update public.questions set note_ar = 'القاهرة أكبر مدينة في أفريقيا والعالم العربي، وفيها أكتر من ٢٠ مليون.', note_en = 'Cairo is the largest city in Africa and the Arab world — over 20 million people.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;
update public.questions set note_ar = 'توت عنخ آمون بقى ملك وعنده ٩ سنين، ومات وعنده ١٨، ومقبرته اتلقت كاملة تقريبًا.', note_en = 'Tutankhamun became king at nine and died at eighteen; his tomb was found almost untouched.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 3;
update public.questions set note_ar = 'الأهرامات اتبنت قبل كليوباترا بحوالي ٢٥٠٠ سنة — هي كانت أقرب لينا منها لبناة الهرم.', note_en = 'Cleopatra lived closer in time to us than to the building of the pyramids.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 4;
update public.questions set note_ar = 'كليوباترا كانت بتتكلم كذا لغة، وكانت آخر حاكم لمصر القديمة قبل الرومان.', note_en = 'Cleopatra spoke several languages and was ancient Egypt’s last ruler before Rome.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 5;
update public.questions set note_ar = 'أبو الهول منحوت من صخرة واحدة، طوله حوالي ٧٣ متر، وله وش إنسان وجسم أسد.', note_en = 'The Sphinx is carved from one piece of rock — about 73 metres of lion with a human head.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 6;
update public.questions set note_ar = 'الهيروغليفية اتقرت تاني سنة ١٨٢٢ بعد ما فضلت مقفولة أكتر من ألف سنة.', note_en = 'Hieroglyphs went unread for over a thousand years, until 1822.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 7;
update public.questions set note_ar = 'حجر رشيد مكتوب عليه نفس النص بتلات كتابات، وده اللي خلى فك الرموز ممكن.', note_en = 'The Rosetta Stone carries the same text three ways — that is what cracked the code.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 8;
update public.questions set note_ar = 'قناة السويس بتوفر على السفينة حوالي ٧٠٠٠ كيلومتر بدل ما تلف حوالين أفريقيا.', note_en = 'The Suez Canal saves a ship about 7,000 km around Africa.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 9;
update public.questions set note_ar = 'البحر الأحمر من أحسن أماكن الغطس في الدنيا بسبب الشعاب المرجانية.', note_en = 'The Red Sea’s coral reefs make it one of the best diving spots on earth.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 10;
update public.questions set note_ar = 'الإسكندر بنى الإسكندرية سنة ٣٣١ قبل الميلاد وسماها على اسمه.', note_en = 'Alexander founded Alexandria in 331 BC and named it after himself.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 11;
update public.questions set note_ar = 'فنار الإسكندرية فضل واقف حوالي ١٦٠٠ سنة لحد ما الزلازل وقعته.', note_en = 'The Lighthouse stood for about 1,600 years before earthquakes brought it down.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 12;
update public.questions set note_ar = 'محمد صلاح من قرية نجريج في المحلة، وبقى أشهر لاعب عربي في أوروبا.', note_en = 'Mohamed Salah came from a village in the Nile Delta called Nagrig.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 13;
update public.questions set note_ar = 'الكشري أكلة الشارع الأولى في مصر، وأصلها خليط من هندي وإيطالي ومصري.', note_en = 'Koshari is Egypt’s street food — Indian, Italian and Egyptian ideas in one bowl.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 14;
update public.questions set note_ar = 'البردي كان أول ورق في الدنيا، ومصر كانت بتصدره لكل البحر المتوسط.', note_en = 'Papyrus was the world’s first paper, and Egypt exported it across the Mediterranean.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 15;
update public.questions set note_ar = 'حوالي ٩٦٪ من مساحة مصر صحرا، والناس عايشة على شريط ضيق جنب النيل.', note_en = 'About 96% of Egypt is desert; nearly everyone lives on a thin strip by the Nile.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 16;
update public.questions set note_ar = 'السد العالي حمى مصر من الفيضان، وبحيرة ناصر ورا السد من أكبر البحيرات الصناعية.', note_en = 'The High Dam ended the Nile’s floods; Lake Nasser behind it is one of the largest man-made lakes.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 17;
update public.questions set note_ar = 'معابد أبو سمبل اتنقلت حجر حجر في الستينات عشان مايغرقهاش السد.', note_en = 'Abu Simbel was cut up and moved, block by block, so the dam would not drown it.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 18;
update public.questions set note_ar = 'الجنيه المصري اتقسم زمان لـ ١٠٠ قرش، والقرش لسه اسمه موجود في الكلام.', note_en = 'The Egyptian pound splits into 100 piastres — still called that in everyday talk.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 19;
update public.questions set note_ar = 'الهرم الأكبر فضل أطول مبنى في الدنيا حوالي ٣٨٠٠ سنة.', note_en = 'The Great Pyramid was the tallest building on earth for about 3,800 years.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 20;
update public.questions set note_ar = 'العربية هي اللغة الرسمية، والمصري بيتكلم لهجة مصرية مفهومة في كل العالم العربي.', note_en = 'Arabic is official; the Egyptian dialect is understood across the whole Arab world.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;
update public.questions set note_ar = 'الأهرامات اتبنت حوالي ٢٥٦٠ قبل الميلاد — يعني قبل روما بآلاف السنين.', note_en = 'The pyramids went up around 2560 BC — thousands of years before Rome existed.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 22;
update public.questions set note_ar = 'بعد ٣٠ قبل الميلاد مصر بقت ولاية رومانية، وكانت بتطعم روما بالقمح.', note_en = 'From 30 BC Egypt was a Roman province — and the grain supply that fed Rome.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 23;
update public.questions set note_ar = 'القناة اتفتحت سنة ١٨٦٩، واتحفرت بأيدي عشرات الآلاف من المصريين.', note_en = 'The canal opened in 1869, dug largely by tens of thousands of Egyptian labourers.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;
update public.questions set note_ar = 'ثورة ٢٣ يوليو ١٩٥٢ أنهت الملكية، ومصر بقت جمهورية بعدها بسنة.', note_en = 'The revolution of July 1952 ended the monarchy; the republic followed a year later.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 25;
update public.questions set note_ar = 'عبد الناصر أمّم قناة السويس سنة ١٩٥٦، والسد العالي خلص سنة ١٩٧٠.', note_en = 'Nasser nationalised the canal in 1956; the High Dam was finished in 1970.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 26;
update public.questions set note_ar = 'مكتبة الإسكندرية كانت بتجمع نسخة من كل كتاب في الدنيا، وضاعت على مراحل.', note_en = 'The Library of Alexandria tried to hold a copy of every book in the world.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 27;
update public.questions set note_ar = 'الأواني الكانوبية كانت أربعة، كل واحدة لعضو، وكل واحدة عليها وش حارس مختلف.', note_en = 'There were four canopic jars, one per organ, each with a different guardian’s head.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 28;
update public.questions set note_ar = 'سواحل مصر على المتوسط طولها حوالي ٩٠٠ كيلومتر، والإسكندرية أهم موانيها.', note_en = 'Egypt has about 900 km of Mediterranean coast, with Alexandria as its great port.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 29;
update public.questions set note_ar = 'البحر الأحمر بيفصل مصر عن السعودية، وبيوصل للمحيط الهندي من الجنوب.', note_en = 'The Red Sea separates Egypt from Arabia and opens to the Indian Ocean.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 30;
update public.questions set note_ar = 'سينا هي الجسر البري الوحيد بين أفريقيا وآسيا، وفيها أعلى جبل في مصر.', note_en = 'Sinai is the only land bridge between Africa and Asia, and holds Egypt’s highest mountain.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 31;
update public.questions set note_ar = 'حدود مصر مع ليبيا خط مستقيم في الصحرا طوله أكتر من ١١٠٠ كيلومتر.', note_en = 'The Libya border is a straight desert line over 1,100 km long.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 32;
update public.questions set note_ar = 'السودان كان مع مصر دولة واحدة لحد ١٩٥٦، والنيل بيدخل مصر من عنده.', note_en = 'Sudan and Egypt were one country until 1956 — and the Nile enters Egypt from there.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 33;
update public.questions set note_ar = 'دلتا النيل من أخصب الأراضي في الدنيا، وشكلها مثلث زي حرف دلتا اليوناني.', note_en = 'The Nile delta is some of the most fertile land on earth — and shaped like the Greek letter.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 34;
update public.questions set note_ar = 'حوالي ٩٥٪ من المصريين عايشين على بعد كيلومترات قليلة من النيل.', note_en = 'About 95% of Egyptians live within a few kilometres of the Nile.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 35;
update public.questions set note_ar = 'المثل ده بيتقال لما حد يمدح ابنه قدام الناس — الحب بيعمي عن العيوب.', note_en = 'Said when a parent brags about their child: love does not see the flaws.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 36;
update public.questions set note_ar = 'بيتقال عشان حد يبطل يفكر في اللي راح ويكمّل قدام.', note_en = 'Said to stop somebody chewing over what is already done.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 37;
update public.questions set note_ar = 'بيتقال عن الشغل الجماعي — محدش بيوصل لحاجة لوحده.', note_en = 'Said about teamwork: nobody gets anywhere on their own.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 38;
update public.questions set note_ar = 'مثل بيتقال وقت الأزمة، ومعناه إن الحل بيجي لما تستنى وتهدى.', note_en = 'Said in a crisis: the way out arrives if you can wait for it.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 39;
update public.questions set note_ar = 'بيتقال عن اللي بيتكلم كتير في اللي محرومه — الحرمان بيسيطر على التفكير.', note_en = 'Said about somebody who talks endlessly about what they lack.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 40;
update public.questions set note_ar = 'نصيحة قديمة: اقطع مصدر التعب من أوله بدل ما تفضل تشيل نتيجته.', note_en = 'Old advice: cut the cause off rather than carrying the consequences forever.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 41;
update public.questions set note_ar = 'في مصر اللي بيجوّز اتنين بيتلام لو المشوار فشل — فالناس بتحذر من الوساطة.', note_en = 'In Egypt the matchmaker gets the blame if the marriage goes wrong.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 42;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · READ IT OUT FIRST, THEN SHOW THE CHOICES
--
--  Ayser hosts on a shared screen and asked for the thing every real
--  quiz night does: put the question up on its own, read it out loud,
--  let people think — and only then show the four answers and start
--  the clock.
--
--  That cannot be done on the phone alone. If the deadline is stamped
--  when the question appears, the twenty seconds are already draining
--  while the host is still reading, and the people on the call lose
--  the time it took him to say it.
--
--  So a question now has TWO moments, and the server knows about both:
--
--    reading   the question is up. No options anywhere, no deadline,
--              no clock. Everybody reads or listens.
--    question  the choices appear and the clock starts — stamped by
--              the server, at that instant, for everybody at once.
--
--  ── ONLY WHEN THE ROOM ASKS FOR IT ───────────────────────────────
--  read_first is off by default, because somebody playing alone on a
--  phone does not want to tap twice for every question. The presenter
--  screen turns it on for the room it is hosting.
--
--  ── AND THE CLOCK IS STILL THE SERVER'S ──────────────────────────
--  The host decides WHEN the choices appear. The deadline is stamped
--  from the server's own now() at that moment, so the length is the
--  room's chosen length and everybody's question ends together, however
--  slow anybody's phone is.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists read_first boolean not null default false;

-- ── A ROOM MAY NOW BE "READING" ────────────────────────────────────
-- The status list is widened by dropping the old constraint and adding
-- a wider one NOT VALID: an existing room is in one of the old states
-- and re-validating a table mid-game is a lock nobody asked for. The
-- same lesson as scripts/check-sql-twice.sh — a constraint that
-- validates against rows written later is how this file broke twice.
do $$
begin
  alter table public.game_rooms drop constraint if exists game_rooms_status_check;
  alter table public.game_rooms add constraint game_rooms_status_check
    check (status in ('lobby','reading','question','reveal','leaderboard','ended')) not valid;
exception when others then null;
end $$;

-- ── ADVANCE: TO THE READING, OR STRAIGHT TO THE QUESTION ───────────
create or replace function public.lamma_advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  nxt int;
  q  public.questions%rowtype;
  total int;
  secs numeric;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  total := coalesce(array_length(r.question_ids, 1),
                    (select count(*)::int from public.questions where pack_id = r.pack_id));
  nxt := r.current_question_index + 1;

  if nxt >= total then
    update public.game_rooms set status = 'ended', current_deadline_at = null where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'ended');
  end if;

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    select * into q from public.questions where id = r.question_ids[nxt + 1];
  else
    select * into q from public.questions where pack_id = r.pack_id and order_index = nxt;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  /* Reading first: the question goes up with NO deadline at all. A
     null deadline is what tells every phone not to start a clock and
     not to show a tile. */
  if r.read_first then
    update public.game_rooms
       set status = 'reading',
           current_question_index = nxt,
           current_started_at = now(),
           current_deadline_at = null
     where id = p_room_id;
    return jsonb_build_object('ok', true, 'status', 'reading', 'question_index', nxt, 'total', total);
  end if;

  secs := coalesce(r.timer_ms, q.timer_ms) / 1000.0;
  update public.game_rooms
     set status = 'question',
         current_question_index = nxt,
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => secs)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question', 'question_index', nxt,
                            'total', total, 'timer_ms', coalesce(r.timer_ms, q.timer_ms),
                            'deadline_at', now() + make_interval(secs => secs));
end;
$$;

-- ── AND THE MOMENT THE CHOICES APPEAR ──────────────────────────────
-- Host only, and only out of 'reading'. Asking twice is harmless: the
-- second call finds the room already on the question and says so
-- rather than restarting the clock somebody is already answering
-- against.
create or replace function public.lamma_show_options(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  secs numeric;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;
  if r.status <> 'reading' then return jsonb_build_object('ok', false, 'reason', 'not_reading'); end if;

  if r.question_ids is not null and array_length(r.question_ids, 1) > 0 then
    select * into q from public.questions where id = r.question_ids[r.current_question_index + 1];
  else
    select * into q from public.questions where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  secs := coalesce(r.timer_ms, q.timer_ms) / 1000.0;
  update public.game_rooms
     set status = 'question',
         current_started_at = now(),
         current_deadline_at = now() + make_interval(secs => secs)
   where id = p_room_id;

  return jsonb_build_object('ok', true, 'status', 'question',
                            'timer_ms', coalesce(r.timer_ms, q.timer_ms),
                            'deadline_at', now() + make_interval(secs => secs));
end;
$$;

grant execute on function public.lamma_show_options(uuid) to authenticated;

-- ── THE HOST'S SETTINGS, PLUS "READ IT FIRST" ──────────────────────
drop function if exists public.lamma_set_room(uuid, int, boolean, int);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean,
                                                 p_round int, p_read_first boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;
  if p_round is not null and p_round not in (0, 10, 15, 25) then
    return jsonb_build_object('ok', false, 'reason', 'bad_round');
  end if;
  if p_round is not null and r.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  update public.game_rooms
     set timer_ms   = coalesce(p_timer_ms, timer_ms),
         locked     = coalesce(p_locked, locked),
         read_first = coalesce(p_read_first, read_first),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'read_first', r.read_first,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int, boolean) to authenticated;

-- ── AND EVERY PHONE IS TOLD WHICH MOMENT IT IS ─────────────────────
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

  if r.question_ids is not null and r.current_question_index >= 0
     and r.current_question_index < coalesce(array_length(r.question_ids, 1), 0) then
    qid := r.question_ids[r.current_question_index + 1];
  else
    select id into qid from public.questions
     where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;

  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'question_ids', coalesce(to_jsonb(r.question_ids), '[]'::jsonb),
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'timer_ms', r.timer_ms,
    'read_first', r.read_first,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected,
                                          'avatar_key', avatar_key)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE PART THAT IS NOT IN ANY BOOK
--
--  Ayser: "عايز الناس تضحك و تتعلم اكتر عن مصر و المصريين و الثقافه
--  واللغه وطريقه التعامل."
--
--  Dates and rivers are the easy half. The half that makes somebody
--  say "ah, THAT is why" is the one nobody writes down: what "maalesh"
--  is doing in a sentence, why "bukra" is not exactly tomorrow, what
--  happens to a guest in the first ninety seconds, the three named
--  levels of sugar in a glass of tea, and why the taxi driver is a
--  basha.
--
--  Ten of them, in the five languages, each with the line that
--  explains it afterwards.
--
--  ── AND WHO THE JOKE IS ON ───────────────────────────────────────
--  Nobody. It is Egyptians laughing at things Egyptians do — the
--  elastic hour, the insisting on more food, the haggling that both
--  sides enjoy — which is a different thing from being laughed at. No
--  question here works by making somebody the fool for being Egyptian,
--  and none of the wrong answers is a caricature of anybody.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index >= 43;

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',43,'كلمة «معلش» بتتقال إمتى؟','When does an Egyptian say “maalesh”?',20000,
 '[{"index":0,"text_ar":"في كل حاجة — أسف، ولا يهمك، وشد حيلك","text_en":"For almost anything — sorry, never mind, and cheer up"},{"index":1,"text_ar":"في المطار بس","text_en":"Only at the airport"},{"index":2,"text_ar":"لما يكسب فلوس","text_en":"Only when they win money"},{"index":3,"text_ar":"مبتتقالش خالص","text_en":"It is never said"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',44,'لو مصري قالك «بكرة»، غالبًا يقصد إيه؟','If an Egyptian says “bukra” (tomorrow), what do they usually mean?',20000,
 '[{"index":0,"text_ar":"قريب — مش بالضرورة بكرة بالظبط","text_en":"Soon — not necessarily tomorrow exactly"},{"index":1,"text_ar":"بعد ٢٤ ساعة بالثانية","text_en":"Exactly 24 hours from now"},{"index":2,"text_ar":"عمره ما هيحصل","text_en":"It will never happen"},{"index":3,"text_ar":"حالًا","text_en":"Right now"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',45,'ضيف دخل بيت مصري. إيه اللي هيحصل أول حاجة؟','A guest walks into an Egyptian home. What happens first?',20000,
 '[{"index":0,"text_ar":"أكل وشرب، وإصرار إنه ياكل تاني","text_en":"Food and drink appear, and insistence that he eats more"},{"index":1,"text_ar":"يملا استمارة","text_en":"He fills in a form"},{"index":2,"text_ar":"يستنى في الصالة لوحده","text_en":"He waits alone in the hall"},{"index":3,"text_ar":"يدفع دخول","text_en":"He pays an entrance fee"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',46,'«الشاي مظبوط» يعني إيه؟','In Egypt, tea “mazbout” means what?',20000,
 '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar"},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all"},{"index":2,"text_ar":"بالحليب","text_en":"With milk"},{"index":3,"text_ar":"بارد","text_en":"Cold"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',47,'في الشارع، مصري بينادي على حد مايعرفوش بإيه؟','In the street, what does an Egyptian call a stranger?',20000,
 '[{"index":0,"text_ar":"بلقب فخم: يا باشا، يا هندسة، يا دكتور","text_en":"A grand title: basha, handasa, doctor"},{"index":1,"text_ar":"برقمه القومي","text_en":"By his ID number"},{"index":2,"text_ar":"مبيناديش أصلاً","text_en":"They do not call out at all"},{"index":3,"text_ar":"يصفر","text_en":"By whistling"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',48,'لو حد جمع صوابعه ورفع إيده كده 👌 في مصر، يعني إيه؟','Fingers pinched together, hand raised — what does that mean in Egypt?',20000,
 '[{"index":0,"text_ar":"استنى شوية","text_en":"Wait a moment"},{"index":1,"text_ar":"الأكل حلو","text_en":"The food is good"},{"index":2,"text_ar":"روح من هنا","text_en":"Go away"},{"index":3,"text_ar":"أنا مش فاهم","text_en":"I do not understand"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',49,'لو سألت مصري «إزيك؟» غالبًا يرد بإيه؟','Ask an Egyptian “ezzayak?” (how are you?) — the usual answer is:',20000,
 '[{"index":0,"text_ar":"الحمد لله","text_en":"Al-hamdu lillah — thank God"},{"index":1,"text_ar":"بشرح مفصل لليوم كله","text_en":"A full account of their whole day"},{"index":2,"text_ar":"مبيردش","text_en":"They do not answer"},{"index":3,"text_ar":"بسؤال عن الطقس","text_en":"A question about the weather"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',50,'في فرح مصري، الزغروتة إيه؟','At an Egyptian wedding, what is a zaghrouta?',20000,
 '[{"index":0,"text_ar":"صوت فرح عالي بتطلعه الستات باللسان","text_en":"A high trilling cry of joy, made by the women"},{"index":1,"text_ar":"نوع من الحلويات","text_en":"A kind of sweet"},{"index":2,"text_ar":"رقصة للعريس لوحده","text_en":"A dance for the groom alone"},{"index":3,"text_ar":"هدية فلوس","text_en":"A gift of money"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',51,'«تسلم إيدك» بتتقال لمين؟','Who do you say “teslam eedak” to?',20000,
 '[{"index":0,"text_ar":"لحد عمل حاجة بإيده — طبخ أو صلّح أو رسم","text_en":"To somebody who made something with their hands — cooked, fixed, drew"},{"index":1,"text_ar":"للي بيمشي بسرعة","text_en":"To somebody walking fast"},{"index":2,"text_ar":"للي خسر","text_en":"To somebody who lost"},{"index":3,"text_ar":"للي بينام بدري","text_en":"To somebody who sleeps early"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',52,'في السوق المصري، السعر الأول معناه إيه؟','In an Egyptian market, what is the first price?',20000,
 '[{"index":0,"text_ar":"بداية الكلام — الفصال متوقع","text_en":"The opening of a conversation — haggling is expected"},{"index":1,"text_ar":"السعر النهائي","text_en":"The final price"},{"index":2,"text_ar":"سعر الجملة","text_en":"The wholesale price"},{"index":3,"text_ar":"غلط مطبعي","text_en":"A typing mistake"}]',0,'double');

update public.questions set
  text_i18n = '{"fr": "Quand un Égyptien dit-il « maalesh » ?", "es": "¿Cuándo dice un egipcio “maalesh”?", "ro": "Când spune un egiptean „maalesh”?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"في كل حاجة — أسف، ولا يهمك، وشد حيلك","text_en":"For almost anything — sorry, never mind, and cheer up","text_i18n":{"fr":"Pour à peu près tout : pardon, tant pis, courage","es":"Para casi todo: perdón, no pasa nada, ánimo","ro":"Pentru aproape orice: scuze, nu-i nimic, hai că trece"}},{"index":1,"text_ar":"في المطار بس","text_en":"Only at the airport","text_i18n":{"fr":"Seulement à l’aéroport","es":"Solo en el aeropuerto","ro":"Doar la aeroport"}},{"index":2,"text_ar":"لما يكسب فلوس","text_en":"Only when they win money","text_i18n":{"fr":"Seulement en gagnant de l’argent","es":"Solo al ganar dinero","ro":"Doar când câștigă bani"}},{"index":3,"text_ar":"مبتتقالش خالص","text_en":"It is never said","text_i18n":{"fr":"Elle ne se dit jamais","es":"No se dice nunca","ro":"Nu se spune niciodată"}}]'::jsonb,
  note_ar   = 'كلمة واحدة بتشيل اعتذار وتهوين ومواساة — على حسب نبرة الصوت.',
  note_en   = 'One word carrying apology, reassurance and sympathy — the tone decides which.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 43;

update public.questions set
  text_i18n = '{"fr": "Si un Égyptien dit « bukra » (demain), il veut dire quoi ?", "es": "Si un egipcio dice “bukra” (mañana), ¿qué suele querer decir?", "ro": "Dacă un egiptean spune „bukra” (mâine), ce vrea să zică de obicei?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"قريب — مش بالضرورة بكرة بالظبط","text_en":"Soon — not necessarily tomorrow exactly","text_i18n":{"fr":"Bientôt — pas forcément demain","es":"Pronto, no necesariamente mañana","ro":"Curând — nu neapărat mâine"}},{"index":1,"text_ar":"بعد ٢٤ ساعة بالثانية","text_en":"Exactly 24 hours from now","text_i18n":{"fr":"Dans exactement 24 heures","es":"Exactamente en 24 horas","ro":"Exact peste 24 de ore"}},{"index":2,"text_ar":"عمره ما هيحصل","text_en":"It will never happen","text_i18n":{"fr":"Cela n’arrivera jamais","es":"No pasará nunca","ro":"Nu se va întâmpla niciodată"}},{"index":3,"text_ar":"حالًا","text_en":"Right now","text_i18n":{"fr":"Tout de suite","es":"Ahora mismo","ro":"Chiar acum"}}]'::jsonb,
  note_ar   = 'الوقت في مصر مطاطي شوية، والنية حقيقية حتى لو الميعاد مش دقيق.',
  note_en   = 'Time is elastic; the intention is real even when the hour is not.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 44;

update public.questions set
  text_i18n = '{"fr": "Un invité entre dans une maison égyptienne. Que se passe-t-il d’abord ?", "es": "Un invitado entra en una casa egipcia. ¿Qué pasa primero?", "ro": "Un oaspete intră într-o casă egipteană. Ce se întâmplă întâi?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أكل وشرب، وإصرار إنه ياكل تاني","text_en":"Food and drink appear, and insistence that he eats more","text_i18n":{"fr":"On apporte à manger et à boire, et on insiste pour resservir","es":"Aparecen comida y bebida, y se insiste en repetir","ro":"Apar mâncare și băutură, și insistă să mai mănânce"}},{"index":1,"text_ar":"يملا استمارة","text_en":"He fills in a form","text_i18n":{"fr":"Il remplit un formulaire","es":"Rellena un formulario","ro":"Completează un formular"}},{"index":2,"text_ar":"يستنى في الصالة لوحده","text_en":"He waits alone in the hall","text_i18n":{"fr":"Il attend seul dans l’entrée","es":"Espera solo en el recibidor","ro":"Așteaptă singur pe hol"}},{"index":3,"text_ar":"يدفع دخول","text_en":"He pays an entrance fee","text_i18n":{"fr":"Il paie l’entrée","es":"Paga la entrada","ro":"Plătește intrarea"}}]'::jsonb,
  note_ar   = 'رفض الأكل مرة أو اتنين متوقع — الكرم بيصر، والضيف بيكسر.',
  note_en   = 'Refusing once or twice is expected: the host insists, the guest gives in.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 45;

update public.questions set
  text_i18n = '{"fr": "En Égypte, un thé « mazbout », c’est quoi ?", "es": "En Egipto, un té “mazbout” ¿qué es?", "ro": "În Egipt, un ceai „mazbout” înseamnă ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar","text_i18n":{"fr":"Sucré comme il faut","es":"Con azúcar medio","ro":"Cu zahăr potrivit"}},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all","text_i18n":{"fr":"Sans sucre","es":"Sin azúcar","ro":"Fără zahăr"}},{"index":2,"text_ar":"بالحليب","text_en":"With milk","text_i18n":{"fr":"Avec du lait","es":"Con leche","ro":"Cu lapte"}},{"index":3,"text_ar":"بارد","text_en":"Cold","text_i18n":{"fr":"Froid","es":"Frío","ro":"Rece"}}]'::jsonb,
  note_ar   = 'مظبوط، سكر زيادة، وعلى الريحة — تلات درجات للسكر لهم أسماء.',
  note_en   = 'Mazbout, ziyada and “ala er-reeha” — three named levels of sugar.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 46;

update public.questions set
  text_i18n = '{"fr": "Dans la rue, comment un Égyptien interpelle-t-il un inconnu ?", "es": "En la calle, ¿cómo llama un egipcio a un desconocido?", "ro": "Pe stradă, cum i se adresează un egiptean unui necunoscut?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"بلقب فخم: يا باشا، يا هندسة، يا دكتور","text_en":"A grand title: basha, handasa, doctor","text_i18n":{"fr":"Par un grand titre : bacha, ingénieur, docteur","es":"Con un título grande: bacha, ingeniero, doctor","ro":"Cu un titlu mare: pașă, inginer, doctor"}},{"index":1,"text_ar":"برقمه القومي","text_en":"By his ID number","text_i18n":{"fr":"Par son numéro d’identité","es":"Por su número de identidad","ro":"Cu numărul de buletin"}},{"index":2,"text_ar":"مبيناديش أصلاً","text_en":"They do not call out at all","text_i18n":{"fr":"On n’interpelle personne","es":"No se llama a nadie","ro":"Nu strigă pe nimeni"}},{"index":3,"text_ar":"يصفر","text_en":"By whistling","text_i18n":{"fr":"En sifflant","es":"Silbando","ro":"Fluierând"}}]'::jsonb,
  note_ar   = 'الألقاب دي مجاملة مش وظيفة — والباشا ممكن يكون سواق التاكسي.',
  note_en   = 'The titles are courtesy, not job descriptions — the basha may be your driver.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 47;

update public.questions set
  text_i18n = '{"fr": "Doigts joints, main levée — qu’est-ce que ça veut dire en Égypte ?", "es": "Dedos juntos, mano levantada: ¿qué significa en Egipto?", "ro": "Degete strânse, mâna ridicată — ce înseamnă în Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"استنى شوية","text_en":"Wait a moment","text_i18n":{"fr":"Attends un instant","es":"Espera un momento","ro":"Așteaptă puțin"}},{"index":1,"text_ar":"الأكل حلو","text_en":"The food is good","text_i18n":{"fr":"C’est délicieux","es":"La comida está buena","ro":"Mâncarea e bună"}},{"index":2,"text_ar":"روح من هنا","text_en":"Go away","text_i18n":{"fr":"Va-t’en","es":"Vete","ro":"Pleacă"}},{"index":3,"text_ar":"أنا مش فاهم","text_en":"I do not understand","text_i18n":{"fr":"Je ne comprends pas","es":"No entiendo","ro":"Nu înțeleg"}}]'::jsonb,
  note_ar   = 'الإيد بتتكلم في مصر — والحركة دي معناها اصبر لحظة.',
  note_en   = 'Hands talk in Egypt, and this one means: give me a second.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 48;

update public.questions set
  text_i18n = '{"fr": "Demandez « ezzayak ? » à un Égyptien — la réponse habituelle est :", "es": "Pregunta “ezzayak” a un egipcio: la respuesta habitual es", "ro": "Întreabă un egiptean „ezzayak?” — răspunsul obișnuit e:"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الحمد لله","text_en":"Al-hamdu lillah — thank God","text_i18n":{"fr":"Al-hamdou lillah — Dieu merci","es":"Al-hamdu lillah: gracias a Dios","ro":"Al-hamdu lillah — slavă Domnului"}},{"index":1,"text_ar":"بشرح مفصل لليوم كله","text_en":"A full account of their whole day","text_i18n":{"fr":"Le récit complet de sa journée","es":"Un relato completo de su día","ro":"Toată ziua, în detaliu"}},{"index":2,"text_ar":"مبيردش","text_en":"They do not answer","text_i18n":{"fr":"Il ne répond pas","es":"No responde","ro":"Nu răspunde"}},{"index":3,"text_ar":"بسؤال عن الطقس","text_en":"A question about the weather","text_i18n":{"fr":"Une question sur la météo","es":"Una pregunta sobre el tiempo","ro":"O întrebare despre vreme"}}]'::jsonb,
  note_ar   = 'الرد ده بيتقال في الفرح والزنقة — وبعده بس بتعرف الحقيقة.',
  note_en   = 'Said in good times and bad; the real answer comes after it.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 49;

update public.questions set
  text_i18n = '{"fr": "Dans un mariage égyptien, qu’est-ce qu’une zaghrouta ?", "es": "En una boda egipcia, ¿qué es una zaghrouta?", "ro": "La o nuntă egipteană, ce e o zaghrouta?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"صوت فرح عالي بتطلعه الستات باللسان","text_en":"A high trilling cry of joy, made by the women","text_i18n":{"fr":"Un youyou aigu poussé par les femmes","es":"Un grito agudo de alegría que hacen las mujeres","ro":"Un strigăt ascuțit de bucurie, scos de femei"}},{"index":1,"text_ar":"نوع من الحلويات","text_en":"A kind of sweet","text_i18n":{"fr":"Une pâtisserie","es":"Un dulce","ro":"Un fel de dulce"}},{"index":2,"text_ar":"رقصة للعريس لوحده","text_en":"A dance for the groom alone","text_i18n":{"fr":"Une danse du marié seul","es":"Un baile solo del novio","ro":"Un dans doar al mirelui"}},{"index":3,"text_ar":"هدية فلوس","text_en":"A gift of money","text_i18n":{"fr":"Un cadeau en argent","es":"Un regalo de dinero","ro":"Un cadou în bani"}}]'::jsonb,
  note_ar   = 'الزغروتة مش في الأفراح بس — بتطلع في النجاح والرجوع بالسلامة كمان.',
  note_en   = 'Not only at weddings — also for exam results and safe returns.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 50;

update public.questions set
  text_i18n = '{"fr": "À qui dit-on « teslam eedak » ?", "es": "¿A quién se le dice “teslam eedak”?", "ro": "Cui îi spui „teslam eedak”?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"لحد عمل حاجة بإيده — طبخ أو صلّح أو رسم","text_en":"To somebody who made something with their hands — cooked, fixed, drew","text_i18n":{"fr":"À qui a fait quelque chose de ses mains : cuisiné, réparé, dessiné","es":"A quien ha hecho algo con las manos: cocinar, arreglar, dibujar","ro":"Cuiva care a făcut ceva cu mâinile: a gătit, a reparat, a desenat"}},{"index":1,"text_ar":"للي بيمشي بسرعة","text_en":"To somebody walking fast","text_i18n":{"fr":"À qui marche vite","es":"A quien camina rápido","ro":"Cuiva care merge repede"}},{"index":2,"text_ar":"للي خسر","text_en":"To somebody who lost","text_i18n":{"fr":"À qui a perdu","es":"A quien ha perdido","ro":"Cuiva care a pierdut"}},{"index":3,"text_ar":"للي بينام بدري","text_en":"To somebody who sleeps early","text_i18n":{"fr":"À qui se couche tôt","es":"A quien se acuesta temprano","ro":"Cuiva care se culcă devreme"}}]'::jsonb,
  note_ar   = 'حرفيًا «سلمت يداك» — أعلى شكر لمجهود إيد إنسان.',
  note_en   = 'Literally “may your hands be safe” — the highest thanks for handiwork.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 51;

update public.questions set
  text_i18n = '{"fr": "Sur un marché égyptien, que vaut le premier prix annoncé ?", "es": "En un mercado egipcio, ¿qué es el primer precio?", "ro": "Într-o piață egipteană, ce e primul preț?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"بداية الكلام — الفصال متوقع","text_en":"The opening of a conversation — haggling is expected","text_i18n":{"fr":"Le début de la conversation : on marchande","es":"El inicio de la conversación: se regatea","ro":"Începutul conversației — se negociază"}},{"index":1,"text_ar":"السعر النهائي","text_en":"The final price","text_i18n":{"fr":"Le prix final","es":"El precio final","ro":"Prețul final"}},{"index":2,"text_ar":"سعر الجملة","text_en":"The wholesale price","text_i18n":{"fr":"Le prix de gros","es":"El precio al por mayor","ro":"Prețul en gros"}},{"index":3,"text_ar":"غلط مطبعي","text_en":"A typing mistake","text_i18n":{"fr":"Une faute de frappe","es":"Una errata","ro":"O greșeală de tipar"}}]'::jsonb,
  note_ar   = 'الفصال جزء من التعامل، ومحدش بيزعل منه — بس بابتسامة.',
  note_en   = 'Haggling is part of the exchange, and nobody minds — with a smile.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 52;

update public.game_packs set
  description_ar = 'تاريخ وجغرافيا وأكل وكورة وأمثال وعادات — ١٥ سؤال كل جولة',
  description_en = 'History, geography, food, football, sayings and habits — 15 a round'
 where id = 'eeee5555-0000-4000-8000-000000000001';

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE LINE THAT TEACHES, IN ALL FIVE
--
--  The note after each answer existed in Arabic and English, and the
--  other three languages read the English one. That was the honest
--  stopgap and it was written down as one; this is the other three,
--  written rather than machine-translated, because these lines are
--  read out at a table and a sentence that drifts is worse than no
--  sentence.
--
--  Fifty-three questions, French, Spanish and Romanian.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

update public.questions set note_i18n = '{"fr": "Une pyramide était un tombeau : le roi y était enterré avec tout ce qu’il lui fallait ensuite.", "es": "Una pirámide era una tumba: el rey se enterraba con todo lo que necesitaría después.", "ro": "O piramidă era un mormânt: regele era îngropat cu tot ce-i trebuia dincolo."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 0;
update public.questions set note_i18n = '{"fr": "Le Nil traverse onze pays avant d’arriver en Égypte.", "es": "El Nilo atraviesa once países antes de llegar a Egipto.", "ro": "Nilul trece prin unsprezece țări înainte să ajungă în Egipt."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;
update public.questions set note_i18n = '{"fr": "Le Caire est la plus grande ville d’Afrique et du monde arabe : plus de 20 millions d’habitants.", "es": "El Cairo es la mayor ciudad de África y del mundo árabe: más de 20 millones.", "ro": "Cairo e cel mai mare oraș din Africa și din lumea arabă: peste 20 de milioane."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;
update public.questions set note_i18n = '{"fr": "Toutânkhamon devient roi à neuf ans et meurt à dix-huit ; sa tombe fut retrouvée presque intacte.", "es": "Tutankamón fue rey a los nueve años y murió a los dieciocho; su tumba apareció casi intacta.", "ro": "Tutankhamon a ajuns rege la nouă ani și a murit la optsprezece; mormântul i-a fost găsit aproape intact."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 3;
update public.questions set note_i18n = '{"fr": "Cléopâtre vivait plus près de notre époque que de la construction des pyramides.", "es": "Cleopatra vivió más cerca de nuestra época que de la construcción de las pirámides.", "ro": "Cleopatra a trăit mai aproape de vremea noastră decât de construcția piramidelor."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 4;
update public.questions set note_i18n = '{"fr": "Cléopâtre parlait plusieurs langues et fut la dernière souveraine de l’Égypte antique avant Rome.", "es": "Cleopatra hablaba varios idiomas y fue la última gobernante del Egipto antiguo antes de Roma.", "ro": "Cleopatra vorbea mai multe limbi și a fost ultima conducătoare a Egiptului antic înainte de Roma."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 5;
update public.questions set note_i18n = '{"fr": "Le Sphinx est taillé dans un seul bloc : environ 73 mètres de lion à tête humaine.", "es": "La Esfinge está tallada en una sola roca: unos 73 metros de león con cabeza humana.", "ro": "Sfinxul e sculptat dintr-o singură stâncă: vreo 73 de metri de leu cu cap de om."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 6;
update public.questions set note_i18n = '{"fr": "Les hiéroglyphes sont restés illisibles plus de mille ans, jusqu’en 1822.", "es": "Los jeroglíficos quedaron ilegibles más de mil años, hasta 1822.", "ro": "Hieroglifele au rămas necitite peste o mie de ani, până în 1822."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 7;
update public.questions set note_i18n = '{"fr": "La pierre de Rosette porte le même texte de trois façons : c’est ce qui a permis de déchiffrer.", "es": "La piedra de Rosetta lleva el mismo texto de tres formas: eso permitió descifrarlos.", "ro": "Piatra din Rosetta poartă același text în trei feluri: asta a permis descifrarea."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 8;
update public.questions set note_i18n = '{"fr": "Le canal de Suez épargne à un navire environ 7 000 km autour de l’Afrique.", "es": "El canal de Suez le ahorra a un barco unos 7.000 km rodeando África.", "ro": "Canalul Suez scutește o navă de vreo 7.000 km în jurul Africii."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 9;
update public.questions set note_i18n = '{"fr": "Les récifs de corail font de la mer Rouge l’un des meilleurs sites de plongée au monde.", "es": "Los arrecifes de coral hacen del mar Rojo uno de los mejores sitios de buceo del mundo.", "ro": "Recifele de corali fac din Marea Roșie unul dintre cele mai bune locuri de scufundări."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 10;
update public.questions set note_i18n = '{"fr": "Alexandre fonde Alexandrie en 331 av. J.-C. et lui donne son nom.", "es": "Alejandro fundó Alejandría en el 331 a. C. y le puso su nombre.", "ro": "Alexandru a fondat Alexandria în 331 î.Hr. și i-a dat numele lui."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 11;
update public.questions set note_i18n = '{"fr": "Le phare a tenu environ 1 600 ans avant que des séismes ne l’abattent.", "es": "El faro resistió unos 1.600 años hasta que los terremotos lo derribaron.", "ro": "Farul a rezistat vreo 1.600 de ani până l-au doborât cutremurele."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 12;
update public.questions set note_i18n = '{"fr": "Mohamed Salah vient d’un village du delta du Nil appelé Nagrig.", "es": "Mohamed Salah es de un pueblo del delta del Nilo llamado Nagrig.", "ro": "Mohamed Salah e dintr-un sat din delta Nilului, Nagrig."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 13;
update public.questions set note_i18n = '{"fr": "Le koshari est le plat de rue égyptien : des idées indiennes, italiennes et égyptiennes dans un bol.", "es": "El koshari es la comida callejera de Egipto: ideas indias, italianas y egipcias en un bol.", "ro": "Koshari e mâncarea de stradă a Egiptului: idei indiene, italiene și egiptene într-un bol."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 14;
update public.questions set note_i18n = '{"fr": "Le papyrus fut le premier papier du monde, et l’Égypte l’exportait dans toute la Méditerranée.", "es": "El papiro fue el primer papel del mundo, y Egipto lo exportaba por todo el Mediterráneo.", "ro": "Papirusul a fost prima hârtie din lume, iar Egiptul o exporta în toată Mediterana."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 15;
update public.questions set note_i18n = '{"fr": "Environ 96 % de l’Égypte est désertique ; presque tout le monde vit sur une bande étroite le long du Nil.", "es": "Cerca del 96% de Egipto es desierto; casi todos viven en una franja junto al Nilo.", "ro": "Circa 96% din Egipt e deșert; aproape toți trăiesc pe o fâșie îngustă lângă Nil."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 16;
update public.questions set note_i18n = '{"fr": "Le haut barrage a mis fin aux crues ; le lac Nasser derrière lui est l’un des plus grands lacs artificiels.", "es": "La presa alta acabó con las crecidas; el lago Nasser es uno de los mayores lagos artificiales.", "ro": "Barajul a oprit inundațiile; Lacul Nasser e unul dintre cele mai mari lacuri artificiale."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 17;
update public.questions set note_i18n = '{"fr": "Abou Simbel a été découpé et déplacé bloc par bloc pour que le barrage ne le noie pas.", "es": "Abu Simbel se cortó y se trasladó bloque a bloque para que la presa no lo inundara.", "ro": "Abu Simbel a fost tăiat și mutat bloc cu bloc, ca să nu-l înece barajul."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 18;
update public.questions set note_i18n = '{"fr": "La livre égyptienne se divise en 100 piastres — le mot sert encore tous les jours.", "es": "La libra egipcia se divide en 100 piastras, palabra que aún se usa a diario.", "ro": "Lira egipteană se împarte în 100 de piaștri — cuvântul se folosește și azi."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 19;
update public.questions set note_i18n = '{"fr": "La grande pyramide fut le plus haut bâtiment du monde pendant environ 3 800 ans.", "es": "La Gran Pirámide fue el edificio más alto del mundo unos 3.800 años.", "ro": "Marea Piramidă a fost cea mai înaltă clădire din lume vreo 3.800 de ani."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 20;
update public.questions set note_i18n = '{"fr": "L’arabe est la langue officielle ; le dialecte égyptien se comprend dans tout le monde arabe.", "es": "El árabe es la lengua oficial; el dialecto egipcio se entiende en todo el mundo árabe.", "ro": "Araba e limba oficială; dialectul egiptean se înțelege în toată lumea arabă."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;
update public.questions set note_i18n = '{"fr": "Les pyramides datent d’environ 2560 av. J.-C., des milliers d’années avant Rome.", "es": "Las pirámides son de hacia el 2560 a. C., miles de años antes de Roma.", "ro": "Piramidele sunt din jur de 2560 î.Hr., cu milenii înainte de Roma."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 22;
update public.questions set note_i18n = '{"fr": "À partir de 30 av. J.-C., l’Égypte est une province romaine — et le grenier qui nourrit Rome.", "es": "Desde el 30 a. C. Egipto fue provincia romana, y el granero que alimentaba a Roma.", "ro": "Din 30 î.Hr. Egiptul a fost provincie romană — și grânarul care hrănea Roma."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 23;
update public.questions set note_i18n = '{"fr": "Le canal ouvre en 1869, creusé surtout par des dizaines de milliers d’ouvriers égyptiens.", "es": "El canal abrió en 1869, excavado sobre todo por decenas de miles de obreros egipcios.", "ro": "Canalul s-a deschis în 1869, săpat mai ales de zeci de mii de muncitori egipteni."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;
update public.questions set note_i18n = '{"fr": "La révolution de juillet 1952 met fin à la monarchie ; la république suit un an après.", "es": "La revolución de julio de 1952 acabó con la monarquía; la república llegó un año después.", "ro": "Revoluția din iulie 1952 a pus capăt monarhiei; republica a urmat un an mai târziu."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 25;
update public.questions set note_i18n = '{"fr": "Nasser nationalise le canal en 1956 ; le haut barrage est achevé en 1970.", "es": "Nasser nacionalizó el canal en 1956; la presa alta se terminó en 1970.", "ro": "Nasser a naționalizat canalul în 1956; barajul a fost gata în 1970."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 26;
update public.questions set note_i18n = '{"fr": "La bibliothèque d’Alexandrie voulait un exemplaire de chaque livre du monde.", "es": "La biblioteca de Alejandría quería un ejemplar de cada libro del mundo.", "ro": "Biblioteca din Alexandria voia un exemplar din fiecare carte a lumii."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 27;
update public.questions set note_i18n = '{"fr": "Quatre vases canopes, un par organe, chacun avec une tête de gardien différente.", "es": "Cuatro vasos canopos, uno por órgano, cada uno con una cabeza guardiana distinta.", "ro": "Patru vase canope, unul de fiecare organ, fiecare cu alt cap de paznic."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 28;
update public.questions set note_i18n = '{"fr": "L’Égypte a environ 900 km de côte méditerranéenne, avec Alexandrie pour grand port.", "es": "Egipto tiene unos 900 km de costa mediterránea, con Alejandría como gran puerto.", "ro": "Egiptul are vreo 900 km de coastă mediteraneană, cu Alexandria drept mare port."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 29;
update public.questions set note_i18n = '{"fr": "La mer Rouge sépare l’Égypte de l’Arabie et ouvre sur l’océan Indien.", "es": "El mar Rojo separa Egipto de Arabia y da al océano Índico.", "ro": "Marea Roșie desparte Egiptul de Arabia și dă spre Oceanul Indian."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 30;
update public.questions set note_i18n = '{"fr": "Le Sinaï est le seul pont terrestre entre l’Afrique et l’Asie, et porte le plus haut sommet d’Égypte.", "es": "El Sinaí es el único puente terrestre entre África y Asia, y tiene la cima más alta de Egipto.", "ro": "Sinai e singura punte de uscat între Africa și Asia și are cel mai înalt vârf din Egipt."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 31;
update public.questions set note_i18n = '{"fr": "La frontière libyenne est une ligne droite dans le désert, longue de plus de 1 100 km.", "es": "La frontera con Libia es una línea recta en el desierto de más de 1.100 km.", "ro": "Granița cu Libia e o linie dreaptă în deșert, de peste 1.100 km."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 32;
update public.questions set note_i18n = '{"fr": "Le Soudan et l’Égypte n’ont fait qu’un pays jusqu’en 1956 — et le Nil entre par là.", "es": "Sudán y Egipto fueron un solo país hasta 1956, y el Nilo entra por ahí.", "ro": "Sudanul și Egiptul au fost o singură țară până în 1956 — și Nilul intră pe acolo."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 33;
update public.questions set note_i18n = '{"fr": "Le delta du Nil est parmi les terres les plus fertiles du monde — et il a la forme de la lettre grecque.", "es": "El delta del Nilo es de las tierras más fértiles del mundo, y tiene la forma de la letra griega.", "ro": "Delta Nilului e printre cele mai fertile pământuri, și are forma literei grecești."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 34;
update public.questions set note_i18n = '{"fr": "Environ 95 % des Égyptiens vivent à quelques kilomètres du Nil.", "es": "Cerca del 95% de los egipcios viven a pocos kilómetros del Nilo.", "ro": "Circa 95% dintre egipteni trăiesc la câțiva kilometri de Nil."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 35;
update public.questions set note_i18n = '{"fr": "Se dit quand un parent vante son enfant : l’amour ne voit pas les défauts.", "es": "Se dice cuando un padre presume de su hijo: el cariño no ve los defectos.", "ro": "Se spune când un părinte își laudă copilul: dragostea nu vede cusururile."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 36;
update public.questions set note_i18n = '{"fr": "Se dit pour empêcher quelqu’un de ressasser ce qui est déjà fait.", "es": "Se dice para que alguien deje de darle vueltas a lo ya hecho.", "ro": "Se spune ca cineva să nu mai rumege ce s-a întâmplat deja."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 37;
update public.questions set note_i18n = '{"fr": "Se dit du travail à plusieurs : seul, on n’arrive à rien.", "es": "Se dice del trabajo en equipo: solo no se llega a nada.", "ro": "Se spune despre munca în echipă: singur nu ajungi nicăieri."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 38;
update public.questions set note_i18n = '{"fr": "Se dit dans la difficulté : la sortie arrive à qui sait attendre.", "es": "Se dice en los apuros: la salida llega a quien sabe esperar.", "ro": "Se spune la greu: ieșirea vine la cine știe să aștepte."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 39;
update public.questions set note_i18n = '{"fr": "Se dit de quelqu’un qui ne parle que de ce qui lui manque.", "es": "Se dice de quien no para de hablar de lo que le falta.", "ro": "Se spune despre cine vorbește întruna despre ce-i lipsește."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 40;
update public.questions set note_i18n = '{"fr": "Vieux conseil : coupe la cause au lieu d’en porter les conséquences éternellement.", "es": "Consejo viejo: corta la causa en vez de cargar siempre con las consecuencias.", "ro": "Sfat vechi: taie cauza, în loc să duci veșnic consecințele."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 41;
update public.questions set note_i18n = '{"fr": "En Égypte, c’est l’entremetteur qu’on blâme si le mariage tourne mal.", "es": "En Egipto, al casamentero se le culpa si el matrimonio sale mal.", "ro": "În Egipt, pețitorul e cel învinovățit dacă iese prost căsnicia."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 42;
update public.questions set note_i18n = '{"fr": "Un seul mot pour l’excuse, le réconfort et la compassion — le ton tranche.", "es": "Una sola palabra para disculpa, consuelo y ánimo: el tono decide cuál.", "ro": "Un singur cuvânt pentru scuză, alinare și încurajare — tonul decide."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 43;
update public.questions set note_i18n = '{"fr": "Le temps est élastique ; l’intention est vraie même si l’heure ne l’est pas.", "es": "El tiempo es elástico; la intención es real aunque la hora no lo sea.", "ro": "Timpul e elastic; intenția e reală chiar dacă ora nu e."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 44;
update public.questions set note_i18n = '{"fr": "Refuser une ou deux fois fait partie du rituel : l’hôte insiste, l’invité cède.", "es": "Rechazar una o dos veces es parte del rito: el anfitrión insiste, el invitado cede.", "ro": "Refuzul de una-două ori face parte din ritual: gazda insistă, oaspetele cedează."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 45;
update public.questions set note_i18n = '{"fr": "Mazbout, ziyada, ala er-reeha : trois niveaux de sucre qui ont chacun un nom.", "es": "Mazbout, ziyada y “ala er-reeha”: tres niveles de azúcar con nombre propio.", "ro": "Mazbout, ziyada și „ala er-reeha”: trei niveluri de zahăr, fiecare cu numele lui."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 46;
update public.questions set note_i18n = '{"fr": "Ces titres sont de la politesse, pas des métiers — le bacha peut être votre chauffeur.", "es": "Esos títulos son cortesía, no oficios: el bacha puede ser tu conductor.", "ro": "Titlurile sunt politețe, nu meserii — pașa poate fi șoferul tău."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 47;
update public.questions set note_i18n = '{"fr": "Les mains parlent en Égypte, et celle-ci veut dire : une seconde.", "es": "Las manos hablan en Egipto, y esta dice: un segundo.", "ro": "Mâinile vorbesc în Egipt, iar asta zice: o secundă."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 48;
update public.questions set note_i18n = '{"fr": "On le dit dans la joie comme dans la peine ; la vraie réponse vient après.", "es": "Se dice en la alegría y en el apuro; la respuesta de verdad viene después.", "ro": "Se spune și la bine, și la greu; răspunsul adevărat vine după."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 49;
update public.questions set note_i18n = '{"fr": "Pas seulement aux mariages : aussi pour un examen réussi ou un retour sain et sauf.", "es": "No solo en bodas: también por un examen aprobado o una vuelta a salvo.", "ro": "Nu doar la nunți: și pentru un examen luat sau o întoarcere cu bine."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 50;
update public.questions set note_i18n = '{"fr": "Littéralement « que tes mains soient saines » — le plus beau merci pour un travail fait à la main.", "es": "Literalmente “que tus manos estén a salvo”: el mayor agradecimiento por algo hecho a mano.", "ro": "Literal „să-ți fie mâinile sănătoase” — cea mai mare mulțumire pentru ce e făcut de mână."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 51;
update public.questions set note_i18n = '{"fr": "Le marchandage fait partie de l’échange, et personne ne s’en offusque — avec le sourire.", "es": "El regateo es parte del trato, y a nadie le molesta: con una sonrisa.", "ro": "Negocierea face parte din schimb și nu supără pe nimeni — cu zâmbetul pe buze."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 52;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  أخضر · GREEN MINDS
--
--  Ayser asked for a green corner of Moments: clean-ups, nature
--  reflection circles, art and culture, Erasmus-style projects, in
--  Egypt, France, Spain, Moldova, Hungary and Czechia — and for it to
--  be inspiring, chic, and a SAFE place where differences of culture,
--  thought and belief are respected.
--
--  ── THE ONE DECISION EVERYTHING ELSE FOLLOWS FROM ────────────────
--  Nothing in here is invented. There are no seeded "events" with
--  made-up dates, made-up organisers and made-up numbers of people
--  going, because a wall of plausible-looking gatherings that do not
--  exist is a lie the first person to turn up finds out about — alone,
--  by a canal, on a Saturday morning.
--
--  So the section has two halves, and they never pretend to be each
--  other:
--
--    GATHERINGS  real, created by real people, with a real place and a
--                real hour. Empty until somebody makes one. Joining is
--                a row with a name on it.
--
--    SPARKS      ideas. "Here is a thing you could start, here is what
--                it needs, here is roughly how long it takes." They
--                carry no date, no location and no attendance, and the
--                screen calls them ideas — because that is what they
--                are. Six countries' worth, written to be startable by
--                one person with no budget.
--
--  ── AND THE CARE CODE ────────────────────────────────────────────
--  Every gathering carries the same short code, and the person
--  creating one agrees to it: come as you are, leave the place better,
--  differences of culture and belief are welcome and not up for
--  debate, nobody is photographed without asking, and anybody may
--  leave at any time without explaining. It is stored WITH the
--  gathering rather than in an app policy somewhere, so it is read at
--  the moment it matters.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── WHAT KIND OF THING IT IS ───────────────────────────────────────
--   cleanup   a clean-up: a beach, a park, a riverbank, a street
--   circle    a reflection circle: sitting outside, talking, listening
--   art       art and culture: a walk, a sketch afternoon, a swap
--   project   the Erasmus-shaped thing: a group with a plan and a term
create table if not exists public.green_gatherings (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  title       text not null,
  about       text,
  country     text not null,                 -- ISO code: EG, FR, ES, MD, HU, CZ…
  city        text,
  place_name  text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  minutes     int,                           -- how long it is meant to take
  capacity    int,                           -- null = as many as turn up
  host_id     uuid not null references public.profiles(id) on delete cascade,
  language    text,                          -- what it will mostly be held in
  cancelled_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists green_gatherings_when_idx on public.green_gatherings (country, starts_at);

do $$ begin
  alter table public.green_gatherings drop constraint if exists green_gatherings_kind_check;
  alter table public.green_gatherings add constraint green_gatherings_kind_check
    check (kind in ('cleanup','circle','art','project')) not valid;
exception when others then null; end $$;

create table if not exists public.green_joins (
  gathering_id uuid not null references public.green_gatherings(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (gathering_id, user_id)
);

-- ── THE IDEAS ──────────────────────────────────────────────────────
-- No date, no place, no attendance: a spark is a thing to start, and
-- the columns make that impossible to confuse with a gathering.
create table if not exists public.green_sparks (
  id        uuid primary key default gen_random_uuid(),
  kind      text not null,
  country   text,                            -- null = anywhere
  title_ar  text not null,
  title_en  text not null,
  title_i18n jsonb,
  about_ar  text,
  about_en  text,
  about_i18n jsonb,
  minutes   int,
  people    text,                            -- "2–10", as text, because it is a hint
  sort      int not null default 0
);

alter table public.green_gatherings enable row level security;
alter table public.green_joins      enable row level security;
alter table public.green_sparks     enable row level security;

drop policy if exists "gatherings are public" on public.green_gatherings;
create policy "gatherings are public" on public.green_gatherings for select using (true);

drop policy if exists "you host your own gatherings" on public.green_gatherings;
create policy "you host your own gatherings" on public.green_gatherings
  for insert with check (host_id = auth.uid());

drop policy if exists "a host edits their own" on public.green_gatherings;
create policy "a host edits their own" on public.green_gatherings
  for update using (host_id = auth.uid());

drop policy if exists "who is coming is public" on public.green_joins;
create policy "who is coming is public" on public.green_joins for select using (true);

drop policy if exists "you speak for yourself" on public.green_joins;
create policy "you speak for yourself" on public.green_joins
  for insert with check (user_id = auth.uid());

drop policy if exists "and you may leave" on public.green_joins;
create policy "and you may leave" on public.green_joins
  for delete using (user_id = auth.uid());

drop policy if exists "sparks are for everybody" on public.green_sparks;
create policy "sparks are for everybody" on public.green_sparks for select using (true);

-- ── WHAT IS ON NEAR YOU ────────────────────────────────────────────
-- Upcoming only, cancelled ones excluded, with the count of people
-- coming and whether you are one of them. A country of null means
-- everywhere, because somebody in Prague may want to see what Cairo
-- is doing.
create or replace function public.green_list(p_country text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.starts_at), '[]'::jsonb)
    from (
      select g.id, g.kind, g.title, g.about, g.country, g.city, g.place_name,
             g.lat, g.lng, g.starts_at, g.minutes, g.capacity, g.language,
             g.host_id, p.name as host_name,
             (select count(*) from public.green_joins j where j.gathering_id = g.id) as going,
             exists (select 1 from public.green_joins j
                      where j.gathering_id = g.id and j.user_id = auth.uid()) as im_going
        from public.green_gatherings g
        left join public.profiles p on p.id = g.host_id
       where g.cancelled_at is null
         and g.starts_at > now() - interval '3 hours'      -- still on if it just started
         and (p_country is null or g.country = p_country)
       order by g.starts_at
       limit 60
    ) x;
$$;

grant execute on function public.green_list(text) to anon, authenticated;

-- ── STARTING ONE ───────────────────────────────────────────────────
-- The checks are here rather than on the phone: a gathering with no
-- title, in the past, or of a kind nobody recognises is refused.
create or replace function public.green_create(
  p_kind text, p_title text, p_about text, p_country text, p_city text,
  p_place text, p_lat double precision, p_lng double precision,
  p_starts_at timestamptz, p_minutes int, p_capacity int, p_language text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.green_gatherings%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if p_kind not in ('cleanup','circle','art','project') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;
  if coalesce(length(btrim(p_title)), 0) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'no_title');
  end if;
  if p_starts_at is null or p_starts_at < now() - interval '1 hour' then
    return jsonb_build_object('ok', false, 'reason', 'in_the_past');
  end if;
  if coalesce(length(btrim(p_country)), 0) <> 2 then
    return jsonb_build_object('ok', false, 'reason', 'no_country');
  end if;

  insert into public.green_gatherings
    (kind, title, about, country, city, place_name, lat, lng, starts_at, minutes, capacity, host_id, language)
  values
    (p_kind, btrim(p_title), nullif(btrim(coalesce(p_about, '')), ''), upper(btrim(p_country)),
     nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_place, '')), ''),
     p_lat, p_lng, p_starts_at, p_minutes, p_capacity, me, p_language)
  returning * into g;

  -- the host is the first person coming; a gathering of nobody is a plan
  insert into public.green_joins (gathering_id, user_id) values (g.id, me)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'id', g.id);
end;
$$;

grant execute on function public.green_create(text, text, text, text, text, text,
                                              double precision, double precision,
                                              timestamptz, int, int, text) to authenticated;

-- ── COMING, OR NOT COMING AFTER ALL ────────────────────────────────
-- Leaving needs no reason and no message to anybody. That is part of
-- what makes it a place people will come back to.
create or replace function public.green_join(p_id uuid, p_going boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.green_gatherings%rowtype;
  n  int;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into g from public.green_gatherings where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_gathering'); end if;
  if g.cancelled_at is not null then return jsonb_build_object('ok', false, 'reason', 'cancelled'); end if;

  if coalesce(p_going, true) then
    if g.capacity is not null then
      select count(*) into n from public.green_joins where gathering_id = p_id;
      if n >= g.capacity and not exists (
        select 1 from public.green_joins where gathering_id = p_id and user_id = me
      ) then
        return jsonb_build_object('ok', false, 'reason', 'full');
      end if;
    end if;
    insert into public.green_joins (gathering_id, user_id) values (p_id, me) on conflict do nothing;
  else
    delete from public.green_joins where gathering_id = p_id and user_id = me;
  end if;

  select count(*) into n from public.green_joins where gathering_id = p_id;
  return jsonb_build_object('ok', true, 'going', n, 'im_going', coalesce(p_going, true));
end;
$$;

grant execute on function public.green_join(uuid, boolean) to authenticated;

-- ── AND CALLING IT OFF, WHICH IS ALSO ALLOWED ──────────────────────
create or replace function public.green_cancel(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  update public.green_gatherings set cancelled_at = now()
   where id = p_id and host_id = me and cancelled_at is null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_yours'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.green_cancel(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── THE IDEAS THEMSELVES ───────────────────────────────────────────
-- Replaced whole each time this runs, because they are OURS: nothing
-- anybody typed is in this table, so there is nothing here to lose.
delete from public.green_sparks;
insert into public.green_sparks
  (kind, country, title_ar, title_en, title_i18n, about_ar, about_en, about_i18n, minutes, people, sort)
values
('cleanup','EG','ساعة على النيل','An hour on the Nile','{"fr": "Une heure au bord du Nil", "es": "Una hora junto al Nilo", "ro": "O oră pe malul Nilului"}'::jsonb,'اتفقوا على مكان على الكورنيش، هاتوا أكياس وجوانتيات، ونضفوا ساعة واحدة وصوّروا قبل وبعد.','Pick a spot on the corniche, bring bags and gloves, clean for one hour, photograph before and after.','{"fr": "Choisissez un coin de la corniche, apportez sacs et gants, nettoyez une heure, photo avant et après.", "es": "Elegid un punto del paseo, llevad bolsas y guantes, limpiad una hora, foto antes y después.", "ro": "Alegeți un loc pe faleză, luați saci și mănuși, curățați o oră, poză înainte și după."}'::jsonb,60,'3–15',0),
('circle','EG','قعدة غروب','A sunset circle','{"fr": "Un cercle au coucher du soleil", "es": "Un círculo al atardecer", "ro": "Un cerc la apus"}'::jsonb,'اقعدوا دايرة على المغرب، وكل واحد يجاوب على سؤال واحد: إيه اللي مديك أمل الأسبوع ده؟','Sit in a circle at sunset; everyone answers one question: what gave you hope this week?','{"fr": "Asseyez-vous en cercle au coucher du soleil ; chacun répond à une question : qu’est-ce qui t’a donné de l’espoir cette semaine ?", "es": "Sentaos en círculo al atardecer; cada uno responde a una pregunta: ¿qué te dio esperanza esta semana?", "ro": "Stați în cerc la apus; fiecare răspunde la o întrebare: ce ți-a dat speranță săptămâna asta?"}'::jsonb,45,'4–10',1),
('cleanup','FR','ساعة على ضفة القناة','An hour on the canal bank','{"fr": "Une heure au bord du canal", "es": "Una hora en la orilla del canal", "ro": "O oră pe malul canalului"}'::jsonb,'اختاروا جزء من الضفة، نضفوه، وافرزوا الزجاج والبلاستيك — ووزنوا اللي جمعتوه.','Take one stretch of bank, clear it, sort glass from plastic — and weigh what you collected.','{"fr": "Prenez un tronçon de berge, nettoyez-le, triez verre et plastique — et pesez votre récolte.", "es": "Coged un tramo de orilla, limpiadlo, separad vidrio y plástico y pesad lo recogido.", "ro": "Luați o porțiune de mal, curățați-o, separați sticla de plastic — și cântăriți ce ați strâns."}'::jsonb,60,'2–12',2),
('art','FR','مشوار رسم: عشر تفاصيل','A sketch walk: ten details','{"fr": "Balade croquis : dix détails", "es": "Paseo de bocetos: diez detalles", "ro": "Plimbare cu schițe: zece detalii"}'::jsonb,'امشوا ساعة ونص، وكل واحد يرسم عشر تفاصيل صغيرة محدش بياخد باله منها، وتتفرجوا عليها في الآخر.','Walk for ninety minutes; each person sketches ten small details nobody notices, then you share them.','{"fr": "Marchez une heure et demie ; chacun croque dix petits détails que personne ne remarque, puis on partage.", "es": "Caminad noventa minutos; cada uno dibuja diez detalles que nadie mira, y luego los compartís.", "ro": "Mergeți nouăzeci de minute; fiecare schițează zece detalii pe care nu le observă nimeni, apoi le arătați."}'::jsonb,90,'2–8',3),
('cleanup','ES','ساعة على الشاطئ','An hour on the beach','{"fr": "Une heure sur la plage", "es": "Una hora en la playa", "ro": "O oră pe plajă"}'::jsonb,'روحوا بدري قبل الزحمة، ونضفوا شريط واحد من الرمل — وعدّوا أعقاب السجاير، الرقم بيصدم.','Go early, clean one strip of sand — and count the cigarette ends; the number is the shock.','{"fr": "Allez-y tôt, nettoyez une bande de sable — et comptez les mégots : le chiffre est le choc.", "es": "Id temprano, limpiad una franja de arena y contad las colillas: el número impresiona.", "ro": "Mergeți devreme, curățați o fâșie de nisip — și numărați mucurile; numărul e șocul."}'::jsonb,60,'3–20',4),
('art','ES','تبادل: أكلة وأغنية','A swap: one dish, one song','{"fr": "Un échange : un plat, une chanson", "es": "Un intercambio: un plato, una canción", "ro": "Un schimb: un fel de mâncare, un cântec"}'::jsonb,'كل واحد يجيب أكلة من بلده وأغنية، ويحكي في تلات جمل ليه هي مهمة عنده.','Everyone brings one dish from home and one song, and says in three sentences why it matters to them.','{"fr": "Chacun apporte un plat de chez lui et une chanson, et dit en trois phrases pourquoi ça compte.", "es": "Cada uno trae un plato de su tierra y una canción, y cuenta en tres frases por qué le importa.", "ro": "Fiecare aduce un fel de mâncare de acasă și un cântec și spune în trei fraze de ce contează."}'::jsonb,120,'4–15',5),
('cleanup','MD','تنضيف ضفة النهر','A riverbank clean-up','{"fr": "Nettoyage de la berge", "es": "Limpieza de la ribera", "ro": "Curățenie pe malul râului"}'::jsonb,'اختاروا جزء من الضفة أو الغابة القريبة، واتفقوا فين تحطوا الزبالة قبل ما تبدأوا.','Pick a stretch of bank or nearby wood, and agree where the bags go before you start.','{"fr": "Choisissez un bout de berge ou de bois, et décidez où iront les sacs avant de commencer.", "es": "Elegid un tramo de ribera o de bosque y acordad dónde irán las bolsas antes de empezar.", "ro": "Alegeți o porțiune de mal sau de pădure și stabiliți unde ajung sacii înainte să începeți."}'::jsonb,90,'4–20',6),
('project','MD','تبادل بذور وشتلات','A seed and seedling swap','{"fr": "Un troc de graines et de plants", "es": "Un intercambio de semillas y plantones", "ro": "Un schimb de semințe și răsaduri"}'::jsonb,'كل واحد يجيب اللي عنده زيادة ويمشي باللي محتاجه — ومعاه ورقة صغيرة بترعى إزاي.','Everyone brings what they have spare and leaves with what they need — plus a note on how to grow it.','{"fr": "Chacun apporte son surplus et repart avec ce qu’il lui faut, avec un mot sur comment le cultiver.", "es": "Cada uno trae lo que le sobra y se lleva lo que necesita, con una nota de cómo cuidarlo.", "ro": "Fiecare aduce ce-i prisosește și pleacă cu ce-i trebuie — plus un bilet despre cum se îngrijește."}'::jsonb,null,'5–25',7),
('cleanup','HU','ساعة على الدانوب','An hour on the Danube','{"fr": "Une heure au bord du Danube", "es": "Una hora junto al Danubio", "ro": "O oră pe malul Dunării"}'::jsonb,'نضفوا جزء من الضفة، وشوفوا أكتر حاجة اتكررت — دي اللي تستاهل تتحكي بعد كده.','Clean a stretch of bank and note the single most common item — that is the story worth telling after.','{"fr": "Nettoyez un bout de berge et notez l’objet le plus fréquent : c’est lui qui raconte l’histoire.", "es": "Limpiad un tramo de orilla y anotad el objeto más repetido: esa es la historia que contar.", "ro": "Curățați o porțiune de mal și notați obiectul cel mai des întâlnit — asta e povestea."}'::jsonb,60,'3–15',8),
('project','HU','مقهى التصليح','A repair café','{"fr": "Un café réparation", "es": "Un café de reparaciones", "ro": "O cafenea a reparațiilor"}'::jsonb,'اقعدوا سوا ساعتين وصلّحوا حاجات مكسورة بدل ما ترموها — وكل واحد يعلّم اللي جنبه حاجة.','Sit together for two hours mending broken things instead of binning them — and teach each other as you go.','{"fr": "Deux heures ensemble à réparer au lieu de jeter — et chacun apprend quelque chose à son voisin.", "es": "Dos horas juntos arreglando cosas rotas en vez de tirarlas, enseñándoos unos a otros.", "ro": "Două ore împreună, reparând lucruri stricate în loc să le aruncați — și învățându-vă unii pe alții."}'::jsonb,null,'4–12',9),
('cleanup','CZ','مشوار غابة بكيس','A forest walk with a bag','{"fr": "Balade en forêt avec un sac", "es": "Paseo por el bosque con una bolsa", "ro": "O plimbare în pădure cu un sac"}'::jsonb,'امشوا المسار المعتاد ومعاكم كيس، والقاعدة الوحيدة: مترجعوش وهو فاضي.','Walk the usual trail carrying a bag; the only rule is that you do not come back with it empty.','{"fr": "Marchez le sentier habituel avec un sac ; seule règle : ne pas revenir les mains vides.", "es": "Recorred el sendero de siempre con una bolsa; la única regla es no volver con ella vacía.", "ro": "Mergeți pe traseul obișnuit cu un sac; singura regulă e să nu vă întoarceți cu el gol."}'::jsonb,90,'2–15',10),
('circle','CZ','دايرة الاختلاف','The differences circle','{"fr": "Le cercle des différences", "es": "El círculo de las diferencias", "ro": "Cercul diferențelor"}'::jsonb,'كل واحد يحكي حاجة من ثقافته الناس بتفهمها غلط — والباقي بيسمعوا بس، من غير جدال.','Each person names one thing from their culture that outsiders misread — and the rest only listen, no debate.','{"fr": "Chacun cite une chose de sa culture souvent mal comprise — les autres écoutent, sans débat.", "es": "Cada uno nombra algo de su cultura que se malinterpreta, y los demás solo escuchan, sin debate.", "ro": "Fiecare spune un lucru din cultura lui care e înțeles greșit — ceilalți doar ascultă, fără dezbatere."}'::jsonb,45,'4–10',11),
('project',null,'نفس اليوم، بلدين','Same day, two countries','{"fr": "Le même jour, deux pays", "es": "El mismo día, dos países", "ro": "Aceeași zi, două țări"}'::jsonb,'اتفقوا مع مجموعة في بلد تانية تعملوا نفس التنضيف في نفس اليوم، وتتبادلوا الصور والأرقام بعده.','Agree with a group in another country to clean on the same day, then swap photographs and numbers after.','{"fr": "Convenez avec un groupe d’un autre pays de nettoyer le même jour, puis échangez photos et chiffres.", "es": "Acordad con un grupo de otro país limpiar el mismo día y luego intercambiad fotos y cifras.", "ro": "Puneți-vă de acord cu un grup din altă țară să curățați în aceeași zi, apoi faceți schimb de poze și cifre."}'::jsonb,null,'6–30',12),
('cleanup',null,'قاعدة الربع ساعة','The quarter-hour rule','{"fr": "La règle du quart d’heure", "es": "La regla del cuarto de hora", "ro": "Regula sfertului de oră"}'::jsonb,'في أي مكان إنت فيه: ربع ساعة، كيس واحد، وامشي. أصغر حاجة ممكن تبدأ بيها.','Wherever you already are: fifteen minutes, one bag, then go. The smallest possible start.','{"fr": "Là où vous êtes déjà : quinze minutes, un sac, et voilà. Le plus petit début possible.", "es": "Donde ya estés: quince minutos, una bolsa, y ya. El comienzo más pequeño posible.", "ro": "Oriunde ești deja: cincisprezece minute, un sac, atât. Cel mai mic început posibil."}'::jsonb,15,'1–3',13),
('art',null,'صور: قبل وبعد','Before and after, on a wall','{"fr": "Avant / après, sur un mur", "es": "Antes y después, en una pared", "ro": "Înainte și după, pe un perete"}'::jsonb,'اعملوا معرض صغير من صور قبل وبعد التنضيفات — في مقهى، في مدرسة، أو على حيطة.','Make a small show of before-and-after photographs from your clean-ups: a café, a school, a wall.','{"fr": "Montez une petite expo de photos avant/après de vos nettoyages : un café, une école, un mur.", "es": "Montad una pequeña muestra de fotos antes y después de vuestras limpiezas: un café, una escuela, un muro.", "ro": "Faceți o mică expoziție cu poze înainte/după de la curățenii: o cafenea, o școală, un perete."}'::jsonb,60,'3–12',14);

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  عقول خضرا · GREEN MINDS — the questions
--
--  Ayser: "awesrness about pollution and respecting our differnses
--  and cultures thoughts beleives."
--
--  The green corner already lets somebody start a clean-up and put
--  their name to it. This is the other half he asked for: the part
--  that teaches, without a lecture and without frightening anybody.
--
--  ── HOW THESE ARE WRITTEN ────────────────────────────────────────
--  Every number here is one that is widely published and easy to
--  check — the cigarette end being the most collected item on a
--  beach, the twelve minutes a plastic bag is carried, the ~95% of
--  the energy saved by recycling a can, the third of crops that
--  depend on pollinators. Nothing is invented to sound worse than it
--  is, and no wrong answer is a joke at anybody's expense.
--
--  A third of them are not about rubbish at all. They are about
--  people: what Erasmus is, what the rule is in a reflection circle,
--  what you do when somebody says something you disagree with. Those
--  are the ones Ayser actually asked for, and they are the reason
--  this pack is not just a recycling quiz.
--
--  Sixteen are written; a room draws fifteen. The spare one is why
--  two rounds are not the same round.
--
--  ── AND WHAT IT REFUSES TO DO ────────────────────────────────────
--  It does not tell anybody their country is the problem. Six
--  countries are in the green corner and none of them is the villain
--  of a question here. Pollution is the subject; a nationality never
--  is.
--
--  Written in the five play languages, with the line that teaches
--  underneath each answer, so getting it wrong is still worth
--  something.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions where pack_id = 'ffff6666-0000-4000-8000-000000000001';
delete from public.game_packs where id = 'ffff6666-0000-4000-8000-000000000001';

-- country is null on purpose: this one belongs to nobody's country.
-- The green corner spans six of them, and a pack tagged EG would sort
-- to the bottom of the shelf for everybody outside Egypt — which is
-- exactly the wrong half of the world for these questions.
insert into public.game_packs (id, title_ar, title_en, description_ar, description_en,
                               category, country, is_official, visibility) values
 ('ffff6666-0000-4000-8000-000000000001','عقول خضرا','Green Minds',
  'التلوث والطبيعة واحترام اختلافنا — ١٥ سؤال كل جولة',
  'Pollution, nature and respecting our differences — 15 a round.',
  'fun', null, true, 'public');

-- The flags on the pack card. Said in its own statement, exactly the
-- way every other pack says it, because that is the one line the
-- build reads to check the claim is true.
update public.game_packs
   set languages = array['ar','en','fr','es','ro']
 where id = 'ffff6666-0000-4000-8000-000000000001';

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('ffff6666-0000-4000-8000-000000000001',0,'أكتر حاجة بتتجمع في تنضيف الشواطئ حول العالم إيه؟','What is the most collected item in beach clean-ups worldwide?',20000,
 '[{"index":0,"text_ar":"أعقاب السجاير","text_en":"Cigarette ends"},{"index":1,"text_ar":"إطارات عربيات","text_en":"Car tyres"},{"index":2,"text_ar":"موبايلات","text_en":"Mobile phones"},{"index":3,"text_ar":"شمسيات","text_en":"Umbrellas"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',1,'كيس البلاستيك بيتستخدم في المتوسط قد إيه قبل ما يترمي؟','How long is a plastic bag used, on average, before it is thrown away?',20000,
 '[{"index":0,"text_ar":"حوالي ١٢ دقيقة","text_en":"About 12 minutes"},{"index":1,"text_ar":"حوالي أسبوع","text_en":"About a week"},{"index":2,"text_ar":"حوالي سنة","text_en":"About a year"},{"index":3,"text_ar":"حوالي عشر سنين","text_en":"About ten years"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',2,'إعادة تدوير علبة ألومنيوم واحدة بتوفر قد إيه من الطاقة؟','Recycling one aluminium can saves roughly how much energy?',20000,
 '[{"index":0,"text_ar":"حوالي ٩٥٪","text_en":"About 95%"},{"index":1,"text_ar":"حوالي ١٠٪","text_en":"About 10%"},{"index":2,"text_ar":"مفيش فرق","text_en":"None at all"},{"index":3,"text_ar":"بتستهلك أكتر","text_en":"It uses more"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',3,'أغلب البلاستيك اللي بيوصل البحر بيجي منين؟','Most of the plastic that reaches the sea arrives how?',20000,
 '[{"index":0,"text_ar":"من الأنهار","text_en":"Down rivers"},{"index":1,"text_ar":"من السفن","text_en":"From ships"},{"index":2,"text_ar":"من المطر","text_en":"With the rain"},{"index":3,"text_ar":"من الطيارات","text_en":"From aeroplanes"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',4,'الأشجار في الشارع بتقلل حرارته بحوالي كام؟','Trees along a street cool it by roughly how much?',20000,
 '[{"index":0,"text_ar":"من ٢ لـ ٨ درجات","text_en":"Between 2 and 8 degrees"},{"index":1,"text_ar":"مفيش فرق","text_en":"Not at all"},{"index":2,"text_ar":"بيسخنوه","text_en":"They warm it up"},{"index":3,"text_ar":"نص درجة","text_en":"Half a degree"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',5,'«إيراسموس» في أوروبا اسم لإيه؟','In Europe, what is “Erasmus”?',20000,
 '[{"index":0,"text_ar":"برنامج بيبعت طلاب وشباب يعيشوا ويتعلموا في بلد تانية","text_en":"A programme that sends students and young people to live and learn in another country"},{"index":1,"text_ar":"نوع من القطارات","text_en":"A kind of train"},{"index":2,"text_ar":"جايزة رياضية","text_en":"A sports prize"},{"index":3,"text_ar":"بنك","text_en":"A bank"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',6,'في «دايرة الاختلاف»، القاعدة الأساسية إيه؟','In a differences circle, what is the basic rule?',20000,
 '[{"index":0,"text_ar":"واحد يتكلم والباقي يسمعوا، من غير جدال","text_en":"One person speaks, the rest listen, and nobody argues"},{"index":1,"text_ar":"اللي يقنع الباقيين يكسب","text_en":"Whoever convinces the others wins"},{"index":2,"text_ar":"ممنوع الكلام عن الثقافة","text_en":"Culture may not be mentioned"},{"index":3,"text_ar":"لازم توافق على كل حاجة","text_en":"You must agree on everything"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',7,'الأكل اللي بيترمي في الزبالة بينتج غاز إيه؟','Food thrown into landfill produces which gas?',20000,
 '[{"index":0,"text_ar":"الميثان","text_en":"Methane"},{"index":1,"text_ar":"الأكسجين","text_en":"Oxygen"},{"index":2,"text_ar":"الهيليوم","text_en":"Helium"},{"index":3,"text_ar":"مفيش","text_en":"None"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',8,'لبس «الموضة السريعة» بيتلبس في المتوسط كام مرة قبل ما يترمي؟','A fast-fashion garment is worn how many times, on average, before being discarded?',20000,
 '[{"index":0,"text_ar":"أقل من عشر مرات","text_en":"Fewer than ten times"},{"index":1,"text_ar":"أكتر من مية مرة","text_en":"More than a hundred times"},{"index":2,"text_ar":"مرة واحدة بالظبط","text_en":"Exactly once"},{"index":3,"text_ar":"كل يوم لمدة سنة","text_en":"Every day for a year"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',9,'التلوث الضوئي بيأثر على مين بشكل مباشر؟','Light pollution most directly affects what?',20000,
 '[{"index":0,"text_ar":"الطيور المهاجرة وصغار السلاحف","text_en":"Migrating birds and baby turtles"},{"index":1,"text_ar":"الصخور","text_en":"Rocks"},{"index":2,"text_ar":"الرمل","text_en":"Sand"},{"index":3,"text_ar":"محدش","text_en":"Nothing at all"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',10,'النحل والحشرات الملقّحة مسؤولين عن حوالي كام من محاصيل الأكل؟','Bees and other pollinators are behind roughly how much of our food crops?',20000,
 '[{"index":0,"text_ar":"حوالي التلت","text_en":"About a third"},{"index":1,"text_ar":"أقل من ١٪","text_en":"Less than 1%"},{"index":2,"text_ar":"كلها","text_en":"All of it"},{"index":3,"text_ar":"ولا حاجة","text_en":"None of it"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',11,'أنهي واحدة فيهم بتتحلل أسرع؟','Which of these breaks down fastest?',20000,
 '[{"index":0,"text_ar":"قشرة موزة","text_en":"A banana skin"},{"index":1,"text_ar":"لبانة","text_en":"Chewing gum"},{"index":2,"text_ar":"كيس بلاستيك","text_en":"A plastic bag"},{"index":3,"text_ar":"علبة زجاج","text_en":"A glass bottle"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',12,'«يوم تنضيف العالم» بيحصل إمتى؟','When does World Cleanup Day happen?',20000,
 '[{"index":0,"text_ar":"كل سنة في سبتمبر","text_en":"Every year, in September"},{"index":1,"text_ar":"مرة كل عشر سنين","text_en":"Once every ten years"},{"index":2,"text_ar":"في يناير","text_en":"In January"},{"index":3,"text_ar":"مش موجود","text_en":"It does not exist"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',13,'لو محدش معاه جوانتيات في تنضيف، أحسن تصرف إيه؟','If nobody has gloves at a clean-up, what is the sensible thing to do?',20000,
 '[{"index":0,"text_ar":"اجمعوا اللي مش خطر بس، وسيبوا الزجاج والإبر للمختصين","text_en":"Pick up only what is safe and leave glass and needles to the professionals"},{"index":1,"text_ar":"اجمعوا كل حاجة بإيديكم","text_en":"Pick everything up bare-handed"},{"index":2,"text_ar":"الغوا اليوم كله","text_en":"Cancel the whole day"},{"index":3,"text_ar":"استنوا حد يجيب معدات","text_en":"Wait for somebody to bring equipment"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',14,'أحسن حاجة تعملها بصور «قبل وبعد» التنضيف؟','What is the best thing to do with before-and-after photographs of a clean-up?',20000,
 '[{"index":0,"text_ar":"تعرضها عشان حد تاني يبدأ واحدة","text_en":"Show them, so somebody else starts one"},{"index":1,"text_ar":"تمسحها","text_en":"Delete them"},{"index":2,"text_ar":"تسيبها في التليفون","text_en":"Leave them on your phone"},{"index":3,"text_ar":"تطبعها بس","text_en":"Only print them"}]',0,'double'),
('ffff6666-0000-4000-8000-000000000001',15,'لو حد في الدايرة قال حاجة إنت مش موافق عليها، إيه أول حاجة تعملها؟','Somebody in the circle says something you disagree with. What comes first?',20000,
 '[{"index":0,"text_ar":"تسمع لآخر الكلام قبل ما ترد","text_en":"Hear the whole thing before answering"},{"index":1,"text_ar":"تقاطعه","text_en":"Interrupt"},{"index":2,"text_ar":"تمشي","text_en":"Walk out"},{"index":3,"text_ar":"تصوّره","text_en":"Film them"}]',0,'standard');

update public.questions set
  text_i18n = '{"fr":"Quel est l’objet le plus ramassé lors des nettoyages de plages ?","es":"¿Cuál es el objeto más recogido en las limpiezas de playas?","ro":"Care e obiectul cel mai des adunat la curățeniile de pe plaje?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أعقاب السجاير","text_en":"Cigarette ends","text_i18n":{"fr":"Les mégots","es":"Las colillas","ro":"Mucurile de țigară"}},{"index":1,"text_ar":"إطارات عربيات","text_en":"Car tyres","text_i18n":{"fr":"Des pneus","es":"Neumáticos","ro":"Anvelope"}},{"index":2,"text_ar":"موبايلات","text_en":"Mobile phones","text_i18n":{"fr":"Des téléphones","es":"Móviles","ro":"Telefoane"}},{"index":3,"text_ar":"شمسيات","text_en":"Umbrellas","text_i18n":{"fr":"Des parapluies","es":"Paraguas","ro":"Umbrele"}}]'::jsonb,
  note_ar   = 'عقب السجارة فيه بلاستيك، وبيفضل في البيئة سنين — وده أكتر شيء بيتجمع في العالم.',
  note_en   = 'A cigarette filter is plastic, and it is the single most collected item on earth.',
  note_i18n = '{"fr":"Un filtre de cigarette est en plastique, et c’est l’objet le plus ramassé au monde.","es":"El filtro de un cigarrillo es plástico, y es el objeto más recogido del mundo.","ro":"Filtrul de țigară e din plastic și e cel mai adunat obiect din lume."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 0;

update public.questions set
  text_i18n = '{"fr":"Combien de temps un sac plastique sert-il en moyenne avant d’être jeté ?","es":"¿Cuánto se usa una bolsa de plástico de media antes de tirarla?","ro":"Cât se folosește o pungă de plastic, în medie, până e aruncată?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي ١٢ دقيقة","text_en":"About 12 minutes","text_i18n":{"fr":"Environ 12 minutes","es":"Unos 12 minutos","ro":"Cam 12 minute"}},{"index":1,"text_ar":"حوالي أسبوع","text_en":"About a week","text_i18n":{"fr":"Environ une semaine","es":"Una semana","ro":"Cam o săptămână"}},{"index":2,"text_ar":"حوالي سنة","text_en":"About a year","text_i18n":{"fr":"Environ un an","es":"Un año","ro":"Cam un an"}},{"index":3,"text_ar":"حوالي عشر سنين","text_en":"About ten years","text_i18n":{"fr":"Environ dix ans","es":"Unos diez años","ro":"Cam zece ani"}}]'::jsonb,
  note_ar   = 'دقايق استخدام، وقرون في الطبيعة — الفرق ده هو كل الحكاية.',
  note_en   = 'Minutes of use, centuries in the environment — that gap is the whole story.',
  note_i18n = '{"fr":"Quelques minutes d’usage, des siècles dans la nature : tout est là.","es":"Minutos de uso, siglos en la naturaleza: ahí está todo.","ro":"Minute de folosire, secole în natură — asta e toată povestea."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr":"Recycler une canette en aluminium économise à peu près combien d’énergie ?","es":"Reciclar una lata de aluminio ahorra aproximadamente cuánta energía?","ro":"Reciclarea unei doze de aluminiu economisește cam câtă energie?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي ٩٥٪","text_en":"About 95%","text_i18n":{"fr":"Environ 95 %","es":"Cerca del 95%","ro":"Cam 95%"}},{"index":1,"text_ar":"حوالي ١٠٪","text_en":"About 10%","text_i18n":{"fr":"Environ 10 %","es":"Cerca del 10%","ro":"Cam 10%"}},{"index":2,"text_ar":"مفيش فرق","text_en":"None at all","text_i18n":{"fr":"Aucune","es":"Ninguna","ro":"Deloc"}},{"index":3,"text_ar":"بتستهلك أكتر","text_en":"It uses more","text_i18n":{"fr":"Elle en consomme plus","es":"Consume más","ro":"Consumă mai mult"}}]'::jsonb,
  note_ar   = 'علبة واحدة بتوفر طاقة تشغّل تلفزيون ساعات — وده أسهل تدوير في الدنيا.',
  note_en   = 'One can saves enough energy to run a television for hours — the easiest win there is.',
  note_i18n = '{"fr":"Une canette économise de quoi faire tourner une télé des heures : le gain le plus facile qui soit.","es":"Una lata ahorra energía para tener la tele horas: la victoria más fácil que hay.","ro":"O doză economisește energie cât pentru ore de televizor — cel mai ușor câștig."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr":"La plupart du plastique qui atteint la mer arrive comment ?","es":"¿Cómo llega al mar la mayoría del plástico?","ro":"Cum ajunge în mare cea mai mare parte a plasticului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"من الأنهار","text_en":"Down rivers","text_i18n":{"fr":"Par les fleuves","es":"Por los ríos","ro":"Pe râuri"}},{"index":1,"text_ar":"من السفن","text_en":"From ships","text_i18n":{"fr":"Des navires","es":"De los barcos","ro":"De pe nave"}},{"index":2,"text_ar":"من المطر","text_en":"With the rain","text_i18n":{"fr":"Avec la pluie","es":"Con la lluvia","ro":"Cu ploaia"}},{"index":3,"text_ar":"من الطيارات","text_en":"From aeroplanes","text_i18n":{"fr":"Des avions","es":"De los aviones","ro":"Din avioane"}}]'::jsonb,
  note_ar   = 'اللي بيترمي في الشارع بيروح للنهر، والنهر بيوديه البحر — والنيل والدانوب من ضمنهم.',
  note_en   = 'What is dropped in a street reaches a river, and the river carries it to the sea.',
  note_i18n = '{"fr":"Ce qui traîne dans une rue rejoint un fleuve, et le fleuve l’emmène à la mer.","es":"Lo que se tira en la calle llega a un río, y el río lo lleva al mar.","ro":"Ce se aruncă pe stradă ajunge într-un râu, iar râul îl duce în mare."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 3;

update public.questions set
  text_i18n = '{"fr":"Les arbres d’une rue la rafraîchissent d’environ combien ?","es":"Los árboles de una calle la refrescan aproximadamente cuánto?","ro":"Copacii de pe o stradă o răcoresc cu aproximativ cât?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"من ٢ لـ ٨ درجات","text_en":"Between 2 and 8 degrees","text_i18n":{"fr":"De 2 à 8 degrés","es":"Entre 2 y 8 grados","ro":"Cu 2 până la 8 grade"}},{"index":1,"text_ar":"مفيش فرق","text_en":"Not at all","text_i18n":{"fr":"Pas du tout","es":"Nada","ro":"Deloc"}},{"index":2,"text_ar":"بيسخنوه","text_en":"They warm it up","text_i18n":{"fr":"Ils la réchauffent","es":"La calientan","ro":"O încălzesc"}},{"index":3,"text_ar":"نص درجة","text_en":"Half a degree","text_i18n":{"fr":"Un demi-degré","es":"Medio grado","ro":"O jumătate de grad"}}]'::jsonb,
  note_ar   = 'الظل والتبخر بيعملوا الفرق — عشان كده الشارع المشجّر بيبان أبرد فعلاً.',
  note_en   = 'Shade and evaporation do it — which is why a tree-lined street really is cooler.',
  note_i18n = '{"fr":"L’ombre et l’évaporation font le travail : une rue plantée est vraiment plus fraîche.","es":"La sombra y la evaporación lo hacen: una calle con árboles es de verdad más fresca.","ro":"Umbra și evaporarea fac treaba — o stradă cu copaci chiar e mai răcoroasă."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 4;

update public.questions set
  text_i18n = '{"fr":"En Europe, qu’est-ce qu’« Erasmus » ?","es":"En Europa, ¿qué es “Erasmus”?","ro":"În Europa, ce este „Erasmus”?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"برنامج بيبعت طلاب وشباب يعيشوا ويتعلموا في بلد تانية","text_en":"A programme that sends students and young people to live and learn in another country","text_i18n":{"fr":"Un programme qui envoie étudiants et jeunes vivre et apprendre dans un autre pays","es":"Un programa que envía a estudiantes y jóvenes a vivir y aprender en otro país","ro":"Un program care trimite studenți și tineri să trăiască și să învețe în altă țară"}},{"index":1,"text_ar":"نوع من القطارات","text_en":"A kind of train","text_i18n":{"fr":"Un type de train","es":"Un tipo de tren","ro":"Un fel de tren"}},{"index":2,"text_ar":"جايزة رياضية","text_en":"A sports prize","text_i18n":{"fr":"Un prix sportif","es":"Un premio deportivo","ro":"Un premiu sportiv"}},{"index":3,"text_ar":"بنك","text_en":"A bank","text_i18n":{"fr":"Une banque","es":"Un banco","ro":"O bancă"}}]'::jsonb,
  note_ar   = 'اتسمى على مفكر هولندي عاش في كذا بلد — والفكرة نفسها إنك تتعلم بره بيتك.',
  note_en   = 'Named after a Dutch thinker who lived in several countries — the point is learning away from home.',
  note_i18n = '{"fr":"Nommé d’après un penseur néerlandais qui a vécu dans plusieurs pays : apprendre ailleurs, voilà l’idée.","es":"Lleva el nombre de un pensador neerlandés que vivió en varios países: aprender fuera de casa.","ro":"Poartă numele unui gânditor olandez care a trăit în mai multe țări: să înveți departe de casă."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 5;

update public.questions set
  text_i18n = '{"fr":"Dans un cercle des différences, quelle est la règle de base ?","es":"En un círculo de diferencias, ¿cuál es la regla básica?","ro":"Într-un cerc al diferențelor, care e regula de bază?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"واحد يتكلم والباقي يسمعوا، من غير جدال","text_en":"One person speaks, the rest listen, and nobody argues","text_i18n":{"fr":"Une personne parle, les autres écoutent, personne ne débat","es":"Habla uno, los demás escuchan y nadie discute","ro":"Vorbește unul, ceilalți ascultă, nimeni nu contrazice"}},{"index":1,"text_ar":"اللي يقنع الباقيين يكسب","text_en":"Whoever convinces the others wins","text_i18n":{"fr":"Celui qui convainc les autres gagne","es":"Gana quien convence a los demás","ro":"Câștigă cine îi convinge pe ceilalți"}},{"index":2,"text_ar":"ممنوع الكلام عن الثقافة","text_en":"Culture may not be mentioned","text_i18n":{"fr":"On ne parle pas de culture","es":"No se habla de cultura","ro":"Nu se vorbește despre cultură"}},{"index":3,"text_ar":"لازم توافق على كل حاجة","text_en":"You must agree on everything","text_i18n":{"fr":"Il faut être d’accord sur tout","es":"Hay que estar de acuerdo en todo","ro":"Trebuie să fiți de acord în toate"}}]'::jsonb,
  note_ar   = 'الاختلاف مش موضوع للجدال — الهدف تفهم مش تكسب.',
  note_en   = 'A difference is not a debate: the point is to understand, not to win.',
  note_i18n = '{"fr":"Une différence n’est pas un débat : il s’agit de comprendre, pas de gagner.","es":"Una diferencia no es un debate: se trata de entender, no de ganar.","ro":"O diferență nu e o dezbatere: scopul e să înțelegi, nu să câștigi."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 6;

update public.questions set
  text_i18n = '{"fr":"Les déchets alimentaires enfouis produisent quel gaz ?","es":"La comida que va al vertedero produce qué gas?","ro":"Mâncarea aruncată la groapă produce ce gaz?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الميثان","text_en":"Methane","text_i18n":{"fr":"Du méthane","es":"Metano","ro":"Metan"}},{"index":1,"text_ar":"الأكسجين","text_en":"Oxygen","text_i18n":{"fr":"De l’oxygène","es":"Oxígeno","ro":"Oxigen"}},{"index":2,"text_ar":"الهيليوم","text_en":"Helium","text_i18n":{"fr":"De l’hélium","es":"Helio","ro":"Heliu"}},{"index":3,"text_ar":"مفيش","text_en":"None","text_i18n":{"fr":"Aucun","es":"Ninguno","ro":"Niciunul"}}]'::jsonb,
  note_ar   = 'نفس الأكل لو اتعمل كومبوست بيبقى تربة — نفس القشرة، نتيجتين مختلفين تمامًا.',
  note_en   = 'The same peel composted becomes soil instead — same scrap, opposite outcome.',
  note_i18n = '{"fr":"La même épluchure compostée devient de la terre : même déchet, résultat inverse.","es":"La misma cáscara compostada se hace tierra: mismo resto, resultado opuesto.","ro":"Aceeași coajă, compostată, devine pământ: același rest, rezultat opus."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 7;

update public.questions set
  text_i18n = '{"fr":"Un vêtement de fast fashion est porté combien de fois en moyenne avant d’être jeté ?","es":"¿Cuántas veces se usa de media una prenda de moda rápida antes de tirarla?","ro":"De câte ori e purtată, în medie, o haină fast-fashion înainte să fie aruncată?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أقل من عشر مرات","text_en":"Fewer than ten times","text_i18n":{"fr":"Moins de dix fois","es":"Menos de diez veces","ro":"De mai puțin de zece ori"}},{"index":1,"text_ar":"أكتر من مية مرة","text_en":"More than a hundred times","text_i18n":{"fr":"Plus de cent fois","es":"Más de cien veces","ro":"De peste o sută de ori"}},{"index":2,"text_ar":"مرة واحدة بالظبط","text_en":"Exactly once","text_i18n":{"fr":"Exactement une fois","es":"Exactamente una vez","ro":"Exact o dată"}},{"index":3,"text_ar":"كل يوم لمدة سنة","text_en":"Every day for a year","text_i18n":{"fr":"Tous les jours pendant un an","es":"A diario durante un año","ro":"Zilnic timp de un an"}}]'::jsonb,
  note_ar   = 'عشان كده تبادل الهدوم فكرة كويسة: نفس القطعة بتعيش عمر تاني عند حد تاني.',
  note_en   = 'Which is why a clothes swap works: the same piece gets a second life with somebody else.',
  note_i18n = '{"fr":"D’où l’intérêt du troc de vêtements : la même pièce a une seconde vie ailleurs.","es":"Por eso funciona un intercambio de ropa: la misma prenda tiene otra vida con otra persona.","ro":"De asta merge un schimb de haine: aceeași piesă are o a doua viață la altcineva."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 8;

update public.questions set
  text_i18n = '{"fr":"La pollution lumineuse touche surtout quoi ?","es":"¿A qué afecta más directamente la contaminación lumínica?","ro":"Poluarea luminoasă afectează cel mai direct ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الطيور المهاجرة وصغار السلاحف","text_en":"Migrating birds and baby turtles","text_i18n":{"fr":"Les oiseaux migrateurs et les bébés tortues","es":"Las aves migratorias y las crías de tortuga","ro":"Păsările migratoare și puii de țestoasă"}},{"index":1,"text_ar":"الصخور","text_en":"Rocks","text_i18n":{"fr":"Les rochers","es":"Las rocas","ro":"Stâncile"}},{"index":2,"text_ar":"الرمل","text_en":"Sand","text_i18n":{"fr":"Le sable","es":"La arena","ro":"Nisipul"}},{"index":3,"text_ar":"محدش","text_en":"Nothing at all","text_i18n":{"fr":"Rien du tout","es":"Nada","ro":"Nimic"}}]'::jsonb,
  note_ar   = 'صغار السلاحف بتتبع ضوء القمر على البحر — وأضواء الشوارع بتوديهم الناحية الغلط.',
  note_en   = 'Baby turtles follow moonlight to the sea; street lights send them the wrong way.',
  note_i18n = '{"fr":"Les bébés tortues suivent la lune vers la mer ; les lampadaires les envoient à l’opposé.","es":"Las crías de tortuga siguen la luna hacia el mar; las farolas las mandan al revés.","ro":"Puii de țestoasă urmează luna spre mare; felinarele îi trimit invers."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 9;

update public.questions set
  text_i18n = '{"fr":"Les abeilles et autres pollinisateurs assurent environ quelle part de nos cultures ?","es":"¿De qué parte de los cultivos son responsables las abejas y otros polinizadores?","ro":"Albinele și ceilalți polenizatori stau în spatele cam cât din culturile noastre?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي التلت","text_en":"About a third","text_i18n":{"fr":"Environ un tiers","es":"Cerca de un tercio","ro":"Cam o treime"}},{"index":1,"text_ar":"أقل من ١٪","text_en":"Less than 1%","text_i18n":{"fr":"Moins de 1 %","es":"Menos del 1%","ro":"Sub 1%"}},{"index":2,"text_ar":"كلها","text_en":"All of it","text_i18n":{"fr":"La totalité","es":"Todos","ro":"Toate"}},{"index":3,"text_ar":"ولا حاجة","text_en":"None of it","text_i18n":{"fr":"Aucune","es":"Ninguno","ro":"Niciuna"}}]'::jsonb,
  note_ar   = 'شوية زرع على بلكونة أو في حديقة بيفرق معاهم أكتر ما تتخيل.',
  note_en   = 'A few flowering plants on a balcony matter to them more than you would think.',
  note_i18n = '{"fr":"Quelques plantes à fleurs sur un balcon comptent plus qu’on ne croit.","es":"Unas cuantas plantas con flor en un balcón les importan más de lo que crees.","ro":"Câteva plante cu flori pe balcon contează mai mult decât ai crede."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 10;

update public.questions set
  text_i18n = '{"fr":"Lequel se décompose le plus vite ?","es":"¿Cuál de estos se descompone más rápido?","ro":"Care dintre acestea se descompune cel mai repede?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"قشرة موزة","text_en":"A banana skin","text_i18n":{"fr":"Une peau de banane","es":"Una cáscara de plátano","ro":"O coajă de banană"}},{"index":1,"text_ar":"لبانة","text_en":"Chewing gum","text_i18n":{"fr":"Un chewing-gum","es":"Un chicle","ro":"O gumă de mestecat"}},{"index":2,"text_ar":"كيس بلاستيك","text_en":"A plastic bag","text_i18n":{"fr":"Un sac plastique","es":"Una bolsa de plástico","ro":"O pungă de plastic"}},{"index":3,"text_ar":"علبة زجاج","text_en":"A glass bottle","text_i18n":{"fr":"Une bouteille en verre","es":"Una botella de vidrio","ro":"O sticlă"}}]'::jsonb,
  note_ar   = 'اللبانة مطاط صناعي، والزجاج ممكن يفضل آلاف السنين — والموزة أسابيع.',
  note_en   = 'Gum is synthetic rubber and glass can last millennia; the banana skin takes weeks.',
  note_i18n = '{"fr":"Le chewing-gum est du caoutchouc synthétique et le verre peut durer des millénaires ; la banane, des semaines.","es":"El chicle es caucho sintético y el vidrio puede durar milenios; el plátano, semanas.","ro":"Guma e cauciuc sintetic, iar sticla poate dura milenii; coaja de banană, săptămâni."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 11;

update public.questions set
  text_i18n = '{"fr":"Quand a lieu le World Cleanup Day ?","es":"¿Cuándo es el Día Mundial de la Limpieza?","ro":"Când are loc Ziua Mondială a Curățeniei?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"كل سنة في سبتمبر","text_en":"Every year, in September","text_i18n":{"fr":"Chaque année, en septembre","es":"Cada año, en septiembre","ro":"În fiecare an, în septembrie"}},{"index":1,"text_ar":"مرة كل عشر سنين","text_en":"Once every ten years","text_i18n":{"fr":"Une fois tous les dix ans","es":"Una vez cada diez años","ro":"O dată la zece ani"}},{"index":2,"text_ar":"في يناير","text_en":"In January","text_i18n":{"fr":"En janvier","es":"En enero","ro":"În ianuarie"}},{"index":3,"text_ar":"مش موجود","text_en":"It does not exist","text_i18n":{"fr":"Il n’existe pas","es":"No existe","ro":"Nu există"}}]'::jsonb,
  note_ar   = 'ملايين بيطلعوا في نفس اليوم في أكتر من ١٩٠ بلد — وممكن تبقى واحد منهم.',
  note_en   = 'Millions turn out on the same day in more than 190 countries — you can be one of them.',
  note_i18n = '{"fr":"Des millions de gens sortent le même jour dans plus de 190 pays. Vous pouvez en être.","es":"Millones salen el mismo día en más de 190 países. Puedes ser uno.","ro":"Milioane de oameni ies în aceeași zi în peste 190 de țări — poți fi unul dintre ei."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 12;

update public.questions set
  text_i18n = '{"fr":"Si personne n’a de gants lors d’un nettoyage, que faire ?","es":"Si nadie tiene guantes en una limpieza, ¿qué es lo sensato?","ro":"Dacă nimeni nu are mănuși la o curățenie, ce e de făcut?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اجمعوا اللي مش خطر بس، وسيبوا الزجاج والإبر للمختصين","text_en":"Pick up only what is safe and leave glass and needles to the professionals","text_i18n":{"fr":"Ramassez seulement ce qui est sûr et laissez le verre et les seringues aux professionnels","es":"Recoged solo lo seguro y dejad el vidrio y las agujas a los profesionales","ro":"Adunați doar ce e sigur și lăsați sticla și acele profesioniștilor"}},{"index":1,"text_ar":"اجمعوا كل حاجة بإيديكم","text_en":"Pick everything up bare-handed","text_i18n":{"fr":"Tout ramasser à mains nues","es":"Recogerlo todo con las manos","ro":"Adunați totul cu mâna goală"}},{"index":2,"text_ar":"الغوا اليوم كله","text_en":"Cancel the whole day","text_i18n":{"fr":"Tout annuler","es":"Cancelar el día","ro":"Anulați ziua"}},{"index":3,"text_ar":"استنوا حد يجيب معدات","text_en":"Wait for somebody to bring equipment","text_i18n":{"fr":"Attendre que quelqu’un apporte du matériel","es":"Esperar a que alguien traiga material","ro":"Așteptați să aducă cineva echipament"}}]'::jsonb,
  note_ar   = 'التنضيف مش لازم يكون كامل عشان يفرق — والأمان أهم من الرقم.',
  note_en   = 'A clean-up does not have to be complete to matter, and safety beats the total.',
  note_i18n = '{"fr":"Un nettoyage n’a pas besoin d’être complet pour compter ; la sécurité passe avant le chiffre.","es":"Una limpieza no tiene que ser completa para valer; la seguridad va antes que la cifra.","ro":"O curățenie nu trebuie să fie completă ca să conteze; siguranța trece înaintea cifrei."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 13;

update public.questions set
  text_i18n = '{"fr":"Que faire de mieux avec les photos avant/après d’un nettoyage ?","es":"¿Qué es lo mejor que puedes hacer con las fotos de antes y después?","ro":"Ce e cel mai bine să faci cu pozele dinainte și de după?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"تعرضها عشان حد تاني يبدأ واحدة","text_en":"Show them, so somebody else starts one","text_i18n":{"fr":"Les montrer, pour que quelqu’un d’autre se lance","es":"Enseñarlas, para que otro empiece una","ro":"Să le arăți, ca să înceapă și altcineva"}},{"index":1,"text_ar":"تمسحها","text_en":"Delete them","text_i18n":{"fr":"Les effacer","es":"Borrarlas","ro":"Să le ștergi"}},{"index":2,"text_ar":"تسيبها في التليفون","text_en":"Leave them on your phone","text_i18n":{"fr":"Les laisser sur le téléphone","es":"Dejarlas en el móvil","ro":"Să le lași în telefon"}},{"index":3,"text_ar":"تطبعها بس","text_en":"Only print them","text_i18n":{"fr":"Seulement les imprimer","es":"Solo imprimirlas","ro":"Doar să le printezi"}}]'::jsonb,
  note_ar   = 'أغلب اللي بيشاركوا أول مرة بيجوا لأنهم شافوا حد يعرفوه عمل كده.',
  note_en   = 'Most first-timers come because they saw somebody they know do it.',
  note_i18n = '{"fr":"La plupart des débutants viennent parce qu’ils ont vu quelqu’un qu’ils connaissent le faire.","es":"La mayoría de los novatos vienen porque vieron a alguien conocido hacerlo.","ro":"Cei mai mulți vin prima dată pentru că au văzut pe cineva cunoscut făcând-o."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 14;

update public.questions set
  text_i18n = '{"fr":"Quelqu’un dit dans le cercle une chose avec laquelle vous n’êtes pas d’accord. On fait quoi d’abord ?","es":"Alguien en el círculo dice algo con lo que no estás de acuerdo. ¿Qué va primero?","ro":"Cineva din cerc spune ceva cu care nu ești de acord. Ce faci întâi?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"تسمع لآخر الكلام قبل ما ترد","text_en":"Hear the whole thing before answering","text_i18n":{"fr":"Écouter jusqu’au bout avant de répondre","es":"Escuchar hasta el final antes de responder","ro":"Asculți până la capăt înainte să răspunzi"}},{"index":1,"text_ar":"تقاطعه","text_en":"Interrupt","text_i18n":{"fr":"L’interrompre","es":"Interrumpir","ro":"Îl întrerupi"}},{"index":2,"text_ar":"تمشي","text_en":"Walk out","text_i18n":{"fr":"Partir","es":"Irte","ro":"Pleci"}},{"index":3,"text_ar":"تصوّره","text_en":"Film them","text_i18n":{"fr":"Le filmer","es":"Grabarlo","ro":"Îl filmezi"}}]'::jsonb,
  note_ar   = 'السماع لآخره مش موافقة — هو بس الفرق بين حوار وخناقة.',
  note_en   = 'Hearing somebody out is not agreeing with them; it is the difference between a talk and a row.',
  note_i18n = '{"fr":"Écouter jusqu’au bout n’est pas approuver : c’est la différence entre une conversation et une dispute.","es":"Escuchar hasta el final no es estar de acuerdo: es la diferencia entre una charla y una bronca.","ro":"Să asculți până la capăt nu înseamnă să fii de acord: e diferența dintre discuție și ceartă."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 15;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE RIGHT ANSWER WAS ALWAYS THE FIRST BUTTON
--
--  Every question in the game — all of them, across every pack — was
--  written with the correct choice first and stored that way:
--
--      select correct_index, count(*) from questions group by 1;
--       0 | 206
--
--  Nothing in the app shuffles them. The view hands the four choices
--  to the phone in the order they are stored, and the phone draws them
--  in that order. So the top button was right two hundred and six
--  times out of two hundred and six.
--
--  That is not a small bug. A quiz whose answer is always in the same
--  place is not a quiz: one player notices in the first round, taps
--  the top button for the rest of the night, wins every game, and the
--  table stops playing. It cannot be seen by reading a single
--  question, only by counting them all, which is why it survived
--  thirty schema files.
--
--  ── HOW THIS FIXES IT ────────────────────────────────────────────
--  Each question's four choices are put in a new order, and its
--  correct_index moves with them. Nobody's answer changes meaning:
--  the phone sends the POSITION it was tapped, and the position it
--  was tapped is the position that is now stored.
--
--  ── WHY IT IS NOT ACTUALLY RANDOM ────────────────────────────────
--  The new order is a hash of the pack, the question's number in it,
--  and the choice's own authored number — so it is scrambled, but the
--  SAME scramble every time this file runs. Two reasons that matters:
--
--    · This file is applied on every deploy. A genuinely random
--      shuffle would deal the choices again under any room that
--      happened to be mid-question, and somebody's tap would land on
--      a different answer than the one they read.
--    · Running it twice must not undo it. The order is computed from
--      each choice's own "index" field — the number it was written
--      with, which this never rewrites — and not from where the
--      choice currently sits. So the second run computes the same
--      arrangement and changes nothing.
--
--  The app has never read that "index" field: QuestionCard and Stage
--  both use the position in the array. It survives here purely as the
--  choice's name, which is what makes re-running safe.
--
--  Anything oddly shaped — no choices, choices without their number,
--  two choices sharing one, a correct_index pointing past the end —
--  is left exactly as it is rather than guessed at.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

/* A FUNCTION, not a bare block, so that a file added AFTER this one
   can re-deal the questions it just wrote. The first version was an
   anonymous DO block, which meant every later pack would have been
   inserted with its answer first and never shuffled — and it would
   have been invisible: a handful of unshuffled questions among a
   hundred shuffled ones does not move the share enough to trip the
   build's check. Adding four questions was about to do exactly that.

   Not security definer, and execute is taken off PUBLIC below: this
   rewrites rows, and nothing a signed-in player can call has any
   business doing that. It is for the setup run, which is the owner. */
create or replace function public.lamma_spread_answers()
returns int
language plpgsql as $$
declare
  r         record;
  reordered jsonb;
  seed      text;
  named     int;   -- the correct choice's own number, before moving
  landed    int;   -- where it sits once the four are re-dealt
  moved     int := 0;
  skipped   int := 0;
begin
  for r in select id, pack_id, order_index, options, correct_index
             from public.questions loop

    seed := r.pack_id::text || '/' || r.order_index::text || '/';

    if jsonb_typeof(r.options) is distinct from 'array'
       or jsonb_array_length(r.options) < 2
       or r.correct_index is null
       or r.correct_index < 0
       or r.correct_index >= jsonb_array_length(r.options)
       or exists (select 1 from jsonb_array_elements(r.options) as t(e)
                   where t.e->>'index' is null)
       or (select count(distinct t.e->>'index') from jsonb_array_elements(r.options) as t(e))
          <> jsonb_array_length(r.options) then
      skipped := skipped + 1;
      continue;
    end if;

    named := (r.options -> r.correct_index ->> 'index')::int;

    select jsonb_agg(t.e order by md5(seed || (t.e->>'index')))
      into reordered
      from jsonb_array_elements(r.options) as t(e);

    select s.pos - 1 into landed from (
      select row_number() over (order by md5(seed || (t.e->>'index'))) as pos, t.e
        from jsonb_array_elements(r.options) as t(e)) s
     where (s.e->>'index')::int = named;

    if reordered is distinct from r.options or landed is distinct from r.correct_index then
      update public.questions
         set options = reordered, correct_index = landed
       where id = r.id;
      moved := moved + 1;
    end if;
  end loop;

  /* This counts rows changed since the inserts higher up in this same
     file put them back in authored order — not drift between runs.
     Every run re-inserts, then re-deals to the same arrangement, so
     this number stays roughly constant and the questions do not move.
     Measured: three consecutive applications, identical every time. */
  raise notice 'spread the answers: % question(s) moved off the authored order, % left alone', moved, skipped;
  return moved;
end $$;

revoke all on function public.lamma_spread_answers() from public;

select public.lamma_spread_answers();

-- ── AND IT MUST NOT COME BACK ──────────────────────────────────────
-- The fix above is data, not code, so the next pack somebody writes
-- with the answer first would be wrong again the moment it is added
-- after this line. Rather than trusting that nobody does that, the
-- file refuses to finish if the answers are bunched up. The build
-- checks the same thing against a real database (check-sql-twice.sh),
-- so it is caught before a deploy rather than after one.
do $$
declare
  n_all   int;
  n_first int;
  n_kinds int;
begin
  select count(*), count(*) filter (where correct_index = 0), count(distinct correct_index)
    into n_all, n_first, n_kinds
    from public.questions;

  if n_all = 0 then return; end if;   -- nothing loaded yet; nothing to say

  if n_kinds < 3 or n_first::numeric / n_all > 0.45 then
    raise exception 'The right answer sits in only % position(s), and is the first button % of % times. A quiz like that is solved by tapping the top button.',
      n_kinds, n_first, n_all;
  end if;
end $$;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A CLOSED ROOM, AND THE SEAT NOBODY CAN TAKE
--
--  Ayser: "Make it a close room for the Egyptian room and make my
--  account Ayser that only can control it we all enter the live
--  questions together in the same time then ranking."
--
--  Two different things were hiding in that sentence, and only one of
--  them existed.
--
--  ── THE DOOR ─────────────────────────────────────────────────────
--  Already there: a room has a code, and the host can lock it so no
--  new person walks in. That is the "closed" half, and it works.
--
--  ── THE SEAT ─────────────────────────────────────────────────────
--  This is the half that did not. lamma_claim_host exists so a room
--  survives its host's phone dying: if the host has been gone a while,
--  the longest-seated player is promoted and the night continues. That
--  is right for a game between friends and WRONG for the room Ayser is
--  describing, where he is running the evening on a shared screen. His
--  phone locking its screen for ninety seconds was enough for somebody
--  else to become host and start advancing his questions.
--
--  So a host may now BOLT THE SEAT. While it is bolted:
--    · claim_host refuses, with a reason that says why
--    · every other host power is unchanged — the host still controls
--      the clock, the door, the round and when the questions move
--
--  It is off by default. A room with the seat bolted and a host who
--  really has gone is a room nobody can advance, and that is a worse
--  evening than the one this prevents — so it is a choice made on
--  purpose by somebody sitting in front of the screen, never a default
--  somebody inherits.
--
--  ── WHY NOT "ONLY AYSER'S ACCOUNT" IN SO MANY WORDS ──────────────
--  Writing one email address into the database would give him this
--  room and nobody else a room of their own — and the moment he signed
--  in on another address, his own game would lock him out. Whoever
--  starts the room holds it; he starts the Egyptian room, so it is
--  his. Same outcome, and it cannot strand him.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms add column if not exists host_locked boolean not null default false;

-- ── THE SEAT ───────────────────────────────────────────────────────
-- Same promotion rule as before, with one refusal in front of it.
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

  -- the host said this room is theirs to run, and meant it
  if r.host_locked then
    return jsonb_build_object('ok', false, 'reason', 'host_locked');
  end if;

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

-- ── THE HOST'S SETTINGS, PLUS THE BOLT ─────────────────────────────
-- Dropped and recreated rather than overloaded: two functions with the
-- same name and a different number of arguments is "function is not
-- unique" at three in the morning. Same lesson as v25.
drop function if exists public.lamma_set_room(uuid, int, boolean, int, boolean);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean,
                                                 p_round int, p_read_first boolean,
                                                 p_host_locked boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;
  if p_round is not null and p_round not in (0, 10, 15, 25) then
    return jsonb_build_object('ok', false, 'reason', 'bad_round');
  end if;
  if p_round is not null and r.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  update public.game_rooms
     set timer_ms    = coalesce(p_timer_ms, timer_ms),
         locked      = coalesce(p_locked, locked),
         read_first  = coalesce(p_read_first, read_first),
         host_locked = coalesce(p_host_locked, host_locked),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'read_first', r.read_first, 'host_locked', r.host_locked,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int, boolean, boolean) to authenticated;

-- ── AND EVERY PHONE IS TOLD ────────────────────────────────────────
-- A rule nobody can see is a rule that looks like a bug. The players
-- get host_locked in sync so the screen can say, in words, that this
-- room has one host and it is not up for grabs.
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

  if r.question_ids is not null and r.current_question_index >= 0
     and r.current_question_index < coalesce(array_length(r.question_ids, 1), 0) then
    qid := r.question_ids[r.current_question_index + 1];
  else
    select id into qid from public.questions
     where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;

  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'question_ids', coalesce(to_jsonb(r.question_ids), '[]'::jsonb),
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'host_locked', r.host_locked,
    'timer_ms', r.timer_ms,
    'read_first', r.read_first,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected,
                                          'avatar_key', avatar_key)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  تعرف مصر؟ · FOUR OF SARA'S, SWAPPED IN
--
--  Sara Zekralla sent ten questions and Ayser asked: if any are good,
--  trade them for ones already in the pack.
--
--  All ten are true — I checked each one. But SEVEN of them the pack
--  already asks, sometimes almost word for word: Carter and the tomb
--  (q4), the Sphinx's body (q6), the Rosetta Stone (q8), the library
--  at Alexandria (q27), Khufu and the Great Pyramid (q20), papyrus
--  (q15), and the Suez Canal (q9, q24). Adding those would mean a
--  fifteen-question round that asks about the Rosetta Stone twice.
--
--  Three are ground the pack has never covered at all:
--
--    · the FIRST CAPITAL — Narmer and Memphis. The pack starts at the
--      pyramids and had nothing before them.
--    · the GODS — Ra. Fifty-three questions about Egypt and not one
--      about what anybody believed.
--    · the SEASONS — Akhet, the flood. The pack mentions the Nile
--      constantly and never says what it did to the year.
--
--  And one of hers is simply sharper than ours: we asked which CENTURY
--  the Suez Canal opened in, which anybody can reason out. She asked
--  the year. Hers replaces ours.
--
--  ── WHAT GOES, AND WHY ───────────────────────────────────────────
--  Swapped, as asked, rather than piled on — the pack stays at 53.
--  The three that leave are the three that were free points:
--
--    q1  "Which river runs through Egypt?"       (the Nile)
--    q2  "What is the capital of Egypt?"         (Cairo)
--    q21 "What is the official language?"        (Arabic)
--
--  Nobody has ever got one of those wrong, and a question nobody gets
--  wrong teaches nothing and costs twenty seconds. Plenty of gentle
--  ones remain — the currency, the seas, the borders, koshari.
--
--  AYSER: if you want any of those three back, say so and they come
--  back. They are three lines.
--
--  Written in the five play languages, each with the line that teaches
--  underneath. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index in (1, 2, 21, 24);

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',1,'الملك نارمر أسس أول عاصمة لمصر حوالي سنة ٣١٠٠ ق.م — اسمها كان إيه؟','King Narmer founded Egypt’s first capital around 3100 BCE. What was it called?',20000,
 '[{"index":0,"text_ar":"منف","text_en":"Memphis"},{"index":1,"text_ar":"طيبة","text_en":"Thebes"},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":3,"text_ar":"الكرنك","text_en":"Karnak"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',2,'مين إله الشمس عند المصريين القدماء، اللي بيترسم براس صقر وقرص شمس فوقه؟','Who was the sun god of ancient Egypt, drawn with a hawk’s head and a sun disc?',20000,
 '[{"index":0,"text_ar":"رع","text_en":"Ra"},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris"},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis"},{"index":3,"text_ar":"سوبك","text_en":"Sobek"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',21,'المصريين القدماء كانوا بيسموا موسم فيضان النيل إيه؟','What did the ancient Egyptians call the season of the Nile flood?',20000,
 '[{"index":0,"text_ar":"آخت","text_en":"Akhet"},{"index":1,"text_ar":"بيريت","text_en":"Peret"},{"index":2,"text_ar":"شيمو","text_en":"Shemu"},{"index":3,"text_ar":"حابي","text_en":"Hapi"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',24,'قناة السويس اتفتحت سنة كام؟','In what year did the Suez Canal open?',20000,
 '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869"},{"index":1,"text_ar":"١٩٠٥","text_en":"1905"},{"index":2,"text_ar":"١٧٩٨","text_en":"1798"},{"index":3,"text_ar":"١٩٥٢","text_en":"1952"}]',0,'standard');

update public.questions set
  text_i18n = '{"fr":"Le roi Narmer a fondé la première capitale de l’Égypte vers 3100 av. J.-C. Comment s’appelait-elle ?","es":"El rey Narmer fundó la primera capital de Egipto hacia el 3100 a. C. ¿Cómo se llamaba?","ro":"Regele Narmer a întemeiat prima capitală a Egiptului pe la 3100 î.Hr. Cum se numea?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"منف","text_en":"Memphis","text_i18n":{"fr":"Memphis","es":"Menfis","ro":"Memphis"}},{"index":1,"text_ar":"طيبة","text_en":"Thebes","text_i18n":{"fr":"Thèbes","es":"Tebas","ro":"Teba"}},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":3,"text_ar":"الكرنك","text_en":"Karnak","text_i18n":{"fr":"Karnak","es":"Karnak","ro":"Karnak"}}]'::jsonb,
  note_ar   = 'منف قامت عند أول الدلتا، جنب القاهرة النهاردة — وطيبة والإسكندرية جم بعدها بقرون.',
  note_en   = 'Memphis stood where the valley opens into the Delta, beside today’s Cairo. Thebes and Alexandria came centuries later.',
  note_i18n = '{"fr":"Memphis se dressait là où la vallée s’ouvre sur le Delta, près du Caire actuel. Thèbes et Alexandrie sont venues des siècles plus tard.","es":"Menfis estaba donde el valle se abre al Delta, junto al Cairo de hoy. Tebas y Alejandría llegaron siglos después.","ro":"Memphis se afla acolo unde valea se deschide spre Deltă, lângă Cairo de azi. Teba și Alexandria au venit secole mai târziu."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr":"Qui était le dieu du soleil de l’Égypte ancienne, représenté avec une tête de faucon et un disque solaire ?","es":"¿Quién era el dios del sol del antiguo Egipto, con cabeza de halcón y un disco solar?","ro":"Cine era zeul soarelui în Egiptul antic, înfățișat cu cap de șoim și un disc solar?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رع","text_en":"Ra","text_i18n":{"fr":"Rê","es":"Ra","ro":"Ra"}},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris","text_i18n":{"fr":"Osiris","es":"Osiris","ro":"Osiris"}},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis","text_i18n":{"fr":"Anubis","es":"Anubis","ro":"Anubis"}},{"index":3,"text_ar":"سوبك","text_en":"Sobek","text_i18n":{"fr":"Sobek","es":"Sobek","ro":"Sobek"}}]'::jsonb,
  note_ar   = 'رع بيعدي السما بالنهار والعالم التاني بالليل. أوزيريس للموتى، وأنوبيس للتحنيط، وسوبك هو التمساح.',
  note_en   = 'Ra crossed the sky by day and the underworld by night. Osiris ruled the dead, Anubis handled mummification, Sobek was the crocodile.',
  note_i18n = '{"fr":"Rê traversait le ciel le jour et le monde souterrain la nuit. Osiris régnait sur les morts, Anubis s’occupait de la momification, Sobek était le crocodile.","es":"Ra cruzaba el cielo de día y el inframundo de noche. Osiris reinaba sobre los muertos, Anubis se ocupaba de la momificación y Sobek era el cocodrilo.","ro":"Ra traversa cerul ziua și lumea de dincolo noaptea. Osiris domnea peste morți, Anubis se ocupa de mumificare, iar Sobek era crocodilul."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr":"Comment les anciens Égyptiens appelaient-ils la saison de la crue du Nil ?","es":"¿Cómo llamaban los antiguos egipcios a la estación de la crecida del Nilo?","ro":"Cum numeau egiptenii antici anotimpul revărsării Nilului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"آخت","text_en":"Akhet","text_i18n":{"fr":"Akhet","es":"Akhet","ro":"Akhet"}},{"index":1,"text_ar":"بيريت","text_en":"Peret","text_i18n":{"fr":"Peret","es":"Peret","ro":"Peret"}},{"index":2,"text_ar":"شيمو","text_en":"Shemu","text_i18n":{"fr":"Chemou","es":"Shemu","ro":"Shemu"}},{"index":3,"text_ar":"حابي","text_en":"Hapi","text_i18n":{"fr":"Hâpi","es":"Hapi","ro":"Hapi"}}]'::jsonb,
  note_ar   = 'السنة كانت تلات مواسم: آخت الفيضان، وبيريت الزرع، وشيمو الحصاد. وحابي ده إله الفيضان نفسه، مش الموسم.',
  note_en   = 'Their year had three seasons: Akhet the flood, Peret the growing, Shemu the harvest. Hapi was the god of the flood, not the season.',
  note_i18n = '{"fr":"Leur année comptait trois saisons : Akhet la crue, Peret les semailles, Chemou la moisson. Hâpi était le dieu de la crue, pas la saison.","es":"Su año tenía tres estaciones: Akhet la crecida, Peret la siembra, Shemu la cosecha. Hapi era el dios de la crecida, no la estación.","ro":"Anul lor avea trei anotimpuri: Akhet — revărsarea, Peret — semănatul, Shemu — recolta. Hapi era zeul revărsării, nu anotimpul."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;

update public.questions set
  text_i18n = '{"fr":"En quelle année le canal de Suez a-t-il été ouvert ?","es":"¿En qué año se abrió el canal de Suez?","ro":"În ce an a fost deschis Canalul Suez?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869","text_i18n":{"fr":"1869","es":"1869","ro":"1869"}},{"index":1,"text_ar":"١٩٠٥","text_en":"1905","text_i18n":{"fr":"1905","es":"1905","ro":"1905"}},{"index":2,"text_ar":"١٧٩٨","text_en":"1798","text_i18n":{"fr":"1798","es":"1798","ro":"1798"}},{"index":3,"text_ar":"١٩٥٢","text_en":"1952","text_i18n":{"fr":"1952","es":"1952","ro":"1952"}}]'::jsonb,
  note_ar   = 'اتفتحت في نوفمبر ١٨٦٩ بعد عشر سنين حفر، وبقت أقصر طريق بين أوروبا وآسيا.',
  note_en   = 'It opened in November 1869 after ten years of digging, and became the short way between Europe and Asia.',
  note_i18n = '{"fr":"Ouvert en novembre 1869 après dix ans de travaux, il est devenu la route courte entre l’Europe et l’Asie.","es":"Se abrió en noviembre de 1869 tras diez años de obras y se convirtió en el camino corto entre Europa y Asia.","ro":"S-a deschis în noiembrie 1869, după zece ani de săpături, devenind drumul scurt dintre Europa și Asia."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;

-- ── AND THESE FOUR GET DEALT LIKE THE REST ─────────────────────────
-- They were just written with the right answer first, which is the
-- whole thing v32 exists to undo. Without this call they would be the
-- only four questions in the game whose answer is always the top
-- button — and four out of a hundred and fourteen is far too few to
-- move the share the build checks, so nobody would have found out.
select public.lamma_spread_answers();

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  عقول خضرا · THE PHARAOH ALBUM
--
--  Ayser: "I want the photos they take of Pharo filter … this photo
--  become there emoji for the game … and I want they photos to be sent
--  to me on my chat with inspiring green minds. Create chat account
--  and send them to me from this chat. Make me able to download it."
--
--  ── WHAT THIS IS, PLAINLY ────────────────────────────────────────
--  Somebody's photograph of their own face, kept somewhere they cannot
--  see and someone else can. That is not a small feature and it is not
--  built quietly. Three rules hold it:
--
--    1. NOBODY IS MADE TO PHOTOGRAPH THEMSELVES. A pharaoh is required
--       to play an Egypt room, and a DRAWN character satisfies it just
--       as well as the camera. The person who does not want their face
--       in a stranger's album builds one instead, and plays.
--
--    2. THE SCREEN SAYS SO BEFORE IT HAPPENS. The camera and the maker
--       both say, in the player's own language, that what they keep
--       goes to the room and to the Green Minds album. Consent that
--       nobody was told about is not consent.
--
--    3. ONLY THE OWNER CAN READ IT, AND THE SERVER ENFORCES THAT. Not
--       a hidden button — a policy. Before this file the app had no
--       idea in the database who the owner was; isOwner lived in
--       JavaScript, where it protects nothing at all. Anybody who can
--       write a fetch call could have read this table.
--
--    4. AND THEY CAN TAKE IT BACK. A person may delete their own
--       photograph from the album at any time, and that deletes the
--       row, not a flag on it.
--
--  ── WHY NOT A REAL "CHAT ACCOUNT" ────────────────────────────────
--  A message needs an author, an author is a profile, and a profile is
--  a row in auth.users. Minting a fake signed-in human so it can
--  "send" things is a lie in the shape of a user — it would appear in
--  member counts, in searches, in anything that ever counts people.
--
--  So the album IS the sender. It appears in Ayser's chats as a
--  conversation from Green Minds, because that is honestly what it is:
--  the album handing him what it collected. Nothing pretends to be a
--  person who is not one.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── WHO OWNS THIS APP, ACCORDING TO THE DATABASE ───────────────────
-- A table rather than an address written into a function, so a second
-- address can be added without a schema change — and so the answer is
-- somewhere you can look, rather than inside a definition.
create table if not exists public.app_owners (
  email      text primary key,
  added_at   timestamptz not null default now()
);

alter table public.app_owners enable row level security;

insert into public.app_owners (email) values ('ayseryourlifecoach@gmail.com')
  on conflict (email) do nothing;

-- Reading the owner list is itself owner-only, and the check has to
-- bypass RLS to answer or it would ask the policy that calls it.
create or replace function public.is_app_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_owners
     where lower(email) = lower(coalesce(auth.email(), ''))
  );
$$;

grant execute on function public.is_app_owner() to authenticated;

drop policy if exists "owners read the owner list" on public.app_owners;
create policy "owners read the owner list"
  on public.app_owners for select using (public.is_app_owner());

-- ── THE ALBUM ──────────────────────────────────────────────────────
create table if not exists public.green_faces (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  nickname   text,
  room_id    uuid,
  pack_id    uuid,
  kind       text not null default 'photo' check (kind in ('photo', 'drawn')),
  image      text not null,
  created_at timestamptz not null default now()
);

create index if not exists green_faces_when on public.green_faces (created_at desc);
create index if not exists green_faces_who  on public.green_faces (user_id);

alter table public.green_faces enable row level security;

-- You may see your own. The owner may see all. Nobody else sees any.
drop policy if exists "your own face, or the owner's album" on public.green_faces;
create policy "your own face, or the owner's album"
  on public.green_faces for select
  using (user_id = auth.uid() or public.is_app_owner());

-- Taking your own photograph back is yours to do; so is the owner
-- removing something from their album.
drop policy if exists "take your own face back" on public.green_faces;
create policy "take your own face back"
  on public.green_faces for delete
  using (user_id = auth.uid() or public.is_app_owner());

-- Inserting goes through the function below, never straight at the
-- table, because the picture has to be checked first.
revoke insert on public.green_faces from anon, authenticated;
grant select, delete on public.green_faces to authenticated;

-- ── SENDING ONE ────────────────────────────────────────────────────
-- The same check lamma_set_face makes, for the same reason: this must
-- be a small picture and nothing else. A link would mean the album
-- fetches from wherever somebody points it.
create or replace function public.green_send_face(
  p_image text, p_kind text, p_nickname text, p_room_id uuid, p_pack_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n  int;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if p_image is null or p_image not like 'data:image/jpeg;base64,%' then
    return jsonb_build_object('ok', false, 'reason', 'not_a_photo');
  end if;
  if length(p_image) > 26000 then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;
  if coalesce(p_kind, '') not in ('photo', 'drawn') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;

  /* One per person per room. Changing your mind about your pharaoh
     replaces what the album holds rather than adding a second of you —
     an album with the same face four times is a worse album, and four
     copies of somebody's photograph is four times the thing to look
     after. */
  delete from public.green_faces
   where user_id = me and room_id is not distinct from p_room_id;

  insert into public.green_faces (user_id, nickname, room_id, pack_id, kind, image)
  values (me, nullif(trim(coalesce(p_nickname, '')), ''), p_room_id, p_pack_id, p_kind, p_image);

  select count(*) into n from public.green_faces where user_id = me;
  return jsonb_build_object('ok', true, 'mine', n);
end;
$$;

grant execute on function public.green_send_face(text, text, text, uuid, uuid) to authenticated;

-- ── READING THE ALBUM ──────────────────────────────────────────────
-- Owner only, and it says so rather than returning an empty list —
-- "there is nothing here" and "this is not yours to read" are
-- different sentences and the screen should not confuse them.
create or replace function public.green_album(p_limit int default 200)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not public.is_app_owner() then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  return jsonb_build_object('ok', true, 'faces', coalesce((
    select jsonb_agg(row_to_json(f) order by f.created_at desc) from (
      select g.id, g.nickname, g.kind, g.image, g.created_at,
             coalesce(p.name, g.nickname) as name, p.handle
        from public.green_faces g
        left join public.profiles p on p.id = g.user_id
       order by g.created_at desc
       limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) f), '[]'::jsonb));
end;
$$;

grant execute on function public.green_album(int) to authenticated;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  عقول خضرا · THE PROGRAMMES PEOPLE HAVE BEEN ON
--
--  Ayser: "كل الprograms exchange الي الناس حضرتها ممكن نكريت جروب
--  بيها زي Erasmus" — a group for every exchange somebody has been on.
--
--  ── IT IS A SQUAD, NOT A NEW KIND OF THING ───────────────────────
--  Moments already has group chats: squads, with members, messages,
--  invites and a thread that works. A programme that invented its own
--  chat would be a second inbox to keep in step with the first, and
--  the day they disagree is the day somebody's message goes missing.
--
--  So a programme IS a squad, with a row beside it saying what kind of
--  thing it was, where and when. Joining a programme is joining its
--  squad. Every message screen in the app already knows how to open
--  it, and nothing had to learn a new shape.
--
--  ── AND THE ONE THING THAT KILLS A FEATURE LIKE THIS ─────────────
--  Fragmentation. Four people who were on the same exchange each make
--  "Erasmus Budapest 2024" and end up in four groups of one, which is
--  lonelier than having no group at all — and it is nobody's fault,
--  they all did the obvious thing.
--
--  So creating is really CREATE-OR-JOIN. The same programme in the
--  same country in the same year is the same programme, whatever
--  capitals or spaces somebody typed, and the second person to try to
--  make it is quietly put in the first person's group and told so.
--
--  ── NOTHING IS INVENTED ──────────────────────────────────────────
--  There is no seeded list of famous programmes. The list is empty
--  until somebody says "I was on this one", and an empty list says so
--  honestly. A directory of exchanges nobody in this app has been on
--  would be a catalogue, and Ayser asked for the ones people actually
--  attended.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.programmes (
  id          uuid primary key default gen_random_uuid(),
  squad_id    uuid not null references public.squads(id) on delete cascade,
  kind        text not null check (kind in
                ('erasmus','esc','youth_exchange','training','workcamp','volunteering','study','other')),
  title       text not null,
  org         text,
  country     text,                       -- where it happened, as a code
  city        text,
  year        int,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- What makes two of these "the same programme". Written once, here,
-- so the uniqueness rule and the lookup can never drift apart.
create or replace function public.programme_key(p_title text, p_country text, p_year int)
returns text
language sql immutable as $$
  select lower(regexp_replace(coalesce(p_title, ''), '[^a-zA-Z0-9]+', '', 'g'))
      || '/' || upper(coalesce(p_country, '--'))
      || '/' || coalesce(p_year, 0)::text;
$$;

create unique index if not exists programmes_same_thing
  on public.programmes (public.programme_key(title, country, year));

create index if not exists programmes_when on public.programmes (year desc, created_at desc);

alter table public.programmes enable row level security;

-- Anyone signed in may look through them — that is the entire point:
-- you have to be able to FIND the one you were on. Writing goes
-- through the function below.
drop policy if exists "programmes are findable" on public.programmes;
create policy "programmes are findable"
  on public.programmes for select using (auth.uid() is not null);

revoke insert, update, delete on public.programmes from anon, authenticated;
grant select on public.programmes to authenticated;

-- ── ADDING ONE, OR WALKING INTO THE ONE THAT EXISTS ────────────────
create or replace function public.programme_add(
  p_kind text, p_title text, p_org text, p_country text, p_city text, p_year int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  /* v_ prefixes, and not for style. Called `title` and `country`,
     these are the names of two of the columns they are compared
     against, and Postgres refused the whole statement — "column
     reference title is ambiguous: it could refer to either a PL/pgSQL
     variable or a table column". Qualifying the column side is not
     enough; the bare side is the ambiguous one. */
  v_title   text := nullif(trim(coalesce(p_title, '')), '');
  v_country text := nullif(upper(trim(coalesce(p_country, ''))), '');
  existing  public.programmes%rowtype;
  sq        uuid;
  pid       uuid;
  face      text;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if v_title is null then return jsonb_build_object('ok', false, 'reason', 'no_title'); end if;
  if length(v_title) > 90 then return jsonb_build_object('ok', false, 'reason', 'too_long'); end if;
  if coalesce(p_kind, '') not in
     ('erasmus','esc','youth_exchange','training','workcamp','volunteering','study','other') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_country');
  end if;
  /* A year you could plausibly have been on something. Erasmus began
     in 1987; a year in the far future is a typo, and next year is a
     programme somebody has already been accepted onto. */
  if p_year is not null and (p_year < 1980 or p_year > extract(year from now())::int + 1) then
    return jsonb_build_object('ok', false, 'reason', 'bad_year');
  end if;

  -- the same thing under a different spelling is the same thing
  select * into existing from public.programmes
   where public.programme_key(programmes.title, programmes.country, programmes.year)
       = public.programme_key(v_title, v_country, p_year);

  if found then
    insert into public.squad_members (squad_id, user_id)
    values (existing.squad_id, me) on conflict do nothing;
    return jsonb_build_object('ok', true, 'id', existing.id, 'squad_id', existing.squad_id,
                              'joined_existing', true);
  end if;

  face := case p_kind
            when 'erasmus'        then '🇪🇺'
            when 'esc'            then '🤝'
            when 'youth_exchange' then '🎒'
            when 'training'       then '📘'
            when 'workcamp'       then '🛠️'
            when 'volunteering'   then '🌱'
            when 'study'          then '🎓'
            else '🌍' end;

  insert into public.squads (name, emoji) values (v_title, face) returning id into sq;

  insert into public.programmes (squad_id, kind, title, org, country, city, year, created_by)
  values (sq, p_kind, v_title, nullif(trim(coalesce(p_org, '')), ''), v_country,
          nullif(trim(coalesce(p_city, '')), ''), p_year, me)
  returning id into pid;

  insert into public.squad_members (squad_id, user_id) values (sq, me) on conflict do nothing;

  return jsonb_build_object('ok', true, 'id', pid, 'squad_id', sq, 'joined_existing', false);
end;
$$;

grant execute on function public.programme_add(text, text, text, text, text, int) to authenticated;

-- ── FINDING ONE ────────────────────────────────────────────────────
-- Everything, or one country's worth, or whatever matches what they
-- typed. Carries the member count and whether you are already in, so
-- the screen never has to ask a second question to draw a row.
create or replace function public.programme_list(
  p_q text default null, p_country text default null, p_kind text default null,
  p_limit int default 60)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  needle text := nullif(trim(coalesce(p_q, '')), '');
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;

  return jsonb_build_object('ok', true, 'programmes', coalesce((
    select jsonb_agg(row_to_json(r) order by r.people desc, r.year desc nulls last) from (
      select p.id, p.squad_id, p.kind, p.title, p.org, p.country, p.city, p.year,
             s.emoji,
             (select count(*) from public.squad_members m where m.squad_id = p.squad_id) as people,
             exists (select 1 from public.squad_members m
                      where m.squad_id = p.squad_id and m.user_id = me) as im_in
        from public.programmes p
        join public.squads s on s.id = p.squad_id
       where (needle is null
              or p.title ilike '%' || needle || '%'
              or coalesce(p.org, '')  ilike '%' || needle || '%'
              or coalesce(p.city, '') ilike '%' || needle || '%')
         and (p_country is null or p.country = upper(p_country))
         and (p_kind is null or p.kind = p_kind)
       order by p.created_at desc
       limit greatest(1, least(coalesce(p_limit, 60), 200))
    ) r), '[]'::jsonb));
end;
$$;

grant execute on function public.programme_list(text, text, text, int) to authenticated;

-- ── THE ONES YOU HAVE BEEN ON ──────────────────────────────────────
create or replace function public.programme_mine()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;

  return jsonb_build_object('ok', true, 'programmes', coalesce((
    select jsonb_agg(row_to_json(r) order by r.year desc nulls last) from (
      select p.id, p.squad_id, p.kind, p.title, p.org, p.country, p.city, p.year, s.emoji,
             (select count(*) from public.squad_members m2 where m2.squad_id = p.squad_id) as people,
             true as im_in
        from public.programmes p
        join public.squads s on s.id = p.squad_id
        join public.squad_members m on m.squad_id = p.squad_id and m.user_id = me
    ) r), '[]'::jsonb));
end;
$$;

grant execute on function public.programme_mine() to authenticated;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  مصر في ١٥ سؤال · THE ROUND, FIXED
--
--  Yasmin Elkilany sent thirteen questions and Ayser said: make the
--  round these, and keep two of the funny ones — or write two new ones.
--
--  ── WHY THIS IS A PACK AND NOT AN EDIT ───────────────────────────
--  "Do You Know Egypt?" has fifty-three questions and a room draws
--  fifteen of them at random. So there was no way to make Yasmin's
--  thirteen be the round: the draw would take some and leave others,
--  differently every time. Editing the big pack down to fifteen would
--  have thrown away thirty-eight good questions to get there.
--
--  A pack of exactly fifteen solves it exactly. A room draws fifteen,
--  the pack holds fifteen, so the round IS the list — in a different
--  order each time, which is the only part that should vary.
--
--  Both packs stay. Pick this one for the night you want these
--  questions; pick the big one when you want surprise.
--
--  ── TWELVE OF THESE WERE ALREADY WRITTEN ─────────────────────────
--  Nine of Yasmin's thirteen are already in the Egypt pack, several of
--  them word for word — the sayings, Sinai, the tea, and the four that
--  went in from Sara's list last week. Those are COPIED from what is
--  already there, with their translations and their teaching lines,
--  rather than retyped: retyping is how a French line drifts from the
--  Arabic one it is supposed to match.
--
--  Three are asked the other way round from ours — Yasmin asks whose
--  tomb Carter found, where we asked who found the tomb — so those
--  three are written fresh, in all five languages, with their own
--  notes.
--
--  And the two funny ones Ayser asked to keep are here: the Sphinx,
--  where one of the wrong answers is a penguin, and who founded
--  Alexandria, where one of them is "a man called Alex, obviously".
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions where pack_id = 'aaaa7777-0000-4000-8000-000000000001';
delete from public.game_packs where id = 'aaaa7777-0000-4000-8000-000000000001';

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en,
                               category, country, locale, is_official, visibility) values
 ('aaaa7777-0000-4000-8000-000000000001','مصر في ١٥ سؤال','Egypt in 15',
  'الجولة دي بالظبط — مفيش سحب عشوائي',
  'This exact round, every time — nothing left to the draw.',
  'fun','EG','ar-EG',true,'public');

update public.game_packs
   set languages = array['ar','en','fr','es','ro']
 where id = 'aaaa7777-0000-4000-8000-000000000001';

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('aaaa7777-0000-4000-8000-000000000001',0,'مقبرة أنهي فرعون لقاها هوارد كارتر كاملة تقريبًا سنة ١٩٢٢؟','Whose tomb did Howard Carter find almost untouched in 1922?',20000,
 '[{"index":0,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"},{"index":1,"text_ar":"رمسيس الثاني","text_en":"Ramses II"},{"index":2,"text_ar":"تحتمس الثالث","text_en":"Thutmose III"},{"index":3,"text_ar":"سيتي الأول","text_en":"Seti I"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',1,'الملك نارمر أسس أول عاصمة لمصر حوالي سنة ٣١٠٠ ق.م — اسمها كان إيه؟','King Narmer founded Egypt’s first capital around 3100 BCE. What was it called?',20000,
 '[{"index":0,"text_ar":"منف","text_en":"Memphis"},{"index":1,"text_ar":"طيبة","text_en":"Thebes"},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":3,"text_ar":"الكرنك","text_en":"Karnak"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',2,'مين إله الشمس عند المصريين القدماء، اللي بيترسم براس صقر وقرص شمس فوقه؟','Who was the sun god of ancient Egypt, drawn with a hawk’s head and a sun disc?',20000,
 '[{"index":0,"text_ar":"رع","text_en":"Ra"},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris"},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis"},{"index":3,"text_ar":"سوبك","text_en":"Sobek"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',3,'الهرم الأكبر في الجيزة اتبنى لمين؟','The Great Pyramid of Giza was built for whom?',20000,
 '[{"index":0,"text_ar":"خوفو","text_en":"Khufu"},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra"},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',4,'أنهي أثر اتلقى سنة ١٧٩٩ وكان مفتاح قراية الهيروغليفية؟','Which object, found in 1799, was the key to reading hieroglyphs?',20000,
 '[{"index":0,"text_ar":"حجر رشيد","text_en":"The Rosetta Stone"},{"index":1,"text_ar":"تمثال نفرتيتي","text_en":"The bust of Nefertiti"},{"index":2,"text_ar":"حجر باليرمو","text_en":"The Palermo Stone"},{"index":3,"text_ar":"قناع توت عنخ آمون","text_en":"The mask of Tutankhamun"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',5,'المصريين القدماء كانوا بيسموا موسم فيضان النيل إيه؟','What did the ancient Egyptians call the season of the Nile flood?',20000,
 '[{"index":0,"text_ar":"آخت","text_en":"Akhet"},{"index":1,"text_ar":"بيريت","text_en":"Peret"},{"index":2,"text_ar":"شيمو","text_en":"Shemu"},{"index":3,"text_ar":"حابي","text_en":"Hapi"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',6,'المصريين القدماء عملوا حاجة زي الورق من نبات بيطلع على النيل — اسمها إيه؟','The ancient Egyptians made a paper-like material from a plant of the Nile. What is it called?',20000,
 '[{"index":0,"text_ar":"البردي","text_en":"Papyrus"},{"index":1,"text_ar":"الرق","text_en":"Parchment"},{"index":2,"text_ar":"الڤيلام","text_en":"Vellum"},{"index":3,"text_ar":"القماش","text_en":"Canvas"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',7,'قناة السويس اتفتحت سنة كام؟','In what year did the Suez Canal open?',20000,
 '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869"},{"index":1,"text_ar":"١٩٠٥","text_en":"1905"},{"index":2,"text_ar":"١٧٩٨","text_en":"1798"},{"index":3,"text_ar":"١٩٥٢","text_en":"1952"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',8,'«اللي فات مات» — معناه إيه؟','“What has passed is dead” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on"},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter"},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead"},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',9,'«الباب اللي يجيلك منه الريح سده واستريح» — معناه إيه؟','“Block the door the wind comes from, and rest” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble"},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night"},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing"},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',10,'سينا عبارة عن إيه؟','Sinai is what?',20000,
 '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula"},{"index":1,"text_ar":"جزيرة","text_en":"An island"},{"index":2,"text_ar":"بحيرة","text_en":"A lake"},{"index":3,"text_ar":"مدينة","text_en":"A city"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',11,'«القرد في عين أمه غزال» — المثل ده معناه إيه؟','“A monkey is a gazelle in his mother’s eyes” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful"},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests"},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging"},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',12,'«الشاي مظبوط» يعني إيه؟','In Egypt, tea “mazbout” means what?',20000,
 '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar"},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all"},{"index":2,"text_ar":"بالحليب","text_en":"With milk"},{"index":3,"text_ar":"بارد","text_en":"Cold"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',13,'أبو الهول جسمه جسم إيه؟','The Sphinx has the body of which animal?',20000,
 '[{"index":0,"text_ar":"أسد","text_en":"A lion"},{"index":1,"text_ar":"حصان","text_en":"A horse"},{"index":2,"text_ar":"سمكة","text_en":"A fish"},{"index":3,"text_ar":"بطريق","text_en":"A penguin"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',14,'مين اللي أسّس الإسكندرية؟','Who founded Alexandria?',20000,
 '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great"},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar"},{"index":2,"text_ar":"نابليون","text_en":"Napoleon"},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously"}]',0,'double');

update public.questions set
  text_i18n = '{"fr":"De quel pharaon Howard Carter a-t-il trouvé la tombe presque intacte en 1922 ?","es":"¿De qué faraón encontró Howard Carter la tumba casi intacta en 1922?","ro":"A cărui faraon i-a găsit Howard Carter mormântul aproape neatins în 1922?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}},{"index":1,"text_ar":"رمسيس الثاني","text_en":"Ramses II","text_i18n":{"fr":"Ramsès II","es":"Ramsés II","ro":"Ramses al II-lea"}},{"index":2,"text_ar":"تحتمس الثالث","text_en":"Thutmose III","text_i18n":{"fr":"Thoutmôsis III","es":"Tutmosis III","ro":"Tutmes al III-lea"}},{"index":3,"text_ar":"سيتي الأول","text_en":"Seti I","text_i18n":{"fr":"Séthi Ier","es":"Seti I","ro":"Seti I"}}]'::jsonb,
  note_ar   = 'كانت المقبرة الوحيدة اللي وصلت شبه كاملة، وعشان كده الدنيا اتقلبت على مصر القديمة.',
  note_en   = 'It was the only royal tomb to survive nearly complete — which is why the world went mad for ancient Egypt.',
  note_i18n = '{"fr":"C’était la seule tombe royale parvenue presque complète : d’où la folie mondiale pour l’Égypte ancienne.","es":"Fue la única tumba real que llegó casi completa: por eso el mundo se volvió loco con el antiguo Egipto.","ro":"A fost singurul mormânt regal păstrat aproape întreg — de aceea lumea a înnebunit după Egiptul antic."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 0;

update public.questions set
  text_i18n = '{"fr":"Le roi Narmer a fondé la première capitale de l’Égypte vers 3100 av. J.-C. Comment s’appelait-elle ?","es":"El rey Narmer fundó la primera capital de Egipto hacia el 3100 a. C. ¿Cómo se llamaba?","ro":"Regele Narmer a întemeiat prima capitală a Egiptului pe la 3100 î.Hr. Cum se numea?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"منف","text_en":"Memphis","text_i18n":{"fr":"Memphis","es":"Menfis","ro":"Memphis"}},{"index":1,"text_ar":"طيبة","text_en":"Thebes","text_i18n":{"fr":"Thèbes","es":"Tebas","ro":"Teba"}},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":3,"text_ar":"الكرنك","text_en":"Karnak","text_i18n":{"fr":"Karnak","es":"Karnak","ro":"Karnak"}}]'::jsonb,
  note_ar   = 'منف قامت عند أول الدلتا، جنب القاهرة النهاردة — وطيبة والإسكندرية جم بعدها بقرون.',
  note_en   = 'Memphis stood where the valley opens into the Delta, beside today’s Cairo. Thebes and Alexandria came centuries later.',
  note_i18n = '{"fr":"Memphis se dressait là où la vallée s’ouvre sur le Delta, près du Caire actuel. Thèbes et Alexandrie sont venues des siècles plus tard.","es":"Menfis estaba donde el valle se abre al Delta, junto al Cairo de hoy. Tebas y Alejandría llegaron siglos después.","ro":"Memphis se afla acolo unde valea se deschide spre Deltă, lângă Cairo de azi. Teba și Alexandria au venit secole mai târziu."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr":"Qui était le dieu du soleil de l’Égypte ancienne, représenté avec une tête de faucon et un disque solaire ?","es":"¿Quién era el dios del sol del antiguo Egipto, con cabeza de halcón y un disco solar?","ro":"Cine era zeul soarelui în Egiptul antic, înfățișat cu cap de șoim și un disc solar?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رع","text_en":"Ra","text_i18n":{"fr":"Rê","es":"Ra","ro":"Ra"}},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris","text_i18n":{"fr":"Osiris","es":"Osiris","ro":"Osiris"}},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis","text_i18n":{"fr":"Anubis","es":"Anubis","ro":"Anubis"}},{"index":3,"text_ar":"سوبك","text_en":"Sobek","text_i18n":{"fr":"Sobek","es":"Sobek","ro":"Sobek"}}]'::jsonb,
  note_ar   = 'رع بيعدي السما بالنهار والعالم التاني بالليل. أوزيريس للموتى، وأنوبيس للتحنيط، وسوبك هو التمساح.',
  note_en   = 'Ra crossed the sky by day and the underworld by night. Osiris ruled the dead, Anubis handled mummification, Sobek was the crocodile.',
  note_i18n = '{"fr":"Rê traversait le ciel le jour et le monde souterrain la nuit. Osiris régnait sur les morts, Anubis s’occupait de la momification, Sobek était le crocodile.","es":"Ra cruzaba el cielo de día y el inframundo de noche. Osiris reinaba sobre los muertos, Anubis se ocupaba de la momificación y Sobek era el cocodrilo.","ro":"Ra traversa cerul ziua și lumea de dincolo noaptea. Osiris domnea peste morți, Anubis se ocupa de mumificare, iar Sobek era crocodilul."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr":"La grande pyramide de Gizeh a été bâtie pour qui ?","es":"¿Para quién se construyó la Gran Pirámide de Guiza?","ro":"Pentru cine a fost construită Marea Piramidă din Giza?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"خوفو","text_en":"Khufu","text_i18n":{"fr":"Khéops","es":"Keops","ro":"Keops"}},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra","text_i18n":{"fr":"Cléopâtre","es":"Cleopatra","ro":"Cleopatra"}},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client","text_i18n":{"fr":"Un client très exigeant","es":"Un cliente muy exigente","ro":"Un client foarte pretențios"}}]'::jsonb,
  note_ar   = 'الهرم الأكبر فضل أطول مبنى في الدنيا حوالي ٣٨٠٠ سنة.',
  note_en   = 'The Great Pyramid was the tallest building on earth for about 3,800 years.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 3;

update public.questions set
  text_i18n = '{"fr":"Quel objet, trouvé en 1799, a été la clé pour lire les hiéroglyphes ?","es":"¿Qué objeto, hallado en 1799, fue la clave para leer los jeroglíficos?","ro":"Ce obiect, găsit în 1799, a fost cheia citirii hieroglifelor?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حجر رشيد","text_en":"The Rosetta Stone","text_i18n":{"fr":"La pierre de Rosette","es":"La piedra de Rosetta","ro":"Piatra din Rosetta"}},{"index":1,"text_ar":"تمثال نفرتيتي","text_en":"The bust of Nefertiti","text_i18n":{"fr":"Le buste de Néfertiti","es":"El busto de Nefertiti","ro":"Bustul lui Nefertiti"}},{"index":2,"text_ar":"حجر باليرمو","text_en":"The Palermo Stone","text_i18n":{"fr":"La pierre de Palerme","es":"La piedra de Palermo","ro":"Piatra din Palermo"}},{"index":3,"text_ar":"قناع توت عنخ آمون","text_en":"The mask of Tutankhamun","text_i18n":{"fr":"Le masque de Toutânkhamon","es":"La máscara de Tutankamón","ro":"Masca lui Tutankhamon"}}]'::jsonb,
  note_ar   = 'نفس الكلام مكتوب بتلات كتابات — واللي كان معروف منهم فك اللي مكانش معروف.',
  note_en   = 'The same text in three scripts: the one people could still read unlocked the two they could not.',
  note_i18n = '{"fr":"Le même texte en trois écritures : celle qu’on savait encore lire a ouvert les deux autres.","es":"El mismo texto en tres escrituras: la que aún se sabía leer abrió las otras dos.","ro":"Același text în trei scrieri: cea care se mai citea le-a deschis pe celelalte două."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 4;

update public.questions set
  text_i18n = '{"fr":"Comment les anciens Égyptiens appelaient-ils la saison de la crue du Nil ?","es":"¿Cómo llamaban los antiguos egipcios a la estación de la crecida del Nilo?","ro":"Cum numeau egiptenii antici anotimpul revărsării Nilului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"آخت","text_en":"Akhet","text_i18n":{"fr":"Akhet","es":"Akhet","ro":"Akhet"}},{"index":1,"text_ar":"بيريت","text_en":"Peret","text_i18n":{"fr":"Peret","es":"Peret","ro":"Peret"}},{"index":2,"text_ar":"شيمو","text_en":"Shemu","text_i18n":{"fr":"Chemou","es":"Shemu","ro":"Shemu"}},{"index":3,"text_ar":"حابي","text_en":"Hapi","text_i18n":{"fr":"Hâpi","es":"Hapi","ro":"Hapi"}}]'::jsonb,
  note_ar   = 'السنة كانت تلات مواسم: آخت الفيضان، وبيريت الزرع، وشيمو الحصاد. وحابي ده إله الفيضان نفسه، مش الموسم.',
  note_en   = 'Their year had three seasons: Akhet the flood, Peret the growing, Shemu the harvest. Hapi was the god of the flood, not the season.',
  note_i18n = '{"fr":"Leur année comptait trois saisons : Akhet la crue, Peret les semailles, Chemou la moisson. Hâpi était le dieu de la crue, pas la saison.","es":"Su año tenía tres estaciones: Akhet la crecida, Peret la siembra, Shemu la cosecha. Hapi era el dios de la crecida, no la estación.","ro":"Anul lor avea trei anotimpuri: Akhet — revărsarea, Peret — semănatul, Shemu — recolta. Hapi era zeul revărsării, nu anotimpul."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 5;

update public.questions set
  text_i18n = '{"fr":"Les anciens Égyptiens fabriquaient une matière proche du papier avec une plante du Nil. Son nom ?","es":"Los antiguos egipcios hacían un material parecido al papel con una planta del Nilo. ¿Cómo se llama?","ro":"Egiptenii antici făceau un material asemănător hârtiei dintr-o plantă de pe Nil. Cum se numește?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البردي","text_en":"Papyrus","text_i18n":{"fr":"Le papyrus","es":"Papiro","ro":"Papirus"}},{"index":1,"text_ar":"الرق","text_en":"Parchment","text_i18n":{"fr":"Le parchemin","es":"Pergamino","ro":"Pergament"}},{"index":2,"text_ar":"الڤيلام","text_en":"Vellum","text_i18n":{"fr":"Le vélin","es":"Vitela","ro":"Veline"}},{"index":3,"text_ar":"القماش","text_en":"Canvas","text_i18n":{"fr":"La toile","es":"Lienzo","ro":"Pânză"}}]'::jsonb,
  note_ar   = 'البردي نبات بيتقطع شرايح وبيتلزق مع بعضه — والرق والڤيلام بيتعملوا من جلد حيوان.',
  note_en   = 'Papyrus is a plant cut into strips and pressed together; parchment and vellum are animal skin.',
  note_i18n = '{"fr":"Le papyrus est une plante coupée en lanières et pressée ; parchemin et vélin sont de la peau.","es":"El papiro es una planta cortada en tiras y prensada; el pergamino y la vitela son piel.","ro":"Papirusul e o plantă tăiată fâșii și presată; pergamentul și velina sunt din piele."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 6;

update public.questions set
  text_i18n = '{"fr":"En quelle année le canal de Suez a-t-il été ouvert ?","es":"¿En qué año se abrió el canal de Suez?","ro":"În ce an a fost deschis Canalul Suez?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869","text_i18n":{"fr":"1869","es":"1869","ro":"1869"}},{"index":1,"text_ar":"١٩٠٥","text_en":"1905","text_i18n":{"fr":"1905","es":"1905","ro":"1905"}},{"index":2,"text_ar":"١٧٩٨","text_en":"1798","text_i18n":{"fr":"1798","es":"1798","ro":"1798"}},{"index":3,"text_ar":"١٩٥٢","text_en":"1952","text_i18n":{"fr":"1952","es":"1952","ro":"1952"}}]'::jsonb,
  note_ar   = 'اتفتحت في نوفمبر ١٨٦٩ بعد عشر سنين حفر، وبقت أقصر طريق بين أوروبا وآسيا.',
  note_en   = 'It opened in November 1869 after ten years of digging, and became the short way between Europe and Asia.',
  note_i18n = '{"fr":"Ouvert en novembre 1869 après dix ans de travaux, il est devenu la route courte entre l’Europe et l’Asie.","es":"Se abrió en noviembre de 1869 tras diez años de obras y se convirtió en el camino corto entre Europa y Asia.","ro":"S-a deschis în noiembrie 1869, după zece ani de săpături, devenind drumul scurt dintre Europa și Asia."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 7;

update public.questions set
  text_i18n = '{"fr":"« Ce qui est passé est mort » — que veut dire ce proverbe égyptien ?","es":"“Lo que pasó, murió” — ¿qué significa este dicho egipcio?","ro":"„Ce-a trecut a murit” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on","text_i18n":{"fr":"Laisse le passé et avance","es":"Deja atrás el pasado y sigue","ro":"Lasă trecutul și mergi mai departe"}},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter","text_i18n":{"fr":"L’histoire n’a pas d’importance","es":"La historia no importa","ro":"Istoria nu contează"}},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead","text_i18n":{"fr":"Ne parle jamais des morts","es":"No hables de los muertos","ro":"Nu vorbi despre cei morți"}},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly","text_i18n":{"fr":"Le temps passe vite","es":"El tiempo pasa rápido","ro":"Timpul trece repede"}}]'::jsonb,
  note_ar   = 'بيتقال عشان حد يبطل يفكر في اللي راح ويكمّل قدام.',
  note_en   = 'Said to stop somebody chewing over what is already done.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 8;

update public.questions set
  text_i18n = '{"fr":"« Bouche la porte d’où vient le vent, et repose-toi » — que veut dire ce proverbe égyptien ?","es":"“Tapa la puerta por donde entra el viento y descansa” — ¿qué significa este dicho egipcio?","ro":"„Astupă ușa de unde vine vântul și odihnește-te” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble","text_i18n":{"fr":"Coupe court à ce qui te cause du souci","es":"Corta de raíz lo que te causa problemas","ro":"Taie de la rădăcină ce îți face probleme"}},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night","text_i18n":{"fr":"Ferme les fenêtres la nuit","es":"Cierra las ventanas de noche","ro":"Închide ferestrele noaptea"}},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing","text_i18n":{"fr":"Dormir est ce qu’il y a de mieux","es":"Dormir es lo mejor","ro":"Somnul e cel mai bun lucru"}},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you","text_i18n":{"fr":"L’air frais fait du bien","es":"El aire fresco es bueno","ro":"Aerul curat îți face bine"}}]'::jsonb,
  note_ar   = 'نصيحة قديمة: اقطع مصدر التعب من أوله بدل ما تفضل تشيل نتيجته.',
  note_en   = 'Old advice: cut the cause off rather than carrying the consequences forever.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 9;

update public.questions set
  text_i18n = '{"fr":"Le Sinaï, c’est quoi ?","es":"¿Qué es el Sinaí?","ro":"Ce este Sinai?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula","text_i18n":{"fr":"Une péninsule","es":"Una península","ro":"O peninsulă"}},{"index":1,"text_ar":"جزيرة","text_en":"An island","text_i18n":{"fr":"Une île","es":"Una isla","ro":"O insulă"}},{"index":2,"text_ar":"بحيرة","text_en":"A lake","text_i18n":{"fr":"Un lac","es":"Un lago","ro":"Un lac"}},{"index":3,"text_ar":"مدينة","text_en":"A city","text_i18n":{"fr":"Une ville","es":"Una ciudad","ro":"Un oraș"}}]'::jsonb,
  note_ar   = 'سينا هي الجسر البري الوحيد بين أفريقيا وآسيا، وفيها أعلى جبل في مصر.',
  note_en   = 'Sinai is the only land bridge between Africa and Asia, and holds Egypt’s highest mountain.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 10;

update public.questions set
  text_i18n = '{"fr":"« Un singe est une gazelle aux yeux de sa mère » — que veut dire ce proverbe égyptien ?","es":"“Un mono es una gacela a los ojos de su madre” — ¿qué significa este dicho egipcio?","ro":"„O maimuță e o gazelă în ochii mamei ei” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful","text_i18n":{"fr":"Une mère trouve toujours son enfant beau","es":"Una madre siempre ve guapo a su hijo","ro":"O mamă își vede mereu copilul frumos"}},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests","text_i18n":{"fr":"Les singes vivent en forêt","es":"Los monos viven en el bosque","ro":"Maimuțele trăiesc în pădure"}},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging","text_i18n":{"fr":"Faites vérifier vos yeux avant de juger","es":"Hazte una revisión de la vista antes de juzgar","ro":"Verifică-ți vederea înainte să judeci"}},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey","text_i18n":{"fr":"La gazelle court plus vite que le singe","es":"La gacela es más rápida que el mono","ro":"Gazela e mai rapidă decât maimuța"}}]'::jsonb,
  note_ar   = 'المثل ده بيتقال لما حد يمدح ابنه قدام الناس — الحب بيعمي عن العيوب.',
  note_en   = 'Said when a parent brags about their child: love does not see the flaws.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 11;

update public.questions set
  text_i18n = '{"fr":"En Égypte, un thé « mazbout », c’est quoi ?","es":"En Egipto, un té “mazbout” ¿qué es?","ro":"În Egipt, un ceai „mazbout” înseamnă ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar","text_i18n":{"fr":"Sucré comme il faut","es":"Con azúcar medio","ro":"Cu zahăr potrivit"}},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all","text_i18n":{"fr":"Sans sucre","es":"Sin azúcar","ro":"Fără zahăr"}},{"index":2,"text_ar":"بالحليب","text_en":"With milk","text_i18n":{"fr":"Avec du lait","es":"Con leche","ro":"Cu lapte"}},{"index":3,"text_ar":"بارد","text_en":"Cold","text_i18n":{"fr":"Froid","es":"Frío","ro":"Rece"}}]'::jsonb,
  note_ar   = 'مظبوط، سكر زيادة، وعلى الريحة — تلات درجات للسكر لهم أسماء.',
  note_en   = 'Mazbout, ziyada and “ala er-reeha” — three named levels of sugar.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 12;

update public.questions set
  text_i18n = '{"fr":"Le Sphinx a le corps de quel animal ?","es":"¿El cuerpo de la Esfinge es de qué animal?","ro":"Sfinxul are corpul cărui animal?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أسد","text_en":"A lion","text_i18n":{"fr":"Un lion","es":"Un león","ro":"Un leu"}},{"index":1,"text_ar":"حصان","text_en":"A horse","text_i18n":{"fr":"Un cheval","es":"Un caballo","ro":"Un cal"}},{"index":2,"text_ar":"سمكة","text_en":"A fish","text_i18n":{"fr":"Un poisson","es":"Un pez","ro":"Un pește"}},{"index":3,"text_ar":"بطريق","text_en":"A penguin","text_i18n":{"fr":"Un pingouin","es":"Un pingüino","ro":"Un pinguin"}}]'::jsonb,
  note_ar   = 'أبو الهول منحوت من صخرة واحدة، طوله حوالي ٧٣ متر، وله وش إنسان وجسم أسد.',
  note_en   = 'The Sphinx is carved from one piece of rock — about 73 metres of lion with a human head.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 13;

update public.questions set
  text_i18n = '{"fr":"Qui a fondé Alexandrie ?","es":"¿Quién fundó Alejandría?","ro":"Cine a fondat Alexandria?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great","text_i18n":{"fr":"Alexandre le Grand","es":"Alejandro Magno","ro":"Alexandru cel Mare"}},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar","text_i18n":{"fr":"Jules César","es":"Julio César","ro":"Iulius Cezar"}},{"index":2,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously","text_i18n":{"fr":"Un type qui s''appelait Alex, évidemment","es":"Un tal Alex, claro","ro":"Un tip pe nume Alex, evident"}}]'::jsonb,
  note_ar   = 'الإسكندر بنى الإسكندرية سنة ٣٣١ قبل الميلاد وسماها على اسمه.',
  note_en   = 'Alexander founded Alexandria in 331 BC and named it after himself.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 14;

-- These fifteen were written with the right answer first, like every
-- other question in the game. Deal them.
select public.lamma_spread_answers();

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE PERSON READING IS NOT PLAYING
--
--  Ayser: "خليني أنا الي مكريت الروم أنا ما بلعبش، أنا إلي بعرض على
--  التليفون. الusers الي بيلعبو يظهرلهم شاشه تانيه يجربو فيها كلهم في
--  نفس الوقت. أنا بس بعرض الاسأله وهما يحلو كلهم في نفس الوقت. وفي
--  الاخر في تقيم حقيقي. وكل الاسأله نفس الpoints."
--
--  Three things, and they belong together.
--
--  ── ONE · THE HOST STEPS OFF THE BOARD ───────────────────────────
--  He was on the leaderboard with everybody else while holding the
--  phone that shows the questions — which is not a competition, it is
--  one person who can see the answer coming standing in the race.
--
--  So a room may say its host is presenting. Their seat stays (they
--  are in the room, they host it, the sync and the host checks all
--  need that row) but `playing` goes false, and after that:
--    · the leaderboard does not carry them
--    · the final ranking does not carry them
--    · the server refuses their answers outright, so a stray tap on a
--      phone that is being passed around cannot put them back on
--
--  It is a choice, not a rule. Somebody playing at a table with four
--  friends is the host AND a player, and that stays the default.
--
--  ── TWO · EVERY QUESTION IS WORTH THE SAME ───────────────────────
--  It was not. A question could be worth double, the last two of a
--  round were worth another half again, a streak paid a bonus of up
--  to fifty per cent, and answering fast paid more than answering
--  slowly. So the winner was whoever got the RIGHT questions right,
--  quickly, in a row — which is a real game, and not the one Ayser is
--  running.
--
--  Now a right answer is a right answer: the same points on the first
--  question and the last, for the fastest thumb and the slowest.
--
--  ── THREE · SO THE RANKING NEEDED A TIE-BREAK ────────────────────
--  Flat scoring means ties, and lots of them: fifteen questions and
--  six people will very often produce two on eleven. Ties are broken
--  by the total time the person spent answering, soonest first.
--
--  That ordering is the honest version of what speed was doing
--  before. Knowing the answer is what puts you above somebody;
--  answering quickly only separates you from the people who knew
--  exactly as much as you did.
--
--  AYSER: if you want the speed bonus back, it is one line — the
--  base is worked out in lamma_award and nowhere else.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_rooms  add column if not exists host_plays boolean not null default true;
alter table public.room_players add column if not exists playing   boolean not null default true;

-- ── EVERY QUESTION, THE SAME ───────────────────────────────────────
-- The arguments are kept exactly as they were. Four callers pass them
-- and one of those is a view; changing the shape to drop what is no
-- longer read would be a much bigger edit than the change deserves,
-- and the next person to want the speed bonus back would have to put
-- them all back. They are ignored, and it says so.
create or replace function public.lamma_award(
  p_is_correct   boolean,
  p_elapsed_ms   int,          -- ignored: answering fast no longer pays
  p_timer_ms     int,          -- ignored, for the same reason
  p_points_style text,         -- ignored: no question is worth double
  p_streak       int,          -- ignored: a run no longer pays a bonus
  p_is_last_two  boolean       -- ignored: the end is worth the start
) returns int
language plpgsql immutable as $$
begin
  if not coalesce(p_is_correct, false) then return 0; end if;
  return 1000;
end;
$$;

-- ── THE HOST MAY PRESENT INSTEAD OF PLAY ───────────────────────────
drop function if exists public.lamma_set_room(uuid, int, boolean, int, boolean, boolean);

create or replace function public.lamma_set_room(p_room_id uuid, p_timer_ms int, p_locked boolean,
                                                 p_round int, p_read_first boolean,
                                                 p_host_locked boolean, p_host_plays boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if r.host_user_id <> me then return jsonb_build_object('ok', false, 'reason', 'not_host'); end if;

  if p_timer_ms is not null and p_timer_ms not in (10000, 20000, 30000, 45000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_timer');
  end if;
  if p_round is not null and p_round not in (0, 10, 15, 25) then
    return jsonb_build_object('ok', false, 'reason', 'bad_round');
  end if;
  if p_round is not null and r.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'already_started');
  end if;

  update public.game_rooms
     set timer_ms    = coalesce(p_timer_ms, timer_ms),
         locked      = coalesce(p_locked, locked),
         read_first  = coalesce(p_read_first, read_first),
         host_locked = coalesce(p_host_locked, host_locked),
         host_plays  = coalesce(p_host_plays, host_plays),
         question_ids = case when p_round is null then question_ids
                             else public.lamma_draw_questions(r.pack_id, p_round) end
   where id = p_room_id;

  /* Stepping off the board takes the host's score with them. Leaving
     it behind would mean a presenter who played the first three
     questions keeps three questions' worth of points on a ranking
     they are no longer on — and if they step back on, they should
     start where everybody else did. */
  if p_host_plays is not null then
    update public.room_players
       set playing = p_host_plays,
           score = case when p_host_plays then score else 0 end,
           streak = case when p_host_plays then streak else 0 end,
           best_streak = case when p_host_plays then best_streak else 0 end
     where room_id = p_room_id and user_id = me;

    if p_host_plays is false then
      delete from public.answers where room_id = p_room_id and user_id = me;
    end if;
  end if;

  select * into r from public.game_rooms where id = p_room_id;
  return jsonb_build_object('ok', true, 'timer_ms', r.timer_ms, 'locked', r.locked,
                            'read_first', r.read_first, 'host_locked', r.host_locked,
                            'host_plays', r.host_plays,
                            'round', coalesce(array_length(r.question_ids, 1), 0));
end;
$$;

grant execute on function public.lamma_set_room(uuid, int, boolean, int, boolean, boolean, boolean) to authenticated;

-- ── AND THE SERVER REFUSES THEIR ANSWERS ───────────────────────────
-- The screen does not offer a presenter the four tiles, but a screen
-- is not a rule. This is the rule.
create or replace function public.lamma_submit_answer(
  p_room_id uuid, p_question_id uuid, p_selected_index int, p_elapsed_ms int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  pl public.room_players%rowtype;
  v_correct boolean;
  v_points  int;
  v_streak  int;
  v_elapsed int;
  v_flag    boolean := false;
  v_total   int;
  v_last_two boolean;
begin
  if me is null then return jsonb_build_object('accepted', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_room'); end if;
  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'not_in_room'); end if;

  -- reading the questions out is not playing them
  if not coalesce(pl.playing, true) then
    return jsonb_build_object('accepted', false, 'reason', 'presenting');
  end if;

  if r.status <> 'question' then
    return jsonb_build_object('accepted', false, 'reason', 'not_open');
  end if;
  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_question'); end if;
  if r.current_deadline_at is not null and now() > r.current_deadline_at + interval '1500 milliseconds' then
    return jsonb_build_object('accepted', false, 'reason', 'too_late');
  end if;

  v_elapsed := least(greatest(coalesce(p_elapsed_ms, q.timer_ms), 0), q.timer_ms + 1500);

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
    return jsonb_build_object('accepted', false, 'reason', 'already_answered');
  end;

  update public.room_players
     set score = score + v_points,
         streak = v_streak,
         best_streak = greatest(best_streak, v_streak)
   where room_id = p_room_id and user_id = me;

  return jsonb_build_object('accepted', true);
end;
$$;

grant execute on function public.lamma_submit_answer(uuid, uuid, int, int) to authenticated;

-- ── THE BOARD, WITHOUT THE PERSON READING ──────────────────────────
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

  if r.question_ids is not null and r.current_question_index >= 0
     and r.current_question_index < coalesce(array_length(r.question_ids, 1), 0) then
    qid := r.question_ids[r.current_question_index + 1];
  else
    select id into qid from public.questions
     where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;

  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'question_ids', coalesce(to_jsonb(r.question_ids), '[]'::jsonb),
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'host_locked', r.host_locked,
    'host_plays', r.host_plays,
    'im_playing', coalesce(pl.playing, true),
    'timer_ms', r.timer_ms,
    'read_first', r.read_first,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    /* Ordered by what they knew, then by how long they took — the
       tie-break flat scoring made necessary. */
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nickname', p.nickname,
                                          'score', p.score, 'best_streak', p.best_streak,
                                          'is_connected', p.is_connected,
                                          'avatar_key', p.avatar_key)
                       order by p.score desc, t.spent asc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select coalesce(sum(a.elapsed_ms), 0) as spent
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) t
       where p.room_id = p_room_id and coalesce(p.playing, true)), '[]'::jsonb)
  );
end;
$$;

-- ── AND THE FINAL RANKING ──────────────────────────────────────────
create or replace function public.lamma_room_results(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  total int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  select count(*) into total from public.questions where pack_id = r.pack_id;

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'country', (select country from public.game_packs where id = r.pack_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id, 'nickname', p.nickname, 'score', p.score,
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, c.spent asc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered,
                 coalesce(sum(a.elapsed_ms), 0) as spent
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id and coalesce(p.playing, true)), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE SHELF HAS AN ORDER NOW
--
--  Ayser: "Make 15 Egyptian question at the top now."
--
--  The shelf had no order to speak of. Packs came back official-first
--  and then in whatever order the table felt like, and the app moved
--  the player's own country up. So "Egypt in 15" — the pack that IS
--  the round he runs his evenings on — sat wherever it landed.
--
--  ── A COLUMN, NOT A LINE OF CODE ─────────────────────────────────
--  The quick version of this is an id written into fetchPacks with a
--  comment saying "put this one first". Then the next time he wants a
--  different pack at the top it is a code change, a build and a
--  deploy, for something that is genuinely just a preference.
--
--  So the order lives on the pack. Lower comes first, everything
--  unranked sits at 100, and moving a pack up the shelf is one UPDATE.
--
--  ── AND IT BEATS THE COUNTRY SORT ────────────────────────────────
--  The app already moves a player's own country to the top, which was
--  itself a fix: an Egyptian in Cairo opened لمّة and saw three
--  worldwide packs and no Egyptian one. That stays — but it now only
--  decides between packs with the SAME rank. A deliberate choice about
--  what belongs at the top should not be undone by where somebody
--  happens to live, or the pack Ayser pinned would drop for every
--  player outside Egypt: exactly the people he plays with.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_packs add column if not exists sort_order int not null default 100;

create index if not exists game_packs_shelf on public.game_packs (sort_order, is_official desc);

-- The round he actually runs, then the big Egyptian pack behind it,
-- then the green one. Everything else keeps the default and sorts
-- itself out below.
update public.game_packs set sort_order =  0 where id = 'aaaa7777-0000-4000-8000-000000000001'; -- Egypt in 15
update public.game_packs set sort_order = 10 where id = 'eeee5555-0000-4000-8000-000000000001'; -- Do You Know Egypt?
update public.game_packs set sort_order = 20 where id = 'ffff6666-0000-4000-8000-000000000001'; -- Green Minds

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A ROOM OF SEVENTY, AND IT HOLDS
--
--  Ayser asked whether the app could take seventy people playing at
--  once. The honest answer was no — it would have come apart somewhere
--  around twenty or thirty — and this is the file that makes the
--  answer yes.
--
--  ── WHAT WAS ACTUALLY WRONG ──────────────────────────────────────
--  Not the game. The PAYLOAD.
--
--  lamma_sync returned the whole leaderboard, and every row carried
--  that player's face: a base64 JPEG of up to 26,000 characters. With
--  seventy players that is about 1.8 MB per sync. Every phone polls
--  every five seconds and re-syncs on every phase change, so a single
--  question cost the room in the order of gigabytes — to send a set of
--  pictures that had not changed since the lobby.
--
--  And underneath it, lamma_sync ran a lateral aggregate over the
--  answers table for every player on every call, to work out the
--  tie-break. Seventy players times fifteen questions times fourteen
--  syncs a second is a lot of arithmetic to redo for a number that
--  only changes when somebody answers.
--
--  ── THREE CHANGES, AND THE ARGUMENT FOR EACH ─────────────────────
--
--  1. THE FACES LEAVE THE HOT PATH. lamma_sync stops sending
--     avatar_key. A new lamma_faces() returns the pictures, and the
--     app asks for it once per room and again only when it sees a
--     face it does not know. A picture that changes once an evening
--     should not travel fourteen times a second.
--
--     The leaderboard row goes from ~26 KB to ~90 bytes. Seventy of
--     them is about 6 KB — which is the difference between "it works"
--     and "it does not".
--
--  2. THE TIE-BREAK IS STORED, NOT RECOMPUTED. room_players gains
--     spent_ms, added to as each answer lands. The aggregate over
--     answers disappears from the read path entirely. Same ordering,
--     same rule — the fastest player wins a tie — computed once when
--     it changes instead of on every read.
--
--  3. AN INDEX THE ANSWERS TABLE NEVER HAD. (room_id, user_id) —
--     used by the backfill below, by lamma_room_results, and by
--     anything else that asks what one player did in one room.
--
--  ── WHY NOT JUST SEND FEWER PLAYERS ──────────────────────────────
--  The obvious fix is to return the top twenty and stop. It is also
--  wrong: somebody in fortieth place is playing the same evening and
--  their own row has to be right, the final ranking needs everybody,
--  and a truncated board is a bug that only appears in exactly the
--  big room this file exists to support. Send everybody. Send less
--  about each of them.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.room_players add column if not exists spent_ms bigint not null default 0;

create index if not exists answers_room_user on public.answers (room_id, user_id);

-- Rooms that were played before this column existed still have a
-- correct total waiting in the answers table. One pass, and every old
-- room's tie-break survives the change.
update public.room_players p
   set spent_ms = coalesce(t.total, 0)
  from (select room_id, user_id, sum(elapsed_ms) as total
          from public.answers group by room_id, user_id) t
 where t.room_id = p.room_id and t.user_id = p.user_id
   and p.spent_ms = 0;

-- ── THE TAP, NOW KEEPING ITS OWN RUNNING TOTAL ─────────────────────
-- Identical to v38 in every rule it applies. The only difference is
-- the last line of the update: the time spent is accumulated here,
-- once, rather than summed on every read by every phone in the room.
create or replace function public.lamma_submit_answer(
  p_room_id uuid, p_question_id uuid, p_selected_index int, p_elapsed_ms int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  q  public.questions%rowtype;
  pl public.room_players%rowtype;
  v_correct boolean;
  v_points  int;
  v_streak  int;
  v_elapsed int;
  v_flag    boolean := false;
  v_total   int;
  v_last_two boolean;
begin
  if me is null then return jsonb_build_object('accepted', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_room'); end if;
  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'not_in_room'); end if;

  -- reading the questions out is not playing them
  if not coalesce(pl.playing, true) then
    return jsonb_build_object('accepted', false, 'reason', 'presenting');
  end if;

  if r.status <> 'question' then
    return jsonb_build_object('accepted', false, 'reason', 'not_open');
  end if;
  select * into q from public.questions where id = p_question_id;
  if not found then return jsonb_build_object('accepted', false, 'reason', 'no_question'); end if;
  if r.current_deadline_at is not null and now() > r.current_deadline_at + interval '1500 milliseconds' then
    return jsonb_build_object('accepted', false, 'reason', 'too_late');
  end if;

  v_elapsed := least(greatest(coalesce(p_elapsed_ms, q.timer_ms), 0), q.timer_ms + 1500);

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
    return jsonb_build_object('accepted', false, 'reason', 'already_answered');
  end;

  update public.room_players
     set score = score + v_points,
         streak = v_streak,
         best_streak = greatest(best_streak, v_streak),
         spent_ms = spent_ms + v_elapsed      -- the tie-break, kept as we go
   where room_id = p_room_id and user_id = me;

  return jsonb_build_object('accepted', true);
end;
$$;

grant execute on function public.lamma_submit_answer(uuid, uuid, int, int) to authenticated;

-- ── THE FACES, ASKED FOR SEPARATELY AND RARELY ─────────────────────
-- Everything lamma_sync used to carry on its back, on its own, so a
-- phone can fetch it once and keep it. Only for somebody actually in
-- the room — a face is not public just because a room id is guessable.
create or replace function public.lamma_faces(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  if not public.lamma_in_room(p_room_id) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'avatar_key', p.avatar_key))
      from public.room_players p
     where p.room_id = p_room_id and p.avatar_key is not null), '[]'::jsonb);
end;
$$;

revoke all on function public.lamma_faces(uuid) from public;
grant execute on function public.lamma_faces(uuid) to authenticated;

-- ── AND THE BOARD, WITHOUT THE PICTURES ────────────────────────────
-- Byte for byte the same information as v38 minus avatar_key, and
-- ordered by the stored spent_ms rather than by an aggregate run
-- afresh for every player on every call.
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

  if r.question_ids is not null and r.current_question_index >= 0
     and r.current_question_index < coalesce(array_length(r.question_ids, 1), 0) then
    qid := r.question_ids[r.current_question_index + 1];
  else
    select id into qid from public.questions
     where pack_id = r.pack_id and order_index = r.current_question_index;
  end if;

  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'question_ids', coalesce(to_jsonb(r.question_ids), '[]'::jsonb),
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'locked', r.locked,
    'host_locked', r.host_locked,
    'host_plays', r.host_plays,
    'im_playing', coalesce(pl.playing, true),
    'timer_ms', r.timer_ms,
    'read_first', r.read_first,
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    /* Ordered by what they knew, then by how long they took — the
       tie-break flat scoring made necessary. */
    /* No avatar_key here any more, and no aggregate: the faces come
       from lamma_faces() once per room, and the tie-break is the
       stored spent_ms. Same players, same order, ~90 bytes a row
       instead of ~26 KB. See supabase/schema_v40_big_room.sql. */
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nickname', p.nickname,
                                          'score', p.score, 'best_streak', p.best_streak,
                                          'is_connected', p.is_connected)
                       order by p.score desc, p.spent_ms asc, p.joined_at asc)
        from public.room_players p
       where p.room_id = p_room_id and coalesce(p.playing, true)), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.lamma_sync(uuid) to authenticated;

notify pgrst, 'reload schema';
