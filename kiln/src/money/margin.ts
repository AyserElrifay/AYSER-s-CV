import {
  type BasisPoints,
  BASIS_POINT_SCALE,
  applyBasisPoints,
  assertBasisPoints,
} from './allocate';
import {
  type Money,
  CurrencyMismatchError,
  compare,
  isPositive,
  subtract,
  zero,
} from './money';
import { type Rounding, DEFAULT_ROUNDING, divRound } from './rounding';

/**
 * What a deal is actually worth, and who it is worth it to.
 *
 *   revenue - direct costs = gross profit
 *   gross profit x house rate = the agency's share
 *   what is left is the only money the split engine ever sees
 *
 * The house rate coming off the top first is the point: it makes every discount
 * cost the account manager their own commission, in the same motion that it
 * costs the agency its margin.
 */
export interface MarginBreakdown {
  readonly revenue: Money;
  readonly directCosts: Money;
  readonly grossProfit: Money;
  /** Stays with the agency. */
  readonly houseShare: Money;
  /** Everything the split rules are allowed to touch. */
  readonly distributable: Money;
  /** Profit as a share of revenue, in basis points. Null when revenue is zero. */
  readonly marginBasisPoints: number | null;
  /** True when costs exceeded revenue. */
  readonly isLoss: boolean;
}

/**
 * Losses are absorbed by the house, not shared.
 *
 * A negative distributable would mean invoicing a freelancer for their share of
 * a deal that went wrong. No agency does that, and a payout engine that can
 * generate a negative statement will eventually generate one by accident.
 * The house eats the whole loss; the split engine sees zero.
 */
export const LOSS_POLICY = 'house-absorbs' as const;

export function computeMargin(
  revenue: Money,
  directCosts: Money,
  houseRate: BasisPoints,
  mode: Rounding = DEFAULT_ROUNDING,
): MarginBreakdown {
  if (revenue.currency !== directCosts.currency) {
    throw new CurrencyMismatchError(revenue.currency, directCosts.currency);
  }
  assertBasisPoints(houseRate);

  const grossProfit = subtract(revenue, directCosts);
  const isLoss = grossProfit.minor < 0n;

  const houseShare = isLoss ? grossProfit : applyBasisPoints(grossProfit, houseRate, mode);
  const distributable = isLoss ? zero(revenue.currency) : subtract(grossProfit, houseShare);

  return {
    revenue,
    directCosts,
    grossProfit,
    houseShare,
    distributable,
    marginBasisPoints: marginBasisPoints(revenue, directCosts, mode),
    isLoss,
  };
}

/**
 * Margin as a share of revenue, in basis points.
 *
 * Null rather than zero when revenue is zero: a pro-bono deal has no margin,
 * which is not the same statement as "its margin is 0%", and the deal card
 * should say so rather than draw a red bar at the bottom of the scale.
 */
export function marginBasisPoints(
  revenue: Money,
  directCosts: Money,
  mode: Rounding = DEFAULT_ROUNDING,
): number | null {
  if (revenue.currency !== directCosts.currency) {
    throw new CurrencyMismatchError(revenue.currency, directCosts.currency);
  }
  if (revenue.minor === 0n) return null;
  const profit = revenue.minor - directCosts.minor;
  return Number(divRound(profit * BASIS_POINT_SCALE, revenue.minor, mode));
}

// --- the margin bar ----------------------------------------------------------

export type MarginState = 'healthy' | 'warning' | 'critical' | 'unpriced';

export interface MarginThresholds {
  /** At or above this, the bar is green. */
  readonly healthyFromBp: BasisPoints;
  /** At or above this but below healthy, the bar is amber. Below it, red. */
  readonly warningFromBp: BasisPoints;
}

/** Sane starting point for a creative agency; every org can move them. */
export const DEFAULT_MARGIN_THRESHOLDS: MarginThresholds = {
  healthyFromBp: 4_000, // 40%
  warningFromBp: 2_000, // 20%
};

export function marginState(
  bp: number | null,
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS,
): MarginState {
  if (bp === null) return 'unpriced';
  if (bp >= thresholds.healthyFromBp) return 'healthy';
  if (bp >= thresholds.warningFromBp) return 'warning';
  return 'critical';
}

// --- the pricing band --------------------------------------------------------

/**
 * The floor / target / ceiling a service is sold within.
 *
 * Internal only. The client is shown one number. Show a client a range and they
 * anchor to the floor, every time, and the ceiling may as well not exist.
 */
export interface PriceBand {
  readonly floor: Money;
  readonly target: Money;
  readonly ceiling: Money;
}

export class PriceBandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceBandError';
  }
}

export function assertPriceBand(band: PriceBand): PriceBand {
  const { floor, target, ceiling } = band;
  if (floor.currency !== target.currency || floor.currency !== ceiling.currency) {
    throw new PriceBandError('A price band must be quoted in one currency');
  }
  if (compare(floor, target) > 0) throw new PriceBandError('Floor is above target');
  if (compare(target, ceiling) > 0) throw new PriceBandError('Target is above ceiling');
  if (floor.minor < 0n) throw new PriceBandError('Floor must not be negative');
  return band;
}

/** Below the floor, a deal cannot close — it routes to the owner for approval. */
export function requiresOwnerApproval(price: Money, band: PriceBand): boolean {
  if (price.currency !== band.floor.currency) {
    throw new CurrencyMismatchError(price.currency, band.floor.currency);
  }
  return compare(price, band.floor) < 0;
}

/**
 * Where the slider handle sits, 0 (floor) to 10000 (ceiling), clamped.
 * Basis points rather than a float so the UI and the server agree exactly.
 */
export function bandPositionBp(price: Money, band: PriceBand): number {
  assertPriceBand(band);
  if (price.currency !== band.floor.currency) {
    throw new CurrencyMismatchError(price.currency, band.floor.currency);
  }
  const span = band.ceiling.minor - band.floor.minor;
  if (span === 0n) return isPositive(subtract(price, band.floor)) ? 10_000 : 0;
  const offset = price.minor - band.floor.minor;
  if (offset <= 0n) return 0;
  if (offset >= span) return 10_000;
  return Number(divRound(offset * BASIS_POINT_SCALE, span, DEFAULT_ROUNDING));
}
