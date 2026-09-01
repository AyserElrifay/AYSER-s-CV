import 'server-only';
import { sql as raw } from 'drizzle-orm';
import { type TenantContext, withTenant } from '@/db/client';
import {
  type CurrencyCode,
  type Money,
  assertCurrencyCode,
  money,
  parseDays,
  priceWork,
  WorkQuantityError,
} from '@/money';

/**
 * Staffing a deal, and the days that follow from it.
 *
 * The two halves of the same idea: who is on this, and what their time on it
 * cost. Every margin in the product was previously computed as though the
 * agency's own people were free, which is the single most flattering assumption
 * a spreadsheet can make.
 */

export interface AssignmentRow {
  id: string;
  dealId: string;
  dealTitle: string;
  clientName: string | null;
  userId: string;
  personName: string;
  dayRateMinor: bigint;
  currency: CurrencyCode;
  note: string | null;
  /** Days already logged against this assignment, in hundredths. */
  daysLogged: number;
  loggedMinor: bigint;
}

export class AssignmentError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'AssignmentError';
  }
}

/**
 * Put somebody on a deal.
 *
 * The rate is read from the person and written onto the assignment, where it
 * stops moving. That is the whole point: a raise in June must not change what
 * April's work cost, and nothing downstream should ever have to ask what
 * somebody's rate is *today* to price what they did in the spring.
 */
