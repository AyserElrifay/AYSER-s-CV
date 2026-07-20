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
drop policy if exists "members can leave squads" on public.squad_members;
create policy "members can leave squads" on public.squad_members
  for delete using (auth.uid() = user_id);

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
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

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
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'country')                    as country_column_ready,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'avatar_dna')                  as avatar_builder_ready;
