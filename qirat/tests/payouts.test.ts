import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { adminSql, as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';

/**
 * Payouts carry the most sensitive numbers in the product, and the rule from
 * the brief is absolute: a Partner sees their own statements and nothing else.
 * These tests hold that at the database, where a route cannot get it wrong.
 */

let orgA: SeededOrg;
let orgB: SeededOrg;
let periodA: string;
let statementForPartner: string;

async function openPeriod(org: SeededOrg, startsOn: string, endsOn: string): Promise<string> {
  const id = randomUUID();
  await withTenant(as(org, 'owner'), (tx) =>
    tx.execute(raw`
      insert into payout_periods (id, org_id, starts_on, ends_on)
      values (${id}, ${org.orgId}, ${startsOn}::date, ${endsOn}::date)`),
  );
  return id;
}

async function issueStatement(
  org: SeededOrg,
  periodId: string,
  beneficiaryId: string,
  amount: string,
): Promise<string> {
  const id = randomUUID();
  await withTenant(as(org, 'owner'), (tx) =>
    tx.execute(raw`
      insert into payout_statements (id, org_id, period_id, beneficiary_user_id, currency, amount_minor, lines)
      values (${id}, ${org.orgId}, ${periodId}, ${beneficiaryId}, 'EGP', ${amount}::bigint,
              '[{"dealId":"x","kind":"partner_equity","rateBp":3000}]'::jsonb)`),
  );
  return id;
}

beforeAll(async () => {
  await resetTables();
  orgA = await seedOrg('payoutsa');
  orgB = await seedOrg('payoutsb');
  periodA = await openPeriod(orgA, '2026-02-01', '2026-02-28');
  statementForPartner = await issueStatement(orgA, periodA, orgA.partnerId, '900000');
  await issueStatement(orgA, periodA, orgA.managerId, '750000');
});

afterAll(async () => {
  await closeAll();
});

describe('the Partner', () => {
  it('sees their own statement, which is the point of the product', async () => {
    const rows = await withTenant(as(orgA, 'partner'), (tx) =>
      tx.execute(raw`select amount_minor from payout_statements`),
    );
    const amounts = Array.from(rows as Iterable<{ amount_minor: bigint }>).map(
      (r) => r.amount_minor,
    );
    expect(amounts).toEqual([900_000n]);
  });

  it('does not see anybody else’s', async () => {
    const rows = await withTenant(as(orgA, 'partner'), (tx) =>
      tx.execute(raw`select beneficiary_user_id from payout_statements`),
    );
    const ids = Array.from(rows as Iterable<{ beneficiary_user_id: string }>).map(
      (r) => r.beneficiary_user_id,
    );
    expect(ids).toEqual([orgA.partnerId]);
    expect(ids).not.toContain(orgA.managerId);
  });

  it('still cannot see a deal, a price or a cost', async () => {
    for (const table of ['deals', 'costs', 'services']) {
      await expectRefused(
        withTenant(as(orgA, 'partner'), (tx) => tx.execute(raw.raw(`select * from ${table}`))),
        /permission denied/i,
      );
    }
  });

  it('cannot issue a statement to themselves', async () => {
    await expectRefused(
      withTenant(as(orgA, 'partner'), (tx) =>
        tx.execute(raw`
          insert into payout_statements (org_id, period_id, beneficiary_user_id, currency, amount_minor)
          values (${orgA.orgId}, ${periodA}, ${orgA.partnerId}, 'EGP', 99999999)`),
      ),
      /permission denied/i,
    );
  });

  it('reads only the equity rule that names them', async () => {
    await withTenant(as(orgA, 'owner'), async (tx) => {
      await tx.execute(raw`
        insert into split_rules (org_id, kind, beneficiary_user_id, rate_bp)
        values (${orgA.orgId}, 'partner_equity', ${orgA.partnerId}, 3000)`);
      await tx.execute(raw`
        insert into split_rules (org_id, kind, beneficiary_user_id, rate_bp)
        values (${orgA.orgId}, 'partner_equity', ${orgA.ownerId}, 5000)`);
    });
    const rows = await withTenant(as(orgA, 'partner'), (tx) =>
      tx.execute(raw`select rate_bp from split_rules`),
    );
    // Their own 30%, not the owner's 50%.
    expect(Array.from(rows as Iterable<{ rate_bp: number }>).map((r) => r.rate_bp)).toEqual([3000]);
  });
});

describe('the Member', () => {
  it('cannot reach any part of the payout machinery', async () => {
    for (const table of ['split_rules', 'payout_periods', 'payout_statements', 'payout_adjustments']) {
      await expectRefused(
        withTenant(as(orgA, 'member'), (tx) => tx.execute(raw.raw(`select * from ${table}`))),
        /permission denied/i,
      );
    }
  });
});

describe('an issued statement', () => {
  it('cannot be edited by anyone, including the owner', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`update payout_statements set amount_minor = 1`),
      ),
      /immutable|permission denied/i,
    );
  });

  it('cannot be deleted', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) => tx.execute(raw`delete from payout_statements`)),
      /immutable|permission denied/i,
    );
  });

  it('is immutable even to the role that owns the table', async () => {
    // The privilege layer is the first defence; the trigger is the second, and
    // it is the one that still holds when a grant is handed out by mistake.
    await expectRefused(
      adminSql().unsafe(`update payout_statements set amount_minor = 1`),
      /immutable/i,
    );
    await expectRefused(adminSql().unsafe(`delete from payout_statements`), /immutable/i);
    // Once a correction exists, the foreign key refuses the truncate before the
    // trigger is even reached. Either refusal is the database saying no, and
    // both are load-bearing, so the assertion accepts whichever arrives first.
    await expectRefused(
      adminSql().unsafe(`truncate payout_statements`),
      /immutable|cannot truncate a table referenced/i,
    );
  });

  it('is corrected by a new entry that carries a reason', async () => {
    await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`
        insert into payout_adjustments
          (org_id, statement_id, beneficiary_user_id, currency, amount_minor, reason, created_by_user_id)
        values (${orgA.orgId}, ${statementForPartner}, ${orgA.partnerId}, 'EGP', -50000,
                'Double-counted the Cairo shoot', ${orgA.ownerId})`),
    );
    const rows = await withTenant(as(orgA, 'partner'), (tx) =>
      tx.execute(raw`select amount_minor, reason from payout_adjustments`),
    );
    const adjustment = Array.from(rows as Iterable<{ amount_minor: bigint; reason: string }>)[0];
    expect(adjustment?.amount_minor).toBe(-50_000n);
    expect(adjustment?.reason).toBe('Double-counted the Cairo shoot');
  });

  it('refuses a correction with no reason', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into payout_adjustments
            (org_id, statement_id, beneficiary_user_id, currency, amount_minor, reason, created_by_user_id)
          values (${orgA.orgId}, ${statementForPartner}, ${orgA.partnerId}, 'EGP', -1, '   ', ${orgA.ownerId})`),
      ),
      /violates check|check constraint/i,
    );
  });

  it('leaves the correction itself uneditable', async () => {
    await expectRefused(
      adminSql().unsafe(`update payout_adjustments set amount_minor = 0`),
      /immutable/i,
    );
  });
});

describe('a closed period', () => {
  it('records who closed it and when', async () => {
    await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`
        update payout_periods
        set status = 'closed', closed_at = now(), closed_by_user_id = ${orgA.ownerId}
        where id = ${periodA}`),
    );
    const rows = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`select status::text as status, closed_by_user_id from payout_periods where id = ${periodA}`),
    );
    const row = Array.from(rows as Iterable<{ status: string; closed_by_user_id: string }>)[0];
    expect(row?.status).toBe('closed');
    expect(row?.closed_by_user_id).toBe(orgA.ownerId);
  });

  it('cannot be reopened', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`update payout_periods set status = 'open' where id = ${periodA}`),
      ),
      /is closed/i,
    );
  });

  it('cannot be marked closed without a closer', async () => {
    const other = await openPeriod(orgA, '2026-03-01', '2026-03-31');
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`update payout_periods set status = 'closed' where id = ${other}`),
      ),
      /closed_periods_are_stamped|violates check/i,
    );
  });
});

describe('across organisations', () => {
  it('cannot see another organisation’s statements', async () => {
    const periodB = await openPeriod(orgB, '2026-02-01', '2026-02-28');
    await issueStatement(orgB, periodB, orgB.partnerId, '5555555');

    const rows = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`select org_id, amount_minor from payout_statements`),
    );
    const values = Array.from(rows as Iterable<{ org_id: string; amount_minor: bigint }>);
    expect(values.filter((r) => r.org_id !== orgA.orgId)).toEqual([]);
    expect(values.map((r) => r.amount_minor)).not.toContain(5_555_555n);
  });

  it('cannot issue a statement into another organisation', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into payout_statements (org_id, period_id, beneficiary_user_id, currency, amount_minor)
          values (${orgB.orgId}, ${periodA}, ${orgB.partnerId}, 'EGP', 1)`),
      ),
      /row-level security|foreign key|violates/i,
    );
  });
});
