import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql as raw } from 'drizzle-orm';
import { withTenant } from '@/db/client';
import { hashPassword } from '@/auth/password';
import { fromMajor } from '@/money';
import { DEFAULT_BRAND_KIT, DEFAULT_CURRENCY, DEFAULT_SERVICES } from './service-catalog';

/**
 * Create an organisation, its owner, and enough real content that the first
 * screen is usable.
 *
 * The whole thing is one transaction under ordinary tenant context: the org id
 * is minted here, the context is set to it, and every insert then satisfies the
 * same RLS policies every other request does. Signup needs no privileged path
 * and gets none — the only RLS bypass in the system is the sign-in lookup.
 */

export interface SignupInput {
  agencyName: string;
  ownerName: string;
  email: string;
  password: string;
  locale?: 'en' | 'ar';
}

export interface SignupResult {
  orgId: string;
  slug: string;
  userId: string;
}

export class SignupError extends Error {
  constructor(
    message: string,
    readonly field?: keyof SignupInput,
  ) {
    super(message);
    this.name = 'SignupError';
  }
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Arabic agency names transliterate to nothing useful, so fall back below.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : `agency-${randomUUID().slice(0, 8)}`;
}

export async function signUp(input: SignupInput): Promise<SignupResult> {
  const agencyName = input.agencyName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();

  if (agencyName.length < 2) throw new SignupError('Enter your agency name.', 'agencyName');
  if (ownerName.length < 2) throw new SignupError('Enter your name.', 'ownerName');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new SignupError('Enter a valid email address.', 'email');
  }

  const passwordHash = await hashPassword(input.password);
  const locale = input.locale ?? 'en';

  // Slug collisions are resolved by retrying, not by reading the table first:
  // under RLS a lookup cannot see other organisations' slugs, so the unique
  // index is the only authority on whether one is taken.
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? slugify(agencyName) : `${slugify(agencyName)}-${randomUUID().slice(0, 4)}`;
    try {
      return await provision({ slug, agencyName, ownerName, email, passwordHash, locale });
    } catch (error) {
      if (isUniqueViolation(error, 'organizations_slug_key')) {
        lastError = error;
        continue;
      }
      if (isUniqueViolation(error, 'users_org_email_key')) {
        throw new SignupError('That email address is already registered.', 'email');
      }
      throw error;
    }
  }
  throw new SignupError(
    'Could not find an available address for your agency. Try a slightly different name.',
    'agencyName',
  );
}

async function provision(args: {
  slug: string;
  agencyName: string;
  ownerName: string;
  email: string;
  passwordHash: string;
  locale: 'en' | 'ar';
}): Promise<SignupResult> {
  const orgId = randomUUID();
  const userId = randomUUID();

  await withTenant({ orgId, userId, role: 'owner' }, async (tx) => {
    await tx.execute(raw`
      insert into organizations (id, slug, name, default_currency, default_locale, numbering_system)
      values (${orgId}, ${args.slug}, ${args.agencyName}, ${DEFAULT_CURRENCY},
              ${args.locale}, ${args.locale === 'ar' ? 'arab' : 'latn'})`);

    await tx.execute(raw`
      insert into users (id, org_id, email, password_hash, name, role, locale)
      values (${userId}, ${orgId}, ${args.email}, ${args.passwordHash}, ${args.ownerName},
              'owner', ${args.locale})`);

    await tx.execute(raw`
      insert into brand_kits (org_id, palette, fonts, locked_config)
      values (${orgId},
              ${JSON.stringify(DEFAULT_BRAND_KIT.palette)}::jsonb,
              ${JSON.stringify(DEFAULT_BRAND_KIT.fonts)}::jsonb,
              ${JSON.stringify(DEFAULT_BRAND_KIT.lockedConfig)}::jsonb)`);

    const serviceIds: string[] = [];
    for (const service of DEFAULT_SERVICES) {
      const id = randomUUID();
      serviceIds.push(id);
      await tx.execute(raw`
        insert into services (id, org_id, name, name_ar, currency, floor_minor, target_minor,
                              ceiling_minor, default_cost_min_minor, default_cost_max_minor,
                              task_template)
        values (${id}, ${orgId}, ${service.name}, ${service.nameAr}, ${DEFAULT_CURRENCY},
                ${fromMajor(service.floor, DEFAULT_CURRENCY).minor},
                ${fromMajor(service.target, DEFAULT_CURRENCY).minor},
                ${fromMajor(service.ceiling, DEFAULT_CURRENCY).minor},
                ${fromMajor(service.costMin, DEFAULT_CURRENCY).minor},
                ${fromMajor(service.costMax, DEFAULT_CURRENCY).minor},
                ${JSON.stringify(service.tasks)}::jsonb)`);
    }

    // A sample client and a sample deal, so the deal card — the home screen —
    // has something on it the moment the owner arrives.
    const clientId = randomUUID();
    await tx.execute(raw`
      insert into clients (id, org_id, name, name_ar, country, default_currency)
      values (${clientId}, ${orgId}, 'Sample Client', 'عميل تجريبي', 'EG', ${DEFAULT_CURRENCY})`);

    const brandBook = DEFAULT_SERVICES[0]!;
    await tx.execute(raw`
      insert into deals (org_id, client_id, service_id, owner_user_id, title, currency,
                         agreed_price_minor, estimated_cost_minor, delivery_date, status)
      values (${orgId}, ${clientId}, ${serviceIds[0]}, ${userId},
              ${`${brandBook.name} — Sample Client`}, ${DEFAULT_CURRENCY},
              ${fromMajor(brandBook.target, DEFAULT_CURRENCY).minor},
              ${fromMajor(brandBook.costMin, DEFAULT_CURRENCY).minor},
              ${sampleDeliveryDate()}, 'draft')`);

    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${orgId}, ${userId}, ${args.email}, 'owner', 'organization.created', 'organization',
              ${orgId}, ${JSON.stringify({ slug: args.slug, services: DEFAULT_SERVICES.length })}::jsonb)`);
  });

  return { orgId, slug: args.slug, userId };
}

function sampleDeliveryDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 45);
  return date.toISOString().slice(0, 10);
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
