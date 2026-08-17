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
