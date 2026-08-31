'use server';

import { sql as raw } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { withTenant } from '@/db/client';
import { checkPayoutRunBalances, formatMoney } from '@/money';
import { buildPayoutRun } from '@/server/payouts';
import { contextFor, requireUser } from '@/server/session';

/**
 * Closing the period.
 *
 * One button, once a month, and something real comes out of it. Everything
 * below is in service of that being trustworthy rather than merely fast.
 */

export type PayoutActionResult = { ok: true; message?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireOwner() {
  const user = await requireUser();
  return user.role === 'owner' ? user : null;
}

/** Open a period. Months are the unit because that is how agencies pay people. */
export async function openPeriodAction(
  startsOn: string,
  endsOn: string,
): Promise<PayoutActionResult> {
  const user = await requireOwner();
  if (!user) return { ok: false, error: 'payout.ownerOnly' };
  if (!DATE.test(startsOn) || !DATE.test(endsOn) || endsOn < startsOn) {
    return { ok: false, error: 'payout.badDates' };
  }

  try {
    await withTenant(contextFor(user), (tx) =>
      tx.execute(raw`
        insert into payout_periods (org_id, starts_on, ends_on)
        values (${user.orgId}, ${startsOn}::date, ${endsOn}::date)`),
    );
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: 'payout.periodExists' };
    throw error;
  }

  revalidatePath('/app/payouts');
  return { ok: true };
}

/**
 * Close the period and issue the statements.
 *
 * Three things have to be true before a single row is written, and the whole
 * operation is one transaction so that none of them can be half-true:
 *
 *  1. The run balances. Statements plus pool plus retained must equal the
 *     distributable profit, exactly, in every currency. If it does not, the
 *     close is refused — an unbalanced run is not a rounding curiosity, it is
 *     money on one side of the books and not the other.
 *  2. The period is still open. Closing twice would issue every statement
 *     twice.
 *  3. Every statement is written before the period flips to closed, and after
 *     that the trigger makes all of it immutable.
 */
export async function closePeriodAction(periodId: string): Promise<PayoutActionResult> {
  const user = await requireOwner();
  if (!user) return { ok: false, error: 'payout.ownerOnly' };
  if (!UUID.test(periodId)) return { ok: false, error: 'payout.closeFailed' };

  const ctx = contextFor(user);
  const { run, dealCount } = await buildPayoutRun(ctx, periodId);

  const faults = checkPayoutRunBalances(run);
  if (faults.length > 0) {
    // Deliberately loud, and deliberately not written. Somebody has to look.
    const detail = faults
      .map((fault) => `${fault.currency} ${formatMoney(fault.difference, { display: 'none' })}`)
      .join(', ');
    return { ok: false, error: `payout.unbalanced:${detail}` };
  }

  try {
    await withTenant(ctx, async (tx) => {
      const open = await tx.execute<{ [column: string]: unknown; status: string }>(
        raw`select status::text as status from payout_periods where id = ${periodId} for update`,
      );
      const status = Array.from(open)[0]?.status;
      if (status !== 'open') throw new PeriodNotOpen();

      for (const statement of run.statements) {
        await tx.execute(raw`
          insert into payout_statements
            (org_id, period_id, beneficiary_user_id, currency, amount_minor, lines)
          values (${user.orgId}, ${periodId}, ${statement.beneficiaryUserId},
                  ${raw.raw(`'${statement.currency}'::currency_code`)},
                  ${statement.total.minor.toString()}::bigint,
                  ${JSON.stringify(statement.lines, bigintToString)}::jsonb)`);
      }

      await tx.execute(raw`
        update payout_periods
        set status = 'closed', closed_at = now(), closed_by_user_id = ${user.id}
        where id = ${periodId}`);

      await tx.execute(raw`
        insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
        values (${user.orgId}, ${user.id}, ${user.email}, 'owner', 'payout_period.closed',
                'payout_period', ${periodId},
                ${JSON.stringify(
                  {
                    dealCount,
                    statements: run.statements.length,
                    distributable: run.distributable.map(
                      (value) => `${value.currency} ${value.minor.toString()}`,
                    ),
                  },
                  bigintToString,
                )}::jsonb)`);
    });
  } catch (error) {
    if (error instanceof PeriodNotOpen) return { ok: false, error: 'payout.alreadyClosed' };
    throw error;
  }

  revalidatePath('/app/payouts');
  revalidatePath('/app');
  return { ok: true };
}

