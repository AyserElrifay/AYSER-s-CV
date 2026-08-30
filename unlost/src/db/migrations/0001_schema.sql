-- Unlost core schema.
--
-- Two rules govern every table below and are enforced here rather than in
-- application code, because application code is one forgotten WHERE clause away
-- from a tenant data leak:
--
--   1. Every table carries org_id.
--   2. Every cross-table reference is composite on (org_id, id), so a row in
--      one organisation cannot point at a row in another even if a bug tries.

create schema if not exists unlost;

-- Session context. `current_setting(..., true)` yields NULL when unset rather
-- than raising, so a query that forgets to establish tenant context matches no
-- rows instead of matching all of them. Deny is the default, always.
create or replace function unlost.current_org_id() returns uuid
  language sql stable
  set search_path = pg_catalog, public
as $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

create or replace function unlost.current_user_id() returns uuid
  language sql stable
  set search_path = pg_catalog, public
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

do $$ begin
  create type user_role as enum ('owner', 'account_manager', 'member', 'partner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_status as enum ('draft', 'pending_approval', 'won', 'lost');
exception when duplicate_object then null; end $$;

-- Currency is an enum rather than a lookup table: a reference table would be
-- the one table in the database without an org_id, and that exception is how
-- the rule starts eroding. Kept in step with src/money/currency.ts by a test.
do $$ begin
  create type currency_code as enum
    ('EGP','USD','SAR','AED','QAR','EUR','GBP','KWD','BHD','OMR','JOD','TND','JPY');
exception when duplicate_object then null; end $$;

-- --- organizations -----------------------------------------------------------

create table if not exists organizations (
  id                 uuid primary key default gen_random_uuid(),
  -- The tenant table is its own tenant. Generated rather than nullable so the
  -- "every table has org_id" invariant is literally true and testable.
  org_id             uuid generated always as (id) stored,
  slug               text not null unique
                     check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name               text not null check (length(trim(name)) > 0),
  name_ar            text,
  default_currency   currency_code not null default 'EGP',
  -- Share of profit the agency keeps before anything reaches the split engine.
  house_rate_bp      integer not null default 5000 check (house_rate_bp between 0 and 10000),
  margin_healthy_bp  integer not null default 4000 check (margin_healthy_bp between 0 and 10000),
  margin_warning_bp  integer not null default 2000 check (margin_warning_bp between 0 and 10000),
  default_locale     text not null default 'en' check (default_locale in ('en','ar')),
  numbering_system   text not null default 'latn' check (numbering_system in ('latn','arab')),
  created_at         timestamptz not null default now(),
  check (margin_warning_bp <= margin_healthy_bp)
);

create unique index if not exists organizations_org_id_key on organizations (org_id, id);

-- --- users -------------------------------------------------------------------

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  email          text not null check (position('@' in email) > 1),
  password_hash  text not null,
  name           text not null check (length(trim(name)) > 0),
  role           user_role not null,
  locale         text not null default 'en' check (locale in ('en','ar')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz,
  unique (org_id, id)
);

-- The same person may hold an account in two agencies with one email address.
create unique index if not exists users_org_email_key on users (org_id, lower(email));
create index if not exists users_email_idx on users (lower(email));

-- --- brand kit ---------------------------------------------------------------

create table if not exists brand_kits (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  logo_url       text,
  -- Locked layer: only an Owner may write these, and no proposal may override
  -- them. An agency's proposal is its own advertisement.
  palette        jsonb not null default '{}'::jsonb,
  fonts          jsonb not null default '{}'::jsonb,
  locked_config  jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, id)
);

create unique index if not exists brand_kits_one_per_org on brand_kits (org_id);

-- --- services ----------------------------------------------------------------

create table if not exists services (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organizations (id) on delete cascade,
  name                    text not null check (length(trim(name)) > 0),
  name_ar                 text,
  currency                currency_code not null,
  -- The band is internal. A client is shown one number; shown a range they
  -- anchor to the floor and the ceiling may as well not exist.
  floor_minor             bigint not null check (floor_minor >= 0),
  target_minor            bigint not null,
  ceiling_minor           bigint not null,
  default_cost_min_minor  bigint not null default 0 check (default_cost_min_minor >= 0),
  default_cost_max_minor  bigint not null default 0,
  task_template           jsonb not null default '[]'::jsonb,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  unique (org_id, id),
  check (floor_minor <= target_minor and target_minor <= ceiling_minor),
  check (default_cost_min_minor <= default_cost_max_minor)
);

-- --- clients -----------------------------------------------------------------

create table if not exists clients (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  name_ar           text,
  country           char(2),
  default_currency  currency_code,
  created_at        timestamptz not null default now(),
  unique (org_id, id)
);

-- --- deals -------------------------------------------------------------------

create table if not exists deals (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organizations (id) on delete cascade,
  client_id              uuid not null,
  service_id             uuid,
  owner_user_id          uuid not null,
  title                  text not null check (length(trim(title)) > 0),
  currency               currency_code not null,
  agreed_price_minor     bigint not null default 0,
  estimated_cost_minor   bigint not null default 0 check (estimated_cost_minor >= 0),
  delivery_date          date,
  status                 deal_status not null default 'draft',

  -- Frozen on close. If the owner changes the house rate in March, February's
  -- closed deals must not silently recalculate: the numbers a partner was paid
  -- against live on the deal, not in today's settings.
  closed_at              timestamptz,
  frozen_house_rate_bp   integer check (frozen_house_rate_bp between 0 and 10000),
  frozen_fx_rate         numeric(30, 12) check (frozen_fx_rate > 0),
  frozen_fx_source       text,
  frozen_fx_captured_at  timestamptz,
  frozen_split_rules     jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Composite references: a deal cannot reach into another organisation.
  foreign key (org_id, client_id)     references clients (org_id, id)  on delete restrict,
  foreign key (org_id, service_id)    references services (org_id, id) on delete set null (service_id),
  foreign key (org_id, owner_user_id) references users (org_id, id)    on delete restrict,
  unique (org_id, id),

  -- A won deal without its frozen terms is not a won deal. The freeze is a
  -- constraint, not a convention some future code path can forget.
  constraint won_deals_are_frozen check (
    status <> 'won' or (
      closed_at is not null
      and frozen_house_rate_bp is not null
      and frozen_split_rules is not null
    )
  )
);

create index if not exists deals_org_status_idx on deals (org_id, status);
create index if not exists deals_org_owner_idx on deals (org_id, owner_user_id);

-- --- audit log ---------------------------------------------------------------

create table if not exists audit_log (
  id             bigint generated always as identity primary key,
  org_id         uuid not null references organizations (id) on delete restrict,
  -- The actor is denormalised on purpose. When a partner disputes a payout two
  -- years on, the log has to say who did it even if that person's account is
  -- long gone or renamed, so it holds no foreign key to chase.
  actor_user_id  uuid,
  actor_email    text,
  actor_role     user_role,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx on audit_log (org_id, created_at desc);
create index if not exists audit_log_entity_idx on audit_log (org_id, entity_type, entity_id);
