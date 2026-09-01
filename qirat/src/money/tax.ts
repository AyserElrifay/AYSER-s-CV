import { type BasisPoints, applyBasisPoints, assertBasisPoints } from './allocate';
import { type Money, CurrencyMismatchError, add, subtract, zero } from './money';
import { type Rounding, DEFAULT_ROUNDING, divRound } from './rounding';
import { BASIS_POINT_SCALE } from './allocate';

/**
 * Value added tax, and why a margin computed on gross amounts is wrong.
 *
 * This is the gap. An agency in Berlin invoices a client in Paris under the
 * reverse charge, so it adds no VAT. The freelancer who did the work invoices
 * the agency for 4,000 plus 19%, so 4,760 leaves the bank. Put those two
 * numbers in a spreadsheet and the deal reports 52.4% margin. The real margin
 * is 60%, because the 760 is reclaimed input VAT — it was never the agency's
 * money, it was the tax authority's, held briefly.
 *
 * Every agency tool treats a price as one number. Every European agency
 * therefore does this in a spreadsheet, and gets it wrong in whichever
 * direction their VAT position happens to run. An account manager paid
 * commission on the wrong figure is underpaid every single month.
 *
 * The rule this module enforces: **a margin is always computed on net.** VAT
 * collected is not revenue, VAT paid is not a cost — unless the agency cannot
 * reclaim it, which is the one case that flips and is handled explicitly below.
 *
 * This computes what it is told. Which treatment applies to a given sale is a
 * question for the agency and its accountant, not for this module and not for
 * the interface: nothing here infers a legal position from a country code.
 */

export type TaxTreatment =
  /** Domestic supply: VAT charged at the local rate. */
  | 'standard'
  /** EU B2B cross-border: no VAT charged, the customer accounts for it. */
  | 'reverse_charge'
  /** Export outside the VAT area: no VAT, but the supply is still in scope. */
  | 'zero_rated'
  /** The supply itself is exempt. No VAT, and input VAT may not be reclaimable. */
  | 'exempt'
  /** The agency is under the registration threshold and charges no VAT at all. */
  | 'not_registered';

export const TAX_TREATMENTS: TaxTreatment[] = [
  'standard',
  'reverse_charge',
  'zero_rated',
  'exempt',
  'not_registered',
];

export interface TaxedAmount {
  readonly net: Money;
  readonly vat: Money;
  readonly gross: Money;
  readonly treatment: TaxTreatment;
  readonly rateBp: BasisPoints;
}

export class TaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxError';
  }
}

/** Only a standard-rated supply carries VAT. The rest are zero for four different reasons. */
export function chargesVat(treatment: TaxTreatment): boolean {
  return treatment === 'standard';
}

/**
 * Add VAT to a net price.
 *
 * The net figure is the one the deal is priced in, always. A quoted price in
 * this product is what the agency earns; what the client pays is derived.
 */
export function applyVat(
  net: Money,
  treatment: TaxTreatment,
  rateBp: BasisPoints,
  mode: Rounding = DEFAULT_ROUNDING,
): TaxedAmount {
  assertBasisPoints(rateBp, { allowAbove100: false });
  const vat = chargesVat(treatment) ? applyBasisPoints(net, rateBp, mode) : zero(net.currency);
  return {
    net,
    vat,
    gross: add(net, vat),
    treatment,
    // A non-charging treatment has no rate, whatever was passed in. Storing the
    // rate that was not applied would invite somebody to apply it later.
    rateBp: chargesVat(treatment) ? rateBp : 0,
  };
}

/**
 * Work backwards from a gross figure.
 *
 * Needed because a freelancer's invoice arrives as one number with the VAT
 * already in it, and somebody typing that number into a cost field is entering
 * gross whether they realise it or not.
 *
 * net = gross × 10000 ÷ (10000 + rate), rounded once. The VAT is then the
 * remainder, so net + vat is exactly the gross that was handed in — no
 * rounding residue can appear between the two.
 */
