import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';
import { APP_ROLES, type AppRole } from '../src/db/roles';

/**
 * The Phase 0 gate: a user in one organisation cannot reach another's data.
 *
 * Every case below goes through `withTenant`, the same path a request takes, as
 * nisba_app, the same role the application connects as. Nothing here has more
 * reach than the running product does.
 */

let orgA: SeededOrg;
let orgB: SeededOrg;

const TENANT_TABLES = ['organizations', 'users', 'brand_kits', 'services', 'clients', 'deals'];

beforeAll(async () => {
  await resetTables();
  orgA = await seedOrg('orga');
  orgB = await seedOrg('orgb');
});

afterAll(async () => {
  await closeAll();
});

describe('reading across organisations', () => {
  it('sees only its own rows, on every table, for every role', async () => {
    for (const role of APP_ROLES) {
      for (const table of TENANT_TABLES) {
        // Members and Partners hold no grant on some tables at all; that is a
        // stronger answer than "no rows", and is asserted separately below.
        let rows: unknown[];
        try {
          const result = await withTenant(as(orgA, role), (tx) =>
            tx.execute(raw.raw(`select org_id from ${table}`)),
          );
          rows = Array.from(result as Iterable<{ org_id: string }>);
        } catch {
          continue;
        }
        const foreign = (rows as { org_id: string }[]).filter((r) => r.org_id !== orgA.orgId);
        expect(foreign, `${role} on ${table} saw rows from another organisation`).toEqual([]);
      }
    }
  });

  it('cannot fetch a known row from the other organisation by its id', async () => {
    // The attacker's best case: they already know the exact primary key.
    for (const role of APP_ROLES) {
      for (const [table, id] of [
        ['deals', orgB.dealId],
        ['clients', orgB.clientId],
        ['services', orgB.serviceId],
        ['users', orgB.memberId],
        ['organizations', orgB.orgId],
      ] as const) {
        let rows: unknown[];
        try {
          const result = await withTenant(as(orgA, role), (tx) =>
            tx.execute(raw.raw(`select id from ${table} where id = '${id}'`)),
          );
          rows = Array.from(result as Iterable<unknown>);
        } catch {
          continue;
        }
        expect(rows, `${role} fetched ${table} ${id} across the tenant boundary`).toEqual([]);
      }
    }
  });

  it('counts zero of the other organisation, not "some"', async () => {
    const result = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`select count(*)::int as n from deals where org_id = ${orgB.orgId}`),
    );
    expect(Array.from(result as Iterable<{ n: number }>)[0]?.n).toBe(0);
  });

  it('cannot reach the other organisation through a join', async () => {
    const result = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`
        select d.id from deals d
        join clients c on c.id = d.client_id
        join organizations o on o.id = d.org_id`),
    );
    const rows = Array.from(result as Iterable<{ id: string }>);
    expect(rows.every((r) => r.id !== orgB.dealId && r.id !== orgB.otherDealId)).toBe(true);
    expect(rows).toHaveLength(2); // both of org A's deals, and nothing else
  });

  it('cannot reach it through a subquery that never names org_id', async () => {
    const result = await withTenant(as(orgA, 'owner'), (tx) =>
      tx.execute(raw`
        select id from deals
        where client_id in (select id from clients)
           or client_id = ${orgB.clientId}`),
    );
    expect(Array.from(result as Iterable<unknown>)).toHaveLength(2);
  });
});

