/**
 * Migration runner.
 *
 * Runs as an administrative connection (ADMIN_DATABASE_URL) because it creates
 * roles and owns the tables. The application never uses this connection: it
 * connects as nisba_app, which owns nothing and inherits nothing.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { DB_ROLE_BY_APP_ROLE, MANAGED_ROLES } from './roles';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export interface MigrateOptions {
  adminUrl: string;
  /** Password given to nisba_app; the app's own DATABASE_URL must match. */
  appPassword: string;
  log?: (message: string) => void;
}

export async function migrate({ adminUrl, appPassword, log = () => {} }: MigrateOptions) {
  const sql = postgres(adminUrl, { onnotice: () => {}, max: 1 });
  try {
    await provisionRoles(sql, appPassword, log);

    await sql`create schema if not exists nisba`;
    await sql`
      create table if not exists nisba.schema_migrations (
        version    text primary key,
        applied_at timestamptz not null default now()
      )`;

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set(
      (await sql<{ version: string }[]>`select version from nisba.schema_migrations`).map(
        (row) => row.version,
      ),
    );

    for (const file of files) {
      if (applied.has(file)) {
        log(`  = ${file}`);
        continue;
      }
      const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      // Each migration is one transaction: it applies completely or not at all.
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into nisba.schema_migrations (version) values (${file})`;
      });
      log(`  + ${file}`);
    }

    // Anything created by a later migration still needs to be reachable.
    await grantSchemaUsage(sql);
    return files.length;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function provisionRoles(
  sql: postgres.Sql,
  appPassword: string,
  log: (message: string) => void,
) {
  const nologinRoles = [...Object.values(DB_ROLE_BY_APP_ROLE), MANAGED_ROLES.bootstrap];

  for (const role of nologinRoles) {
    const present = await sql`select 1 from pg_roles where rolname = ${role}`;
    if (present.length > 0) continue;
    await sql.unsafe(await statement(sql, 'create role %I nologin', role));
    log(`  + role ${role}`);
  }

  const exists = await sql<{ one: number }[]>`
    select 1 as one from pg_roles where rolname = ${MANAGED_ROLES.app}`;
  if (exists.length === 0) {
    // Postgres builds the statement so Postgres does the quoting.
    await sql.unsafe(
      await statement(
        sql,
        'create role %I with login noinherit password %L',
        MANAGED_ROLES.app,
        appPassword,
      ),
    );
    log(`  + role ${MANAGED_ROLES.app}`);
  } else {
    await sql.unsafe(
      await statement(
        sql,
        'alter role %I with login noinherit password %L',
        MANAGED_ROLES.app,
        appPassword,
      ),
    );
  }

  // NOINHERIT is what makes a forgotten SET ROLE fail loudly instead of running
  // with the union of every role's privileges.
  for (const role of Object.values(DB_ROLE_BY_APP_ROLE)) {
    await sql.unsafe(await statement(sql, 'grant %I to %I', role, MANAGED_ROLES.app));
  }
}

async function grantSchemaUsage(sql: postgres.Sql) {
  const roles = [...Object.values(DB_ROLE_BY_APP_ROLE), MANAGED_ROLES.app, MANAGED_ROLES.bootstrap];
  for (const role of roles) {
    await sql.unsafe(await statement(sql, 'grant usage on schema nisba to %I', role));
  }
}

/**
 * Build a DDL statement using Postgres's own quoting.
 *
 * Role names and passwords cannot be bound as parameters in DDL, so `format`
 * with %I and %L does the escaping server-side rather than by string
 * concatenation here.
 */
async function statement(sql: postgres.Sql, template: string, ...args: string[]): Promise<string> {
  const [first, second] = args;
  if (first === undefined) throw new Error('statement() needs at least one argument');
  const rows =
    second === undefined
      ? await sql<{ stmt: string }[]>`
          select format(${template}::text, ${first}::text) as stmt`
      : await sql<{ stmt: string }[]>`
          select format(${template}::text, ${first}::text, ${second}::text) as stmt`;
  return rows[0]!.stmt;
}

async function main() {
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  const appPassword = process.env.NISBA_APP_DB_PASSWORD;
  if (!adminUrl || !appPassword) {
    console.error('Set ADMIN_DATABASE_URL and NISBA_APP_DB_PASSWORD. See nisba/.env.example.');
    process.exit(1);
  }
  const count = await migrate({ adminUrl, appPassword, log: (m) => console.log(m) });
  console.log(`Schema is current (${count} migration${count === 1 ? '' : 's'}).`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  void main();
}
