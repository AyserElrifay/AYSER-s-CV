import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminSql, closeAll, getDb, raw, resetTables } from './helpers/db';
import { CURRENCY_CODES } from '../src/money/currency';
import { APP_ROLES, DB_ROLE_BY_APP_ROLE, MANAGED_ROLES } from '../src/db/roles';
import {
  MEMBER_FORBIDDEN_COLUMNS,
  PARTNER_FORBIDDEN_COLUMNS,
  RELATIONSHIP_TABLES,
} from '../src/db/schema';
import { assertConnectionIsLeastPrivilege } from '../src/db/client';
import { expectRefused } from './helpers/errors';

/**
 * Structural guarantees.
 *
 * These do not test a behaviour; they test that the shape of the database makes
 * a class of behaviour impossible. Their real job is the table that has not been
 * written yet: add one without org_id, without FORCE RLS, or without a policy,
 * and this suite fails before anybody can query it.
 */

const APP_TABLES = [
  'organizations',
  'users',
  'brand_kits',
  'services',
  'clients',
  'client_contacts',
  'conversations',
  'deals',
  'deal_assignments',
  'work_log',
  'costs',
  'invoices',
  'payments',
  'ledger_entries',
  'ledger_lines',
  'audit_log',
  'split_rules',
  'payout_periods',
  'payout_statements',
  'payout_adjustments',
];

beforeAll(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeAll();
});

