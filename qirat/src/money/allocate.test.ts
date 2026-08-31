import { describe, expect, it } from 'vitest';
import {
  AllocationError,
  InvalidRateError,
  allocate,
  allocateEvenly,
  applyBasisPoints,
  assertBasisPoints,
  splitByBasisPoints,
} from './allocate';
import { type Money, fromMajor, money, sum, toMajorString } from './money';

const egp = (v: string) => fromMajor(v, 'EGP');
const minors = (values: Money[]) => values.map((v) => v.minor);
const total = (values: Money[]) => sum(values, 'EGP').minor;

describe('assertBasisPoints', () => {
  it('accepts whole basis points in range', () => {
    expect(assertBasisPoints(0)).toBe(0);
    expect(assertBasisPoints(5_000)).toBe(5_000);
    expect(assertBasisPoints(10_000)).toBe(10_000);
  });

  it('rejects fractions, negatives, and rates over 100% unless allowed', () => {
    expect(() => assertBasisPoints(12.5)).toThrow(InvalidRateError);
    expect(() => assertBasisPoints(-1)).toThrow(InvalidRateError);
    expect(() => assertBasisPoints(10_001)).toThrow(InvalidRateError);
    expect(assertBasisPoints(15_000, { allowAbove100: true })).toBe(15_000);
  });
});

describe('applyBasisPoints', () => {
  it('takes a percentage', () => {
    expect(applyBasisPoints(egp('100.00'), 5_000).minor).toBe(5000n);
    expect(applyBasisPoints(egp('100.00'), 0).minor).toBe(0n);
    expect(applyBasisPoints(egp('100.00'), 10_000).minor).toBe(10000n);
    expect(applyBasisPoints(egp('100.00'), 250).minor).toBe(250n); // 2.5%
  });

  it('handles a rate that does not divide evenly', () => {
    // 33.33% of 10.00 is 3.333, which must round once.
    expect(applyBasisPoints(egp('10.00'), 3_333).minor).toBe(333n);
  });

  it('carries the sign of a loss', () => {
    expect(applyBasisPoints(egp('-100.00'), 5_000).minor).toBe(-5000n);
  });
});

describe('allocate', () => {
  it('splits evenly when it can', () => {
    expect(minors(allocate(egp('100.00'), [1n, 1n]))).toEqual([5000n, 5000n]);
    expect(minors(allocate(egp('90.00'), [1n, 1n, 1n]))).toEqual([3000n, 3000n, 3000n]);
  });

  it('gives the indivisible remainder away rather than losing it', () => {
    // 0.10 across three shares: 4 + 3 + 3, never 3 + 3 + 3.
    const shares = allocate(egp('0.10'), [1n, 1n, 1n]);
    expect(minors(shares)).toEqual([4n, 3n, 3n]);
    expect(total(shares)).toBe(10n);
  });

  it('respects weights', () => {
    expect(minors(allocate(egp('100.00'), [7n, 3n]))).toEqual([7000n, 3000n]);
    expect(minors(allocate(egp('100.00'), [1n, 2n, 3n]))).toEqual([1667n, 3333n, 5000n]);
  });

  it('sums to the total exactly for weighted, uneven splits', () => {
    const shares = allocate(egp('100.00'), [1n, 1n, 1n]);
    expect(total(shares)).toBe(10000n);
    expect(minors(shares)).toEqual([3334n, 3333n, 3333n]);
  });

  it('honours a zero weight without giving it a share', () => {
    const shares = allocate(egp('10.00'), [1n, 0n, 1n]);
    expect(minors(shares)).toEqual([500n, 0n, 500n]);
  });

  it('mirrors exactly when the total is a loss', () => {
    const profit = allocate(egp('0.10'), [1n, 1n, 1n]);
    const loss = allocate(egp('-0.10'), [1n, 1n, 1n]);
    expect(minors(loss)).toEqual(minors(profit).map((m) => -m));
    expect(total(loss)).toBe(-10n);
  });

  it('allocates nothing from nothing', () => {
    const shares = allocate(egp('0.00'), [1n, 2n, 3n]);
    expect(minors(shares)).toEqual([0n, 0n, 0n]);
  });

  it('is deterministic, so a period closed twice gives identical statements', () => {
    const first = minors(allocate(egp('1000.03'), [5n, 3n, 2n, 1n]));
    const second = minors(allocate(egp('1000.03'), [5n, 3n, 2n, 1n]));
    expect(first).toEqual(second);
  });

  it('breaks ties toward the earlier share', () => {
    // Two identical weights, one spare unit: it goes to the first.
    expect(minors(allocate(egp('0.01'), [1n, 1n]))).toEqual([1n, 0n]);
  });

  it('rejects impossible weightings', () => {
    expect(() => allocate(egp('1.00'), [])).toThrow(AllocationError);
    expect(() => allocate(egp('1.00'), [0n, 0n])).toThrow(AllocationError);
    expect(() => allocate(egp('1.00'), [1n, -1n])).toThrow(AllocationError);
  });

  it('never loses or invents a unit, across a thousand generated splits', () => {
    // Deterministic pseudo-random: same sequence every run, so a failure is
    // reproducible rather than a haunting.
    let seed = 20260830;
    const next = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };

    for (let round = 0; round < 1000; round++) {
      const parts = 1 + next(9);
      const weights: bigint[] = Array.from({ length: parts }, () => BigInt(next(100)));
      if (weights.reduce((a, b) => a + b, 0n) === 0n) weights[0] = 1n;
      const amount = money(BigInt(next(2_000_000) - 1_000_000), 'EGP');

      const shares = allocate(amount, weights);
      expect(shares).toHaveLength(parts);
      expect(sum(shares, 'EGP').minor, `weights=${weights} amount=${amount.minor}`).toBe(
        amount.minor,
      );
      // No share may point the opposite way to the total it came from.
      for (const share of shares) {
        if (amount.minor >= 0n) expect(share.minor >= 0n).toBe(true);
        else expect(share.minor <= 0n).toBe(true);
      }
    }
  });

  it('holds for amounts beyond a double', () => {
    const huge = money(10n ** 25n + 7n, 'EGP');
    const shares = allocate(huge, [1n, 1n, 1n]);
    expect(sum(shares, 'EGP').minor).toBe(huge.minor);
  });
});

