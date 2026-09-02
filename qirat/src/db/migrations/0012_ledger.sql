-- The books.
--
-- Until now the product could tell you what a deal was worth. It could not tell
-- you whether the money arrived, what is left after the tax you are holding for
-- somebody else, or whether you can make payroll on Thursday. Those are
-- different questions and only one of them is about margin.
--
-- Double entry, and not because accountants like it. Every movement is written
-- twice, in opposite directions, and a constraint refuses any entry whose sides
-- do not cancel. That single rule is what makes "how much do I have" an answer
-- rather than an opinion: a number that does not balance cannot be stored, so a
-- total can never quietly drift away from the rows that produced it.

do $$ begin
  create type ledger_account as enum (
    -- Assets
    'cash',              -- what is actually in the bank
    'receivable',        -- invoiced and not yet paid
    'vat_receivable',    -- input VAT the authority owes back
    -- Liabilities
    'vat_payable',       -- VAT collected and owed onward. Never yours.
    'payroll_payable',   -- salaries earned and not yet transferred
    'partner_payable',   -- statements issued and not yet paid out
    -- Income and expense
    'revenue',
    'cost_of_delivery',  -- suppliers, and your own people's days
    'payroll_expense',
    'other_expense'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_source as enum (
    'invoice', 'payment', 'cost', 'work', 'payroll', 'payout', 'adjustment', 'opening'
  );
exception when duplicate_object then null; end $$;

/*
 * An entry is one economic event. Its lines are how that event moved money.
 *
 * `occurred_on` is the date the thing happened, which is not the date somebody
 * typed it in. A cost paid on the 29th and entered on the 3rd belongs in the
 * month it was paid, or every month-end is wrong by however long people are
 * behind on their admin.
 */
create table if not exists ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  occurred_on  date not null default current_date,
  currency     currency_code not null,
  source       ledger_source not null,
  -- What in the product caused this. Not a foreign key: the sources are in
  -- different tables and an entry must survive its cause being deleted, because
  -- the books are a record of what happened, not a view of what still exists.
  source_id    uuid,
  memo         text not null check (length(trim(memo)) > 0),
  posted_by    uuid,
  created_at   timestamptz not null default now(),

  foreign key (org_id, posted_by) references users (org_id, id) on delete set null,
  unique (org_id, id)
);

create index if not exists ledger_entries_when_idx on ledger_entries (org_id, occurred_on desc);
create index if not exists ledger_entries_source_idx on ledger_entries (org_id, source, source_id);

/*
 * `amount_minor` is signed, and the sign is the direction.
 *
 * Positive is a debit, negative is a credit — one column instead of two, so
 * "does this entry balance" is `sum(amount_minor) = 0` rather than a comparison
 * between two sums that can each be right while the pair is wrong.
 */
create table if not exists ledger_lines (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  entry_id     uuid not null,
  account      ledger_account not null,
  amount_minor bigint not null check (amount_minor <> 0),
  currency     currency_code not null,
  -- Who or what this side is about: the client on a receivable, the person on a
  -- payroll line. Nullable, because cash is nobody's in particular.
  party_id     uuid,
  note         text,

  foreign key (org_id, entry_id) references ledger_entries (org_id, id) on delete cascade,
  unique (org_id, id)
);

create index if not exists ledger_lines_entry_idx on ledger_lines (org_id, entry_id);
create index if not exists ledger_lines_account_idx on ledger_lines (org_id, account, currency);

/*
 * The rule the whole thing rests on.
 *
 * A CONSTRAINT TRIGGER, deferred to commit time, because the lines of an entry
 * arrive as separate statements and an entry is legitimately unbalanced in the
 * middle of being written. Checked once, at the end, when the transaction
 * claims it is finished — which is the only moment the question is meaningful.
 *
 * It also refuses an entry whose lines are in a currency the entry is not, and
 * an entry with no lines at all. A row that says a thing happened and cannot
 * say what moved is not a record of anything.
 */
create or replace function qirat.assert_entry_balances()
returns trigger
language plpgsql
as $$
declare
  imbalance bigint;
  line_count integer;
  wrong_currency integer;
begin
  select count(*), coalesce(sum(l.amount_minor), 0),
         count(*) filter (where l.currency <> e.currency)
    into line_count, imbalance, wrong_currency
  from ledger_entries e
  left join ledger_lines l on l.entry_id = e.id
  where e.id = new.id;

  if line_count = 0 then
    raise exception 'ledger entry % has no lines', new.id
      using errcode = 'check_violation';
  end if;

  if wrong_currency > 0 then
    raise exception 'ledger entry % mixes currencies', new.id
      using errcode = 'check_violation';
  end if;

  if imbalance <> 0 then
    raise exception 'ledger entry % does not balance: off by %', new.id, imbalance
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists ledger_entries_balance on ledger_entries;
create constraint trigger ledger_entries_balance
  after insert or update on ledger_entries
  deferrable initially deferred
  for each row execute function qirat.assert_entry_balances();

/*
 * The books do not get edited.
 *
 * Same rule as the audit log and the payout statements, and for the same
 * reason: a correction is a new entry in the opposite direction, which leaves
 * both the mistake and the fix visible. An accounting system whose history can
 * be rewritten is a system whose history means nothing.
 */
create or replace function qirat.refuse_ledger_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'the ledger is append-only; post a reversing entry instead'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists ledger_entries_immutable on ledger_entries;
create trigger ledger_entries_immutable
  before update or delete on ledger_entries
  for each row execute function qirat.refuse_ledger_change();

drop trigger if exists ledger_lines_immutable on ledger_lines;
create trigger ledger_lines_immutable
  before update or delete on ledger_lines
  for each row execute function qirat.refuse_ledger_change();

-- --- row level security ------------------------------------------------------

alter table ledger_entries enable row level security;
alter table ledger_entries force row level security;
alter table ledger_lines enable row level security;
alter table ledger_lines force row level security;

/*
 * The books are the Owner's.
 *
 * An account manager sees their own deals' economics and has no business with
 * the agency's cash position, its VAT liability or its payroll. A Member and a
 * Partner get nothing at all. This is the narrowest grant in the schema and it
 * should stay that way.
 */
grant select, insert on ledger_entries to qirat_role_owner;
grant select, insert on ledger_lines to qirat_role_owner;

create policy ledger_entries_owner on ledger_entries
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy ledger_lines_owner on ledger_lines
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());
