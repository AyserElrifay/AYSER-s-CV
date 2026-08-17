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
