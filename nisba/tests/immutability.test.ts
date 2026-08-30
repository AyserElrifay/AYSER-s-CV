import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminSql, as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';

/**
 * The two immutability rules: the audit log is append-only, and a deal's terms
 * freeze when it closes. Both are enforced by triggers, so they hold for every
 * role including the one that owns the tables.
 */

let org: SeededOrg;

beforeAll(async () => {
  await resetTables();
  org = await seedOrg('frozenorg');
});
afterAll(async () => {
  await closeAll();
});

async function appendAudit(action: string) {
  return withTenant(as(org, 'owner'), (tx) =>
    tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id)
      values (${org.orgId}, ${org.ownerId}, 'owner@frozenorg.test', 'owner', ${action}, 'deal', ${org.dealId})
      returning id`),
  );
}

describe('the audit log', () => {
  it('accepts entries', async () => {
    const inserted = await appendAudit('deal.closed');
    expect(Array.from(inserted as Iterable<unknown>)).toHaveLength(1);
  });

  it('refuses to let an entry be edited', async () => {
    await appendAudit('price.changed');
    // Two layers deep: no application role is granted UPDATE, so the privilege
    // check refuses this before the trigger is ever consulted.
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update audit_log set action = 'nothing happened'`),
      ),
      /append-only|permission denied/i,
    );
  });

  it('is immutable even to the role that owns the table', async () => {
    // The privilege layer is the first defence; this is the second. A grant can
    // be handed out by mistake, and the migration role holds every privilege
    // there is — the trigger is what still says no.
    await expectRefused(
      adminSql().unsafe(`update audit_log set action = 'rewritten'`),
      /append-only/i,
    );
    await expectRefused(
      adminSql().unsafe(`delete from audit_log`),
      /append-only/i,
    );
    await expectRefused(
      adminSql().unsafe(`truncate audit_log`),
      /append-only/i,
    );
  });

  it('refuses to let an entry be deleted', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) => tx.execute(raw`delete from audit_log`)),
      /append-only|permission denied/i,
    );
  });

  it('keeps every entry that was written', async () => {
    const rows = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select action from audit_log order by id`),
    );
    const actions = Array.from(rows as Iterable<{ action: string }>).map((r) => r.action);
    expect(actions).toEqual(['deal.closed', 'price.changed']);
  });

  it('cannot be appended to on behalf of another organisation', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`
          insert into audit_log (org_id, action, entity_type)
          values (gen_random_uuid(), 'forged', 'deal')`),
      ),
      /row-level security|violates/i,
    );
  });
});

describe('freeze on close', () => {
  const closeDeal = (houseRate = 5000) =>
    withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`
        update deals set status = 'won',
                         closed_at = now(),
                         frozen_house_rate_bp = ${houseRate},
                         frozen_split_rules = '[{"userId":"x","bp":6000}]'::jsonb,
                         frozen_fx_rate = 1.0,
                         frozen_fx_source = 'identity',
                         frozen_fx_captured_at = now()
        where id = ${org.dealId}`),
    );

  it('refuses to mark a deal won without its frozen terms', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update deals set status = 'won' where id = ${org.dealId}`),
      ),
      /won_deals_are_frozen|violates check/i,
    );
  });

  it('closes a deal with its terms attached', async () => {
    await closeDeal();
    const rows = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select status, frozen_house_rate_bp from deals where id = ${org.dealId}`),
    );
    const row = Array.from(rows as Iterable<{ status: string; frozen_house_rate_bp: number }>)[0];
    expect(row?.status).toBe('won');
    expect(row?.frozen_house_rate_bp).toBe(5000);
  });

  it('will not let March change what February closed on', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update deals set frozen_house_rate_bp = 7000 where id = ${org.dealId}`),
      ),
      /frozen/i,
    );
  });

  it('will not let the agreed price move after close', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update deals set agreed_price_minor = 1 where id = ${org.dealId}`),
      ),
      /frozen/i,
    );
  });

  it('will not let the currency or the FX rate move after close', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update deals set currency = 'USD' where id = ${org.dealId}`),
      ),
      /frozen/i,
    );
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update deals set frozen_fx_rate = 61.2 where id = ${org.dealId}`),
      ),
      /frozen/i,
    );
  });

  it('will not let a closed deal be reopened', async () => {
    await expectRefused(
      withTenant(as(org, 'owner'), (tx) =>
        tx.execute(raw`update deals set status = 'draft' where id = ${org.dealId}`),
      ),
      /cannot be reopened/i,
    );
  });

  it('still lets costs and delivery move, because those are not the terms', async () => {
    await withTenant(as(org, 'owner'), async (tx) => {
      await tx.execute(raw`
        update deals set estimated_cost_minor = 3000000, delivery_date = '2026-12-01'
        where id = ${org.dealId}`);
    });
    const rows = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select estimated_cost_minor from deals where id = ${org.dealId}`),
    );
    // Money arrives as a bigint, never as a float or a lossy Number.
    expect(
      Array.from(rows as Iterable<{ estimated_cost_minor: bigint }>)[0]?.estimated_cost_minor,
    ).toBe(3_000_000n);
  });

  it('leaves an open deal fully editable', async () => {
    await withTenant(as(org, 'owner'), async (tx) => {
      await tx.execute(raw`
        update deals set agreed_price_minor = 9000000 where id = ${org.otherDealId}`);
    });
    const rows = await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`select agreed_price_minor from deals where id = ${org.otherDealId}`),
    );
    expect(
      Array.from(rows as Iterable<{ agreed_price_minor: bigint }>)[0]?.agreed_price_minor,
    ).toBe(9_000_000n);
  });
});
