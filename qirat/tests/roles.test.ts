import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';
import { MEMBER_FORBIDDEN_COLUMNS } from '../src/db/schema';
import { canSeeFinancials } from '../src/db/roles';

/**
 * Role scoping.
 *
 * The rule that matters most here: "a Member must never receive a financial
 * field in an API response". That is enforced as a column privilege, so it does
 * not depend on any select list anybody remembers to write — asking for the
 * column is an error, not a filtered result.
 */

let org: SeededOrg;

beforeAll(async () => {
  await resetTables();
  org = await seedOrg('rolesorg');
});
afterAll(async () => {
  await closeAll();
});

describe('the Member', () => {
  it('cannot select a financial column, on any table', async () => {
    for (const [table, columns] of Object.entries(MEMBER_FORBIDDEN_COLUMNS)) {
      for (const column of columns) {
        await expectRefused(
          withTenant(as(org, 'member'), (tx) =>
            tx.execute(raw.raw(`select ${column} from ${table}`)),
          ),
          /permission denied/i,
        );
      }
    }
  });

  it('cannot select * from a table that has financial columns', async () => {
    // The lazy query is the dangerous one, so it is the one that must fail.
    for (const table of ['deals', 'services', 'organizations']) {
      await expectRefused(
        withTenant(as(org, 'member'), (tx) => tx.execute(raw.raw(`select * from ${table}`))),
        /permission denied/i,
      );
    }
  });

  it('sees no deals at all', async () => {
    const rows = await withTenant(as(org, 'member'), (tx) =>
      tx.execute(raw`select id, title from deals`),
    );
    expect(Array.from(rows as Iterable<unknown>)).toEqual([]);
  });

  it('can still read what it legitimately needs', async () => {
    const rows = await withTenant(as(org, 'member'), (tx) =>
      tx.execute(raw`select name from organizations`),
    );
    expect(Array.from(rows as Iterable<{ name: string }>)[0]?.name).toBe('rolesorg Agency');

    const services = await withTenant(as(org, 'member'), (tx) =>
      tx.execute(raw`select name, task_template from services`),
    );
    expect(Array.from(services as Iterable<unknown>)).toHaveLength(1);
  });

  it('sees only itself in the user list', async () => {
    const rows = await withTenant(as(org, 'member'), (tx) =>
      tx.execute(raw`select id from users`),
    );
    const ids = Array.from(rows as Iterable<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual([org.memberId]);
  });

  it('cannot read the audit log', async () => {
    await expectRefused(
      withTenant(as(org, 'member'), (tx) => tx.execute(raw`select * from audit_log`)),
      /permission denied/i,
    );
  });
});

describe('the Partner', () => {
  it('cannot reach deals, services or clients at all', async () => {
    for (const table of ['deals', 'services', 'clients']) {
      await expectRefused(
        withTenant(as(org, 'partner'), (tx) => tx.execute(raw.raw(`select * from ${table}`))),
        /permission denied/i,
      );
    }
  });

  it('sees only itself', async () => {
    const rows = await withTenant(as(org, 'partner'), (tx) =>
      tx.execute(raw`select id from users`),
    );
    expect(Array.from(rows as Iterable<{ id: string }>).map((r) => r.id)).toEqual([org.partnerId]);
  });
});

describe('the Account Manager', () => {
  it('sees their own pipeline and not a colleague’s', async () => {
    const rows = await withTenant(as(org, 'account_manager'), (tx) =>
      tx.execute(raw`select id from deals`),
    );
    const ids = Array.from(rows as Iterable<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual([org.dealId]);
    expect(ids).not.toContain(org.otherDealId);
  });

  it('sees margin on their own deal', async () => {
    const rows = await withTenant(as(org, 'account_manager'), (tx) =>
      tx.execute(raw`select agreed_price_minor, estimated_cost_minor from deals`),
    );
    const row = Array.from(rows as Iterable<{ agreed_price_minor: string }>)[0];
    expect(row?.agreed_price_minor).toBeDefined();
  });

  it('cannot edit a colleague’s deal', async () => {
    await withTenant(as(org, 'account_manager'), async (tx) => {
      await tx.execute(raw`update deals set title = 'taken over' where id = ${org.otherDealId}`);
    });
    const after = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select title from deals where id = ${org.otherDealId}`),
    );
    expect(Array.from(after as Iterable<{ title: string }>)[0]?.title).toBe('rolesorg deal two');
  });

  it('cannot reassign a deal to itself to gain access', async () => {
    await withTenant(as(org, 'account_manager'), async (tx) => {
      await tx.execute(
        raw`update deals set owner_user_id = ${org.managerId} where id = ${org.otherDealId}`,
      );
    });
    const after = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select owner_user_id from deals where id = ${org.otherDealId}`),
    );
    expect(Array.from(after as Iterable<{ owner_user_id: string }>)[0]?.owner_user_id).toBe(
      org.otherManagerId,
    );
  });

  it('cannot create a deal owned by somebody else', async () => {
    await expectRefused(
      withTenant(as(org, 'account_manager'), (tx) =>
        tx.execute(raw`
          insert into deals (org_id, client_id, owner_user_id, title, currency,
                             agreed_price_minor, estimated_cost_minor)
          values (${org.orgId}, ${org.clientId}, ${org.otherManagerId}, 'planted', 'EGP', 100, 0)`),
      ),
      /row-level security|violates/i,
    );
  });

  it('cannot read the audit log', async () => {
    await expectRefused(
      withTenant(as(org, 'account_manager'), (tx) => tx.execute(raw`select * from audit_log`)),
      /permission denied/i,
    );
  });
});

describe('the Owner', () => {
  it('sees every deal in the organisation', async () => {
    const rows = await withTenant(as(org, 'owner'), (tx) => tx.execute(raw`select id from deals`));
    expect(Array.from(rows as Iterable<unknown>)).toHaveLength(2);
  });

  it('sees the house rate and the margin thresholds', async () => {
    const rows = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select house_rate_bp, margin_healthy_bp from organizations`),
    );
    expect(Array.from(rows as Iterable<{ house_rate_bp: number }>)[0]?.house_rate_bp).toBe(5000);
  });

  it('cannot read a password hash back, even for their own users', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) => tx.execute(raw`select password_hash from users`)),
      /permission denied/i,
    );
  });
});

describe('the role table in code', () => {
  it('agrees with what the database actually permits', async () => {
    for (const role of ['owner', 'account_manager', 'member', 'partner'] as const) {
      let sawMoney = false;
      try {
        await withTenant(as(org, role), (tx) =>
          tx.execute(raw`select agreed_price_minor from deals`),
        );
        sawMoney = true;
      } catch {
        sawMoney = false;
      }
      expect(sawMoney, `${role}: code and database disagree about financial access`).toBe(
        canSeeFinancials(role),
      );
    }
  });
});