describe('every table in the public schema', () => {
  it('is the set we expect — a new one must be added deliberately', async () => {
    const rows = await adminSql()<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename`;
    expect(rows.map((r) => r.tablename).sort()).toEqual([...APP_TABLES].sort());
  });

  it('carries org_id', async () => {
    const rows = await adminSql()<{ table_name: string }[]>`
      select t.tablename as table_name
      from pg_tables t
      where t.schemaname = 'public'
        and not exists (
          select 1 from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name = t.tablename
            and c.column_name = 'org_id'
        )`;
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });

  it('has row-level security enabled AND forced', async () => {
    const rows = await adminSql()<
      { relname: string; rls: boolean; forced: boolean }[]
    >`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname`;

    // FORCE matters as much as ENABLE: without it the table's owner reads every
    // row of every tenant, and the owner is whoever ran the migration.
    const unprotected = rows.filter((r) => !r.rls || !r.forced);
    expect(unprotected.map((r) => `${r.relname} (rls=${r.rls}, forced=${r.forced})`)).toEqual([]);
  });

  it('has at least one policy', async () => {
    const rows = await adminSql()<{ tablename: string; count: number }[]>`
      select t.tablename, (select count(*) from pg_policies p
                            where p.schemaname = 'public' and p.tablename = t.tablename)::int as count
      from pg_tables t where t.schemaname = 'public'`;
    const bare = rows.filter((r) => r.count === 0);
    expect(bare.map((r) => r.tablename)).toEqual([]);
  });

  it('grants nothing to PUBLIC', async () => {
    const rows = await adminSql()<{ table_name: string; privilege_type: string }[]>`
      select table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'PUBLIC'`;
    expect(rows).toEqual([]);
  });
});

describe('the connection role', () => {
  it('is least-privilege: not a superuser, cannot bypass RLS, owns no table', async () => {
    await expect(assertConnectionIsLeastPrivilege()).resolves.toBeUndefined();
  });

  it('is NOINHERIT, so a forgotten SET ROLE cannot silently succeed', async () => {
    const rows = await adminSql()<{ rolinherit: boolean; rolbypassrls: boolean }[]>`
      select rolinherit, rolbypassrls from pg_roles where rolname = ${MANAGED_ROLES.app}`;
    expect(rows[0]?.rolinherit).toBe(false);
    expect(rows[0]?.rolbypassrls).toBe(false);
  });

  it('holds no table privileges of its own', async () => {
    const rows = await adminSql()<{ table_name: string; privilege_type: string }[]>`
      select table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = ${MANAGED_ROLES.app}`;
    expect(rows).toEqual([]);
  });

  // Stronger than "returns no rows": refused by Postgres before any policy is
  // consulted. qirat_app holds no USAGE on the schema either, so the table is not
  // merely unreadable to it — it is invisible.
  const REFUSED = /permission denied|does not exist/i;

  it('cannot read a table without switching roles first', async () => {
    await expectRefused(getDb().execute(raw`select * from deals`), REFUSED);
  });

  it('cannot read a table with tenant context but no role switch', async () => {
    await expectRefused(
      getDb().execute(raw`
        select set_config('app.org_id', gen_random_uuid()::text, false);
        select * from deals`),
      REFUSED,
    );
  });

  it('holds no privilege on the schema itself', async () => {
    const rows = await adminSql()<{ has: boolean }[]>`
      select has_schema_privilege(${MANAGED_ROLES.app}, 'public', 'USAGE') as has`;
    expect(rows[0]?.has).toBe(false);
  });
});

/**
 * Every way past row-level security, named.
 *
 * There are exactly three, and each exists because somebody legitimately has no
 * account: the person signing in has not proved who they are yet, and the person
 * paying an invoice is a client who must never be asked to sign up in order to
 * pay you.
 *
 * The list is written out here on purpose. Adding a fourth SECURITY DEFINER
 * anywhere in the schema fails this suite, which is the point: a bypass should
 * be a decision somebody made in front of a test, not a convenience that
 * appeared in a migration on a Thursday.
 */
const SANCTIONED_BYPASSES: Record<string, keyof typeof MANAGED_ROLES> = {
  authenticate_lookup: 'bootstrap',
  public_invoice: 'publicReader',
  public_claim_payment: 'publicReader',
};

describe('the sanctioned bypasses', () => {
  it('are the only SECURITY DEFINER functions in the schema', async () => {
    const rows = await adminSql()<{ name: string }[]>`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'qirat') and p.prosecdef
      order by p.proname`;
    expect(rows.map((r) => r.name).sort()).toEqual(Object.keys(SANCTIONED_BYPASSES).sort());
  });

  it('are each owned by a role that cannot log in', async () => {
    /*
     * The whole danger of SECURITY DEFINER is the owner.
     *
     * Left owned by whoever ran the migration — typically a superuser — the
     * function runs with that role's privileges and bypasses RLS entirely
     * rather than through the narrow door it was written to be.
     */
    const rows = await adminSql()<{ name: string; owner: string; canlogin: boolean }[]>`
      select p.proname as name, r.rolname as owner, r.rolcanlogin as canlogin
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles r on r.oid = p.proowner
      where n.nspname = 'qirat' and p.prosecdef`;

    expect(rows.length).toBe(Object.keys(SANCTIONED_BYPASSES).length);
    for (const row of rows) {
      const expected = SANCTIONED_BYPASSES[row.name];
      expect(expected, `${row.name} is not a sanctioned bypass`).toBeDefined();
      expect(row.owner, `${row.name} is owned by the wrong role`).toBe(
        MANAGED_ROLES[expected!],
      );
      expect(row.canlogin, `${row.name}'s owner can log in`).toBe(false);
    }
  });

  it('own nothing else they could reach through', async () => {
    // A role that owns a table also owns the ability to read it past every
    // policy on it. The bypass roles must own their functions and no tables.
    const rows = await adminSql()<{ tablename: string; owner: string }[]>`
      select tablename, tableowner as owner from pg_tables
      where schemaname = 'public'
        and tableowner = any(${[MANAGED_ROLES.bootstrap, MANAGED_ROLES.publicReader]})`;
    expect(rows).toEqual([]);
  });

  it('is executable only by the application role', async () => {
    const rows = await adminSql()<{ grantee: string }[]>`
      select grantee from information_schema.role_routine_grants
      where routine_schema = 'qirat' and routine_name = 'authenticate_lookup'
        and grantee not in (${MANAGED_ROLES.bootstrap}, 'PUBLIC')
      order by grantee`;
    expect(rows.map((r) => r.grantee)).toEqual([MANAGED_ROLES.app]);
  });
});

