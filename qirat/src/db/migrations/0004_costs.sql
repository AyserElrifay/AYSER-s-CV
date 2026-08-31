-- Costs.
--
-- Until these exist, every margin in the system is an estimate wearing a
-- precise-looking number. A deal card that says 64% when nobody has recorded
-- the videographer, the stock licence and the courier is not reporting a
-- margin — it is reporting a hope.

do $$ begin
  create type cost_kind as enum ('estimated', 'actual');
exception when duplicate_object then null; end $$;

create table if not exists costs (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  deal_id              uuid not null,
  kind                 cost_kind not null default 'actual',
  amount_minor         bigint not null check (amount_minor >= 0),
  currency             currency_code not null,
  vendor               text,
  description          text,
  spent_on             date not null default current_date,
  -- Set once object storage exists. A cost with no receipt is still a cost:
  -- making the photo mandatory is how a system stops being used on a Thursday
  -- afternoon when someone is standing in a print shop.
  receipt_url          text,
  recorded_by_user_id  uuid not null,
  created_at           timestamptz not null default now(),

  -- Composite, so a cost cannot attach to another organisation's deal.
  foreign key (org_id, deal_id)             references deals (org_id, id) on delete cascade,
  foreign key (org_id, recorded_by_user_id) references users (org_id, id) on delete restrict,
  unique (org_id, id)
);

create index if not exists costs_org_deal_idx on costs (org_id, deal_id);
create index if not exists costs_org_spent_idx on costs (org_id, spent_on desc);

-- How far actual may drift from the estimate before the card says something.
alter table organizations
  add column if not exists cost_drift_alert_bp integer not null default 1500
  check (cost_drift_alert_bp between 0 and 100000);

-- --- row-level security ------------------------------------------------------

alter table costs enable row level security;
alter table costs force  row level security;
revoke all on table costs from public;

grant select, insert, update, delete on costs to qirat_role_owner;
grant select, insert on costs to qirat_role_manager;

/*
 * A Member may record a cost and may not read one.
 *
 * The brief is absolute that a Member never receives a financial field, and it
 * is right. But a freelancer standing in a print shop with a receipt is exactly
 * who should be recording that number, and refusing them would push the whole
 * thing back into WhatsApp and a spreadsheet.
 *
 * INSERT without SELECT resolves it. They can hand a number in; they cannot
 * read it, or any other, back out — not their own, not anyone's. Postgres
 * enforces the asymmetry, so no API route has to remember it.
 */
grant insert on costs to qirat_role_member;

create policy costs_owner_rw on costs
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

-- An account manager sees costs on their own deals. The subquery is evaluated
-- under their own policies on `deals`, so it cannot reach a colleague's.
create policy costs_manager_read on costs
  for select to qirat_role_manager
  using (
    org_id = qirat.current_org_id()
    and exists (select 1 from deals d where d.id = costs.deal_id)
  );

create policy costs_manager_write on costs
  for insert to qirat_role_manager
  with check (
    org_id = qirat.current_org_id()
    and recorded_by_user_id = qirat.current_user_id()
    and exists (select 1 from deals d where d.id = costs.deal_id)
  );

-- No USING clause is possible for a role with no SELECT, which is the point:
-- a Member's insert is checked and then invisible to them.
create policy costs_member_write on costs
  for insert to qirat_role_member
  with check (
    org_id = qirat.current_org_id()
    and recorded_by_user_id = qirat.current_user_id()
  );

-- --- the organisation's drift threshold --------------------------------------

-- Owners and managers need it to render the card; nobody else does.
grant select (cost_drift_alert_bp) on organizations to qirat_role_manager;