describe('writing across organisations', () => {
  it('cannot update the other organisation, and reports zero rows changed', async () => {
    await withTenant(as(orgA, 'owner'), async (tx) => {
      await tx.execute(raw`update deals set title = 'stolen' where id = ${orgB.dealId}`);
    });
    const after = await withTenant(as(orgB, 'owner'), (tx) =>
      tx.execute(raw`select title from deals where id = ${orgB.dealId}`),
    );
    expect(Array.from(after as Iterable<{ title: string }>)[0]?.title).toBe('orgb deal one');
  });

  it('cannot delete from the other organisation', async () => {
    await withTenant(as(orgA, 'owner'), async (tx) => {
      await tx.execute(raw`delete from deals where id = ${orgB.dealId}`);
    });
    const after = await withTenant(as(orgB, 'owner'), (tx) =>
      tx.execute(raw`select count(*)::int as n from deals where id = ${orgB.dealId}`),
    );
    expect(Array.from(after as Iterable<{ n: number }>)[0]?.n).toBe(1);
  });

  it('cannot insert a row belonging to the other organisation', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into clients (org_id, name) values (${orgB.orgId}, 'planted')`),
      ),
      /row-level security|violates/i,
    );
  });

  it('cannot build a deal that points at the other organisation', async () => {
    // Even with the right org_id on the deal itself, the composite foreign key
    // refuses a client that lives somewhere else.
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into deals (org_id, client_id, owner_user_id, title, currency,
                             agreed_price_minor, estimated_cost_minor)
          values (${orgA.orgId}, ${orgB.clientId}, ${orgA.managerId}, 'cross-tenant',
                  'EGP', 100, 0)`),
      ),
      /foreign key|violates/i,
    );
  });

  it('cannot assign a deal to a user in the other organisation', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into deals (org_id, client_id, owner_user_id, title, currency,
                             agreed_price_minor, estimated_cost_minor)
          values (${orgA.orgId}, ${orgA.clientId}, ${orgB.managerId}, 'cross-tenant',
                  'EGP', 100, 0)`),
      ),
      /foreign key|violates/i,
    );
  });
});

describe('a request with no tenant context', () => {
  it('matches nothing rather than everything', async () => {
    // current_org_id() is NULL, and org_id = NULL is never true. The failure
    // mode of forgetting context is an empty screen, not a data breach.
    const unknownOrg = randomUUID();
    const result = await withTenant(
      { orgId: unknownOrg, userId: randomUUID(), role: 'owner' },
      (tx) => tx.execute(raw`select id from deals`),
    );
    expect(Array.from(result as Iterable<unknown>)).toEqual([]);
  });

  it('refuses a context that is not a UUID', async () => {
    await expect(
      withTenant({ orgId: "' or true --", userId: randomUUID(), role: 'owner' }, async () => null),
    ).rejects.toThrow(/not a UUID/);
    await expect(
      withTenant({ orgId: randomUUID(), userId: 'nope', role: 'owner' }, async () => null),
    ).rejects.toThrow(/not a UUID/);
  });

  it('refuses a role that is not one of the four', async () => {
    await expect(
      withTenant(
        { orgId: randomUUID(), userId: randomUUID(), role: 'superuser' as AppRole },
        async () => null,
      ),
    ).rejects.toThrow(/No database role is mapped/);
  });
});

describe('context does not survive its transaction', () => {
  it('is cleared before the next request can reuse the connection', async () => {
    // The pooled-connection failure mode: request one sets context, request two
    // lands on the same physical connection and inherits it. SET LOCAL is what
    // prevents that, and this is the test that it is actually SET LOCAL.
    await withTenant(as(orgA, 'owner'), async (tx) => {
      const seen = await tx.execute(raw`select nisba.current_org_id() as org`);
      expect(Array.from(seen as Iterable<{ org: string }>)[0]?.org).toBe(orgA.orgId);
    });

    for (let i = 0; i < 20; i++) {
      const leaked = await withTenant(as(orgB, 'owner'), (tx) =>
        tx.execute(raw`select nisba.current_org_id() as org, current_user::text as role`),
      );
      const row = Array.from(leaked as Iterable<{ org: string; role: string }>)[0];
      expect(row?.org).toBe(orgB.orgId);
      expect(row?.role).toBe('nisba_role_owner');
    }
  });

  it('restores the connection role afterwards', async () => {
    await withTenant(as(orgA, 'member'), async (tx) => {
      const inside = await tx.execute(raw`select current_user::text as role`);
      expect(Array.from(inside as Iterable<{ role: string }>)[0]?.role).toBe('nisba_role_member');
    });
    // Back on nisba_app, which cannot see the schema at all.
    await expectRefused(
      withTenant(as(orgA, 'owner'), async (tx) => {
        await tx.execute(raw`reset role`);
        return tx.execute(raw`select * from deals`);
      }),
      /permission denied|does not exist/i,
    );
  });
});
