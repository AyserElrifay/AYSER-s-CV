import { type Money, multiplyRatio } from './money';
import { type Rounding, DEFAULT_ROUNDING, divRound } from './rounding';

/**
 * A rate expressed in basis points: 10000 bp = 100%, 5000 bp = 50%, 250 bp = 2.5%.
 *
 * Percentages are integers for the same reason money is. A house rate of 33.33%
 * stored as 0.3333 is a rounding argument waiting to happen at the end of every
 * quarter; stored as 3333 bp it is a number two people can agree on.
 */
export type BasisPoints = number;

export const BASIS_POINT_SCALE = 10_000n;

export class InvalidRateError extends Error {
  constructor(value: number, reason: string) {
    super(`Invalid rate ${value}: ${reason}`);
    this.name = 'InvalidRateError';
  }
}

export function assertBasisPoints(value: number, { allowAbove100 = false } = {}): BasisPoints {
  if (!Number.isInteger(value)) {
    throw new InvalidRateError(value, 'basis points must be a whole number');
  }
  if (value < 0) throw new InvalidRateError(value, 'must not be negative');
  if (!allowAbove100 && value > 10_000) {
    throw new InvalidRateError(value, 'must not exceed 10000 (100%)');
  }
  return value;
}

/** Take a percentage of an amount. Rounds once, at the end. */
export function applyBasisPoints(
  value: Money,
  rate: BasisPoints,
  mode: Rounding = DEFAULT_ROUNDING,
): Money {
  assertBasisPoints(rate, { allowAbove100: true });
  return multiplyRatio(value, BigInt(rate), BASIS_POINT_SCALE, mode);
}

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}

/**
 * Split an amount across weights so that the parts sum to the whole, exactly.
 *
 * Uses the largest-remainder method: every share is floored, then the leftover
 * minor units go one each to the shares with the largest discarded fraction.
 * Rounding each share independently would leave a piastre unaccounted for, and
 * an unaccounted piastre in a payout statement is a support ticket that ends
 * with a partner not trusting the number above it.
 *
 * Ties break toward the earlier weight, so the result is deterministic — the
 * same period closed twice produces byte-identical statements.
 */
export function allocate(total: Money, weights: readonly bigint[]): Money[] {
  if (weights.length === 0) throw new AllocationError('Cannot allocate across zero shares');

  let totalWeight = 0n;
  for (const weight of weights) {
    if (weight < 0n) throw new AllocationError('Weights must not be negative');
    totalWeight += weight;
  }
  if (totalWeight === 0n) throw new AllocationError('Weights must not all be zero');

  // Work on the magnitude and re-apply the sign, so a loss splits as the exact
  // mirror of the profit it would have been.
  const negative = total.minor < 0n;
  const magnitude = negative ? -total.minor : total.minor;

  const shares: bigint[] = new Array(weights.length).fill(0n);
  const remainders: Array<{ index: number; remainder: bigint }> = [];
  let distributed = 0n;

  for (let i = 0; i < weights.length; i++) {
    const numerator = magnitude * weights[i]!;
    const base = numerator / totalWeight; // both non-negative, so this floors
    shares[i] = base;
    distributed += base;
    remainders.push({ index: i, remainder: numerator % totalWeight });
  }

  let leftover = magnitude - distributed; // strictly less than weights.length
  remainders.sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (let k = 0; leftover > 0n; k++, leftover--) {
    const index = remainders[k]!.index;
    shares[index] = shares[index]! + 1n;
  }

  return shares.map((minor) => ({
    currency: total.currency,
    minor: negative ? -minor : minor,
  }));
}

/** Equal split, with the odd units going to the earliest shares. */
export function allocateEvenly(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new AllocationError('Part count must be a positive whole number');
  }
  return allocate(total, new Array<bigint>(parts).fill(1n));
}

/**
 * Split by explicit basis-point shares that need not cover the whole amount.
 *
 * The covered portion is computed once and then allocated, so the shares always
 * sum to it exactly, and whatever the rates do not claim is returned as
 * `remainder` rather than being quietly absorbed into the last share.
 */
export function splitByBasisPoints(
  total: Money,
  rates: readonly BasisPoints[],
  mode: Rounding = DEFAULT_ROUNDING,
): { shares: Money[]; remainder: Money } {
  let claimed = 0;
  for (const rate of rates) {
    assertBasisPoints(rate);
    claimed += rate;
  }
  if (claimed > 10_000) {
    throw new InvalidRateError(claimed, 'shares total more than 100%');
  }
  if (rates.length === 0 || claimed === 0) {
    return {
      shares: rates.map(() => ({ currency: total.currency, minor: 0n })),
      remainder: total,
    };
  }

  const covered: Money = {
    currency: total.currency,
    minor: divRound(total.minor * BigInt(claimed), BASIS_POINT_SCALE, mode),
  };
  const shares = allocate(covered, rates.map((rate) => BigInt(rate)));
  return {
    shares,
    remainder: { currency: total.currency, minor: total.minor - covered.minor },
  };
}
