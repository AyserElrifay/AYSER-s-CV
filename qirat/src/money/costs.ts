import { type BasisPoints } from './allocate';
import { type CurrencyCode } from './currency';
import { type Money, CurrencyMismatchError, fromMajor, max, multiply, subtract, sum } from './money';
import { type Rounding, DEFAULT_ROUNDING, divRound } from './rounding';
import { BASIS_POINT_SCALE } from './allocate';

/**
 * Estimated cost against what has actually been spent.
 *
 * The brief calls cost capture the point where the product lives or dies, and
 * it is right: a card reading 64% when nobody has recorded the videographer,
 * the stock licence and the courier is not reporting a margin, it is reporting
 * a hope. This is the arithmetic that turns one into the other.
 */
export interface CostPosition {
  readonly estimated: Money;
  readonly actual: Money;
  /** actual − estimated. Positive means over the estimate. */
  readonly variance: Money;
  /** Variance as a share of the estimate, in basis points. */
  readonly driftBasisPoints: number | null;
  /** True once spending is over the estimate by the organisation's threshold. */
  readonly alerting: boolean;
  /** The cost the margin should actually be computed on. */
  readonly effective: Money;
}

/**
 * The cost a margin should be computed on.
 *
 * The greater of the estimate and what has been spent so far. An estimate stops
 * being the best available guess the moment more than it has already left the
 * bank — from then on the estimate is a number that has been disproved, and
 * continuing to divide by it would let a deal keep reporting a margin it no
 * longer has.
 *
 * Below the estimate it stays the estimate, because costs arrive late: three
 * of five invoices in does not mean the deal came in cheap.
 */
export function effectiveCost(estimated: Money, actual: Money): Money {
  return max(estimated, actual);
}

/**
 * Drift as a share of the estimate, in basis points.
 *
 * Null when nothing was estimated: spending 8,000 against an estimate of zero
 * is not "infinite drift", it is an un-estimated deal, and the card should say
 * that rather than draw a bar off the end of the scale.
 */
export function costDriftBasisPoints(
  estimated: Money,
  actual: Money,
  mode: Rounding = DEFAULT_ROUNDING,
): number | null {
  if (estimated.currency !== actual.currency) {
    throw new CurrencyMismatchError(estimated.currency, actual.currency);
  }
  if (estimated.minor === 0n) return null;
  return Number(
    divRound((actual.minor - estimated.minor) * BASIS_POINT_SCALE, estimated.minor, mode),
  );
}

export function costPosition(
  estimated: Money,
  actual: Money,
  alertFromBp: BasisPoints,
): CostPosition {
  if (estimated.currency !== actual.currency) {
    throw new CurrencyMismatchError(estimated.currency, actual.currency);
  }
  const driftBasisPoints = costDriftBasisPoints(estimated, actual);

  /*
   * Only over-spending raises the alert.
   *
   * Coming in under the estimate is worth showing and is not worth an alarm:
   * it means a quote was cautious, not that a margin on a card is wrong. Over
   * the estimate is different — the number the deal has been reporting to
   * everyone who looked at it has stopped being true, and somebody has to know
   * today rather than at the end of the period.
   */
  const alerting = driftBasisPoints !== null && driftBasisPoints >= alertFromBp;

  return {
    estimated,
    actual,
    variance: subtract(actual, estimated),
    driftBasisPoints,
    alerting,
    effective: effectiveCost(estimated, actual),
  };
}

// --- what a service costs to deliver -----------------------------------------

/** What a quantity counts. Shown to the reader; never used in the arithmetic. */
export type CostUnit = 'day' | 'person' | 'item' | 'month';

/**
 * One line of a service's cost build-up: the videographer, the kit, the editor.
 *
 * `amount` is the rate for a single unit, held as an exact decimal string rather
 * than a number so it survives JSON and the database without ever touching a
 * float.
 */
export interface CostTemplateLine {
  readonly label: string;
  readonly labelAr: string;
  readonly amount: string;
  readonly quantity: number;
  readonly unit: CostUnit;
}

export interface CostTemplateRow {
  readonly line: CostTemplateLine;
  readonly rate: Money;
  readonly total: Money;
}

export class CostTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostTemplateError';
  }
}

/**
 * Price out a template.
 *
 * Each line is multiplied by whole units and summed exactly — no line is
 * rounded, because every rate is already a whole number of minor units and
 * quantities are integers. An estimate assembled this way can be taken apart
 * again in front of a client, which is the entire point of having one.
 */
export function priceCostTemplate(
  lines: readonly CostTemplateLine[],
  currency: CurrencyCode,
): { rows: CostTemplateRow[]; total: Money } {
  const rows: CostTemplateRow[] = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new CostTemplateError(
        `"${line.label}" has a quantity of ${line.quantity}; it must be a whole number of units`,
      );
    }
    const rate = fromMajor(line.amount, currency);
    if (rate.minor < 0n) {
      throw new CostTemplateError(`"${line.label}" has a negative rate`);
    }
    return { line, rate, total: multiply(rate, BigInt(line.quantity)) };
  });

  return { rows, total: sum(rows.map((row) => row.total), currency) };
}

/** Just the number, for the places that only need the estimate. */
export function costTemplateTotal(
  lines: readonly CostTemplateLine[],
  currency: CurrencyCode,
): Money {
  return priceCostTemplate(lines, currency).total;
}
