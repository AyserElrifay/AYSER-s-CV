-- People, their portals, and what their time costs.
--
-- Until now an organisation could only ever hold its owner: the four roles were
-- enforced everywhere and reachable by nobody. This migration is what makes
-- them real — an account for each person, a way in that is theirs, the deals
-- they are on, and the rate their day is worth.

-- --- a way in that belongs to the person -------------------------------------

/*
 * A username, because a freelancer is not an email address.
 *
 * People join an agency for one shoot and leave; half of them share a family
 * address, some have none they check. `email` stays, because it is how an owner
 * reaches somebody, but it stops being the only way to sign in.
 *
 * Stored lower-cased and unique per organisation — the same person can hold an
 * account at two agencies, which is the ordinary case for a freelancer and the
 * whole reason sign-in already asks which workspace when an address is
 * ambiguous.
 */
alter table users
  add column if not exists username text
    check (username is null or username ~ '^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$');

create unique index if not exists users_org_username_key on users (org_id, username);

/*
 * What a day of this person's time costs the agency.
 *
 * Nullable on purpose: an owner does not have a day rate, and a person hired
 * before anyone agreed one should still be able to sign in. A rate is a fact
 * that arrives later, not a condition of existing.
 */
alter table users
  add column if not exists day_rate_minor bigint check (day_rate_minor is null or day_rate_minor >= 0),
  add column if not exists rate_currency currency_code,
  add column if not exists title text,
  add column if not exists phone text,
  add column if not exists must_change_password boolean not null default false,
  -- A rate without a currency is a number nobody can add up.
  add constraint users_rate_has_currency
    check ((day_rate_minor is null) = (rate_currency is null)) not valid;

alter table users validate constraint users_rate_has_currency;

-- --- who is on which deal ----------------------------------------------------

/*
 * The rate is copied here, not read from the person.
 *
 * Same rule as the house rate on a closed deal: a raise in June must not change
 * what April's work cost. The assignment is where the rate stops moving.
 */
create table if not exists deal_assignments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  deal_id        uuid not null,
  user_id        uuid not null,
  day_rate_minor bigint not null check (day_rate_minor >= 0),
  currency       currency_code not null,
  note           text,
  created_at     timestamptz not null default now(),

  foreign key (org_id, deal_id) references deals (org_id, id) on delete cascade,
  foreign key (org_id, user_id) references users (org_id, id) on delete restrict,
  unique (org_id, id),
  -- One assignment per person per deal. A second engagement at a different rate
  -- is a different deal, or an adjustment, not a duplicate row.
  unique (org_id, deal_id, user_id)
);

create index if not exists deal_assignments_user_idx on deal_assignments (org_id, user_id);

-- --- the days themselves -----------------------------------------------------

/*
 * A timesheet, and deliberately a separate table from `costs`.
 *
 * These are two different kinds of money and the product should keep saying so.
 * `costs` is what left the bank: a printer's invoice, a stock licence, a
 * freelancer's bill. `work_log` is your own people's time, which never leaves
 * the bank and is exactly the cost agencies forget — the four days a designer
 * spent on a retainer that everyone agrees is profitable.
 *
 * Keeping them apart also keeps a rule intact. A Member holds INSERT on `costs`
 * and no SELECT at all, and that asymmetry is load-bearing. Their own timesheet
 * is a different question: it is a financial fact about *them*, and withholding
 * it would mean they cannot check what they are about to be paid — the same
 * argument that gives a Partner their own statement.
 */
create table if not exists work_log (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  deal_id        uuid not null,
  user_id        uuid not null,
  worked_on      date not null default current_date,
  -- Hundredths of a day. Quarter-days are expressible; thirds are not, and a
  -- person who means a third is told so rather than rounded.
  days           integer not null check (days > 0 and days <= 2000),
  day_rate_minor bigint not null check (day_rate_minor >= 0),
  currency       currency_code not null,
  -- days × rate ÷ 100, rounded once by the money module. Stored rather than
  -- computed so the row keeps saying what it said when it was written.
  amount_minor   bigint not null check (amount_minor >= 0),
  note           text,
  created_at     timestamptz not null default now(),

  foreign key (org_id, deal_id) references deals (org_id, id) on delete cascade,
  foreign key (org_id, user_id) references users (org_id, id) on delete restrict,
  unique (org_id, id)
);