export function removeVat(
  gross: Money,
  treatment: TaxTreatment,
  rateBp: BasisPoints,
  mode: Rounding = DEFAULT_ROUNDING,
): TaxedAmount {
  assertBasisPoints(rateBp, { allowAbove100: false });
  if (!chargesVat(treatment) || rateBp === 0) {
    return { net: gross, vat: zero(gross.currency), gross, treatment, rateBp: 0 };
  }
  const net: Money = {
    currency: gross.currency,
    minor: divRound(gross.minor * BASIS_POINT_SCALE, BASIS_POINT_SCALE + BigInt(rateBp), mode),
  };
  return { net, vat: subtract(gross, net), gross, treatment, rateBp };
}

/**
 * What a supplier's invoice actually costs the agency.
 *
 * A VAT-registered agency reclaims the input VAT, so the cost is the net: the
 * gross left the bank, but the difference comes back. An agency below the
 * registration threshold cannot reclaim, so the gross is the cost — the tax is
 * real money it will never see again.
 *
 * Getting this backwards is the second half of the same mistake. A registered
 * agency that counts gross costs understates every margin by the VAT rate; an
 * unregistered one that counts net costs overstates them by the same amount,
 * and pays out commission it did not earn.
 */
export function supplierCost(
  invoice: TaxedAmount,
  agencyCanReclaimInputVat: boolean,
): Money {
  return agencyCanReclaimInputVat ? invoice.net : invoice.gross;
}

export interface VatPosition {
  /** VAT charged to clients and owed to the authority. */
  readonly outputVat: Money;
  /** VAT paid to suppliers and reclaimable. Zero when the agency cannot reclaim. */
  readonly inputVat: Money;
  /** Positive means owed to the authority; negative means reclaimable. */
  readonly due: Money;
}

/**
 * What the agency owes the tax authority for a period.
 *
 * Not a filing, and not advice — a running total, so an owner closing a month
 * can see that the healthy-looking balance includes money that is not theirs.
 * Agencies spend collected VAT and then find the quarter short; showing it
 * separately is most of the fix.
 */
export function vatPosition(
  sales: readonly TaxedAmount[],
  purchases: readonly TaxedAmount[],
  agencyCanReclaimInputVat: boolean,
  currency: Money['currency'],
): VatPosition {
  const total = (items: readonly TaxedAmount[]): bigint => {
    let running = 0n;
    for (const item of items) {
      if (item.vat.currency !== currency) {
        throw new CurrencyMismatchError(currency, item.vat.currency);
      }
      running += item.vat.minor;
    }
    return running;
  };

  const outputVat: Money = { currency, minor: total(sales) };
  const inputVat: Money = {
    currency,
    minor: agencyCanReclaimInputVat ? total(purchases) : 0n,
  };
  return { outputVat, inputVat, due: subtract(outputVat, inputVat) };
}

/**
 * Standard VAT rates, in basis points, for the places this product is sold.
 *
 * A convenience for the signup form and nothing more. Rates change, reduced
 * rates exist for particular supplies, and which one applies to a given invoice
 * is the agency's call — so this is a starting value the owner can edit, never
 * a rule the product enforces.
 */
export const DEFAULT_VAT_RATE_BP: Record<string, number> = {
  // European Union
  DE: 1900, // Germany
  FR: 2000, // France
  NL: 2100, // Netherlands
  ES: 2100, // Spain
  IT: 2200, // Italy
  BE: 2100, // Belgium
  AT: 2000, // Austria
  IE: 2300, // Ireland
  PT: 2300, // Portugal
  PL: 2300, // Poland
  SE: 2500, // Sweden
  DK: 2500, // Denmark
  FI: 2550, // Finland
  EE: 2400, // Estonia
  CZ: 2100, // Czechia
  RO: 1900, // Romania
  GR: 2400, // Greece
  // Europe, outside the EU
  GB: 2000, // United Kingdom
  CH: 810, // Switzerland
  NO: 2500, // Norway
  // MENA
  EG: 1400, // Egypt
  SA: 1500, // Saudi Arabia
  AE: 500, // United Arab Emirates
  QA: 500, // Qatar
  JO: 1600, // Jordan
  MA: 2000, // Morocco
  TN: 1900, // Tunisia
};

export function defaultVatRateFor(country: string | null | undefined): number {
  if (!country) return 0;
  return DEFAULT_VAT_RATE_BP[country.toUpperCase()] ?? 0;
}
