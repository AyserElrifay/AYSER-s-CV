import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql as raw } from 'drizzle-orm';
import postgres from 'postgres';
import { type AppRole, DB_ROLE_BY_APP_ROLE, dbRoleFor } from './roles';
import * as schema from './schema';

/**
 * The only way into the database.
 *
 * Every query runs inside `withTenant`, which opens a transaction, switches to
 * the caller's role, and pins the tenant context to that transaction. Three
 * things follow, and all three are properties of Postgres rather than promises
 * made by the code above it:
 *
 *  - A query that forgets tenant context matches nothing, because
 *    current_org_id() is NULL and NULL = anything is never true.
 *  - A query that forgets to switch roles is refused outright, because qirat_app
 *    is NOINHERIT and holds no table privileges of its own.
 *  - Context cannot outlive its transaction, because SET LOCAL is scoped to it.
 *    That last one is what makes this safe behind a transaction pooler, where
 *    the next request may land on the same physical connection.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantContext {
  readonly orgId: string;
  readonly userId: string;
  readonly role: AppRole;
}

export type Db = PostgresJsDatabase<typeof schema>;

let pool: postgres.Sql | undefined;
let db: Db | undefined;

function connectionUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy qirat/.env.example to qirat/.env.');
  return url;
}

export function getDb(): Db {
  if (!db) {
    pool = postgres(connectionUrl(), {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 30,
      onnotice: () => {},
      // Money arrives as bigint. Never let it become a double on the way in.
      types: {
        bigint: postgres.BigInt,
      },
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}

function assertContext(ctx: TenantContext): string {
  if (!UUID.test(ctx.orgId)) throw new TenantContextError('orgId is not a UUID');
  if (!UUID.test(ctx.userId)) throw new TenantContextError('userId is not a UUID');
  const dbRole = dbRoleFor(ctx.role);
  // The role name is interpolated into DDL, so it must come from the fixed map
  // and nowhere else. Belt and braces: the union type already guarantees it.
  if (!Object.values(DB_ROLE_BY_APP_ROLE).includes(dbRole)) {
    throw new TenantContextError(`Refusing to switch to unmanaged role "${dbRole}"`);
  }
  return dbRole;
}

/**
 * Run a unit of work as one tenant, as one role, in one transaction.
 *
 * Everything the request does to the database happens inside the callback. Do
 * not hand the `tx` handle to anything that outlives it.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  work: (tx: Db) => Promise<T>,
): Promise<T> {
  const dbRole = assertContext(ctx);
  return getDb().transaction(async (tx) => {
    // SET LOCAL: both of these are discarded when the transaction ends, so no
    // context can leak onto the next request sharing this connection.
    await tx.execute(raw`select set_config('app.org_id', ${ctx.orgId}, true)`);
    await tx.execute(raw`select set_config('app.user_id', ${ctx.userId}, true)`);
    await tx.execute(raw.raw(`set local role ${dbRole}`));
    return work(tx);
  });
}

/**
 * The sign-in lookup, and nothing else.
 *
 * This is the one query with no tenant context, because "which organisation does
 * this email belong to" is the question being asked. It runs through a
 * SECURITY DEFINER function whose owner cannot log in and which is granted to
 * nothing but qirat_app.
 */
export interface LoginCandidate {
  userId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  userRole: AppRole;
  passwordHash: string;
  isActive: boolean;
  userName: string;
  locale: string;
}

export async function findLoginCandidates(email: string): Promise<LoginCandidate[]> {
  const rows = await getDb().execute<{
    user_id: string;
    org_id: string;
    org_slug: string;
    org_name: string;
    user_role: AppRole;
    password_hash: string;
    is_active: boolean;
    user_name: string;
    locale: string;
  }>(raw`select * from qirat.authenticate_lookup(${email})`);

  return Array.from(rows).map((row) => ({
    userId: row.user_id,
    orgId: row.org_id,
    orgSlug: row.org_slug,
    orgName: row.org_name,
    userRole: row.user_role,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    userName: row.user_name,
    locale: row.locale,
  }));
}

/**
 * Startup assertion: the application must not be connected as a role that owns
 * the tables or can bypass RLS. Getting this wrong turns every policy in the
 * schema into a comment, silently, with all tests still passing.
 */
export async function assertConnectionIsLeastPrivilege(): Promise<void> {
  const rows = await getDb().execute<{
    role_name: string;
    bypassrls: boolean;
    superuser: boolean;
    owns_tables: number;
  }>(raw`
    select current_user::text                as role_name,
           rolbypassrls                      as bypassrls,
           rolsuper                          as superuser,
           (select count(*) from pg_tables
             where schemaname = 'public' and tableowner = current_user)::int as owns_tables
    from pg_roles where rolname = current_user`);

  const row = Array.from(rows)[0];
  if (!row) throw new TenantContextError('Could not inspect the connection role');
  const faults: string[] = [];
  if (row.superuser) faults.push('is a superuser');
  if (row.bypassrls) faults.push('can bypass row-level security');
  if (row.owns_tables > 0) faults.push(`owns ${row.owns_tables} table(s), so FORCE RLS is its only guard`);
  if (faults.length > 0) {
    throw new TenantContextError(
      `DATABASE_URL connects as "${row.role_name}", which ${faults.join(' and ')}. ` +
        'Point it at qirat_app instead — see qirat/.env.example.',
    );
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end({ timeout: 5 });
  pool = undefined;
  db = undefined;
}
