import 'server-only';
import { sql as raw } from 'drizzle-orm';
import { type TenantContext, withTenant } from '@/db/client';
import {
  type CompanyMonth,
  type CurrencyCode,
  type Overhead,
  type OverheadCadence,
  assertCurrencyCode,
  breakEvenRevenue,
  companyMonth,
  money,
  overheadsForMonth,
  parseUserAmount,
  zero,
} from '@/money';

/**
 * The month, assembled.
 *
 * Every figure here already exists somewhere in the product — deals carry
 * revenue, costs carry spend, the work log carries labour, split rules carry
 * what was promised. What did not exist was the one place they are added up,
 * and the two lines that never appear on a deal card at all: the salaries and
 * the rent.
 *
 * Nothing is entered twice. That is the point of doing it here rather than in a
 * spreadsheet: the month is derived, so it cannot disagree with the rows.
 */

export class CompanyError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'CompanyError';
  }
}

export interface OverheadRow {
  id: string;
  name: string;
  category: string | null;
  amountMinor: bigint;
  currency: CurrencyCode;
  cadence: OverheadCadence;
  activeFrom: string;
  activeTo: string | null;
  note: string | null;
  /** What this one costs the month being looked at. */
  perMonthMinor: bigint;
}

export interface MonthView {
  month: string;
  currency: CurrencyCode;
  figures: CompanyMonth;
  dealCount: number;
  overheads: OverheadRow[];
  salaryCount: number;
  breakEvenMinor: bigint | null;
  /** The period covering this month, if one exists, and whether it is locked. */
  period: { id: string; status: 'open' | 'closed'; reopenCount: number } | null;
}

/** "2026-09" for the month a date falls in. */
export function monthOf(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function listOverheads(
  ctx: TenantContext,
  month: string,
): Promise<OverheadRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      name: string;
      category: string | null;
      amount_minor: bigint;
      currency: string;
      cadence: OverheadCadence;
      active_from: string;
      active_to: string | null;
      note: string | null;
    }>(raw`
      select id, name, category, amount_minor, currency::text as currency, cadence::text as cadence,
             active_from::text as active_from, active_to::text as active_to, note
      from overheads
      order by active_to nulls first, amount_minor desc`),
  );

  return Array.from(rows).map((row) => {
    const currency = assertCurrencyCode(row.currency);
    const overhead: Overhead = {
      amountMinor: row.amount_minor,
      currency,
      cadence: row.cadence,
      activeFrom: row.active_from,
      activeTo: row.active_to,
    };
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      amountMinor: row.amount_minor,
      currency,
      cadence: row.cadence,
      activeFrom: row.active_from,
      activeTo: row.active_to,
      note: row.note,
      perMonthMinor: overheadsForMonth([overhead], month, currency).minor,
    };
  });
}

/**
 * The whole month in one query and one function.
 *
 * The SQL gathers; the money module decides. Nothing in here rounds, allocates
 * or compares — those are the things that go wrong quietly, and they live where
 * a thousand generated cases already hammer them.
 */
