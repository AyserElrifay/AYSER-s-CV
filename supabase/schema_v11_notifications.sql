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
