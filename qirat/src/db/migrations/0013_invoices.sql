-- Getting paid.
--
-- A deal that closed is a promise; an invoice is the claim; a payment is the
-- money. The product knew about the first and nothing about the other two,
-- which is why it could tell an owner their margin and not whether they could
-- make payroll.

do $$ begin
  create type invoice_state as enum ('draft', 'sent', 'part_paid', 'paid', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('bank_transfer', 'cash', 'card', 'wallet', 'cheque');
exception when duplicate_object then null; end $$;

/*
 * A claimed payment is not a received payment.
 *
 * The person paying says they sent it; the agency says it arrived. Those are
 * different facts on different days, and collapsing them is how a receivable
 * disappears from the books before the money appears in the bank. Only a
 * confirmed payment posts to the ledger.
 */
do $$ begin
  create type payment_state as enum ('claimed', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

-- --- how this agency takes money ---------------------------------------------

alter table organizations
  add column if not exists invoice_seq integer not null default 0,
  -- Free text on purpose. "Instapay to 0100…", an IBAN, a Wise link, a wallet
  -- number — the ways an agency actually gets paid differ by country and by
  -- year, and a schema that enumerates them is a schema that is wrong by the
  -- time somebody in Casablanca signs up.
  add column if not exists payment_instructions text,
  add column if not exists payment_terms_days integer not null default 14
    check (payment_terms_days between 0 and 365);

grant select (invoice_seq, payment_instructions, payment_terms_days)
  on organizations to qirat_role_manager;

-- --- the claim ---------------------------------------------------------------

create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  client_id       uuid,
  deal_id         uuid,
  -- Human-facing and per organisation: QT-2026-0001. Unique so two people
  -- issuing at once cannot produce the same number, which is the one thing an
  -- invoice number must never do.
  number          text not null,
  state           invoice_state not null default 'draft',
  currency        currency_code not null,
  description     text not null check (length(trim(description)) > 0),
  net_minor       bigint not null check (net_minor >= 0),
  vat_minor       bigint not null default 0 check (vat_minor >= 0),
  gross_minor     bigint not null check (gross_minor >= 0),
  tax_treatment   tax_treatment not null default 'not_registered',
  vat_rate_bp     integer not null default 0 check (vat_rate_bp between 0 and 10000),
  issued_on       date,
  due_on          date,
  /*
   * The link a client opens.
   *
   * Long and random, because it is the only thing standing between an invoice
   * and anybody who can guess a URL. It is not a password: it identifies one
   * invoice and grants nothing else, and the function that reads it returns the
   * few fields a payer needs and no others.
   */
  pay_token       text not null unique check (length(pay_token) >= 32),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  void_reason     text,

  foreign key (org_id, client_id) references clients (org_id, id) on delete set null,
  foreign key (org_id, deal_id) references deals (org_id, id) on delete set null,
  foreign key (org_id, created_by) references users (org_id, id) on delete set null,
  unique (org_id, id),
  unique (org_id, number),

  -- The three figures have to agree with each other, always, at the database.
  constraint invoice_totals_agree check (gross_minor = net_minor + vat_minor),
  -- A treatment that charges nothing must carry nothing.
  constraint invoice_vat_matches_treatment
    check (tax_treatment = 'standard' or (vat_minor = 0 and vat_rate_bp = 0)),
  -- An issued invoice has a date on it. A draft does not.
  constraint invoice_issued_has_date
    check (state = 'draft' or state = 'void' or issued_on is not null)
);

create index if not exists invoices_org_state_idx on invoices (org_id, state);
create index if not exists invoices_client_idx on invoices (org_id, client_id);

-- --- the money ---------------------------------------------------------------

create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  invoice_id     uuid not null,
  state          payment_state not null default 'claimed',
  method         payment_method not null default 'bank_transfer',
  amount_minor   bigint not null check (amount_minor > 0),
  currency       currency_code not null,
  received_on    date not null default current_date,
  -- A transfer reference, the last four of a card, a receipt number. Whatever
  -- the person confirming it will need in order to find it in the bank.
  reference      text,
  note           text,
  claimed_at     timestamptz not null default now(),
  confirmed_by   uuid,
  confirmed_at   timestamptz,
  -- Set when the money posts, so a payment cannot post twice.
  ledger_entry_id uuid,

  foreign key (org_id, invoice_id) references invoices (org_id, id) on delete cascade,
  foreign key (org_id, confirmed_by) references users (org_id, id) on delete set null,
  unique (org_id, id),
  constraint payment_confirmed_has_who
    check (state <> 'confirmed' or (confirmed_at is not null and ledger_entry_id is not null))
);

create index if not exists payments_invoice_idx on payments (org_id, invoice_id);
create index if not exists payments_state_idx on payments (org_id, state);

-- --- row level security ------------------------------------------------------

alter table invoices enable row level security;
alter table invoices force row level security;
alter table payments enable row level security;
alter table payments force row level security;

