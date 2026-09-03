-- What the company costs, and what is actually left.
--
-- The product could tell you a deal's margin. It could not tell you whether the
-- agency made money, because a deal's margin does not know about the rent, the
-- subscriptions, the accountant, or the salaries that go out whether or not
-- anybody booked anything that month.
--
-- Those are the numbers an owner is actually asking about when they ask how
-- they are doing, and they are exactly the ones that never make it into a
-- spreadsheet of jobs.

do $$ begin
  create type overhead_cadence as enum ('monthly', 'quarterly', 'yearly', 'one_off');
exception when duplicate_object then null; end $$;

/*
 * Overheads: the cost of being open.
 *
 * Rent, software, the accountant, the internet. None of it belongs to a deal
 * and all of it has to be earned before anybody takes a share — which is why an
 * agency can run a year of healthy-looking margins and have nothing at the end.
 *
 * `active_from` and `active_to` rather than a delete: an office you left in
 * March was a real cost in February, and February must keep saying so.
 */
create table if not exists overheads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  category      text,
  amount_minor  bigint not null check (amount_minor >= 0),
  currency      currency_code not null,
  cadence       overhead_cadence not null default 'monthly',
  active_from   date not null default current_date,
  active_to     date,
  note          text,
  created_at    timestamptz not null default now(),

  unique (org_id, id),
  constraint overhead_dates_ordered check (active_to is null or active_to >= active_from)
);

create index if not exists overheads_org_idx on overheads (org_id, active_from);

alter table overheads enable row level security;
alter table overheads force row level security;

-- What the company costs is the owner's business and nobody else's.
grant select, insert, update, delete on overheads to qirat_role_owner;

create policy overheads_owner on overheads
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

-- --- what people are paid every month ----------------------------------------

/*
 * A salary is not a day rate.
 *
 * The day rate says what an hour of somebody's time costs a job. The salary
 * says what they cost the company whether or not a job exists. Most agencies
 * have both kinds of person, and confusing them is how a studio with four
 * salaried staff believes its 45% margins mean it is comfortable.
 */
alter table users
  add column if not exists monthly_salary_minor bigint
    check (monthly_salary_minor is null or monthly_salary_minor >= 0),
  add column if not exists salary_currency currency_code;

alter table users
  add constraint users_salary_has_currency
    check ((monthly_salary_minor is null) = (salary_currency is null)) not valid;
alter table users validate constraint users_salary_has_currency;

grant select (monthly_salary_minor, salary_currency) on users to qirat_role_owner;
-- A person may see their own salary and nobody else's: RLS already limits a
-- Member and a Partner to their own row, the same shape as their own day rate.
grant select (monthly_salary_minor, salary_currency)
  on users to qirat_role_member, qirat_role_partner;

-- --- booking a shoot ---------------------------------------------------------

/*
 * The day the work happens, which is not the day it is delivered.
 *
 * A shoot is booked for a date, crewed for that date, and delivered weeks
 * later. Without the production date nothing can tell anybody that three jobs
 * are booked on the same Tuesday with one camera operator.
 */
alter table deals
  add column if not exists booked_on date,
  add column if not exists booking_note text;

create index if not exists deals_booked_idx on deals (org_id, booked_on);

-- --- a month that can be reopened --------------------------------------------

/*
 * Closing a month is a decision. Reopening one is a bigger decision.
 *
 * The rule used to be that a closed period could never move, which is correct
 * right up until the afternoon somebody finds a 40,000 cost that belonged in
 * last month. At that point an unbreakable lock does not protect the numbers —
 * it moves the correction somewhere the product cannot see.
 *
 * So a period reopens: by the owner, with a reason, and it says so afterwards.
 * The statements already issued stay immutable — they were real, somebody may
 * have been paid against them, and a correction is an adjusting entry. What
 * reopening buys is the ability to close again with the truth in it.
 */
alter table payout_periods
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by_user_id uuid,
  add column if not exists reopen_reason text,
  add column if not exists reopen_count integer not null default 0;

alter table payout_periods
  add constraint reopened_periods_are_explained check (
    reopen_count = 0
    or (reopened_at is not null and reopened_by_user_id is not null
        and length(trim(coalesce(reopen_reason, ''))) >= 8)
  ) not valid;
alter table payout_periods validate constraint reopened_periods_are_explained;

/*
 * The trigger now separates the two things it used to refuse together.
 *
 * Editing a closed period's dates is still impossible. Moving it back to open —
 * only that, with a reason and a stamp — is allowed, and increments a counter,
 * so a period reopened four times cannot pretend it closed cleanly.
 */
create or replace function qirat.protect_closed_period() returns trigger
language plpgsql as $$
begin
  if old.status = 'closed' then
    if new.status = 'open'
       and new.reopened_at is not null
       and new.reopened_by_user_id is not null
       and length(trim(coalesce(new.reopen_reason, ''))) >= 8
       and new.reopen_count = old.reopen_count + 1
       and new.starts_on = old.starts_on
       and new.ends_on = old.ends_on
    then
      return new;
    end if;
    raise exception 'Payout period % is closed', old.id
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
