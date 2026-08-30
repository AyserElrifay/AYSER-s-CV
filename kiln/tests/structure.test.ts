import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminSql, closeAll, getDb, raw, resetTables } from './helpers/db';
import { CURRENCY_CODES } from '../src/money/currency';
import { APP_ROLES, DB_ROLE_BY_APP_ROLE, MANAGED_ROLES } from '../src/db/roles';
import { FINANCIAL_COLUMNS } from '../src/db/schema';
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
  'deals',
  'audit_log',
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
  // consulted. kiln_app holds no USAGE on the schema either, so the table is not
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

describe('the sign-in bypass', () => {
  it('is the only SECURITY DEFINER function in the schema', async () => {
    const rows = await adminSql()<{ name: string }[]>`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'kiln') and p.prosecdef
      order by p.proname`;
    expect(rows.map((r) => r.name)).toEqual(['authenticate_lookup']);
  });

  it('is owned by a role that cannot log in', async () => {
    const rows = await adminSql()<{ owner: string; canlogin: boolean }[]>`
      select r.rolname as owner, r.rolcanlogin as canlogin
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles r on r.oid = p.proowner
      where n.nspname = 'kiln' and p.proname = 'authenticate_lookup'`;
    expect(rows[0]?.owner).toBe(MANAGED_ROLES.bootstrap);
    expect(rows[0]?.canlogin).toBe(false);
  });

  it('is executable only by the application role', async () => {
    const rows = await adminSql()<{ grantee: string }[]>`
      select grantee from information_schema.role_routine_grants
      where routine_schema = 'kiln' and routine_name = 'authenticate_lookup'
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
    for (const [table, columns] of Object.entries(FINANCIAL_COLUMNS)) {
      for (const column of columns) {
        if (granted.has(`${table}.${column}`)) leaked.push(`${table}.${column}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('are not granted to the Partner role either', async () => {
    const rows = await adminSql()<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.column_privileges
      where table_schema = 'public'
        and grantee = ${DB_ROLE_BY_APP_ROLE.partner}
        and privilege_type = 'SELECT'`;
    const granted = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const leaked: string[] = [];
    for (const [table, columns] of Object.entries(FINANCIAL_COLUMNS)) {
      for (const column of columns) {
        if (granted.has(`${table}.${column}`)) leaked.push(`${table}.${column}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('never allow password_hash to be read back by an application role', async () => {
    const rows = await adminSql()<{ grantee: string }[]>`
      select distinct grantee from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'users'
        and column_name = 'password_hash' and privilege_type = 'SELECT'
        and grantee <> current_user`;
    // The Owner may write a hash — creating a user, resetting a password — but
    // no application role may select one. Only kiln_bootstrap reads it, through
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