create index if not exists work_log_deal_idx on work_log (org_id, deal_id);
create index if not exists work_log_user_idx on work_log (org_id, user_id, worked_on);

-- --- row level security ------------------------------------------------------

alter table deal_assignments enable row level security;
alter table deal_assignments force row level security;
alter table work_log enable row level security;
alter table work_log force row level security;

grant select, insert, update, delete on deal_assignments to qirat_role_owner;
grant select, insert, delete on deal_assignments to qirat_role_manager;
-- A Member sees where they have been put, and the rate it was agreed at. It is
-- their engagement; they are entitled to its terms.
grant select (id, org_id, deal_id, user_id, day_rate_minor, currency, note, created_at)
  on deal_assignments to qirat_role_member;

create policy deal_assignments_owner_rw on deal_assignments
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

-- Evaluated under the manager's own policies on `deals`, so they cannot staff
-- a colleague's deal.
create policy deal_assignments_manager_rw on deal_assignments
  for all to qirat_role_manager
  using (
    org_id = qirat.current_org_id()
    and deal_id in (select d.id from deals d where d.org_id = qirat.current_org_id())
  )
  with check (
    org_id = qirat.current_org_id()
    and deal_id in (select d.id from deals d where d.org_id = qirat.current_org_id())
  );

create policy deal_assignments_member_read on deal_assignments
  for select to qirat_role_member
  using (org_id = qirat.current_org_id() and user_id = qirat.current_user_id());

grant select, insert, update, delete on work_log to qirat_role_owner;
grant select, insert on work_log to qirat_role_manager;
grant select, insert on work_log to qirat_role_member;

create policy work_log_owner_rw on work_log
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy work_log_manager_read on work_log
  for select to qirat_role_manager
  using (
    org_id = qirat.current_org_id()
    and deal_id in (select d.id from deals d where d.org_id = qirat.current_org_id())
  );

create policy work_log_manager_write on work_log
  for insert to qirat_role_manager
  with check (
    org_id = qirat.current_org_id()
    and deal_id in (select d.id from deals d where d.org_id = qirat.current_org_id())
  );

-- Their own days, and only their own. Not the colleague who was on the same
-- shoot, and not the total.
create policy work_log_member_read on work_log
  for select to qirat_role_member
  using (org_id = qirat.current_org_id() and user_id = qirat.current_user_id());

/*
 * A Member may log a day only against a deal they are actually on, and only in
 * their own name.
 *
 * The assignment subquery is evaluated under their own policies, so it can only
 * ever find their own row. Without this clause a Member could log time to any
 * deal id they could guess, which is both a cost nobody authorised and a way to
 * find out which deal ids exist.
 */
create policy work_log_member_write on work_log
  for insert to qirat_role_member
  with check (
    org_id = qirat.current_org_id()
    and user_id = qirat.current_user_id()
    and deal_id in (
      select a.deal_id from deal_assignments a
      where a.org_id = qirat.current_org_id() and a.user_id = qirat.current_user_id()
    )
  );

-- --- what a Member can now see of a deal -------------------------------------

/*
 * A Member sees the deals they are on, and nothing else about them.
 *
 * The column grant on `deals` already excludes every financial field, so this
 * policy adds a title, a client and a delivery date — the answer to "what am I
 * working on this week" — and cannot add a price.
 */
create policy deals_member_read on deals
  for select to qirat_role_member
  using (
    org_id = qirat.current_org_id()
    and id in (
      select a.deal_id from deal_assignments a
      where a.org_id = qirat.current_org_id() and a.user_id = qirat.current_user_id()
    )
  );

-- A Member already reads clients (0002): a name is not an economic fact, and
-- the column grant there excludes the client's currency. Nothing to add.

-- --- new columns on users ----------------------------------------------------

-- Everyone can see who they are. RLS already limits a Member and a Partner to
-- exactly one row — their own — so this grants them their own rate and nobody
-- else's, which is the same shape as a Partner's own statement.
grant select (username, title, phone, day_rate_minor, rate_currency, must_change_password)
  on users to qirat_role_owner, qirat_role_manager, qirat_role_member, qirat_role_partner;

-- Changing your own password, and the flag that says you no longer have to.
grant update (password_hash, must_change_password, locale, phone)
  on users to qirat_role_manager, qirat_role_member, qirat_role_partner;
