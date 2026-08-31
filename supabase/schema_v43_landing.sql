-- ═══════════════════════════════════════════════════════════════════
--  LANDING — the first thirty days in a European city
--
--  Ayser: "فكر في حاجه كريتف تحل بيها gap او مشكله بذات في اوربا"
--
--  ── THE GAP ──────────────────────────────────────────────────────
--  Every year millions of people arrive in a European city they have
--  never lived in: 1.3 million on Erasmus+, workers moving inside the
--  single market, families under temporary protection, students,
--  researchers, everybody's cousin. Twenty-seven countries, each with
--  its own offices, and every single one of them starts from zero.
--
--  The information exists. It is in the wrong shape:
--
--    · The official portals give you the LAW. "You must register your
--      address" is a true sentence that helps nobody. What you need is
--      which building, which queue, which papers, and whether anyone
--      there speaks English.
--    · Facebook groups have the real answer, buried in a thread from
--      2021, undated, unsearchable, and now wrong.
--    · Blogs are written once and never touched again. A rule changed
--      in January and the top search result still tells you to bring a
--      document nobody accepts.
--
--  Nobody keeps it TRUE. That is the gap — not the writing, the
--  maintenance. So this is built around freshness rather than content.
--
--  ── THE IDEA ─────────────────────────────────────────────────────
--  A checklist per city, where every step carries the date somebody
--  last confirmed it and the number of people who did it recently. A
--  step nobody has vouched for in six months says so, out loud, and
--  asks to be checked. Confirming is one tap — the cheapest possible
--  contribution, which is the only kind most people ever make.
--
--  And the corpus grows without anyone writing a guide: when you tick
--  a step off, you are asked one optional question — "anything the
--  next person should know?" — one sentence, from somebody who did it
--  this week.
--
--  ── THE RULE THAT MAKES IT TRUSTWORTHY ───────────────────────────
--  A step written by a person is NOT SHOWN to newcomers until two
--  different people have confirmed it. One stranger's guess never gets
--  to look like fact. Editing a step resets that clock: confirmations
--  only count if they came after the last revision, so a bad edit
--  drops the step back to "needs checking" and out of the newcomer's
--  list until two people vouch for it again. It heals itself.
--
--  ── AND WHAT WE SHIP OURSELVES ───────────────────────────────────
--  Exactly the part that is the same everywhere: what the EU
--  guarantees you no matter which of the twenty-seven you landed in —
--  the right to a basic bank account, what your EHIC does and does
--  not cover, that refusing your IBAN because it is foreign is
--  illegal, that your licence and your qualifications travel with you.
--  Those are scope='eu' and are visible from day one, because they are
--  not a claim about a city.
--
--  Everything a city does differently is earned, two confirmations at
--  a time, by the people who live there.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.arrival_steps (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null,                 -- 'eu' | 'country' | 'city'
  country     char(2),                       -- ISO-3166-1 alpha-2, upper case
  city        text,
  slug        text not null,                 -- 'address', 'bank', 'health', …
  title       text not null,
  body        text not null,
  author_id   uuid references public.profiles(id) on delete set null,
  sort        int not null default 100,
  revised_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.arrival_steps drop constraint if exists arrival_steps_scope_known;
alter table public.arrival_steps add  constraint arrival_steps_scope_known
  check (scope in ('eu', 'country', 'city'));

/* A step is about somewhere, and which somewhere is not optional. */
alter table public.arrival_steps drop constraint if exists arrival_steps_place_matches_scope;
alter table public.arrival_steps add  constraint arrival_steps_place_matches_scope
  check (
    (scope = 'eu'      and country is null     and city is null) or
    (scope = 'country' and country is not null and city is null) or
    (scope = 'city'    and country is not null and city is not null)
  );

alter table public.arrival_steps drop constraint if exists arrival_steps_says_something;
alter table public.arrival_steps add  constraint arrival_steps_says_something
  check (btrim(title) <> '' and char_length(title) <= 120
         and btrim(body) <> '' and char_length(body) <= 2000);

/* One step per topic per place. A checklist with two "open a bank
   account" entries is not a checklist — corrections improve the one
   that is there rather than forking it. */
create unique index if not exists arrival_steps_one_per_place
  on public.arrival_steps (scope, coalesce(country, ''), lower(coalesce(city, '')), slug);

create index if not exists arrival_steps_lookup
  on public.arrival_steps (country, lower(city), sort);

/* Still true, or not any more — and one sentence about why. */
create table if not exists public.arrival_confirms (
  step_id    uuid not null references public.arrival_steps(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  still_true boolean not null,
  note       text,
  at         timestamptz not null default now(),
  primary key (step_id, user_id)
);

alter table public.arrival_confirms drop constraint if exists arrival_confirms_note_sane;
alter table public.arrival_confirms add  constraint arrival_confirms_note_sane
  check (note is null or char_length(note) <= 400);

create index if not exists arrival_confirms_step on public.arrival_confirms (step_id, at desc);

/* Where you have got to. Yours, and nobody else's business. */
create table if not exists public.arrival_progress (
  step_id uuid not null references public.arrival_steps(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (step_id, user_id)
);

-- ── WHO MAY DO WHAT ────────────────────────────────────────────────
alter table public.arrival_steps    enable row level security;
alter table public.arrival_confirms enable row level security;
alter table public.arrival_progress enable row level security;

/* The list itself is public — somebody deciding whether to move here
   should be able to read it before they have an account. */
drop policy if exists "the arrival list is public" on public.arrival_steps;
create policy "the arrival list is public" on public.arrival_steps for select using (true);

/* Anyone signed in may add a step for a place. What they cannot do is
   write one that claims to be an EU-wide guarantee. */
drop policy if exists "people add steps for a place" on public.arrival_steps;
create policy "people add steps for a place" on public.arrival_steps for insert with check (
  auth.uid() = author_id and scope in ('country', 'city')
);

/* And anyone signed in may improve one — which resets its standing,
   by the trigger below. The shipped EU steps are not editable from a
   phone: they have no author, and this requires one. */
drop policy if exists "people improve steps" on public.arrival_steps;
create policy "people improve steps" on public.arrival_steps for update
  using (author_id is not null and auth.uid() is not null)
  with check (author_id is not null);

drop policy if exists "authors remove their own step" on public.arrival_steps;
create policy "authors remove their own step" on public.arrival_steps for delete
  using (auth.uid() = author_id);

drop policy if exists "confirmations are public" on public.arrival_confirms;
create policy "confirmations are public" on public.arrival_confirms for select using (true);
drop policy if exists "you confirm as yourself" on public.arrival_confirms;
create policy "you confirm as yourself" on public.arrival_confirms for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "your progress is yours" on public.arrival_progress;
create policy "your progress is yours" on public.arrival_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* ── AN EDIT COSTS THE STEP ITS STANDING ─────────────────────────────
   Confirmations are counted only from the last revision onwards, so
   changing the words of a step drops it back to "needs checking" and
   out of the newcomer's list until two people vouch for the new
   version. Rewriting a trusted step into something else is therefore
   not a way to get something untrue in front of people. */
create or replace function public.arrival_touch_revision()
returns trigger language plpgsql as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.revised_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_arrival_step_revised on public.arrival_steps;
create trigger on_arrival_step_revised
  before update on public.arrival_steps
  for each row execute procedure public.arrival_touch_revision();

-- ── THE LIST, WITH ITS AGE ON IT ───────────────────────────────────
/* Everything that applies where you are: what the EU guarantees, what
   the country does, what this city does — with, for each step, how
   many people have vouched for the current wording, how many say it
   has changed, when it was last checked, whether that was long enough
   ago to stop trusting it, and whether you have done it.

   `trusted` is the rule stated once, in one place: a shipped EU step,
   or two people who are not each other. */
create or replace function public.arrival_list(p_country text default null, p_city text default null)
returns table (
  id uuid, scope text, country text, city text, slug text,
  title text, body text, sort int, author_id uuid, author_name text,
  confirms int, disputes int, last_at timestamptz,
  stale boolean, trusted boolean, mine boolean, done boolean
)
language sql stable security definer set search_path = public as $$
  with s as (
    select st.*,
           (select count(*)::int from public.arrival_confirms c
             where c.step_id = st.id and c.still_true and c.at >= st.revised_at) as ok_n,
           (select count(*)::int from public.arrival_confirms c
             where c.step_id = st.id and not c.still_true and c.at >= st.revised_at) as no_n,
           (select max(c.at) from public.arrival_confirms c
             where c.step_id = st.id and c.at >= st.revised_at) as last_c
      from public.arrival_steps st
     where st.scope = 'eu'
        or (st.scope = 'country' and p_country is not null and st.country = upper(p_country))
        or (st.scope = 'city'    and p_country is not null and st.country = upper(p_country)
            and p_city is not null and lower(st.city) = lower(p_city))
  )
  select s.id, s.scope, s.country, s.city, s.slug, s.title, s.body, s.sort,
         s.author_id, pr.name,
         s.ok_n, s.no_n, coalesce(s.last_c, s.created_at),
         /* six months without anybody checking is long enough for a
            queue to move, a form to change and an office to close */
         s.scope <> 'eu' and coalesce(s.last_c, s.created_at) < now() - interval '180 days',
         s.scope = 'eu' or s.ok_n >= 2,
         s.author_id = auth.uid(),
         exists (select 1 from public.arrival_progress g where g.step_id = s.id and g.user_id = auth.uid())
    from s
    left join public.profiles pr on pr.id = s.author_id
   order by s.sort, s.created_at;
$$;

/* One tap. Re-confirming moves the date, which is the whole point. */
create or replace function public.arrival_confirm(p_step uuid, p_ok boolean, p_note text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.arrival_confirms (step_id, user_id, still_true, note, at)
  values (p_step, auth.uid(), p_ok, nullif(btrim(coalesce(p_note, '')), ''), now())
  on conflict (step_id, user_id) do update
    set still_true = excluded.still_true, note = excluded.note, at = now();
$$;

create or replace function public.arrival_done(p_step uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_done then
    insert into public.arrival_progress (step_id, user_id) values (p_step, auth.uid())
    on conflict (step_id, user_id) do nothing;
  else
    delete from public.arrival_progress where step_id = p_step and user_id = auth.uid();
  end if;
end;
$$;

/* What people said about a step, newest first — the sentences that
   turn "register your address" into something you can act on. */
create or replace function public.arrival_notes(p_step uuid)
returns table (name text, note text, at timestamptz, still_true boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(pr.name, 'Someone'), c.note, c.at, c.still_true
    from public.arrival_confirms c
    left join public.profiles pr on pr.id = c.user_id
   where c.step_id = p_step and c.note is not null
   order by c.at desc
   limit 30;
$$;

-- ── WHAT IS TRUE IN ALL TWENTY-SEVEN ───────────────────────────────
/* Shipped, because it is not a claim about anybody's city. Each one is
   the thing people get wrong, not a summary of the law — and none of
   it is advice: the office in front of you has the final word. */
insert into public.arrival_steps (scope, slug, title, body, sort)
values
  ('eu', 'address', 'Register where you live — first, and before everything else',
   'Almost every country expects you to register your address with the local authority soon after you arrive, and almost nothing else works until you have: no personal number, often no bank account, sometimes no doctor. The name and the deadline differ everywhere. If you are an EU citizen your right to stay beyond three months comes from the free-movement directive rather than from a visa, but the registration is still required.', 10),

  ('eu', 'id', 'The number everything else asks for',
   'Most countries give you a personal, national or tax number when you register. From then on it is the first thing every form, employer, landlord, clinic and bank asks for. Get it early; nearly everything below waits on it.', 20),

  ('eu', 'bank', 'A bank account — and two rights nobody tells you about',
   'First: anyone legally resident in the EU has the right to a basic payment account, including people with no fixed address and people seeking asylum. A bank refusing you outright is usually wrong, and saying so politely often ends the conversation.\n\nSecond: your existing EU account may already be enough for a salary and rent. Refusing a payment because the IBAN is from another member state is against EU rules — it has a name, IBAN discrimination, and it is not allowed. You will still want a local account eventually, but you are not stuck on day one.', 30),

  ('eu', 'health', 'Your EHIC is for visiting, not for living',
   'The European Health Insurance Card covers medically necessary care while you are temporarily in another country. It is not cover for moving: once you live and work somewhere, you are insured there, and you register with that system.\n\nThe exception worth knowing is the S1 form — if you are a pensioner or a posted worker, it registers you with the local system while your home country keeps paying. Ask before you go, not after.', 40),

  ('eu', 'sim', 'Roaming is for travel, not for living here',
   'Roam-like-at-home means your EU SIM works across the EU at domestic prices, and it is genuinely good. It is designed for travel, though: providers may apply a fair-use policy if month after month you are using it abroad more than at home.\n\nA local number is also what couriers, banks and government forms expect, and some will not accept a foreign one at all.', 50),

  ('eu', 'driving', 'Your licence travels; your plates may not',
   'A driving licence from an EU or EEA country is valid across the EU — you do not have to exchange it just because you moved, though you may choose to, and you will have to if it is lost, stolen or expires. A licence from outside the EU usually has to be exchanged or retaken within a set period after you become resident, and that period can be short.\n\nA car you bring with you is a separate question with its own deadline for re-registering.', 60),

  ('eu', 'work', 'Your qualifications come with you, with paperwork',
   'For most jobs, nobody has to recognise anything — you are simply hired. For regulated professions such as nursing, teaching, law or engineering there is a recognition procedure, and it takes months rather than weeks, so start it before you need it.\n\nFor a degree that is not about a regulated profession, the ENIC-NARIC centre in the country you moved to is the place that says what it is worth here.', 70),

  ('eu', 'tax', 'Where you live is usually where you are taxed',
   'You generally become tax resident where you actually live, and a common rule of thumb is more than 183 days in a year — but each country writes its own test, and a treaty between the two decides who taxes what when both think you are theirs.\n\nRegistering with the tax office is often the same visit as getting your personal number. Doing it late is the expensive kind of late.', 80)
on conflict (scope, coalesce(country, ''), lower(coalesce(city, '')), slug) do nothing;

notify pgrst, 'reload schema';
