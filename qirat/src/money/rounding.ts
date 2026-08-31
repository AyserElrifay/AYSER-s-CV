/**
 * Exact integer division with explicit rounding.
 *
 * Every piece of money arithmetic in Qirat funnels through `divRound`. It works
 * on bigints only: there is no floating point anywhere below this line, so a
 * result is either exactly right or it throws.
 */

export type Rounding =
  /** Toward zero. -2.5 -> -2, 2.5 -> 2 */
  | 'trunc'
  /** Toward negative infinity. -2.5 -> -3, 2.5 -> 2 */
  | 'floor'
  /** Toward positive infinity. -2.5 -> -2, 2.5 -> 3 */
  | 'ceil'
  /** Ties away from zero. -2.5 -> -3, 2.5 -> 3 */
  | 'half-up'
  /** Ties to the even neighbour. -2.5 -> -2, 3.5 -> 4. No systematic bias. */
  | 'half-even';

/**
 * Banker's rounding is the default everywhere money is divided. Half-up biases
 * every rounded commission upward by a fraction of a unit; across a year of
 * payouts that is a real number that nobody can account for.
 */
export const DEFAULT_ROUNDING: Rounding = 'half-even';

export class DivisionByZeroError extends Error {
  constructor() {
    super('Division by zero in money arithmetic');
    this.name = 'DivisionByZeroError';
  }
}

export function divRound(
  numerator: bigint,
  denominator: bigint,
  mode: Rounding = DEFAULT_ROUNDING,
): bigint {
  if (denominator === 0n) throw new DivisionByZeroError();

  // Normalise so the denominator is positive; the sign rides on the numerator.
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }

  const q = n / d; // bigint division truncates toward zero
  const r = n % d; // remainder carries the sign of n
  if (r === 0n) return q;

  const negative = r < 0n;
  const twiceAbsR = (negative ? -r : r) * 2n;

  switch (mode) {
    case 'trunc':
      return q;
    case 'floor':
      return negative ? q - 1n : q;
    case 'ceil':
      return negative ? q : q + 1n;
    case 'half-up':
      return twiceAbsR >= d ? (negative ? q - 1n : q + 1n) : q;
    case 'half-even':
      if (twiceAbsR > d) return negative ? q - 1n : q + 1n;
      if (twiceAbsR < d) return q;
      // Exactly half: move only if it would otherwise land on an odd number.
      return q % 2n === 0n ? q : negative ? q - 1n : q + 1n;
  }
}

/** 10n ** n, memoised for the handful of exponents currencies actually use. */
const POW10: bigint[] = [];
export function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError(`pow10 expects a non-negative integer, got ${exponent}`);
  }
  const cached = POW10[exponent];
  if (cached !== undefined) return cached;
  const value = 10n ** BigInt(exponent);
  POW10[exponent] = value;
  return value;
}

export function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}
