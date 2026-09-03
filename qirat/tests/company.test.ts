import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';
import { addOverhead, endOverhead, monthPicture, reopenPeriod, setSalary } from '../src/server/company';
import { toMajorString } from '../src/money';

/**
 * What the company costs, and the month that admits it.
 *
 * The interesting assertions here are not that the arithmetic works — that is
 * hammered in src/money/company.test.ts — but that the month is *derived*. No
 * figure below is entered twice, so the picture cannot disagree with the rows.
 */

let org: SeededOrg;
const month = new Date().toISOString().slice(0, 7);

beforeAll(async () => {
  await resetTables();
  org = await seedOrg('books');
});
afterAll(async () => {
  await closeAll();
});

describe('overheads', () => {
  it('are the owner’s alone', async () => {
    // What the company costs to keep open is not an account manager's business,
    // and it is certainly not the crew's.
    for (const role of ['account_manager', 'member', 'partner'] as const) {
      await expectRefused(
        withTenant(as(org, role), (tx) => tx.execute(raw`select * from overheads`)),
        /permission denied/i,
      );
    }
  });

  it('cost the month what their cadence says', async () => {
    const ctx = as(org, 'owner');
    await addOverhead(ctx, {
      name: 'Studio rent',
      amount: '18000',
      currency: 'EGP',
      cadence: 'monthly',
      activeFrom: `${month}-01`,
    });
    await addOverhead(ctx, {
      name: 'Adobe, annual',
      amount: '12000',
      currency: 'EGP',
      cadence: 'yearly',
      activeFrom: `${month}-01`,
    });

    const view = await monthPicture(ctx, month, 'EGP');
    // 18,000 every month plus a twelfth of the annual licence.
    expect(toMajorString(view.figures.overheads)).toBe('19000.00');
  });

  it('are stopped rather than deleted, so an old month keeps saying what it cost', async () => {
    const ctx = as(org, 'owner');
    const rows = await withTenant(ctx, (tx) =>
      tx.execute<{ [c: string]: unknown; id: string }>(
        raw`select id from overheads where name = 'Studio rent'`,
      ),
    );
    const id = Array.from(rows)[0]!.id;
    await endOverhead(ctx, id, `${month}-01`);

    const still = await withTenant(ctx, (tx) =>
      tx.execute<{ [c: string]: unknown; active_to: string }>(
        raw`select active_to::text as active_to from overheads where id = ${id}`,
      ),
    );
    expect(Array.from(still)[0]!.active_to).toBe(`${month}-01`);
    // The row is still there. An office left in March was a real cost in
    // February, and February must keep saying so.
    expect(Array.from(still)).toHaveLength(1);
  });
});

describe('the month, derived', () => {
  it('reports a healthy gross margin as the loss it actually was', async () => {
    const ctx = as(org, 'owner');

    // Close the seeded deal: 80,000.00 billed against 25,000.00 of estimate.
    await withTenant(ctx, (tx) =>
      tx.execute(raw`
        update deals set status = 'won', closed_at = now(), frozen_house_rate_bp = 5000,
          frozen_split_rules = '{"houseRateBp":5000,"rules":[]}'::jsonb
        where id = ${org.dealId}`),
    );
    // 30,000 of suppliers on it.
    await withTenant(ctx, (tx) =>
      tx.execute(raw`
        insert into costs (org_id, deal_id, kind, amount_minor, currency, spent_on,
                           recorded_by_user_id)
        values (${org.orgId}, ${org.dealId}, 'actual', 3000000, 'EGP', current_date,
                ${org.ownerId})`),
    );
    // And two salaried people at 20,000 each.
    await setSalary(ctx, org.memberId, '20000', 'EGP');
    await setSalary(ctx, org.managerId, '20000', 'EGP');

    const view = await monthPicture(ctx, month, 'EGP');
    const f = view.figures;

    // What every deal card in the product has been showing: 62.5%.
    expect(toMajorString(f.revenue)).toBe('80000.00');
    expect(toMajorString(f.grossProfit)).toBe('50000.00');
    expect(f.grossMarginBp).toBe(6250);

    // And what none of them can see: 40,000 of salaries and 19,000 of overhead.
    expect(toMajorString(f.salaries)).toBe('40000.00');
    expect(toMajorString(f.overheads)).toBe('19000.00');
    expect(toMajorString(f.operatingProfit)).toBe('-9000.00');
    expect(f.isLoss).toBe(true);

    // The whole argument, as two numbers on one screen.
    expect(f.grossMarginBp).toBe(6250);
    expect(f.operatingMarginBp).toBe(-1125);
  });

  it('says what has to be billed to cover the month', async () => {
    // 59,000 of salaries and overheads at a 62.5% margin needs 94,400 billed.
    const view = await monthPicture(as(org, 'owner'), month, 'EGP');
    expect(view.breakEvenMinor).toBe(9440000n);
  });

  it('counts a person’s salary only while they are here', async () => {
    const ctx = as(org, 'owner');
    const before = await monthPicture(ctx, month, 'EGP');
    await withTenant(ctx, (tx) =>
      tx.execute(raw`update users set is_active = false where id = ${org.memberId}`),
    );
    const after = await monthPicture(ctx, month, 'EGP');
    expect(before.figures.salaries.minor - after.figures.salaries.minor).toBe(2000000n);
    await withTenant(ctx, (tx) =>
      tx.execute(raw`update users set is_active = true where id = ${org.memberId}`),
    );
  });
});