describe('allocateEvenly', () => {
  it('splits into equal parts with the odd units first', () => {
    expect(minors(allocateEvenly(egp('10.00'), 4))).toEqual([250n, 250n, 250n, 250n]);
    expect(minors(allocateEvenly(egp('0.10'), 4))).toEqual([3n, 3n, 2n, 2n]);
  });

  it('rejects a nonsense part count', () => {
    expect(() => allocateEvenly(egp('1.00'), 0)).toThrow(AllocationError);
    expect(() => allocateEvenly(egp('1.00'), 2.5)).toThrow(AllocationError);
  });
});

describe('splitByBasisPoints', () => {
  it('splits a fully claimed amount with nothing left over', () => {
    const { shares, remainder } = splitByBasisPoints(egp('100.00'), [5_000, 3_000, 2_000]);
    expect(minors(shares)).toEqual([5000n, 3000n, 2000n]);
    expect(remainder.minor).toBe(0n);
  });

  it('returns what the rates did not claim instead of absorbing it', () => {
    const { shares, remainder } = splitByBasisPoints(egp('100.00'), [2_000, 3_000]);
    expect(total(shares)).toBe(5000n);
    expect(remainder.minor).toBe(5000n);
    expect(total(shares) + remainder.minor).toBe(10000n);
  });

  it('keeps shares summing to the covered portion under awkward rates', () => {
    const { shares, remainder } = splitByBasisPoints(egp('10.00'), [3_333, 3_333, 3_334]);
    expect(total(shares) + remainder.minor).toBe(1000n);
    expect(total(shares)).toBe(1000n);
  });

  it('handles no rates and all-zero rates', () => {
    expect(splitByBasisPoints(egp('10.00'), []).remainder.minor).toBe(1000n);
    const zeroed = splitByBasisPoints(egp('10.00'), [0, 0]);
    expect(minors(zeroed.shares)).toEqual([0n, 0n]);
    expect(zeroed.remainder.minor).toBe(1000n);
  });

  it('refuses to hand out more than the whole', () => {
    expect(() => splitByBasisPoints(egp('10.00'), [6_000, 5_000])).toThrow(InvalidRateError);
  });

  it('splits a loss the same way it splits a profit', () => {
    const { shares, remainder } = splitByBasisPoints(egp('-100.00'), [5_000, 2_500]);
    expect(total(shares) + remainder.minor).toBe(-10000n);
    expect(toMajorString(remainder)).toBe('-25.00');
  });
});
