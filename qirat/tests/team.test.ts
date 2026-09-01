import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';
import { buildPayoutRun } from '../src/server/payouts';
import { toMajorString } from '../src/money';

/**
 * People, and the two tables that make a Member's portal possible.
 *
 * The rule this suite defends is narrower than "a Member sees no numbers", and
 * the difference is the product: a Member may see facts about *themselves* —
 * their own rate, their own logged days — and may never see a fact about the
 * agency. Row-level security draws that line, so no route has to.
 */

let orgA: SeededOrg;
let orgB: SeededOrg;

/** Put a person on a deal at a rate, as the owner would. */
async function assign(org: SeededOrg, dealId: string, userId: string, rate: string) {
  await withTenant(as(org, 'owner'), (tx) =>
    tx.execute(raw`
      insert into deal_assignments (org_id, deal_id, user_id, day_rate_minor, currency)
      values (${org.orgId}, ${dealId}, ${userId}, ${rate}::bigint, 'EGP')`),
  );
}

/**
 * `sessionUserId` is who is asking; `rowUserId` is whose name is on the row.
 *
 * They are separate parameters on purpose. Passing one value for both would
 * make "can a Member log time in somebody else's name" unaskable — the session
 * would simply become that other person, and the test would prove nothing.
 */
const logWork = (
  org: SeededOrg,
  role: Parameters<typeof as>[1],
  args: {
    dealId: string;
    sessionUserId: string;
    rowUserId?: string;
    days: number;
    rate: string;
    amount: string;
  },
) =>
  withTenant(as(org, role, args.sessionUserId), (tx) =>
    tx.execute(raw`
      insert into work_log (org_id, deal_id, user_id, worked_on, days, day_rate_minor,
                            currency, amount_minor)
      values (${org.orgId}, ${args.dealId}, ${args.rowUserId ?? args.sessionUserId},
              current_date, ${args.days}, ${args.rate}::bigint, 'EGP', ${args.amount}::bigint)`),
  );

beforeAll(async () => {
  await resetTables();
  orgA = await seedOrg('teama');
  orgB = await seedOrg('teamb');
  // The member is on deal one at 1,200.00 a day. Nobody is on deal two.
  await assign(orgA, orgA.dealId, orgA.memberId, '120000');
  await assign(orgB, orgB.dealId, orgB.memberId, '150000');
});
afterAll(async () => {
  await closeAll();
});

describe('a Member and their own work', () => {
  it('sees the deal they are on', async () => {
    // Previously a Member had no policy on deals at all, so their portal was an
    // empty state by construction. This is what makes it a portal.
    const rows = await withTenant(as(orgA, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; id: string; title: string }>(
        raw`select id, title from deals`,
      ),
    );
    const ids = Array.from(rows).map((r) => r.id);
    expect(ids).toEqual([orgA.dealId]);
  });

  it('does not see the deal they are not on', async () => {
    const rows = await withTenant(as(orgA, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; id: string }>(raw`select id from deals`),
    );
    expect(Array.from(rows).map((r) => r.id)).not.toContain(orgA.otherDealId);
  });

  it('still cannot see what that deal is worth', async () => {
    // The row is now visible; the money on it is not. Column grants and row
    // policies are different mechanisms and both have to hold.
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) =>
        tx.execute(raw`select agreed_price_minor from deals where id = ${orgA.dealId}`),
      ),
      /permission denied/i,
    );
  });

  it('sees the rate their own assignment was agreed at', async () => {
    const rows = await withTenant(as(orgA, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; day_rate_minor: bigint }>(
        raw`select day_rate_minor from deal_assignments`,
      ),
    );
    const all = Array.from(rows);
    expect(all).toHaveLength(1);
    expect(all[0]!.day_rate_minor).toBe(120000n);
  });

  it('cannot see a colleague’s assignment', async () => {
    await assign(orgA, orgA.dealId, orgA.managerId, '250000');
    const rows = await withTenant(as(orgA, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; user_id: string }>(
        raw`select user_id from deal_assignments`,
      ),
    );
    const users = Array.from(rows).map((r) => r.user_id);
    expect(users).toEqual([orgA.memberId]);
    expect(users).not.toContain(orgA.managerId);
  });

  it('can log a day against the deal they are on', async () => {
    await expect(
      logWork(orgA, 'member', {
        dealId: orgA.dealId,
        sessionUserId: orgA.memberId,
        days: 100,
        rate: '120000',
        amount: '120000',
      }),
    ).resolves.toBeDefined();
  });

  it('can read back their own days, because it is their own pay', async () => {
    const rows = await withTenant(as(orgA, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; amount_minor: bigint }>(
        raw`select amount_minor from work_log`,
      ),
    );
    expect(Array.from(rows).map((r) => r.amount_minor)).toEqual([120000n]);
  });

  it('cannot log a day against a deal they are not on', async () => {
    /*
     * Two things at once. It is a cost nobody authorised, and it is an oracle:
     * without this clause, "did the insert succeed" answers "is this a real
     * deal id" for anybody willing to guess.
     */
    await expectRefused(
      logWork(orgA, 'member', {
        dealId: orgA.otherDealId,
        sessionUserId: orgA.memberId,
        days: 100,
        rate: '120000',
        amount: '120000',
      }),
      /row-level security|violates/i,
    );
  });

  it('cannot log a day in somebody else’s name', async () => {
    await expectRefused(
      logWork(orgA, 'member', {
        dealId: orgA.dealId,
        sessionUserId: orgA.memberId,
        rowUserId: orgA.managerId,
        days: 100,
        rate: '250000',
        amount: '250000',
      }),
      /row-level security|violates/i,
    );
  });

  it('cannot see a colleague’s logged days', async () => {
    await logWork(orgA, 'account_manager', {
      dealId: orgA.dealId,
      sessionUserId: orgA.managerId,
      days: 200,
      rate: '250000',
      amount: '500000',
    });
    const rows = await withTenant(as(orgA, 'member'), (tx) =>
      tx.execute<{ [c: string]: unknown; amount_minor: bigint }>(
        raw`select amount_minor from work_log`,
      ),
    );
    // Their own day and nothing else, even though two rows now exist on the deal.
    expect(Array.from(rows).map((r) => r.amount_minor)).toEqual([120000n]);
  });

  it('cannot edit a day once it is logged', async () => {
    // No UPDATE grant at all. A correction is a new entry, the same rule the
    // statements follow.
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) =>
        tx.execute(raw`update work_log set days = 1 where user_id = ${orgA.memberId}`),
      ),
      /permission denied/i,
    );
  });
});

