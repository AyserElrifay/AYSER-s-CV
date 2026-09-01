import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql as raw } from 'drizzle-orm';
import { type TenantContext, withTenant } from '@/db/client';
import { type AppRole } from '@/db/roles';
import { hashPassword } from '@/auth/password';
import { type CurrencyCode, assertCurrencyCode, parseUserAmount } from '@/money';

/**
 * The people an agency is made of.
 *
 * Until this existed an organisation could only ever hold its owner: four roles
 * enforced in the database and reachable by nobody. Everything here is the
 * Owner's — the database agrees, because `insert on users` is granted to that
 * role alone.
 */

export interface Person {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: AppRole;
  title: string | null;
  phone: string | null;
  dayRateMinor: bigint | null;
  rateCurrency: CurrencyCode | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}

export class TeamError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'TeamError';
  }
}

/**
 * Usernames are lower-cased, and that is a rule rather than a convenience.
 *
 * A person who signs up as `Mostafa` and types `mostafa` on their phone three
 * weeks later must land in their own account, not in a refusal they cannot
 * diagnose. Case is not a distinction anybody intends to make.
 */
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '.');
}

const USERNAME = /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/;

export async function listPeople(ctx: TenantContext): Promise<Person[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      name: string;
      username: string | null;
      email: string | null;
      role: AppRole;
      title: string | null;
      phone: string | null;
      day_rate_minor: bigint | null;
      rate_currency: string | null;
      is_active: boolean;
      last_login_at: Date | null;
      must_change_password: boolean;
    }>(raw`
      select id, name, username, email, role::text as role, title, phone,
             day_rate_minor, rate_currency::text as rate_currency, is_active,
             last_login_at, must_change_password
      from users
      order by is_active desc, role, name`),
  );
  return Array.from(rows).map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    role: row.role,
    title: row.title,
    phone: row.phone,
    dayRateMinor: row.day_rate_minor,
    rateCurrency: row.rate_currency ? assertCurrencyCode(row.rate_currency) : null,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    mustChangePassword: row.must_change_password,
  }));
}

export interface AddPersonInput {
  name: string;
  username: string;
  password: string;
  role: AppRole;
  title?: string;
  phone?: string;
  email?: string;
  /** What a day of their time costs, as typed. Blank means no rate agreed yet. */
  dayRate?: string;
  currency: CurrencyCode;
}

/**
 * Add somebody, and hand their credentials back once.
 *
 * The password is returned to the caller so the Owner can pass it on over
 * whatever channel they already use — which in this market is WhatsApp. It is
 * stored only as a scrypt hash, so this is the single moment it exists in
 * readable form, and the account is flagged to require a change on first use.
 */
export async function addPerson(
  ctx: TenantContext,
  input: AddPersonInput,
): Promise<{ id: string; username: string }> {
  if (ctx.role !== 'owner') throw new TeamError('Only the owner can add people.');

  const name = input.name.trim();
  if (name.length < 2) throw new TeamError('Enter their name.', 'name');

  const username = normaliseUsername(input.username);
  if (!USERNAME.test(username)) {
    throw new TeamError(
      'A username is 3–32 characters: letters, digits, dots, dashes or underscores.',
      'username',
    );
  }

  const email = input.email?.trim().toLowerCase() || null;
  if (email !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new TeamError('That is not an email address. Leave it blank if there is none.', 'email');
  }

  // A rate is a fact that arrives later, not a condition of existing: somebody
  // can be on the team on Monday and have a rate agreed on Thursday.
  let dayRateMinor: bigint | null = null;
  const typed = input.dayRate?.trim();
  if (typed) {
    try {
      dayRateMinor = parseUserAmount(typed, input.currency).minor;
    } catch {
      throw new TeamError('That is not an amount.', 'dayRate');
    }
    if (dayRateMinor < 0n) throw new TeamError('A rate cannot be negative.', 'dayRate');
  }

  const passwordHash = await hashPassword(input.password);
  const id = randomUUID();

  try {
    await withTenant(ctx, async (tx) => {
      await tx.execute(raw`
        insert into users (id, org_id, name, username, email, password_hash, role, title, phone,
                           day_rate_minor, rate_currency, must_change_password)
        values (${id}, ${ctx.orgId}, ${name}, ${username}, ${email}, ${passwordHash},
                ${input.role}, ${input.title?.trim() || null}, ${input.phone?.trim() || null},
                ${dayRateMinor === null ? null : dayRateMinor.toString()}::bigint,
                ${dayRateMinor === null ? null : input.currency}, true)`);
      await tx.execute(raw`
        insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                               entity_type, entity_id, payload)
        values (${ctx.orgId}, ${ctx.userId}, ${username}, 'owner', 'user.created', 'user', ${id},
                ${JSON.stringify({ username, role: input.role, hasRate: dayRateMinor !== null })}::jsonb)`);
    });
  } catch (error) {
    if (isUniqueViolation(error, 'users_org_username_key')) {
      throw new TeamError('That username is taken in this agency.', 'username');
    }
    if (isUniqueViolation(error, 'users_org_email_key')) {
      throw new TeamError('That email address is already registered here.', 'email');
    }
    throw error;
  }

  return { id, username };
}

