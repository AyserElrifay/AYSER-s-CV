import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';

/**
 * Costs carry money, so they inherit every rule money carries — plus one of
 * their own: a Member may record a cost and may never read one back.
 */

let orgA: SeededOrg;
let orgB: SeededOrg;

beforeAll(async () => {
  await resetTables();
  orgA = await seedOrg('costsa');
  orgB = await seedOrg('costsb');
});
afterAll(async () => {
  await closeAll();
});

const addCost = (
  org: SeededOrg,
  role: Parameters<typeof as>[1],
  dealId: string,
  amount: string,
  userId?: string,
) =>
  withTenant(as(org, role, userId), (tx) =>
    tx.execute(raw`
      insert into costs (org_id, deal_id, kind, amount_minor, currency, vendor, spent_on,
                         recorded_by_user_id)
      values (${org.orgId}, ${dealId}, 'actual', ${amount}::bigint, 'EGP', 'A vendor',
              current_date, ${userId ?? as(org, role).userId})`),
  );

describe('the Member', () => {
  it('can record a cost', async () => {
    // The freelancer standing in a print shop is exactly who should be entering
    // this number, and refusing them pushes it back into WhatsApp.
    await expect(
      addCost(orgA, 'member', orgA.dealId, '250000', orgA.memberId),
    ).resolves.toBeDefined();
  });

  it('cannot read a single cost back — not even the one they just wrote', async () => {
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) => tx.execute(raw`select amount_minor from costs`)),
      /permission denied/i,
    );
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) => tx.execute(raw`select * from costs`)),
      /permission denied/i,
    );
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) => tx.execute(raw`select count(*) from costs`)),
      /permission denied/i,
    );
  });

  it('cannot record a cost in somebody else’s name', async () => {
    await expectRefused(
      addCost(orgA, 'member', orgA.dealId, '100', orgA.memberId).then(() =>
        withTenant(as(orgA, 'member'), (tx) =>
          tx.execute(raw`
            insert into costs (org_id, deal_id, kind, amount_minor, currency, recorded_by_user_id, spent_on)
            values (${orgA.orgId}, ${orgA.dealId}, 'actual', 100, 'EGP', ${orgA.managerId}, current_date)`),
        ),
      ),
      /row-level security|violates/i,
    );
  });

  it('cannot update or delete what it recorded', async () => {
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) => tx.execute(raw`delete from costs`)),
      /permission denied/i,
    );
  });
});

describe('the Account Manager', () => {
  it('sees costs on their own deal', async () => {
    await addCost(orgA, 'account_manager', orgA.dealId, '400000');
    const rows = await withTenant(as(orgA, 'account_manager'), (tx) =>
      tx.execute(raw`select amount_minor from costs`),
    );
    const amounts = Array.from(rows as Iterable<{ amount_minor: bigint }>).map(
      (r) => r.amount_minor,
    );
    expect(amounts).toContain(400_000n);
  });

  it('does not see costs on a colleague’s deal', async () => {
    // Recorded by the owner against the other manager's deal.
    await addCost(orgA, 'owner', orgA.otherDealId, '999999');
    const rows = await withTenant(as(orgA, 'account_manager'), (tx) =>
      tx.execute(raw`select amount_minor from costs`),
    );
    const amounts = Array.from(rows as Iterable<{ amount_minor: bigint }>).map(
      (r) => r.amount_minor,
    );
    expect(amounts).not.toContain(999_999n);
  });
});

describe('the Partner', () => {
  it('cannot reach costs at all', async () => {
    await expectRefused(
      withTenant(as(orgA, 'partner'), (tx) => tx.execute(raw`select * from costs`)),
      /permission denied/i,
    );
    await expectRefused(
      addCost(orgA, 'partner', orgA.dealId, '100', orgA.partnerId),
      /permission denied/i,
    );
  });
});

describe('across organisations', () => {
  it('cannot see another organisation’s costs', async () => {
    await addCost(orgB, 'owner', orgB.dealId, '777777');
    const rows = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`select org_id, amount_minor from costs`),
    );
    const foreign = Array.from(rows as Iterable<{ org_id: string }>).filter(
      (r) => r.org_id !== orgA.orgId,
    );
    expect(foreign).toEqual([]);
  });

  it('cannot attach a cost to another organisation’s deal', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into costs (org_id, deal_id, kind, amount_minor, currency, recorded_by_user_id, spent_on)
          values (${orgA.orgId}, ${orgB.dealId}, 'actual', 100, 'EGP', ${orgA.ownerId}, current_date)`),
      ),
      /foreign key|violates/i,
    );
  });

  it('cannot record a cost claiming another organisation', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into costs (org_id, deal_id, kind, amount_minor, currency, recorded_by_user_id, spent_on)
          values (${orgB.orgId}, ${orgB.dealId}, 'actual', 100, 'EGP', ${orgB.ownerId}, current_date)`),
      ),
      /row-level security|violates/i,
    );
  });
});

describe('the shape of a cost', () => {
  it('refuses a negative amount', async () => {
    await expectRefused(addCost(orgA, 'owner', orgA.dealId, '-1'), /violates check|check constraint/i);
  });

  it('refuses a deal that does not exist', async () => {
    await expectRefused(
      addCost(orgA, 'owner', randomUUID(), '100'),
      /foreign key|violates/i,
    );
  });
});
