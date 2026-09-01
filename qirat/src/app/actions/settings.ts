'use server';

import { sql as raw } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { withTenant } from '@/db/client';
import { TAX_TREATMENTS, type TaxTreatment } from '@/money';
import { isKnownCountry } from '@/i18n/countries';
import { contextFor, requireUser } from '@/server/session';

/**
 * The agency's tax position.
 *
 * Only the Owner writes this, and the database agrees: the column grants on
 * `organizations` give the manager read access and nobody else anything. The
 * check below is the courteous version of the same refusal.
 *
 * Nothing here infers a legal position from an address. The country picks a
 * sensible starting rate on the signup form and then never speaks again —
 * whether an agency is registered, at what rate, and how it treats a given
 * supply are answers only the agency and its accountant have.
 */

export type SettingsResult = { ok: true } | { ok: false; error: string };

function isTreatment(value: string): value is TaxTreatment {
  return (TAX_TREATMENTS as string[]).includes(value);
}

/** Basis points, 0–10000. A rate typed as "19" means 19%, not 0.19%. */
function parseRatePercent(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const bp = Math.round(Number(trimmed) * 100);
  return bp >= 0 && bp <= 10_000 ? bp : null;
}

export async function saveTaxSettingsAction(input: {
  country: string;
  vatRegistered: boolean;
  vatRatePercent: string;
  defaultTaxTreatment: string;
}): Promise<SettingsResult> {
  const user = await requireUser();
  if (user.role !== 'owner') return { ok: false, error: 'settings.ownerOnly' };

  const country = isKnownCountry(input.country) ? input.country.toUpperCase() : null;
  const rateBp = parseRatePercent(input.vatRatePercent);
  if (rateBp === null) return { ok: false, error: 'settings.badRate' };
  if (!isTreatment(input.defaultTaxTreatment)) return { ok: false, error: 'settings.badTreatment' };

  /*
   * An unregistered agency is held to a rate of zero and a treatment of
   * `not_registered`, whatever the form said.
   *
   * Leaving a stale 19% on a deregistered agency is how a rate that must not be
   * applied gets applied by the next piece of code that reads the column
   * without also reading the boolean beside it.
   */
  const registered = input.vatRegistered;
  const storedRate = registered ? rateBp : 0;
  const storedTreatment: TaxTreatment = registered ? input.defaultTaxTreatment : 'not_registered';

  const ctx = contextFor(user);
  await withTenant(ctx, async (tx) => {
    // Read the outgoing default before overwriting it: which open deals were
    // merely following the agency, and which were set deliberately, is a
    // question only the old value can answer.
    const previous = await tx.execute<{
      [column: string]: unknown;
      default_tax_treatment: TaxTreatment;
    }>(raw`select default_tax_treatment::text as default_tax_treatment from organizations`);
    const wasDefault = Array.from(previous)[0]?.default_tax_treatment ?? 'not_registered';

    await tx.execute(raw`
      update organizations
      set country = ${country},
          vat_registered = ${registered},
          vat_rate_bp = ${storedRate},
          default_tax_treatment = ${storedTreatment}
      where id = ${user.orgId}`);

    /*
     * Open deals follow the agency. Closed ones never do.
     *
     * A deal that has not closed has not been invoiced, so there is no paper to
     * contradict: an agency that registers for VAT on Tuesday should not have to
     * open every draft to say so. A closed deal is the opposite — its treatment
     * is what the invoice the client is holding actually says, and the freeze
     * exists to keep it that way.
     *
     * Only deals still sitting on the old default move. One deliberately set to
     * a reverse charge stays where somebody put it.
     */
    if (wasDefault !== storedTreatment) {
      await tx.execute(raw`
        update deals set tax_treatment = ${storedTreatment}
        where status <> 'won' and tax_treatment = ${wasDefault}`);
    }
    // The rate follows the treatment on every open deal, including ones that
    // were set by hand: a stale 19% on a deal that charges nothing is a wrong
    // invoice waiting for the next person who reads the column on its own.
    await tx.execute(raw`
      update deals
      set vat_rate_bp = case when tax_treatment = 'standard' then ${storedRate} else 0 end
      where status <> 'won'`);
    // A change to how every margin in the product is computed belongs in the log.
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, ${raw.raw(`'${user.role}'::user_role`)},
              'organization.tax_changed', 'organization', ${user.orgId},
              ${JSON.stringify({
                country,
                vatRegistered: registered,
                vatRateBp: storedRate,
                defaultTaxTreatment: storedTreatment,
              })}::jsonb)`);
  });

  revalidatePath('/app');
  revalidatePath('/app/settings');
  return { ok: true };
}

/**
 * How one deal is treated.
 *
 * Per deal, not per agency, for the same reason currency is per deal: a Berlin
 * studio invoices a Munich client at 19% and a Paris client under the reverse
 * charge in the same week, and an agency forced to pick one for everything will
 * pick the wrong one for half its work.
 *
 * A closed deal refuses the change. Its treatment is frozen — it is what the
 * invoice the client is holding actually says.
 */
export async function setDealTaxTreatmentAction(
  dealId: string,
  treatment: string,
): Promise<SettingsResult> {
  const user = await requireUser();
  if (user.role !== 'owner' && user.role !== 'account_manager') {
    return { ok: false, error: 'settings.ownerOnly' };
  }
  if (!isTreatment(treatment)) return { ok: false, error: 'settings.badTreatment' };

  const ctx = contextFor(user);
  const changed = await withTenant(ctx, async (tx) => {
    const rows = await tx.execute<{
      [column: string]: unknown;
      status: string;
      vat_registered: boolean;
      vat_rate_bp: number;
    }>(raw`
      select d.status::text as status, o.vat_registered, o.vat_rate_bp
      from deals d cross join organizations o
      where d.id = ${dealId}`);
    const row = Array.from(rows)[0];
    if (!row) return false;
    if (row.status === 'won') return false;

    // The rate travels with the treatment: charging VAT at a rate of zero, or
    // storing a rate on a supply that carries none, are both ways of ending up
    // with an invoice nobody can reconcile.
    const rateBp = treatment === 'standard' && row.vat_registered ? row.vat_rate_bp : 0;
    await tx.execute(raw`
      update deals set tax_treatment = ${treatment}, vat_rate_bp = ${rateBp}
      where id = ${dealId}`);
    await tx.execute(raw`
      insert into audit_log (org_id, actor_user_id, actor_email, actor_role, action,
                             entity_type, entity_id, payload)
      values (${user.orgId}, ${user.id}, ${user.email}, ${raw.raw(`'${user.role}'::user_role`)},
              'deal.tax_changed', 'deal', ${dealId},
              ${JSON.stringify({ treatment, vatRateBp: rateBp })}::jsonb)`);
    return true;
  });

  if (!changed) return { ok: false, error: 'deal.frozenNote' };
  revalidatePath('/app');
  return { ok: true };
}
