'use server';

import { sql as raw } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { withTenant } from '@/db/client';
import { canSeeFinancials } from '@/db/roles';
import { assertCurrencyCode, money, parseUserAmount, routeForClose } from '@/money';
import { contextFor, requireUser } from '@/server/session';

/**
 * Writing a price.
 *
 * The client decides which button to show. The server decides what is allowed.
 * Those are different jobs: the browser knows the band because the account
 * manager needs to see it, which means the browser can also lie about it. Every
 * rule below is re-checked here against the band as stored.
 */

export type DealActionResult = { ok: true; status: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DealRow {
  // drizzle's execute<T> wants a row shape it can index.
  [column: string]: unknown;
  id: string;
  status: string;
  currency: string;
  floor_minor: string | null;
  service_currency: string | null;
}

/** Load the deal and its band under the caller's own tenant context. */
async function loadDeal(dealId: string) {
  const user = await requireUser();
  if (!canSeeFinancials(user.role)) {
    // Belt and braces: the column grant would refuse this anyway.
    return { user, deal: null as DealRow | null, denied: true as const };
  }
  const ctx = contextFor(user);
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<DealRow>(raw`
      select d.id, d.status::text as status, d.currency::text as currency,
             s.floor_minor::text as floor_minor, s.currency::text as service_currency
      from deals d
      left join services s on s.id = d.service_id
      where d.id = ${dealId}`),
  );
  return { user, deal: Array.from(rows)[0] ?? null, denied: false as const };
}

/**
 * Where this price should go, decided against the band as stored.
 *
 * The rule itself is a pure function in the money module, tested there. This
 * only reads the row and hands it over — which is the point: the decision must
 * not be re-implemented anywhere it could drift.
 */
function belowFloor(deal: DealRow, priceMinor: bigint): boolean {
  if (deal.floor_minor === null || deal.service_currency !== deal.currency) return false;
  const currency = assertCurrencyCode(deal.currency);
  const floor = money(BigInt(deal.floor_minor), currency);
  return (
    routeForClose(money(priceMinor, currency), {
      floor,
      target: floor,
      ceiling: floor,
    }) === 'owner-approval'
  );
}

function parsePrice(input: string): bigint | null {
  if (!/^-?\d{1,18}$/.test(input)) return null;
  const value = BigInt(input);
  return value < 0n ? null : value;
}

/** Persist a dragged price. Called on release, not on every frame. */
export async function savePriceAction(
  dealId: string,
  priceMinor: string,
): Promise<DealActionResult> {
  if (!UUID.test(dealId)) return { ok: false, error: 'deal.saveFailed' };
  const price = parsePrice(priceMinor);
  if (price === null) return { ok: false, error: 'deal.saveFailed' };

  const { user, deal, denied } = await loadDeal(dealId);
  if (denied || !deal) return { ok: false, error: 'deal.saveFailed' };
  if (deal.status === 'won') return { ok: false, error: 'deal.frozenNote' };

  const ctx = contextFor(user);
  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      update deals set agreed_price_minor = ${price.toString()}::bigint where id = ${dealId}`);
    // Price changes are one of the five things the log exists for.
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, ${raw.raw(`'${user.role}'::user_role`)},
              'deal.price_changed', 'deal', ${dealId},
              ${JSON.stringify({ priceMinor: price.toString(), currency: deal.currency })}::jsonb)`);
  });

  revalidatePath('/app');
  return { ok: true, status: deal.status };
}

/**
 * Below the floor, the deal does not close — it goes to the owner.
 *
 * This is a route, not a refusal. The account manager is not stopped and is not
 * shown an error; the button simply said something different, and this is where
 * it goes.
 */
export async function sendForApprovalAction(
  dealId: string,
  priceMinor: string,
): Promise<DealActionResult> {
  if (!UUID.test(dealId)) return { ok: false, error: 'deal.saveFailed' };
  const price = parsePrice(priceMinor);
  if (price === null) return { ok: false, error: 'deal.saveFailed' };

  const { user, deal, denied } = await loadDeal(dealId);
  if (denied || !deal) return { ok: false, error: 'deal.saveFailed' };
  if (deal.status === 'won') return { ok: false, error: 'deal.frozenNote' };

  const ctx = contextFor(user);
  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      update deals
      set agreed_price_minor = ${price.toString()}::bigint, status = 'pending_approval'
      where id = ${dealId}`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, ${raw.raw(`'${user.role}'::user_role`)},
              'deal.sent_for_approval', 'deal', ${dealId},
              ${JSON.stringify({ priceMinor: price.toString(), currency: deal.currency })}::jsonb)`);
  });

  revalidatePath('/app');
  return { ok: true, status: 'pending_approval' };
}

/**
 * Close a deal, freezing what it closed on.
 *
 * A price under the floor cannot be closed here even if the caller asks for it:
 * it is redirected to approval. The button's wording is a courtesy to the
 * account manager; this check is the actual rule.
 */