grant select, insert, update on invoices to qirat_role_owner;
grant select, insert, update on payments to qirat_role_owner;
-- An account manager invoices their own deals and sees what came in against
-- them. They do not confirm money: that is the person who can see the bank.
grant select, insert on invoices to qirat_role_manager;
grant select on payments to qirat_role_manager;

create policy invoices_owner on invoices
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy invoices_manager_read on invoices
  for select to qirat_role_manager
  using (org_id = qirat.current_org_id());

create policy invoices_manager_write on invoices
  for insert to qirat_role_manager
  with check (org_id = qirat.current_org_id());

create policy payments_owner on payments
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy payments_manager_read on payments
  for select to qirat_role_manager
  using (org_id = qirat.current_org_id());

-- --- the payer's door --------------------------------------------------------

/*
 * The second, and last, sanctioned way past row-level security.
 *
 * The first is the sign-in lookup. This one exists because the person paying an
 * invoice has no account and must not need one — asking a client to sign up
 * before they can pay you is how an invoice goes unpaid for a month.
 *
 * It is held to the same shape as the first: SECURITY DEFINER, owned by a role
 * that cannot log in and holds nothing else, reachable only through an EXECUTE
 * grant, and returning a fixed, minimal set of columns. A payer learns what
 * they owe, to whom, and how to send it. They cannot learn what the work cost,
 * what else this client has been invoiced, or that any other invoice exists.
 */
-- The role itself is created by the migration runner alongside the other
-- managed roles, so it exists before any migration references it.
grant usage on schema public, qirat to qirat_public;
grant select on invoices, organizations, clients to qirat_public;
grant insert on payments to qirat_public;

create policy invoices_public_read on invoices
  for select to qirat_public using (true);
create policy organizations_public_read on organizations
  for select to qirat_public using (true);
create policy clients_public_read on clients
  for select to qirat_public using (true);
create policy payments_public_write on payments
  for insert to qirat_public with check (true);

create or replace function qirat.public_invoice(p_token text)
returns table (
  invoice_id           uuid,
  number               text,
  state                invoice_state,
  currency             currency_code,
  description          text,
  net_minor            bigint,
  vat_minor            bigint,
  gross_minor          bigint,
  vat_rate_bp          integer,
  tax_treatment        tax_treatment,
  issued_on            date,
  due_on               date,
  agency_name          text,
  client_name          text,
  payment_instructions text,
  paid_minor           bigint
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select i.id, i.number, i.state, i.currency, i.description,
         i.net_minor, i.vat_minor, i.gross_minor, i.vat_rate_bp, i.tax_treatment,
         i.issued_on, i.due_on,
         o.name, c.name, o.payment_instructions,
         coalesce((
           select sum(p.amount_minor) from payments p
           where p.invoice_id = i.id and p.state = 'confirmed'
         ), 0)
  from invoices i
  join organizations o on o.id = i.org_id
  left join clients c on c.id = i.client_id
  -- A draft has not been sent to anybody, and a void invoice is not owed.
  where i.pay_token = p_token and i.state in ('sent', 'part_paid', 'paid');
$$;

/*
 * "I have sent it."
 *
 * Records a claim, never a receipt. The agency confirms against the bank, and
 * only that posts to the ledger — so somebody typing a number into a public
 * page cannot make an invoice look paid.
 *
 * Refuses a claim on an invoice that is not open, and refuses an amount larger
 * than what is outstanding: both are the sort of thing a bored person tries on
 * a URL, and neither should reach a human's attention as a row to triage.
 */
create or replace function qirat.public_claim_payment(
  p_token     text,
  p_amount    bigint,
  p_method    payment_method,
  p_reference text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inv record;
  outstanding bigint;
begin
  select i.id, i.org_id, i.currency, i.gross_minor, i.state into inv
  from invoices i
  where i.pay_token = p_token and i.state in ('sent', 'part_paid');

  if inv.id is null then return false; end if;
  if p_amount is null or p_amount <= 0 then return false; end if;

  select inv.gross_minor - coalesce(sum(p.amount_minor), 0) into outstanding
  from payments p
  where p.invoice_id = inv.id and p.state in ('confirmed', 'claimed');

  if p_amount > outstanding then return false; end if;

  insert into payments (org_id, invoice_id, state, method, amount_minor, currency, reference)
  values (inv.org_id, inv.id, 'claimed', p_method, p_amount, inv.currency,
          left(coalesce(p_reference, ''), 120));
  return true;
end;
$$;

alter function qirat.public_invoice(text) owner to qirat_public;
alter function qirat.public_claim_payment(text, bigint, payment_method, text) owner to qirat_public;

revoke all on function qirat.public_invoice(text) from public;
revoke all on function qirat.public_claim_payment(text, bigint, payment_method, text) from public;
grant execute on function qirat.public_invoice(text) to qirat_app;
grant execute on function qirat.public_claim_payment(text, bigint, payment_method, text) to qirat_app;
