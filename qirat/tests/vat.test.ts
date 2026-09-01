import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { closeAll, raw, resetTables, withTenant } from './helpers/db';
import { getDealCards, getOrgSettings } from '../src/server/queries';
import { buildPayoutRun } from '../src/server/payouts';
import { toMajorString } from '../src/money';

/**
 * The European gap, end to end.
 *
 * A Berlin agency invoices a Paris client under the reverse charge, so it adds
 * no VAT: 10,000 net is 10,000 gross. The freelancer who did the work invoices
 * 4,000 plus 19%, so 4,760 leaves the bank.
 *
 * Put those two numbers in a spreadsheet — which is where every agency this is
 * built for currently puts them — and the deal reports 52.4%. The real margin is
 * 60%, because the 760 is reclaimed: it was never the agency's money. On one
 * deal that is a rounding error in someone's opinion of the month. On a
 * commission calculation it is a shortfall in someone's pay, every month, in the
 * direction they are least able to check.
 */

const EUR = 'EUR';
let org: {
  orgId: string;
  ownerId: string;
  managerId: string;
  dealId: string;
  periodId: string;
};

/** A Berlin agency: registered for VAT at 19%, selling under the reverse charge. */
async function seedBerlin(vatRegistered: boolean) {
  const orgId = randomUUID();
  const ownerId = randomUUID();
  const managerId = randomUUID();
  const clientId = randomUUID();
  const dealId = randomUUID();
  const periodId = randomUUID();
  const ctx = { orgId, userId: ownerId, role: 'owner' as const };
  // An agency that is not registered charges nothing under any heading, so its
  // default treatment is the one that says so.
  const treatment = vatRegistered ? 'reverse_charge' : 'not_registered';

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      insert into organizations (id, slug, name, default_currency, house_rate_bp,
                                 country, vat_registered, vat_rate_bp, default_tax_treatment)
      values (${orgId}, ${`berlin-${orgId.slice(0, 8)}`}, 'Berlin Studio', ${EUR}, 5000,
              'DE', ${vatRegistered}, 1900, ${treatment})`);
    for (const [id, role, email] of [
      [ownerId, 'owner', `owner-${orgId.slice(0, 8)}@berlin.test`],
      [managerId, 'account_manager', `am-${orgId.slice(0, 8)}@berlin.test`],
    ] as const) {
      await tx.execute(raw`
        insert into users (id, org_id, email, password_hash, name, role)
        values (${id}, ${orgId}, ${email}, 'x', ${role}, ${raw.raw(`'${role}'::user_role`)})`);
    }
    await tx.execute(raw`
      insert into clients (id, org_id, name, country, default_currency)
      values (${clientId}, ${orgId}, 'A Paris client', 'FR', ${EUR})`);
    // 10,000.00 net, estimated to cost 4,000.00.
    await tx.execute(raw`
      insert into deals (id, org_id, client_id, owner_user_id, title, currency,
                         agreed_price_minor, estimated_cost_minor, status,
                         tax_treatment, vat_rate_bp)
      values (${dealId}, ${orgId}, ${clientId}, ${managerId}, 'Campaign film', ${EUR},
              1000000, 400000, 'draft', ${treatment}, 1900)`);
    await tx.execute(raw`
      insert into payout_periods (id, org_id, starts_on, ends_on)
      values (${periodId}, ${orgId}, date_trunc('month', current_date)::date,
              (date_trunc('month', current_date) + interval '1 month - 1 day')::date)`);
    await tx.execute(raw`
      insert into split_rules (org_id, kind, rate_bp, label)
      values (${orgId}, 'manager_commission', 2000, 'Commission on own deals')`);
  });

  return { orgId, ownerId, managerId, dealId, periodId };
}

/**
 * The freelancer's invoice, entered the way the cost form enters it: the cost is
 * what the cost was, and the reclaimable tax is recorded beside it.
 */
async function recordSupplierInvoice(
  o: typeof org,
  costMinor: bigint,
  vatMinor: bigint,
): Promise<void> {
  await withTenant({ orgId: o.orgId, userId: o.ownerId, role: 'owner' }, (tx) =>
    tx.execute(raw`
      insert into costs (org_id, deal_id, kind, amount_minor, vat_minor, currency, vendor,
                         spent_on, recorded_by_user_id)
      values (${o.orgId}, ${o.dealId}, 'actual', ${costMinor.toString()}::bigint,
              ${vatMinor.toString()}::bigint, ${EUR}, 'A freelancer', current_date, ${o.ownerId})`),
  );
}

async function cardFor(o: typeof org) {
  const ctx = { orgId: o.orgId, userId: o.ownerId, role: 'owner' as const };
  const settings = (await getOrgSettings(ctx))!;
  const cards = await getDealCards(ctx, settings);
  return { settings, card: cards[0]! };
}

beforeAll(async () => {
  await resetTables();
  org = await seedBerlin(true);
  // 4,760.00 gross at 19% → 4,000.00 cost, 760.00 reclaimed.
  await recordSupplierInvoice(org, 400000n, 76000n);
});
afterAll(async () => {
  await closeAll();
});

describe('a registered agency', () => {
  it('computes the margin on what the work cost, not on what left the bank', async () => {
    const { card } = await cardFor(org);
    expect(toMajorString(card.cost.actual)).toBe('4000.00');
    // 60.00%, not the 52.4% the spreadsheet gives.
    expect(card.margin.marginBasisPoints).toBe(6_000);
    expect(toMajorString(card.margin.grossProfit)).toBe('6000.00');
  });

  it('shows the client a gross that equals the net under the reverse charge', async () => {
    const { card } = await cardFor(org);
    expect(card.taxed.treatment).toBe('reverse_charge');
    expect(toMajorString(card.taxed.net)).toBe('10000.00');
    expect(toMajorString(card.taxed.vat)).toBe('0.00');
    expect(toMajorString(card.taxed.gross)).toBe('10000.00');
    // The rate is stored on the deal but not applied, and must not leak into
    // the figure anybody invoices from.
    expect(card.taxed.rateBp).toBe(0);
  });

  it('pays the account manager on the real margin', async () => {
    const ctx = { orgId: org.orgId, userId: org.ownerId, role: 'owner' as const };
    await withTenant(ctx, (tx) =>
      tx.execute(raw`
        update deals set status = 'won', closed_at = now(), frozen_house_rate_bp = 5000,
          frozen_split_rules = ${JSON.stringify({
            houseRateBp: 5000,
            rules: [{ kind: 'manager_commission', beneficiaryUserId: null, rateBp: 2000 }],
          })}::jsonb,
          frozen_vat_rate_bp = vat_rate_bp, frozen_tax_treatment = tax_treatment
        where id = ${org.dealId}`),
    );

    const { run, dealCount } = await buildPayoutRun(ctx, org.periodId);
    expect(dealCount).toBe(1);
    // Distributable is the house share of a 6,000 profit: 3,000. Twenty per cent
    // of that is 600 to whoever closed it.
    const statement = run.statements.find((s) => s.beneficiaryUserId === org.managerId)!;
    expect(toMajorString(statement.total)).toBe('600.00');

    // The number the spreadsheet would have produced, stated so the difference
    // is a fact in the test suite and not a claim in a comment: a 5,240 profit
    // would have paid 524.00, and the manager would be 76.00 short on one deal.
    expect(toMajorString(statement.total)).not.toBe('524.00');
  });
});

describe('an agency that cannot reclaim', () => {
  it('counts the whole invoice, because the tax really is gone', async () => {
    const small = await seedBerlin(false);
    // Not registered, so nothing is split: 4,760.00 is what it cost.
    await recordSupplierInvoice(small, 476000n, 0n);
    const { card } = await cardFor(small);
    expect(toMajorString(card.cost.actual)).toBe('4760.00');
    expect(card.margin.marginBasisPoints).toBe(5_240); // 52.40%
  });
});

describe('the cost of a closed deal', () => {
  it('does not change when the agency changes its VAT registration', async () => {
    // The reclaim decision was made when the money went out and stored on the
    // row. An agency deregistering must not retroactively change what a closed
    // deal cost — the same rule as the frozen house rate, one layer down.
    const before = (await cardFor(org)).card;
    await withTenant({ orgId: org.orgId, userId: org.ownerId, role: 'owner' }, (tx) =>
      tx.execute(raw`update organizations set vat_registered = false`),
    );
    const after = (await cardFor(org)).card;

    expect(toMajorString(after.cost.actual)).toBe(toMajorString(before.cost.actual));
    expect(after.margin.marginBasisPoints).toBe(before.margin.marginBasisPoints);

    await withTenant({ orgId: org.orgId, userId: org.ownerId, role: 'owner' }, (tx) =>
      tx.execute(raw`update organizations set vat_registered = true`),
    );
  });
});

/**
 * Registering for VAT after the fact.
 *
 * An agency that crosses the threshold in March has a pipeline full of open
 * deals. It should not have to open each one to say so — and it must not have
 * last month's closed invoices rewritten underneath it.
 */
describe('changing the agency’s tax position', () => {
  it('moves open deals onto the new default and leaves closed ones alone', async () => {
    const agency = await seedBerlin(false);
    const ctx = { orgId: agency.orgId, userId: agency.ownerId, role: 'owner' as const };

    // Three deals: one open on the old default, one deliberately set by hand,
    // and one already closed under the old terms.
    const openByHand = randomUUID();
    const closed = randomUUID();
    await withTenant(ctx, async (tx) => {
      const clientRows = await tx.execute<{ [column: string]: unknown; id: string }>(
        raw`select id from clients limit 1`,
      );
      const clientId = Array.from(clientRows)[0]!.id;
      // Open, and deliberately set to something other than the agency default.
      await tx.execute(raw`
        insert into deals (id, org_id, client_id, owner_user_id, title, currency,
                           agreed_price_minor, estimated_cost_minor, status,
                           tax_treatment, vat_rate_bp)
        values (${openByHand}, ${agency.orgId}, ${clientId}, ${agency.managerId}, 'Set by hand',
                ${EUR}, 500000, 200000, 'draft', 'zero_rated', 0)`);

      // Closed last month, under the terms in force then.
      await tx.execute(raw`
        insert into deals (id, org_id, client_id, owner_user_id, title, currency,
                           agreed_price_minor, estimated_cost_minor, status,
                           tax_treatment, vat_rate_bp, closed_at,
                           frozen_tax_treatment, frozen_vat_rate_bp,
                           frozen_house_rate_bp, frozen_split_rules)
        values (${closed}, ${agency.orgId}, ${clientId}, ${agency.managerId}, 'Already invoiced',
                ${EUR}, 500000, 200000, 'won', 'not_registered', 0, now(),
                'not_registered', 0, 5000, '{"houseRateBp":5000,"rules":[]}'::jsonb)`);

      // The settings change, applied the way the action applies it.
      await tx.execute(raw`
        update organizations set vat_registered = true, vat_rate_bp = 1900,
                                 default_tax_treatment = 'standard'`);
      await tx.execute(raw`
        update deals set tax_treatment = 'standard'
        where status <> 'won' and tax_treatment = 'not_registered'`);
      await tx.execute(raw`
        update deals
        set vat_rate_bp = case when tax_treatment = 'standard' then 1900 else 0 end
        where status <> 'won'`);
    });

    const rows = await withTenant(ctx, (tx) =>
      tx.execute<{
        [column: string]: unknown;
        id: string;
        tax_treatment: string;
        vat_rate_bp: number;
        frozen_tax_treatment: string | null;
      }>(raw`
        select id, tax_treatment::text as tax_treatment, vat_rate_bp,
               frozen_tax_treatment::text as frozen_tax_treatment
        from deals`),
    );
    const byId = new Map(Array.from(rows).map((row) => [row.id, row]));

    // The one that was only ever following the agency has followed it.
    expect(byId.get(agency.dealId)!.tax_treatment).toBe('standard');
    expect(byId.get(agency.dealId)!.vat_rate_bp).toBe(1_900);

    // The one somebody set on purpose is where they left it, and carries no rate.
    expect(byId.get(openByHand)!.tax_treatment).toBe('zero_rated');
    expect(byId.get(openByHand)!.vat_rate_bp).toBe(0);

    // The closed one is untouched. Its invoice already exists.
    expect(byId.get(closed)!.tax_treatment).toBe('not_registered');
    expect(byId.get(closed)!.frozen_tax_treatment).toBe('not_registered');
  });
});
