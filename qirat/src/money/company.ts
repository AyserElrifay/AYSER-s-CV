import { type BasisPoints, allocate, applyBasisPoints } from './allocate';
import { type CurrencyCode } from './currency';
import { type Money, money, subtract, sum, zero } from './money';
import { divRound } from './rounding';

/**
 * What the agency actually made.
 *
 * A deal's margin is not the answer to "how am I doing", and treating it as one
 * is the mistake this module exists to correct. A studio can run a year of 45%
 * margins and end it with nothing, because the rent, the software, the
 * accountant and four salaries went out whether or not anybody booked anything.
 *
 * The shape below is the waterfall an owner already pictures when they do this
 * on the back of an envelope. Writing it down is most of the value: each line
 * is a number they can check, in the order they would check it, and the last
 * one is the only one that answers the question.
 */

export interface CompanyMonthInput {
  readonly currency: CurrencyCode;
  /** Net revenue on deals closed in the month. Never gross — VAT is not income. */
  readonly revenue: Money;
  /** Suppliers, licences, print. What left the bank for a specific job. */
  readonly directCosts: Money;
  /** Your own people's logged days, at the rate their assignment was agreed at. */
  readonly labour: Money;
  /** Commission and bonus already earned on those deals by whoever closed them. */
  readonly earnedSplits: Money;
  /** Salaries for the month, whether or not the month was busy. */
  readonly salaries: Money;
  /** The cost of being open, spread across the months it covers. */
  readonly overheads: Money;
  /** Partner equity, in basis points of what is left. The rest is retained. */
  readonly partnerSplits: ReadonlyArray<{ beneficiaryUserId: string | null; rateBp: BasisPoints }>;
}

export interface CompanyMonth {
  readonly currency: CurrencyCode;
  readonly revenue: Money;
  readonly directCosts: Money;
  readonly labour: Money;
  /** Revenue less what it cost to deliver. The number the deal cards add up to. */
  readonly grossProfit: Money;
  readonly earnedSplits: Money;
  readonly salaries: Money;
  readonly overheads: Money;
  /** After everything. This is the one that answers the question. */
  readonly operatingProfit: Money;
  /** Gross profit as a share of revenue, in basis points. Null on no revenue. */
  readonly grossMarginBp: number | null;
  /** Operating profit as a share of revenue. The one worth watching. */
  readonly operatingMarginBp: number | null;
  /**
   * What each partner's share comes to, and what is left after them.
   *
   * Allocated by largest remainder, so the shares plus the retained amount are
   * exactly the operating profit — never a minor unit more or less.
   */
  readonly partnerShares: ReadonlyArray<{ beneficiaryUserId: string | null; amount: Money }>;
  readonly retained: Money;
  /** True when the month lost money. A loss is not divided; the house carries it. */
  readonly isLoss: boolean;
}

function marginBp(profit: Money, revenue: Money): number | null {
  // Null, not zero: a month with no revenue has no margin, which is a different
  // statement from "its margin was 0%".
  if (revenue.minor === 0n) return null;
  return Number(divRound(profit.minor * 10_000n, revenue.minor));
}