export async function assignToDeal(
  ctx: TenantContext,
  dealId: string,
  userId: string,
  rateOverrideMinor?: bigint,
): Promise<void> {
  if (ctx.role !== 'owner' && ctx.role !== 'account_manager') {
    throw new AssignmentError('Only an owner or an account manager can staff a deal.');
  }

  await withTenant(ctx, async (tx) => {
    const rows = await tx.execute<{
      [column: string]: unknown;
      day_rate_minor: bigint | null;
      rate_currency: string | null;
      deal_currency: string;
      person: string;
    }>(raw`
      select u.day_rate_minor, u.rate_currency::text as rate_currency,
             d.currency::text as deal_currency, u.name as person
      from users u
      cross join deals d
      where u.id = ${userId} and d.id = ${dealId} and u.is_active`);
    const row = Array.from(rows)[0];
    if (!row) throw new AssignmentError('That person or that deal is not available.');

    const rate = rateOverrideMinor ?? row.day_rate_minor;
    if (rate === null || rate === undefined) {
      throw new AssignmentError(
        `${row.person} has no day rate yet. Set one before putting them on a deal.`,
        'dayRate',
      );
    }
    /*
     * A euro rate on an Egyptian deal is a mistake, not a conversion.
     *
     * Converting here would need an FX rate, and the only FX rate this product
     * trusts is the one frozen onto a deal at close — which has not happened
     * yet. Refusing is the honest answer until that path exists.
     */
    if (row.rate_currency && row.rate_currency !== row.deal_currency && !rateOverrideMinor) {
      throw new AssignmentError(
        `${row.person} is paid in ${row.rate_currency} and this deal is in ${row.deal_currency}. Set a rate for this deal.`,
        'dayRate',
      );
    }

    await tx.execute(raw`
      insert into deal_assignments (org_id, deal_id, user_id, day_rate_minor, currency)
      values (${ctx.orgId}, ${dealId}, ${userId}, ${rate.toString()}::bigint, ${row.deal_currency})
      on conflict (org_id, deal_id, user_id) do nothing`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${ctx.orgId}, ${ctx.userId}, 'staffing', ${raw.raw(`'${ctx.role}'::user_role`)},
              'deal.staffed', 'deal', ${dealId},
              ${JSON.stringify({ userId, dayRateMinor: rate.toString() })}::jsonb)`);
  });
}

export async function removeFromDeal(
  ctx: TenantContext,
  dealId: string,
  userId: string,
): Promise<void> {
  if (ctx.role !== 'owner' && ctx.role !== 'account_manager') {
    throw new AssignmentError('Only an owner or an account manager can change staffing.');
  }
  await withTenant(ctx, (tx) =>
    tx.execute(raw`
      delete from deal_assignments where deal_id = ${dealId} and user_id = ${userId}`),
  );
}

/**
 * What one person is on.
 *
 * Read under their own policies, so a Member calling this gets their own work
 * and could not get anybody else's if the route asked for it.
 */
export async function myAssignments(ctx: TenantContext): Promise<AssignmentRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      deal_id: string;
      deal_title: string;
      client_name: string | null;
      user_id: string;
      person_name: string;
      day_rate_minor: bigint;
      currency: string;
      note: string | null;
      days_logged: number;
      logged_minor: string;
    }>(raw`
      select a.id, a.deal_id, d.title as deal_title, c.name as client_name,
             a.user_id, u.name as person_name, a.day_rate_minor,
             a.currency::text as currency, a.note,
             coalesce((
               select sum(w.days)::int from work_log w
               where w.deal_id = a.deal_id and w.user_id = a.user_id
             ), 0) as days_logged,
             coalesce((
               select sum(w.amount_minor) from work_log w
               where w.deal_id = a.deal_id and w.user_id = a.user_id
             ), 0)::text as logged_minor
      from deal_assignments a
      join deals d on d.id = a.deal_id
      join users u on u.id = a.user_id
      left join clients c on c.id = d.client_id
      order by d.delivery_date nulls last, d.title`),
  );
  return Array.from(rows).map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    dealTitle: row.deal_title,
    clientName: row.client_name,
    userId: row.user_id,
    personName: row.person_name,
    dayRateMinor: row.day_rate_minor,
    currency: assertCurrencyCode(row.currency),
    note: row.note,
    daysLogged: row.days_logged,
    loggedMinor: BigInt(row.logged_minor),
  }));
}

export interface WorkLogRow {
  id: string;
  dealId: string;
  dealTitle: string | null;
  personName: string | null;
  workedOn: string;
  days: number;
  amount: Money;
  note: string | null;
}

/** A person's own recent days. Under RLS this is theirs and nobody else's. */
export async function myWorkLog(ctx: TenantContext, limit = 30): Promise<WorkLogRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      deal_id: string;
      deal_title: string | null;
      person_name: string | null;
      worked_on: string;
      days: number;
      amount_minor: bigint;
      currency: string;
      note: string | null;
    }>(raw`
      select w.id, w.deal_id, d.title as deal_title, u.name as person_name,
             w.worked_on::text as worked_on, w.days, w.amount_minor,
             w.currency::text as currency, w.note
      from work_log w
      left join deals d on d.id = w.deal_id
      left join users u on u.id = w.user_id
      order by w.worked_on desc, w.created_at desc
      limit ${limit}`),
  );
  return Array.from(rows).map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    dealTitle: row.deal_title,
    personName: row.person_name,
    workedOn: row.worked_on,
    days: row.days,
    amount: money(row.amount_minor, assertCurrencyCode(row.currency)),
    note: row.note,
  }));
}

/**
 * Log a day.
 *
 * The rate comes off the assignment, never off the person and never off the
 * request. A page that could name its own rate is a page that can price a
 * designer's afternoon at anything it likes.
 *
 * The amount is computed here, by the same function the tests hammer, and
 * stored — so the row keeps saying what it said when it was written, whatever
 * happens to the rate afterwards.
 */
export async function logWork(
  ctx: TenantContext,
  input: { dealId: string; days: string; workedOn: string; note?: string },
): Promise<{ amount: Money; days: number }> {
  let days: number;
  try {
    days = parseDays(input.days);
  } catch (error) {
    if (error instanceof WorkQuantityError) throw new AssignmentError(error.message, 'days');
    throw error;
  }

  const workedOn = /^\d{4}-\d{2}-\d{2}$/.test(input.workedOn)
    ? input.workedOn
    : new Date().toISOString().slice(0, 10);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.execute<{
      [column: string]: unknown;
      day_rate_minor: bigint;
      currency: string;
    }>(raw`
      select day_rate_minor, currency::text as currency
      from deal_assignments
      where deal_id = ${input.dealId} and user_id = ${ctx.userId}`);
    const assignment = Array.from(rows)[0];
    if (!assignment) {
      // Not an error about permissions: they are not on this deal, which is a
      // different and more useful thing to say.
      throw new AssignmentError('You are not on that deal.', 'dealId');
    }

    const currency = assertCurrencyCode(assignment.currency);
    const amount = priceWork(days, money(assignment.day_rate_minor, currency));

    await tx.execute(raw`
      insert into work_log (org_id, deal_id, user_id, worked_on, days, day_rate_minor,
                            currency, amount_minor, note)
      values (${ctx.orgId}, ${input.dealId}, ${ctx.userId}, ${workedOn}::date, ${days},
              ${assignment.day_rate_minor.toString()}::bigint, ${currency},
              ${amount.minor.toString()}::bigint, ${input.note?.trim() || null})`);

    return { amount, days };
  });
}