describe('a person’s own salary', () => {
  it('is theirs to see, and nobody else’s', async () => {
    // The same shape as their own day rate and their own statement: a financial
    // fact about them, not about the agency.
    const rows = await withTenant(as(org, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; monthly_salary_minor: bigint | null }>(
        raw`select monthly_salary_minor from users`,
      ),
    );
    const all = Array.from(rows);
    expect(all).toHaveLength(1);
    expect(all[0]!.monthly_salary_minor).toBe(2000000n);
  });
});

describe('reopening a month', () => {
  it('refuses without a reason somebody will read next year', async () => {
    const ctx = as(org, 'owner');
    const period = await withTenant(ctx, (tx) =>
      tx.execute<{ [c: string]: unknown; id: string }>(raw`
        insert into payout_periods (org_id, starts_on, ends_on, status, closed_at,
                                    closed_by_user_id)
        values (${org.orgId}, ${`${month}-01`}::date,
                (${`${month}-01`}::date + interval '1 month - 1 day')::date,
                'closed', now(), ${org.ownerId})
        returning id`),
    ).then((rows) => Array.from(rows)[0]!.id);

    await expect(reopenPeriod(ctx, period, 'oops')).rejects.toThrow(/why/i);

    // Still closed, and the database is the one holding the line.
    await expectRefused(
      withTenant(ctx, (tx) =>
        tx.execute(raw`update payout_periods set status = 'open' where id = ${period}`),
      ),
      /closed/i,
    );
  });

  it('opens with a reason, and says afterwards that it was reopened', async () => {
    /*
     * The rule used to be that a closed month could never move, which is right
     * until the afternoon somebody finds a cost that belonged in it. An
     * unbreakable lock does not protect the numbers then — it moves the
     * correction somewhere the product cannot see.
     */
    const ctx = as(org, 'owner');
    const rows = await withTenant(ctx, (tx) =>
      tx.execute<{ [c: string]: unknown; id: string }>(
        raw`select id from payout_periods where status = 'closed' limit 1`,
      ),
    );
    const period = Array.from(rows)[0]!.id;

    await reopenPeriod(ctx, period, 'A 40,000 print bill turned up that belongs in this month.');

    const after = await withTenant(ctx, (tx) =>
      tx.execute<{
        [c: string]: unknown;
        status: string;
        reopen_count: number;
        reopen_reason: string;
      }>(raw`
        select status::text as status, reopen_count, reopen_reason
        from payout_periods where id = ${period}`),
    ).then((r) => Array.from(r)[0]!);

    expect(after.status).toBe('open');
    expect(after.reopen_count).toBe(1);
    expect(after.reopen_reason).toContain('print bill');
  });

  it('is the owner’s alone', async () => {
    const rows = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute<{ [c: string]: unknown; id: string }>(raw`select id from payout_periods limit 1`),
    );
    const period = Array.from(rows)[0]!.id;
    await expect(
      reopenPeriod(as(org, 'account_manager'), period, 'I would like to change last month.'),
    ).rejects.toThrow(/owner/i);
  });
});