describe('financial columns', () => {
  it('are not granted to the Member role, on any table', async () => {
    const rows = await adminSql()<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.column_privileges
      where table_schema = 'public'
        and grantee = ${DB_ROLE_BY_APP_ROLE.member}
        and privilege_type = 'SELECT'`;

    const granted = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const leaked: string[] = [];
    for (const [table, columns] of Object.entries(MEMBER_FORBIDDEN_COLUMNS)) {
      for (const column of columns) {
        if (granted.has(`${table}.${column}`)) leaked.push(`${table}.${column}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('keep the agency’s economics away from a Partner', async () => {
    const rows = await adminSql()<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.column_privileges
      where table_schema = 'public'
        and grantee = ${DB_ROLE_BY_APP_ROLE.partner}
        and privilege_type = 'SELECT'`;
    const granted = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const leaked: string[] = [];
    for (const [table, columns] of Object.entries(PARTNER_FORBIDDEN_COLUMNS)) {
      for (const column of columns) {
        if (granted.has(`${table}.${column}`)) leaked.push(`${table}.${column}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('do let a Partner read their own payout, which is the point of them', async () => {
    // The mirror of the test above. A Partner who cannot see the amount on
    // their own statement has been given a product with nothing in it.
    const rows = await adminSql()<{ column_name: string }[]>`
      select column_name from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'payout_statements'
        and grantee = ${DB_ROLE_BY_APP_ROLE.partner} and privilege_type = 'SELECT'`;
    const granted = rows.map((r) => r.column_name);
    expect(granted).toContain('amount_minor');
    expect(granted).toContain('lines');
  });

  it('never allow password_hash to be read back by an application role', async () => {
    const rows = await adminSql()<{ grantee: string }[]>`
      select distinct grantee from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'users'
        and column_name = 'password_hash' and privilege_type = 'SELECT'
        and grantee <> current_user`;
    // The Owner may write a hash — creating a user, resetting a password — but
    // no application role may select one. Only qirat_bootstrap reads it, through
    // the sign-in function.
    expect(rows.map((r) => r.grantee).sort()).toEqual([MANAGED_ROLES.bootstrap]);
  });
});

describe('the schema and the TypeScript agree', () => {
  it('on the list of currencies', async () => {
    const rows = await adminSql()<{ value: string }[]>`
      select e.enumlabel as value from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'currency_code' order by e.enumsortorder`;
    expect(rows.map((r) => r.value)).toEqual([...CURRENCY_CODES]);
  });

  it('on the list of roles', async () => {
    const rows = await adminSql()<{ value: string }[]>`
      select e.enumlabel as value from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'user_role' order by e.enumsortorder`;
    expect(rows.map((r) => r.value)).toEqual([...APP_ROLES]);
  });

  it('on a database role existing for each application role', async () => {
    for (const role of APP_ROLES) {
      const dbRole = DB_ROLE_BY_APP_ROLE[role];
      const rows = await adminSql()<{ n: number }[]>`
        select count(*)::int as n from pg_roles where rolname = ${dbRole}`;
      expect(rows[0]?.n, `${role} -> ${dbRole}`).toBe(1);
    }
  });
});

/**
 * The client relationship is the agency's, and the crew is not in it.
 *
 * Not a financial rule — there is no money on these tables — but the same kind
 * of rule, and it fails the same way: quietly, the first time somebody grants a
 * table wholesale because it seemed harmless.
 */
describe('the relationship tables', () => {
  it('are closed to a Member and a Partner entirely', async () => {
    const rows = await adminSql()<{ grantee: string; table_name: string; privilege_type: string }[]>`
      select grantee, table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = any(${[...RELATIONSHIP_TABLES]})
        and grantee = any(${[DB_ROLE_BY_APP_ROLE.member, DB_ROLE_BY_APP_ROLE.partner]})`;
    expect(rows.map((r) => `${r.grantee} ${r.privilege_type} ${r.table_name}`)).toEqual([]);
  });

  it('are open to the owner and the account manager, because a note is for a colleague', async () => {
    // The positive control: the assertion above would pass on tables nobody can
    // reach at all, which would be a different product.
    const rows = await adminSql()<{ grantee: string; table_name: string }[]>`
      select distinct grantee, table_name
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = any(${[...RELATIONSHIP_TABLES]})
        and privilege_type = 'SELECT'
        and grantee = any(${[DB_ROLE_BY_APP_ROLE.owner, DB_ROLE_BY_APP_ROLE.account_manager]})`;
    expect(rows).toHaveLength(RELATIONSHIP_TABLES.length * 2);
  });
});