export async function monthPicture(
  ctx: TenantContext,
  month: string,
  currency: CurrencyCode,
): Promise<MonthView> {
  const start = `${month}-01`;

  const [totals, splits, overheads, period] = await Promise.all([
    withTenant(ctx, (tx) =>
      tx.execute<{
        [column: string]: unknown;
        deal_count: number;
        revenue: string;
        direct_costs: string;
        labour: string;
        salaries: string;
      }>(raw`
        select
          (select count(*)::int from deals d
           where d.status = 'won' and d.currency = ${currency}
             and date_trunc('month', d.closed_at) = ${start}::date) as deal_count,
          -- Net revenue on what closed this month. VAT is not income.
          coalesce((select sum(d.agreed_price_minor) from deals d
            where d.status = 'won' and d.currency = ${currency}
              and date_trunc('month', d.closed_at) = ${start}::date), 0)::text as revenue,
          -- Suppliers, by the date the money went out rather than the date
          -- somebody typed it in.
          coalesce((select sum(c.amount_minor) from costs c
            where c.kind = 'actual' and c.currency = ${currency}
              and date_trunc('month', c.spent_on) = ${start}::date), 0)::text as direct_costs,
          -- Your own people's days, at the rate their assignment was agreed at.
          coalesce((select sum(w.amount_minor) from work_log w
            where w.currency = ${currency}
              and date_trunc('month', w.worked_on) = ${start}::date), 0)::text as labour,
          -- Salaries go out whether or not the month was busy.
          coalesce((select sum(u.monthly_salary_minor) from users u
            where u.is_active and u.salary_currency = ${currency}), 0)::text as salaries`),
    ).then((rows) => Array.from(rows)[0]!),

    // Commission and bonus already earned on this month's deals, at the rates
    // frozen onto each deal when it closed.
    withTenant(ctx, (tx) =>
      tx.execute<{ [column: string]: unknown; kind: string; rate_bp: number; beneficiary: string | null }>(
        raw`select kind::text as kind, rate_bp, beneficiary_user_id as beneficiary
            from split_rules where is_active order by kind`,
      ),
    ).then((rows) => Array.from(rows)),

    listOverheads(ctx, month),

    withTenant(ctx, (tx) =>
      tx.execute<{
        [column: string]: unknown;
        id: string;
        status: 'open' | 'closed';
        reopen_count: number;
      }>(raw`
        select id, status::text as status, reopen_count from payout_periods
        where date_trunc('month', starts_on) = ${start}::date limit 1`),
    ).then((rows) => Array.from(rows)[0] ?? null),
  ]);

  const revenue = money(BigInt(totals.revenue), currency);
  const directCosts = money(BigInt(totals.direct_costs), currency);
  const labour = money(BigInt(totals.labour), currency);
  const salaries = money(BigInt(totals.salaries), currency);

  /*
   * What the people who closed the work have already earned on it.
   *
   * Taken off before the partners divide anything, because it is a cost of the
   * month rather than a share of it — the account manager's commission is owed
   * whether or not the agency ends the month ahead.
   */
  const earnedBp = splits
    .filter((split) => split.kind !== 'partner_equity')
    .reduce((total, split) => total + split.rate_bp, 0);
  const grossBeforeSplits = revenue.minor - directCosts.minor - labour.minor;
  const earnedSplits =
    grossBeforeSplits > 0n
      ? money((grossBeforeSplits * BigInt(earnedBp)) / 10_000n, currency)
      : zero(currency);

  const partnerSplits = splits
    .filter((split) => split.kind === 'partner_equity')
    .map((split) => ({ beneficiaryUserId: split.beneficiary, rateBp: split.rate_bp }));

  const overheadTotal = money(
    overheads
      .filter((overhead) => overhead.currency === currency)
      .reduce((total, overhead) => total + overhead.perMonthMinor, 0n),
    currency,
  );

  const figures = companyMonth({
    currency,
    revenue,
    directCosts,
    labour,
    earnedSplits,
    salaries,
    overheads: overheadTotal,
    partnerSplits,
  });

  const fixed = money(salaries.minor + overheadTotal.minor, currency);
  const breakEven = breakEvenRevenue(fixed, figures.grossMarginBp);

  return {
    month,
    currency,
    figures,
    dealCount: totals.deal_count,
    overheads,
    salaryCount: partnerSplits.length,
    breakEvenMinor: breakEven?.minor ?? null,
    period: period
      ? { id: period.id, status: period.status, reopenCount: period.reopen_count }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface OverheadInput {
  name: string;
  category?: string;
  amount: string;
  currency: CurrencyCode;
  cadence: OverheadCadence;
  activeFrom?: string;
  note?: string;
}

export async function addOverhead(ctx: TenantContext, input: OverheadInput): Promise<void> {
  if (ctx.role !== 'owner') throw new CompanyError('Only the owner can do this.');
  const name = input.name.trim();
  if (name.length < 2) throw new CompanyError('What is it?', 'name');

  let minor: bigint;
  try {
    minor = parseUserAmount(input.amount, input.currency).minor;
  } catch {
    throw new CompanyError('That is not an amount.', 'amount');
  }
  if (minor < 0n) throw new CompanyError('A cost cannot be negative.', 'amount');

  const from = input.activeFrom && /^\d{4}-\d{2}-\d{2}$/.test(input.activeFrom)
    ? input.activeFrom
    : new Date().toISOString().slice(0, 10);

  await withTenant(ctx, (tx) =>
    tx.execute(raw`
      insert into overheads (org_id, name, category, amount_minor, currency, cadence,
                             active_from, note)
      values (${ctx.orgId}, ${name}, ${input.category?.trim() || null}, ${minor.toString()}::bigint,
              ${input.currency}, ${input.cadence}, ${from}::date, ${input.note?.trim() || null})`),
  );
}

/**
 * Stopping an overhead, rather than deleting one.
 *
 * The office you left in March was a real cost in February. Deleting the row
 * would rewrite February, which is the thing this whole product refuses to do.
 */
export async function endOverhead(
  ctx: TenantContext,
  id: string,
  on: string,
): Promise<void> {
  if (ctx.role !== 'owner') throw new CompanyError('Only the owner can do this.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : new Date().toISOString().slice(0, 10);
  await withTenant(ctx, (tx) =>
    tx.execute(raw`update overheads set active_to = ${date}::date where id = ${id}`),
  );
}

export async function setSalary(
  ctx: TenantContext,
  userId: string,
  amount: string,
  currency: CurrencyCode,
): Promise<void> {
  if (ctx.role !== 'owner') throw new CompanyError('Only the owner can set salaries.');
  const typed = amount.trim();
  let minor: bigint | null = null;
  if (typed) {
    try {
      minor = parseUserAmount(typed, currency).minor;
    } catch {
      throw new CompanyError('That is not an amount.', 'salary');
    }
    if (minor < 0n) throw new CompanyError('A salary cannot be negative.', 'salary');
  }

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      update users
      set monthly_salary_minor = ${minor === null ? null : minor.toString()}::bigint,
          salary_currency = ${minor === null ? null : currency}
      where id = ${userId}`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${ctx.orgId}, ${ctx.userId}, 'owner', 'owner', 'user.salary_changed', 'user',
              ${userId}, ${JSON.stringify({ monthlySalaryMinor: minor?.toString() ?? null, currency })}::jsonb)`);
  });
}

/**
 * Reopening a month.
 *
 * Allowed, by the owner, with a reason — because the alternative is not a
 * protected month, it is a correction made somewhere the product cannot see.
 * The statements already issued stay immutable; what reopening buys is the
 * ability to close again with the truth in it.
 */
export async function reopenPeriod(
  ctx: TenantContext,
  periodId: string,
  reason: string,
): Promise<void> {
  if (ctx.role !== 'owner') throw new CompanyError('Only the owner can reopen a month.');
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    throw new CompanyError('Say why, in a sentence somebody will read next year.', 'reason');
  }

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      update payout_periods
      set status = 'open',
          reopened_at = now(),
          reopened_by_user_id = ${ctx.userId},
          reopen_reason = ${trimmed},
          reopen_count = reopen_count + 1
      where id = ${periodId} and status = 'closed'`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${ctx.orgId}, ${ctx.userId}, 'owner', 'owner', 'period.reopened', 'payout_period',
              ${periodId}, ${JSON.stringify({ reason: trimmed })}::jsonb)`);
  });
}
