import postgres from 'postgres';
import { sql as raw } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { type AppRole } from '../../src/db/roles';
import { closeDb, getDb, withTenant } from '../../src/db/client';
import { hashPassword } from '../../src/auth/password';

try {
  process.loadEnvFile('.env');
} catch {
  /* CI supplies the variables directly */
}

// Every suite talks to the database exactly as the application does: as
// qirat_app, through withTenant. A test that could reach further than the app
// can would be testing something the app never does.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const TABLES = [
  'audit_log',
  'deals',
  'clients',
  'services',
  'brand_kits',
  'users',
  'organizations',
] as const;

let admin: postgres.Sql | undefined;

/** The privileged connection. Used only to reset fixtures, never by the app. */
export function adminSql(): postgres.Sql {
  if (!admin) {
    const url = process.env.TEST_ADMIN_DATABASE_URL;
    if (!url) throw new Error('TEST_ADMIN_DATABASE_URL is not set');
    admin = postgres(url, { onnotice: () => {}, max: 1 });
  }
  return admin;
}

export async function resetTables(): Promise<void> {
  const sql = adminSql();
  // audit_log refuses TRUNCATE by trigger, which is the point of it. Only the
  // table's owner can lift that, and only fixtures ever do.
  await sql.unsafe('alter table audit_log disable trigger audit_log_no_truncate');
  await sql.unsafe(`truncate ${TABLES.join(', ')} restart identity cascade`);
  await sql.unsafe('alter table audit_log enable trigger audit_log_no_truncate');
}

export async function closeAll(): Promise<void> {
  await closeDb();
  await admin?.end({ timeout: 5 });
  admin = undefined;
}

export interface SeededOrg {
  orgId: string;
  emails: { owner: string; manager: string; member: string; partner: string };
  slug: string;
  name: string;
  ownerId: string;
  managerId: string;
  memberId: string;
  partnerId: string;
  clientId: string;
  serviceId: string;
  /** A deal owned by `managerId`. */
  dealId: string;
  /** A second deal, owned by a different account manager. */
  otherManagerId: string;
  otherDealId: string;
}

/**
 * A whole agency: an owner, two account managers, a member, a partner, a
 * client, a service and two deals. Enough that "can org A see org B" and "can
 * one manager see another manager's pipeline" are both answerable.
 */
/** The password every seeded user gets, so suites can sign in over HTTP. */
export const SEED_PASSWORD = 'seeded-password-long-enough';

export async function seedOrg(label: string): Promise<SeededOrg> {
  const orgId = randomUUID();
  const ownerId = randomUUID();
  const ctx = { orgId, userId: ownerId, role: 'owner' as AppRole };

  const ids = {
    managerId: randomUUID(),
    otherManagerId: randomUUID(),
    memberId: randomUUID(),
    partnerId: randomUUID(),
    clientId: randomUUID(),
    serviceId: randomUUID(),
    dealId: randomUUID(),
    otherDealId: randomUUID(),
  };

  // One hash for the whole fixture: scrypt is deliberately slow, and these are
  // throwaway accounts.
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      insert into organizations (id, slug, name, default_currency, house_rate_bp)
      values (${orgId}, ${label}, ${`${label} Agency`}, 'EGP', 5000)`);

    for (const [id, role, email, name] of [
      [ownerId, 'owner', `owner@${label}.test`, 'Owner'],
      [ids.managerId, 'account_manager', `am@${label}.test`, 'Account Manager'],
      [ids.otherManagerId, 'account_manager', `am2@${label}.test`, 'Other Manager'],
      [ids.memberId, 'member', `member@${label}.test`, 'Member'],
      [ids.partnerId, 'partner', `partner@${label}.test`, 'Partner'],
    ] as const) {
      await tx.execute(raw`
        insert into users (id, org_id, email, password_hash, name, role)
        values (${id}, ${orgId}, ${email}, ${passwordHash}, ${name}, ${raw.raw(`'${role}'::user_role`)})`);
    }

    await tx.execute(raw`
      insert into brand_kits (org_id, palette) values (${orgId}, '{"ink":"#1A1C19"}'::jsonb)`);

    await tx.execute(raw`
      insert into clients (id, org_id, name, country, default_currency)
      values (${ids.clientId}, ${orgId}, ${`${label} Client`}, 'EG', 'EGP')`);

    await tx.execute(raw`
      insert into services (id, org_id, name, currency, floor_minor, target_minor, ceiling_minor,
                            default_cost_min_minor, default_cost_max_minor)
      values (${ids.serviceId}, ${orgId}, 'Brand Book', 'EGP', 5000000, 7500000, 10000000, 1500000, 3000000)`);

    for (const [dealId, owner, title] of [
      [ids.dealId, ids.managerId, `${label} deal one`],
      [ids.otherDealId, ids.otherManagerId, `${label} deal two`],
    ] as const) {
      await tx.execute(raw`
        insert into deals (id, org_id, client_id, service_id, owner_user_id, title, currency,
                           agreed_price_minor, estimated_cost_minor, status)
        values (${dealId}, ${orgId}, ${ids.clientId}, ${ids.serviceId}, ${owner}, ${title},
                'EGP', 8000000, 2500000, 'draft')`);
    }
  });

  return {
    orgId,
    slug: label,
    name: `${label} Agency`,
    ownerId,
    emails: {
      owner: `owner@${label}.test`,
      manager: `am@${label}.test`,
      member: `member@${label}.test`,
      partner: `partner@${label}.test`,
    },
    ...ids,
  };
}

/** Run a query as one user of one org, exactly as a request would. */
export function as(org: SeededOrg, role: AppRole, userId?: string) {
  const user =
    userId ??
    (role === 'owner'
      ? org.ownerId
      : role === 'account_manager'
        ? org.managerId
        : role === 'member'
          ? org.memberId
          : org.partnerId);
  return { orgId: org.orgId, userId: user, role };
}

export { getDb, withTenant, raw };
