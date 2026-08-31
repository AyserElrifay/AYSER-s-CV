-- Payouts.
--
-- The wedge. Everything before this exists so that this can be correct: when a
-- period closes, every person who touched a deal gets a number, the numbers add
-- up, and nobody can quietly change one afterwards.

do $$ begin
  create type split_rule_kind as enum ('partner_equity', 'manager_commission', 'bonus_pool');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_period_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

-- --- the policy the owner sets once ------------------------------------------

create table if not exists split_rules (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  kind                 split_rule_kind not null,
  -- Named for partner equity; null for a commission or the pool, which pay
  -- whoever the deal decides rather than a person fixed in advance.
  beneficiary_user_id  uuid,
  rate_bp              integer not null check (rate_bp between 0 and 10000),
  label                text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  foreign key (org_id, beneficiary_user_id) references users (org_id, id) on delete restrict,
  unique (org_id, id),
  constraint equity_names_its_partner check (
    (kind = 'partner_equity' and beneficiary_user_id is not null)
    or (kind <> 'partner_equity' and beneficiary_user_id is null)
  )
);

create index if not exists split_rules_org_active_idx on split_rules (org_id, is_active);

-- --- periods -----------------------------------------------------------------

create table if not exists payout_periods (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations (id) on delete cascade,
  starts_on          date not null,
  ends_on            date not null,
  status             payout_period_status not null default 'open',
  closed_at          timestamptz,
  closed_by_user_id  uuid,
  created_at         timestamptz not null default now(),
  foreign key (org_id, closed_by_user_id) references users (org_id, id) on delete restrict,
  unique (org_id, id),
  unique (org_id, starts_on),
  check (ends_on >= starts_on),
  -- A closed period without the moment and the person who closed it is not
  -- closed, it is merely marked.
  constraint closed_periods_are_stamped check (
    status <> 'closed' or (closed_at is not null and closed_by_user_id is not null)
  )
);

-- --- statements --------------------------------------------------------------

create table if not exists payout_statements (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  period_id            uuid not null,
  beneficiary_user_id  uuid not null,
  currency             currency_code not null,
  amount_minor         bigint not null,
  /*
   * The working, frozen.
   *
   * Every deal that contributed, the pool it produced, the rate applied and the
   * share paid. Held as a snapshot rather than joined at read time, because in
   * two years the deal may have been edited, the rate changed and the person
   * left — and the statement still has to say exactly what it said the day it
   * was issued.
   */
  lines                jsonb not null default '[]'::jsonb,
  issued_at            timestamptz not null default now(),
  foreign key (org_id, period_id)           references payout_periods (org_id, id) on delete restrict,
  foreign key (org_id, beneficiary_user_id) references users (org_id, id)          on delete restrict,
  unique (org_id, id),
  unique (org_id, period_id, beneficiary_user_id, currency)
);

create index if not exists payout_statements_beneficiary_idx
  on payout_statements (org_id, beneficiary_user_id, issued_at desc);

-- --- corrections, never edits -------------------------------------------------

create table if not exists payout_adjustments (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  -- The statement being corrected. The original is never touched.
  statement_id         uuid not null,
  beneficiary_user_id  uuid not null,
  currency             currency_code not null,
  -- Signed: a correction can go either way.
  amount_minor         bigint not null,
  reason               text not null check (length(trim(reason)) > 0),
  created_by_user_id   uuid not null,
  created_at           timestamptz not null default now(),
  foreign key (org_id, statement_id)        references payout_statements (org_id, id) on delete restrict,
  foreign key (org_id, beneficiary_user_id) references users (org_id, id)             on delete restrict,
  foreign key (org_id, created_by_user_id)  references users (org_id, id)             on delete restrict,
  unique (org_id, id)
);

create index if not exists payout_adjustments_statement_idx
  on payout_adjustments (org_id, statement_id);

