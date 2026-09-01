import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { closeAll, raw, resetTables, withTenant } from './helpers/db';
import { signUp } from '../src/server/onboarding';
import { EUROPE_SERVICES } from '../src/server/service-catalog';
import { findLoginCandidates } from '../src/db/client';

/**
 * Signing up from somewhere other than Cairo.
 *
 * The unit tests prove `startingPointFor` picks the right catalogue. This proves
 * the signup transaction actually writes it — that the currency reaches the
 * enum column, that the VAT columns are populated, and that a Berlin studio's
 * first screen is denominated in euros rather than Egyptian pounds.
 */

beforeAll(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeAll();
});

async function register(agencyName: string, country: string | undefined) {
  const email = `owner-${randomUUID().slice(0, 8)}@example.test`;
  const result = await signUp({
    agencyName,
    ownerName: 'The Owner',
    email,
    password: 'seeded-password-long-enough',
    country,
  });
  return { ...result, email };
}

/** Read back exactly as the owner's own session would. */
async function orgRow(orgId: string, userId: string) {
  const rows = await withTenant({ orgId, userId, role: 'owner' }, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      default_currency: string;
      country: string | null;
      vat_registered: boolean;
      vat_rate_bp: number;
      default_tax_treatment: string;
    }>(raw`
      select default_currency::text as default_currency, country,
             vat_registered, vat_rate_bp, default_tax_treatment::text as default_tax_treatment
      from organizations where id = ${orgId}`),
  );
  return Array.from(rows)[0]!;
}

async function serviceNames(orgId: string, userId: string): Promise<string[]> {
  const rows = await withTenant({ orgId, userId, role: 'owner' }, (tx) =>
    tx.execute<{ [column: string]: unknown; name: string; currency: string }>(
      raw`select name, currency::text as currency from services order by name`,
    ),
  );
  return Array.from(rows).map((row) => `${row.name} (${row.currency})`);
}

describe('an agency signing up in Germany', () => {
  it('starts in euros, on the European catalogue, with Germany’s VAT rate offered', async () => {
    const { orgId, userId } = await register('Berlin Studio', 'DE');
    const org = await orgRow(orgId, userId);

    expect(org.default_currency).toBe('EUR');
    expect(org.country).toBe('DE');
    expect(org.vat_rate_bp).toBe(1_900);

    // Offered, not applied. Whether this agency is registered is its own fact,
    // and assuming it would put tax on invoices that must not carry it.
    expect(org.vat_registered).toBe(false);
    expect(org.default_tax_treatment).toBe('not_registered');

    const names = await serviceNames(orgId, userId);
    expect(names).toHaveLength(EUROPE_SERVICES.length);
    expect(names.every((name) => name.endsWith('(EUR)'))).toBe(true);
    expect(names.some((name) => name.startsWith('Brand Identity System'))).toBe(true);
  });

  it('prices the sample deal in the same currency as the service it came from', async () => {
    const { orgId, userId } = await register('Hamburg Werk', 'DE');
    const rows = await withTenant({ orgId, userId, role: 'owner' }, (tx) =>
      tx.execute<{
        [column: string]: unknown;
        currency: string;
        agreed_price_minor: bigint;
        tax_treatment: string;
        vat_rate_bp: number;
        client_country: string | null;
      }>(raw`
        select d.currency::text as currency, d.agreed_price_minor,
               d.tax_treatment::text as tax_treatment, d.vat_rate_bp,
               c.country as client_country
        from deals d join clients c on c.id = d.client_id`),
    );
    const deal = Array.from(rows)[0]!;
    expect(deal.currency).toBe('EUR');
    // 24,000.00 — the European brand identity target, not a Cairo figure.
    expect(deal.agreed_price_minor).toBe(2_400_000n);
    expect(deal.tax_treatment).toBe('not_registered');
    expect(deal.vat_rate_bp).toBe(1_900);
    expect(deal.client_country).toBe('DE');
  });
});

