import 'server-only';
import { sql as raw } from 'drizzle-orm';
import { type TenantContext, withTenant } from '@/db/client';
import {
  type CurrencyCode,
  type DealContribution,
  type PayoutRun,
  type SplitRule,
  type SplitRuleKind,
  assertCurrencyCode,
  computePayouts,
  effectiveCost,
  money,
} from '@/money';

/**
 * Reading the period.
 *
 * A deal belongs to the period whose dates contain the moment it closed. That
 * is the whole rule, and it is deliberately the whole rule: anything cleverer —
 * deals moved between periods, partial recognition — is a place where the same
 * profit gets paid out twice and nobody notices for a quarter.
 */

export interface PeriodRow {
  id: string;
  startsOn: string;
  endsOn: string;
  status: 'open' | 'closed';
  closedAt: Date | null;
}

export interface SplitRuleRow extends SplitRule {
  label: string | null;
  beneficiaryName: string | null;
}

export async function getSplitRules(ctx: TenantContext): Promise<SplitRuleRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      kind: SplitRuleKind;
      beneficiary_user_id: string | null;
      rate_bp: number;
      label: string | null;
      beneficiary_name: string | null;
    }>(raw`
      select r.id, r.kind::text as kind, r.beneficiary_user_id, r.rate_bp, r.label,
             u.name as beneficiary_name
      from split_rules r
      left join users u on u.id = r.beneficiary_user_id
      where r.is_active
      order by r.kind, r.created_at`),
  );
  return Array.from(rows).map((row) => ({
    id: row.id,
    kind: row.kind,
    beneficiaryUserId: row.beneficiary_user_id,
    rateBp: row.rate_bp,
    label: row.label,
    beneficiaryName: row.beneficiary_name,
  }));
}

export async function getPeriods(ctx: TenantContext, limit = 12): Promise<PeriodRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      starts_on: string;
      ends_on: string;
      status: 'open' | 'closed';
      closed_at: Date | null;
    }>(raw`
      select id, starts_on::text as starts_on, ends_on::text as ends_on,
             status::text as status, closed_at
      from payout_periods order by starts_on desc limit ${limit}`),
  );
  return Array.from(rows).map((row) => ({
    id: row.id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    closedAt: row.closed_at,
  }));
}

/**
 * Gather the deals a period covers and run the engine over them.
 *
 * Every input comes off the deal as frozen: the price it closed at, the house
 * rate in force that day, and the split rules as they stood. Nothing is read
 * from today's settings, which is why closing February in March produces
 * February's numbers.
 */
export async function buildPayoutRun(
  ctx: TenantContext,
  periodId: string,
): Promise<{ run: PayoutRun; dealCount: number }> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      owner_user_id: string;
      currency: string;
      agreed_price_minor: bigint;
      estimated_cost_minor: bigint;
      actual_cost_minor: string;
      frozen_house_rate_bp: number;
      frozen_split_rules: { houseRateBp?: number; rules?: SplitRule[] } | null;
    }>(raw`
      select d.id, d.owner_user_id, d.currency::text as currency,
             d.agreed_price_minor, d.estimated_cost_minor,
             d.frozen_house_rate_bp, d.frozen_split_rules,
             -- The same total the deal card uses, and for the same reason: a
             -- payout computed on gross costs pays out less than the deal
             -- earned, every month, to the people least able to check.
             coalesce((
               select sum(c.amount_minor)
               from costs c
               where c.deal_id = d.id and c.kind = 'actual' and c.currency = d.currency
             ), 0)::text as actual_cost_minor
      from deals d
      join payout_periods p on p.id = ${periodId}
      where d.status = 'won'
        and d.closed_at is not null
        and d.closed_at::date between p.starts_on and p.ends_on
      order by d.closed_at, d.id`),
  );

  const deals: DealContribution[] = Array.from(rows).map((row) => {
    const currency = assertCurrencyCode(row.currency);
    // The same effective cost the deal card showed: an estimate stops being the
    // best guess once more than it has been spent, and a payout computed on a
    // disproved estimate would pay out money the deal never made.
    const costs = effectiveCost(
      money(row.estimated_cost_minor, currency),
      money(BigInt(row.actual_cost_minor), currency),
    );
    return {
      dealId: row.id,
      ownerUserId: row.owner_user_id,
      currency,
      revenue: money(row.agreed_price_minor, currency),
      directCosts: costs,
      houseRateBp: row.frozen_house_rate_bp ?? 5000,
      rules: row.frozen_split_rules?.rules ?? [],
    };
  });

  return { run: computePayouts(deals), dealCount: deals.length };
}

export interface StatementRow {
  id: string;
  periodId: string;
  periodStartsOn: string;
  periodEndsOn: string;
  beneficiaryUserId: string;
  beneficiaryName: string | null;
  currency: CurrencyCode;
  amountMinor: bigint;
  lines: unknown;
  issuedAt: Date;
  adjustmentMinor: bigint;
}

/**
 * Statements the caller is allowed to see.
 *
 * There is no "mine" clause in this query. An Owner gets the organisation's, a
 * Partner gets their own, and the difference is a row-level security policy —
 * so the route cannot get it wrong, and neither can the next route.
 */
export async function getStatements(ctx: TenantContext, limit = 50): Promise<StatementRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      period_id: string;
      starts_on: string;
      ends_on: string;
      beneficiary_user_id: string;
      beneficiary_name: string | null;
      currency: string;
      amount_minor: bigint;
      lines: unknown;
      issued_at: Date;
      adjustment_minor: string;
    }>(raw`
      select s.id, s.period_id, p.starts_on::text as starts_on, p.ends_on::text as ends_on,
             s.beneficiary_user_id, u.name as beneficiary_name,
             s.currency::text as currency, s.amount_minor, s.lines, s.issued_at,
             coalesce((
               select sum(a.amount_minor) from payout_adjustments a
               where a.statement_id = s.id
             ), 0)::text as adjustment_minor
      from payout_statements s
      join payout_periods p on p.id = s.period_id
      left join users u on u.id = s.beneficiary_user_id
      order by s.issued_at desc, s.beneficiary_user_id
      limit ${limit}`),
  );

  return Array.from(rows).map((row) => ({
    id: row.id,
    periodId: row.period_id,
    periodStartsOn: row.starts_on,
    periodEndsOn: row.ends_on,
    beneficiaryUserId: row.beneficiary_user_id,
    beneficiaryName: row.beneficiary_name,
    currency: assertCurrencyCode(row.currency),
    amountMinor: row.amount_minor,
    lines: row.lines,
    issuedAt: row.issued_at,
    adjustmentMinor: BigInt(row.adjustment_minor),
  }));
}