-- --- row-level security -------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['split_rules','payout_periods','payout_statements','payout_adjustments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('revoke all on table %I from public', t);
  end loop;
end $$;

-- The owner sets the policy and closes the periods. Nobody else writes here.
grant select, insert, update, delete on split_rules     to qirat_role_owner;
grant select, insert, update         on payout_periods  to qirat_role_owner;
grant select, insert                 on payout_statements   to qirat_role_owner;
grant select, insert                 on payout_adjustments  to qirat_role_owner;

-- An account manager needs to know the rate their own commission is paid at.
grant select on split_rules    to qirat_role_manager;
grant select on payout_periods to qirat_role_manager;
grant select on payout_statements  to qirat_role_manager;
grant select on payout_adjustments to qirat_role_manager;

-- A Partner sees their own statements and nothing else in the product.
grant select on payout_periods     to qirat_role_partner;
grant select on payout_statements  to qirat_role_partner;
grant select on payout_adjustments to qirat_role_partner;
grant select (id, org_id, kind, beneficiary_user_id, rate_bp, label, is_active, created_at)
  on split_rules to qirat_role_partner;

create policy split_rules_owner_rw on split_rules
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy split_rules_manager_read on split_rules
  for select to qirat_role_manager
  using (org_id = qirat.current_org_id());

-- A partner may read the rule that names them, and no other partner's.
create policy split_rules_partner_read on split_rules
  for select to qirat_role_partner
  using (org_id = qirat.current_org_id() and beneficiary_user_id = qirat.current_user_id());

create policy payout_periods_owner_rw on payout_periods
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy payout_periods_read on payout_periods
  for select to qirat_role_manager, qirat_role_partner
  using (org_id = qirat.current_org_id());

create policy payout_statements_owner on payout_statements
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

-- The rule from the brief, enforced by the database rather than by a route:
-- "Partner — own payout statements only."
create policy payout_statements_own on payout_statements
  for select to qirat_role_manager, qirat_role_partner
  using (org_id = qirat.current_org_id() and beneficiary_user_id = qirat.current_user_id());

create policy payout_adjustments_owner on payout_adjustments
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy payout_adjustments_own on payout_adjustments
  for select to qirat_role_manager, qirat_role_partner
  using (org_id = qirat.current_org_id() and beneficiary_user_id = qirat.current_user_id());

-- --- immutability -------------------------------------------------------------

create or replace function qirat.reject_statement_change() returns trigger
language plpgsql as $$
begin
  raise exception 'A payout statement is immutable once issued; % is not permitted', tg_op
    using errcode = 'insufficient_privilege',
          hint = 'Corrections are new adjusting entries in payout_adjustments, never edits.';
end $$;

drop trigger if exists payout_statements_no_update on payout_statements;
create trigger payout_statements_no_update before update on payout_statements
  for each row execute function qirat.reject_statement_change();

drop trigger if exists payout_statements_no_delete on payout_statements;
create trigger payout_statements_no_delete before delete on payout_statements
  for each row execute function qirat.reject_statement_change();

drop trigger if exists payout_statements_no_truncate on payout_statements;
create trigger payout_statements_no_truncate before truncate on payout_statements
  for each statement execute function qirat.reject_statement_change();

-- An adjustment is itself a record of a correction, so it is equally fixed.
drop trigger if exists payout_adjustments_no_update on payout_adjustments;
create trigger payout_adjustments_no_update before update on payout_adjustments
  for each row execute function qirat.reject_statement_change();

drop trigger if exists payout_adjustments_no_delete on payout_adjustments;
create trigger payout_adjustments_no_delete before delete on payout_adjustments
  for each row execute function qirat.reject_statement_change();

-- --- a closed period stays closed ---------------------------------------------

create or replace function qirat.protect_closed_period() returns trigger
language plpgsql as $$
begin
  if old.status = 'closed' then
    raise exception 'Payout period % is closed', old.id
      using errcode = 'insufficient_privilege',
            hint = 'Reopening a period would restate statements people have been paid against. '
                   'Issue an adjustment instead.';
  end if;
  return new;
end $$;

drop trigger if exists payout_periods_stay_closed on payout_periods;
create trigger payout_periods_stay_closed before update on payout_periods
  for each row execute function qirat.protect_closed_period();