/**
 * Correct a statement.
 *
 * The original is never touched. A correction is a new signed entry against it,
 * with a reason, because the question a partner asks two years later is not
 * "what does it say now" but "what changed, and who changed it".
 */
export async function addAdjustmentAction(input: {
  statementId: string;
  amount: string;
  reason: string;
}): Promise<PayoutActionResult> {
  const user = await requireOwner();
  if (!user) return { ok: false, error: 'payout.ownerOnly' };
  if (!UUID.test(input.statementId)) return { ok: false, error: 'payout.adjustFailed' };

  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: 'payout.reasonNeeded' };

  const ctx = contextFor(user);
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{ [column: string]: unknown; beneficiary_user_id: string; currency: string }>(raw`
      select beneficiary_user_id, currency::text as currency
      from payout_statements where id = ${input.statementId}`),
  );
  const statement = Array.from(rows)[0];
  if (!statement) return { ok: false, error: 'payout.adjustFailed' };

  const { assertCurrencyCode, parseUserAmount } = await import('@/money');
  const currency = assertCurrencyCode(statement.currency);
  let amountMinor: bigint;
  const negative = input.amount.trim().startsWith('-');
  try {
    amountMinor = parseUserAmount(input.amount.replace(/^-/, ''), currency).minor;
  } catch {
    return { ok: false, error: 'payout.badAmount' };
  }
  if (amountMinor === 0n) return { ok: false, error: 'payout.badAmount' };
  if (negative) amountMinor = -amountMinor;

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      insert into payout_adjustments
        (org_id, statement_id, beneficiary_user_id, currency, amount_minor, reason, created_by_user_id)
      values (${user.orgId}, ${input.statementId}, ${statement.beneficiary_user_id},
              ${raw.raw(`'${currency}'::currency_code`)}, ${amountMinor.toString()}::bigint,
              ${reason}, ${user.id})`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, 'owner', 'payout_statement.adjusted',
              'payout_statement', ${input.statementId},
              ${JSON.stringify({ amountMinor: amountMinor.toString(), reason })}::jsonb)`);
  });

  revalidatePath('/app/payouts');
  return { ok: true };
}

/** Set the policy. Rules are replaced wholesale, so the set always sums cleanly. */
export async function setSplitRulesAction(
  rules: { kind: string; beneficiaryUserId: string | null; rateBp: number; label: string | null }[],
): Promise<PayoutActionResult> {
  const user = await requireOwner();
  if (!user) return { ok: false, error: 'payout.ownerOnly' };

  let claimed = 0;
  for (const rule of rules) {
    if (!['partner_equity', 'manager_commission', 'bonus_pool'].includes(rule.kind)) {
      return { ok: false, error: 'payout.badRule' };
    }
    if (!Number.isInteger(rule.rateBp) || rule.rateBp < 0 || rule.rateBp > 10_000) {
      return { ok: false, error: 'payout.badRule' };
    }
    if (rule.kind === 'partner_equity' && !rule.beneficiaryUserId) {
      return { ok: false, error: 'payout.equityNeedsPartner' };
    }
    claimed += rule.rateBp;
  }
  if (claimed > 10_000) return { ok: false, error: 'payout.over100' };

  await withTenant(contextFor(user), async (tx) => {
    // Deactivated rather than deleted: a deal that closed under an old rule
    // carries its own frozen copy, but the org's history is worth keeping too.
    await tx.execute(raw`update split_rules set is_active = false where is_active`);
    for (const rule of rules) {
      await tx.execute(raw`
        insert into split_rules (org_id, kind, beneficiary_user_id, rate_bp, label)
        values (${user.orgId}, ${raw.raw(`'${rule.kind}'::split_rule_kind`)},
                ${rule.kind === 'partner_equity' ? rule.beneficiaryUserId : null},
                ${rule.rateBp}, ${rule.label})`);
    }
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, 'owner', 'split_rules.changed',
              'organization', ${user.orgId}, ${JSON.stringify({ rules })}::jsonb)`);
  });

  revalidatePath('/app/payouts');
  return { ok: true };
}

class PeriodNotOpen extends Error {}

function bigintToString(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: string; cause?: unknown };
    if (candidate.code === '23505') return true;
    current = candidate.cause;
  }
  return false;
}