export async function closeDealAction(
  dealId: string,
  priceMinor: string,
): Promise<DealActionResult> {
  if (!UUID.test(dealId)) return { ok: false, error: 'deal.saveFailed' };
  const price = parsePrice(priceMinor);
  if (price === null) return { ok: false, error: 'deal.saveFailed' };

  const { user, deal, denied } = await loadDeal(dealId);
  if (denied || !deal) return { ok: false, error: 'deal.saveFailed' };
  if (deal.status === 'won') return { ok: false, error: 'deal.frozenNote' };

  if (belowFloor(deal, price)) {
    // Not an error. The same journey, through the door it belongs to.
    return sendForApprovalAction(dealId, priceMinor);
  }

  const ctx = contextFor(user);
  await withTenant(ctx, async (tx) => {
    const settings = await tx.execute<{ [column: string]: unknown; house_rate_bp: number }>(
      raw`select house_rate_bp from organizations`,
    );
    const houseRateBp = Array.from(settings)[0]?.house_rate_bp ?? 5000;

    /*
     * The freeze, now with the real policy on it.
     *
     * The rules in force at this moment are copied onto the deal. If the owner
     * cuts a partner's equity next quarter, this deal keeps the terms it closed
     * on — which is what a partner was told, and quite possibly what they have
     * already been paid against.
     */
    const ruleRows = await tx.execute<{
      [column: string]: unknown;
      id: string;
      kind: string;
      beneficiary_user_id: string | null;
      rate_bp: number;
    }>(raw`
      select id, kind::text as kind, beneficiary_user_id, rate_bp
      from split_rules where is_active order by created_at, id`);
    const frozenRules = Array.from(ruleRows).map((row) => ({
      id: row.id,
      kind: row.kind,
      beneficiaryUserId: row.beneficiary_user_id,
      rateBp: row.rate_bp,
    }));

    await tx.execute(raw`
      update deals
      set agreed_price_minor    = ${price.toString()}::bigint,
          status                = 'won',
          closed_at             = now(),
          frozen_house_rate_bp  = ${houseRateBp},
          frozen_fx_rate        = 1.0,
          frozen_fx_source      = 'identity',
          frozen_fx_captured_at = now(),
          frozen_split_rules    = ${JSON.stringify({ houseRateBp, rules: frozenRules })}::jsonb
      where id = ${dealId}`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, ${raw.raw(`'${user.role}'::user_role`)},
              'deal.closed', 'deal', ${dealId},
              ${JSON.stringify({
                priceMinor: price.toString(),
                currency: deal.currency,
                houseRateBp,
              })}::jsonb)`);
  });

  revalidatePath('/app');
  return { ok: true, status: 'won' };
}

/**
 * Record what was actually spent.
 *
 * Kept deliberately small: an amount, who it went to, and when. Every field
 * added here is a field somebody has to fill in while standing in a print shop,
 * and the moment that takes longer than a few seconds the costs stop being
 * recorded and every margin in the product goes back to being a guess.
 *
 * The receipt photo is not here yet — it needs object storage, which needs
 * credentials this build does not have. The column is waiting for it.
 */
export async function addCostAction(input: {
  dealId: string;
  amount: string;
  vendor: string;
  spentOn: string;
}): Promise<DealActionResult> {
  if (!UUID.test(input.dealId)) return { ok: false, error: 'cost.saveFailed' };

  const { user, deal, denied } = await loadDeal(input.dealId);
  if (denied || !deal) return { ok: false, error: 'cost.saveFailed' };

  const currency = assertCurrencyCode(deal.currency);
  let amountMinor: bigint;
  try {
    // Lenient on the way in: this is a human typing, possibly Arabic-Indic
    // digits, possibly with a thousands separator.
    amountMinor = parseUserAmount(input.amount, currency).minor;
  } catch {
    return { ok: false, error: 'cost.badAmount' };
  }
  if (amountMinor < 0n) return { ok: false, error: 'cost.badAmount' };

  const spentOn = /^\d{4}-\d{2}-\d{2}$/.test(input.spentOn)
    ? input.spentOn
    : new Date().toISOString().slice(0, 10);
  const vendor = input.vendor.trim().slice(0, 200) || null;

  const ctx = contextFor(user);
  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      insert into costs (org_id, deal_id, kind, amount_minor, currency, vendor, spent_on,
                         recorded_by_user_id)
      values (${user.orgId}, ${input.dealId}, 'actual', ${amountMinor.toString()}::bigint,
              ${raw.raw(`'${currency}'::currency_code`)}, ${vendor}, ${spentOn}::date, ${user.id})`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, ${raw.raw(`'${user.role}'::user_role`)},
              'cost.added', 'deal', ${input.dealId},
              ${JSON.stringify({ amountMinor: amountMinor.toString(), currency, vendor })}::jsonb)`);
  });

  revalidatePath('/app');
  return { ok: true, status: deal.status };
}