describe('the agency’s own view', () => {
  it('lets the owner see every day logged on the deal', async () => {
    const rows = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute<{ [c: string]: unknown; amount_minor: bigint }>(
        raw`select amount_minor from work_log order by amount_minor`,
      ),
    );
    expect(Array.from(rows).map((r) => r.amount_minor)).toEqual([120000n, 500000n]);
  });

  it('counts logged days as a cost of the deal', async () => {
    // The whole point. 1,200 of the member's time plus 5,000 of the manager's
    // is 6,200 that the margin was previously treating as free.
    const rows = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute<{ [c: string]: unknown; total: string }>(raw`
        select coalesce(sum(amount_minor), 0)::text as total
        from work_log where deal_id = ${orgA.dealId}`),
    );
    expect(Array.from(rows)[0]!.total).toBe('620000');
  });
});

describe('across organisations', () => {
  it('hides org B’s staffing from org A entirely', async () => {
    const rows = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute<{ [c: string]: unknown; user_id: string }>(
        raw`select user_id from deal_assignments`,
      ),
    );
    const users = Array.from(rows).map((r) => r.user_id);
    expect(users).not.toContain(orgB.memberId);
    expect(users.length).toBeGreaterThan(0);
  });

  it('refuses to staff another organisation’s deal', async () => {
    await expectRefused(
      assign(orgA, orgB.dealId, orgA.memberId, '120000'),
      /foreign key|violates|row-level security/i,
    );
  });

  it('refuses to log a day onto another organisation’s deal', async () => {
    await expectRefused(
      logWork(orgA, 'owner', {
        dealId: orgB.dealId,
        sessionUserId: orgA.ownerId,
        days: 100,
        rate: '120000',
        amount: '120000',
      }),
      /foreign key|violates|row-level security/i,
    );
  });
});

describe('a Partner', () => {
  it('is not on the crew and cannot read the staffing at all', async () => {
    // A Partner is an investor. Their own statement, yes; who was on the shoot
    // and what they were paid, no.
    await expectRefused(
      withTenant(as(orgA, 'partner'), (tx) =>
        tx.execute(raw`select day_rate_minor from deal_assignments`),
      ),
      /permission denied/i,
    );
    await expectRefused(
      withTenant(as(orgA, 'partner'), (tx) => tx.execute(raw`select amount_minor from work_log`)),
      /permission denied/i,
    );
  });
});

