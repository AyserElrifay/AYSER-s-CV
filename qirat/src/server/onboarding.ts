import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql as raw } from 'drizzle-orm';
import { withTenant } from '@/db/client';
import { hashPassword } from '@/auth/password';
import { costTemplateTotal, fromMajor } from '@/money';
import { isKnownCountry } from '@/i18n/countries';
import { normaliseUsername } from './team';
import { DEFAULT_BRAND_KIT, startingPointFor } from './service-catalog';

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
  /**
   * ISO 3166-1 alpha-2. Decides the currency, the starting catalogue and the
   * VAT rate offered — not the agency's legal position, which it sets itself.
   */
  country?: string;
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
  // An unrecognised code is not an error: the agency still signs up, on the
  // defaults, and changes its currency the way it would have anyway.
  const country = isKnownCountry(input.country) ? input.country!.toUpperCase() : null;

  // Slug collisions are resolved by retrying, not by reading the table first:
  // under RLS a lookup cannot see other organisations' slugs, so the unique
  // index is the only authority on whether one is taken.
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? slugify(agencyName) : `${slugify(agencyName)}-${randomUUID().slice(0, 4)}`;
    try {
      return await provision({ slug, agencyName, ownerName, email, passwordHash, locale, country });
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
  country: string | null;
}): Promise<SignupResult> {
  const orgId = randomUUID();
  const userId = randomUUID();
  const start = startingPointFor(args.country);
  const currency = start.currency;

  await withTenant({ orgId, userId, role: 'owner' }, async (tx) => {
    await tx.execute(raw`
      insert into organizations (id, slug, name, default_currency, default_locale, numbering_system,
                                 country, vat_registered, vat_rate_bp, default_tax_treatment)
      values (${orgId}, ${args.slug}, ${args.agencyName}, ${currency},
              ${args.locale}, ${args.locale === 'ar' ? 'arab' : 'latn'},
              ${args.country}, ${start.vatRegistered}, ${start.vatRateBp},
              ${start.taxTreatment})`);

    /*
     * The owner gets a username too.
     *
     * Everyone else on the team signs in with one, and an owner who is the only
     * person in the agency still typing an email address is a small
     * inconsistency that becomes a support question. Derived from the address
     * they just gave, and unique by construction: this is the organisation's
     * first row, so nothing can collide with it.
     */
    const username = usernameFromEmail(args.email);

    await tx.execute(raw`
      insert into users (id, org_id, email, username, password_hash, name, role, locale)
      values (${userId}, ${orgId}, ${args.email}, ${username}, ${args.passwordHash},
              ${args.ownerName}, 'owner', ${args.locale})`);

    await tx.execute(raw`
      insert into brand_kits (org_id, palette, fonts, locked_config)
      values (${orgId},
              ${JSON.stringify(DEFAULT_BRAND_KIT.palette)}::jsonb,
              ${JSON.stringify(DEFAULT_BRAND_KIT.fonts)}::jsonb,
              ${JSON.stringify(DEFAULT_BRAND_KIT.lockedConfig)}::jsonb)`);

    const serviceIds: string[] = [];
    for (const service of start.services) {
      const id = randomUUID();
      serviceIds.push(id);
      await tx.execute(raw`
        insert into services (id, org_id, name, name_ar, currency, floor_minor, target_minor,
                              ceiling_minor, default_cost_min_minor, default_cost_max_minor,
                              task_template, cost_template)
        values (${id}, ${orgId}, ${service.name}, ${service.nameAr},
                ${currency},
                ${fromMajor(service.floor, currency).minor},
                ${fromMajor(service.target, currency).minor},
                ${fromMajor(service.ceiling, currency).minor},
                ${fromMajor(service.costMin, currency).minor},
                ${fromMajor(service.costMax, currency).minor},
                ${JSON.stringify(service.tasks)}::jsonb,
                ${JSON.stringify(service.costs)}::jsonb)`);
    }

    // A sample client and a sample deal, so the deal card — the home screen —
    // has something on it the moment the owner arrives.
    const clientId = randomUUID();
    await tx.execute(raw`
      insert into clients (id, org_id, name, name_ar, country, default_currency)
      values (${clientId}, ${orgId}, 'Sample Client', 'عميل تجريبي', ${args.country},
              ${currency})`);

    const first = start.services[0]!;
    await tx.execute(raw`
      insert into deals (org_id, client_id, service_id, owner_user_id, title, currency,
                         agreed_price_minor, estimated_cost_minor, delivery_date, status,
                         tax_treatment, vat_rate_bp)
      values (${orgId}, ${clientId}, ${serviceIds[0]}, ${userId},
              ${`${first.name} — Sample Client`}, ${currency},
              ${fromMajor(first.target, currency).minor},
              ${costTemplateTotal(first.costs, currency).minor},
              ${sampleDeliveryDate()}, 'draft',
              ${start.taxTreatment}, ${start.vatRateBp})`);

    /*
     * A payout policy and this month's period, so the payouts screen is usable
     * on day one rather than showing a form before it shows a product.
     *
     * The numbers are a starting point an owner will change: a fifth of
     * distributable profit to whoever closed the deal, a twentieth to the team
     * pool, and the rest retained. Partner equity is left empty on purpose —
     * only the owner knows who the partners are.
     */
    for (const [kind, rateBp, label] of [
      ['manager_commission', 2000, 'Commission on own deals'],
      ['bonus_pool', 500, 'Team bonus pool'],
    ] as const) {
      await tx.execute(raw`
        insert into split_rules (org_id, kind, rate_bp, label)
        values (${orgId}, ${raw.raw(`'${kind}'::split_rule_kind`)}, ${rateBp}, ${label})`);
    }

    const { startsOn, endsOn } = currentMonth();
    await tx.execute(raw`
      insert into payout_periods (org_id, starts_on, ends_on)
      values (${orgId}, ${startsOn}::date, ${endsOn}::date)`);

    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, payload)
      values (${orgId}, ${userId}, ${args.email}, 'owner', 'organization.created', 'organization',
              ${orgId}, ${JSON.stringify({
                slug: args.slug,
                country: args.country,
                currency,
                services: start.services.length,
              })}::jsonb)`);
  });

  return { orgId, slug: args.slug, userId };
}

/** The calendar month we are in, which is the unit agencies pay people by. */
export function currentMonth(now = new Date()): { startsOn: string; endsOn: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {
    startsOn: iso(new Date(Date.UTC(year, month, 1))),
    // Day zero of the next month is the last day of this one, leap years included.
    endsOn: iso(new Date(Date.UTC(year, month + 1, 0))),
  };
}

/**
 * A username from an email address.
 *
 * The local part, cleaned to what the column allows, with a fallback for the
 * addresses that clean to nothing — a two-character local part, or one that is
 * entirely punctuation, would otherwise fail the check constraint and take the
 * whole signup with it.
 */
function usernameFromEmail(email: string): string {
  const candidate = normaliseUsername((email.split('@')[0] ?? '').replace(/[^a-zA-Z0-9._-]/g, ''));
  return /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/.test(candidate)
    ? candidate
    : `owner.${randomUUID().slice(0, 8)}`;
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