/**
 * What a day of somebody's time costs, from today.
 *
 * Changing it does not touch a deal they are already on: the rate was copied
 * onto the assignment when they were put on it, for the same reason a closed
 * deal keeps the house rate it closed with. A raise applies to the next
 * engagement, not to work already done.
 */
export async function setDayRate(
  ctx: TenantContext,
  userId: string,
  dayRate: string,
  currency: CurrencyCode,
): Promise<void> {
  if (ctx.role !== 'owner') throw new TeamError('Only the owner can set rates.');
  const typed = dayRate.trim();
  let minor: bigint | null = null;
  if (typed) {
    try {
      minor = parseUserAmount(typed, currency).minor;
    } catch {
      throw new TeamError('That is not an amount.', 'dayRate');
    }
    if (minor < 0n) throw new TeamError('A rate cannot be negative.', 'dayRate');
  }

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`
      update users
      set day_rate_minor = ${minor === null ? null : minor.toString()}::bigint,
          rate_currency = ${minor === null ? null : currency}
      where id = ${userId}`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${ctx.orgId}, ${ctx.userId}, 'owner', 'owner', 'user.rate_changed', 'user', ${userId},
              ${JSON.stringify({ dayRateMinor: minor?.toString() ?? null, currency })}::jsonb)`);
  });
}

/**
 * Somebody leaves.
 *
 * Deactivated, never deleted. Their name is on assignments, on logged days and
 * quite possibly on a statement that has already been issued, and a system that
 * lets a person be erased is a system where last quarter stops adding up.
 */
export async function setPersonActive(
  ctx: TenantContext,
  userId: string,
  isActive: boolean,
): Promise<void> {
  if (ctx.role !== 'owner') throw new TeamError('Only the owner can do this.');
  if (userId === ctx.userId) throw new TeamError('You cannot deactivate yourself.');

  await withTenant(ctx, async (tx) => {
    await tx.execute(raw`update users set is_active = ${isActive} where id = ${userId}`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${ctx.orgId}, ${ctx.userId}, 'owner', 'owner',
              ${isActive ? 'user.reactivated' : 'user.deactivated'}, 'user', ${userId},
              ${JSON.stringify({ isActive })}::jsonb)`);
  });
}

/** Changing your own password. Anyone may do this; nobody may do it for anyone else. */
export async function changeOwnPassword(
  ctx: TenantContext,
  newPassword: string,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await withTenant(ctx, (tx) =>
    tx.execute(raw`
      update users set password_hash = ${passwordHash}, must_change_password = false
      where id = ${ctx.userId}`),
  );
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: string; constraint_name?: string; cause?: unknown };
    if (candidate.code === '23505' && candidate.constraint_name === constraint) return true;
    current = candidate.cause;
  }
  return false;
}