export function companyMonth(input: CompanyMonthInput): CompanyMonth {
  const { currency } = input;
  const grossProfit = subtract(
    subtract(input.revenue, input.directCosts),
    input.labour,
  );
  const operatingProfit = subtract(
    subtract(subtract(grossProfit, input.earnedSplits), input.salaries),
    input.overheads,
  );

  const isLoss = operatingProfit.minor < 0n;

  /*
   * A loss is not shared out.
   *
   * The same rule the deal-level engine follows: when a month loses money the
   * house absorbs it. Handing a partner a negative share would be inventing a
   * debt nobody agreed to, and the alternative — pretending it is zero — hides
   * the month that most needs looking at.
   */
  const claimedBp = input.partnerSplits.reduce((total, split) => total + split.rateBp, 0);
  const distributable = isLoss ? zero(currency) : operatingProfit;
  const toPartners = isLoss
    ? zero(currency)
    : applyBasisPoints(distributable, claimedBp);

  const shares =
    isLoss || input.partnerSplits.length === 0
      ? input.partnerSplits.map(() => zero(currency))
      : allocate(
          toPartners,
          input.partnerSplits.map((split) => BigInt(split.rateBp)),
        );

  const partnerShares = input.partnerSplits.map((split, index) => ({
    beneficiaryUserId: split.beneficiaryUserId,
    amount: shares[index] ?? zero(currency),
  }));

  const paidOut = sum(
    partnerShares.map((share) => share.amount),
    currency,
  );

  return {
    currency,
    revenue: input.revenue,
    directCosts: input.directCosts,
    labour: input.labour,
    grossProfit,
    earnedSplits: input.earnedSplits,
    salaries: input.salaries,
    overheads: input.overheads,
    operatingProfit,
    grossMarginBp: marginBp(grossProfit, input.revenue),
    operatingMarginBp: marginBp(operatingProfit, input.revenue),
    partnerShares,
    // Exactly what is left. Computed by subtraction rather than by its own
    // percentage, so the parts always add back to the whole.
    retained: subtract(operatingProfit, paidOut),
    isLoss,
  };
}

// ---------------------------------------------------------------------------
// Overheads
// ---------------------------------------------------------------------------

export type OverheadCadence = 'monthly' | 'quarterly' | 'yearly' | 'one_off';

export interface Overhead {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly cadence: OverheadCadence;
  /** ISO dates. `activeTo` null means it is still running. */
  readonly activeFrom: string;
  readonly activeTo: string | null;
}

/** Was this cost being incurred during the month "YYYY-MM"? */
export function isActiveIn(overhead: Overhead, month: string): boolean {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`; // string comparison, so the 31st is a safe upper bound
  if (overhead.activeFrom > monthEnd) return false;
  if (overhead.activeTo !== null && overhead.activeTo < monthStart) return false;
  return true;
}

/**
 * What one overhead costs a single month.
 *
 * A yearly software bill is spread across twelve months rather than dropped on
 * whichever month it was paid in. That is deliberate and it is the difference
 * between two honest questions: "did this month make money", which wants the
 * cost of the month, and "what left the bank", which wants the payment and is
 * the ledger's job, not this one.
 *
 * A one-off lands entirely in its own month, because a one-off genuinely is
 * that month's cost — there is nothing to spread it over.
 */
export function overheadForMonth(overhead: Overhead, month: string): Money {
  if (!isActiveIn(overhead, month)) return zero(overhead.currency);

  switch (overhead.cadence) {
    case 'monthly':
      return money(overhead.amountMinor, overhead.currency);
    case 'quarterly':
      return money(divRound(overhead.amountMinor, 3n), overhead.currency);
    case 'yearly':
      return money(divRound(overhead.amountMinor, 12n), overhead.currency);
    case 'one_off':
      return overhead.activeFrom.slice(0, 7) === month
        ? money(overhead.amountMinor, overhead.currency)
        : zero(overhead.currency);
  }
}

export function overheadsForMonth(
  overheads: readonly Overhead[],
  month: string,
  currency: CurrencyCode,
): Money {
  return sum(
    overheads
      .filter((overhead) => overhead.currency === currency)
      .map((overhead) => overheadForMonth(overhead, month)),
    currency,
  );
}

/**
 * What the agency has to earn in a month before anybody takes anything.
 *
 * Salaries plus overheads, divided by the margin the agency actually achieves.
 * An owner who knows this number prices differently, which is the entire point
 * of showing it: it converts "we need more work" into a figure.
 */
export function breakEvenRevenue(
  fixedCosts: Money,
  grossMarginBp: number | null,
): Money | null {
  if (grossMarginBp === null || grossMarginBp <= 0) return null;
  return money(
    divRound(fixedCosts.minor * 10_000n, BigInt(grossMarginBp)),
    fixedCosts.currency,
  );
}