describe('an agency signing up in Egypt', () => {
  it('is unchanged: pounds, the MENA catalogue, Egypt’s rate', async () => {
    const { orgId, userId } = await register('Cairo Studio', 'EG');
    const org = await orgRow(orgId, userId);
    expect(org.default_currency).toBe('EGP');
    expect(org.country).toBe('EG');
    expect(org.vat_rate_bp).toBe(1_400);

    const names = await serviceNames(orgId, userId);
    expect(names.every((name) => name.endsWith('(EGP)'))).toBe(true);
    expect(names.some((name) => name.startsWith('Brand Book'))).toBe(true);
  });
});

describe('an agency that gives no country', () => {
  it('still signs up, on the defaults', async () => {
    // A signup that fails because a select was left alone is a signup that
    // never happens. The country is a convenience, never a gate.
    const { orgId, userId } = await register('Somewhere Else', undefined);
    const org = await orgRow(orgId, userId);
    expect(org.country).toBeNull();
    expect(org.default_currency).toBe('EGP');
    expect(org.vat_rate_bp).toBe(0);
  });

  it('ignores a country code it does not know', async () => {
    const { orgId, userId } = await register('Atlantis Creative', 'ZZ');
    expect((await orgRow(orgId, userId)).country).toBeNull();
  });
});

describe('the sign-up transaction', () => {
  it('records the country and currency it chose in the audit log', async () => {
    const { orgId, userId } = await register('Lisbon Collective', 'PT');
    const rows = await withTenant({ orgId, userId, role: 'owner' }, (tx) =>
      tx.execute<{ [column: string]: unknown; payload: { country?: string; currency?: string } }>(
        raw`select payload from audit_log where action = 'organization.created'`,
      ),
    );
    // The audit log is the only place that can later answer "why is this org in
    // euros" without guessing from the rows it happens to hold today.
    expect(Array.from(rows)[0]!.payload.country).toBe('PT');
    expect(Array.from(rows)[0]!.payload.currency).toBe('EUR');
  });
});

describe('the owner’s own way in', () => {
  it('gets a username derived from their address', async () => {
    const email = `hala.mansour-${randomUUID().slice(0, 6)}@studio.test`;
    const { orgId, userId } = await signUp({
      agencyName: 'Mansour Studio',
      ownerName: 'Hala Mansour',
      email,
      password: 'seeded-password-long-enough',
      country: 'EG',
    });
    const rows = await withTenant({ orgId, userId, role: 'owner' }, (tx) =>
      tx.execute<{ [c: string]: unknown; username: string }>(
        raw`select username from users where id = ${userId}`,
      ),
    );
    expect(Array.from(rows)[0]!.username).toBe(email.split('@')[0]);
  });

  it('can sign in with it', async () => {
    // The lookup takes either credential. If this ever stops being true, every
    // person the owner added is locked out and only the owner notices.
    const email = `owner-${randomUUID().slice(0, 6)}@studio.test`;
    await signUp({
      agencyName: 'Another Studio',
      ownerName: 'An Owner',
      email,
      password: 'seeded-password-long-enough',
      country: 'DE',
    });
    const byUsername = await findLoginCandidates(email.split('@')[0]!);
    const byEmail = await findLoginCandidates(email);
    expect(byUsername).toHaveLength(1);
    expect(byUsername[0]!.userId).toBe(byEmail[0]!.userId);
  });

  it('falls back when the address cleans to nothing usable', async () => {
    const email = `+-+@studio.test`;
    const { orgId, userId } = await signUp({
      agencyName: 'Punctuation Studio',
      ownerName: 'A Founder',
      email,
      password: 'seeded-password-long-enough',
    });
    const rows = await withTenant({ orgId, userId, role: 'owner' }, (tx) =>
      tx.execute<{ [c: string]: unknown; username: string }>(
        raw`select username from users where id = ${userId}`,
      ),
    );
    // Not an empty string, and not a signup that fell over on a check constraint.
    expect(Array.from(rows)[0]!.username).toMatch(/^owner\.[0-9a-f]{8}$/);
  });
});