describe('a username', () => {
  it('is unique inside an agency and free to repeat across them', async () => {
    const shared = `mostafa.${randomUUID().slice(0, 6)}`;
    const setUsername = (org: SeededOrg, userId: string) =>
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update users set username = ${shared} where id = ${userId}`),
      );

    await expect(setUsername(orgA, orgA.memberId)).resolves.toBeDefined();
    // The same freelancer works for two agencies. That is the ordinary case.
    await expect(setUsername(orgB, orgB.memberId)).resolves.toBeDefined();
    // Two people inside one agency is not.
    await expect(setUsername(orgA, orgA.managerId)).rejects.toThrow();
  });
});

/**
 * The point of all of it.
 *
 * A deal delivered by your own people and paid a commission as though it cost
 * nothing to deliver is the exact error the timesheet exists to stop. This is
 * the arithmetic, end to end, through the same function the close-the-month
 * screen calls.
 */
describe('logged days reach the payout', () => {
  it('lowers the distributable profit by what the work cost', async () => {
    const org = await seedOrg(`payroll${Date.now().toString().slice(-6)}`);
    const ctx = as(org, 'owner');

    // The seeded deal: 80,000.00 agreed, 25,000.00 estimated cost.
    // Close it with a house rate of 50% and a fifth to the closer.
    const closeDeal = () =>
      withTenant(ctx, (tx) =>
        tx.execute(raw`
          update deals
          set status = 'won', closed_at = now(), frozen_house_rate_bp = 5000,
              frozen_split_rules = ${JSON.stringify({
                houseRateBp: 5000,
                rules: [
                  { kind: 'manager_commission', beneficiaryUserId: null, rateBp: 2000 },
                ],
              })}::jsonb
          where id = ${org.dealId}`),
      );

    const period = randomUUID();
    await withTenant(ctx, (tx) =>
      tx.execute(raw`
        insert into payout_periods (id, org_id, starts_on, ends_on)
        values (${period}, ${org.orgId}, date_trunc('month', current_date)::date,
                (date_trunc('month', current_date) + interval '1 month - 1 day')::date)`),
    );
    await closeDeal();

    // Before anybody logs a day: profit is 80,000 − 25,000 = 55,000, the house
    // keeps half, and a fifth of that half is 5,500 to whoever closed it.
    const before = await buildPayoutRun(ctx, period);
    const beforeShare = before.run.statements.find((s) => s.beneficiaryUserId === org.managerId)!;
    expect(toMajorString(beforeShare.total)).toBe('5500.00');

    /*
     * Four days of a designer at 1,200.00 changes nothing yet, and that is
     * correct rather than a bug.
     *
     * The margin runs on `effectiveCost` — the larger of the estimate and what
     * has actually been spent. 4,800 of logged time is still well under the
     * 25,000 the deal was estimated at, so the estimate remains the more
     * conservative number and stays in charge. Logged work does not add to an
     * estimate; it disproves it.
     */
    await assign(org, org.dealId, org.memberId, '120000');
    await logWork(org, 'member', {
      dealId: org.dealId,
      sessionUserId: org.memberId,
      days: 400,
      rate: '120000',
      amount: '480000',
    });
    const modest = await buildPayoutRun(ctx, period);
    expect(
      toMajorString(modest.run.statements.find((s) => s.beneficiaryUserId === org.managerId)!.total),
    ).toBe('5500.00');

    /*
     * Now the account manager's own time: five days at 6,000.00 is 30,000, and
     * with the designer's 4,800 that is 34,800 — past the estimate, which is
     * the moment the deal stops being worth what everybody thought.
     *
     * They are the person the commission is paid to, so their own days lower
     * their own share. That is the honest behaviour and worth stating: the time
     * you spend on a deal is a cost of that deal even when it is your deal.
     */
    await assign(org, org.dealId, org.managerId, '600000');
    await logWork(org, 'account_manager', {
      dealId: org.dealId,
      sessionUserId: org.managerId,
      days: 500,
      rate: '600000',
      amount: '3000000',
    });

    const after = await buildPayoutRun(ctx, period);
    const afterShare = after.run.statements.find((s) => s.beneficiaryUserId === org.managerId)!;
    // 80,000 − 34,800 = 45,200 profit; the house keeps half, 22,600; a fifth of
    // that is 4,520.
    expect(toMajorString(afterShare.total)).toBe('4520.00');

    /*
     * Stated as a fact rather than a claim in a comment.
     *
     * 980.00 less than the same deal reported when it counted its own people's
     * time as free. That difference is not an accounting nicety — it is money
     * the agency was about to pay out of profit it had not made.
     */
    expect(beforeShare.total.minor - afterShare.total.minor).toBe(98000n);
  });
});
