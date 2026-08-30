import { describe, expect, it } from 'vitest';
import { DivisionByZeroError, absBigInt, divRound, pow10 } from './rounding';

describe('divRound', () => {
  it('returns an exact quotient untouched, whatever the mode', () => {
    for (const mode of ['trunc', 'floor', 'ceil', 'half-up', 'half-even'] as const) {
      expect(divRound(10n, 5n, mode)).toBe(2n);
      expect(divRound(-10n, 5n, mode)).toBe(-2n);
      expect(divRound(0n, 7n, mode)).toBe(0n);
    }
  });

  it('truncates toward zero symmetrically', () => {
    expect(divRound(7n, 2n, 'trunc')).toBe(3n);
    expect(divRound(-7n, 2n, 'trunc')).toBe(-3n);
    expect(divRound(1n, 3n, 'trunc')).toBe(0n);
    expect(divRound(-1n, 3n, 'trunc')).toBe(0n);
  });

  it('floors toward negative infinity', () => {
    expect(divRound(7n, 2n, 'floor')).toBe(3n);
    expect(divRound(-7n, 2n, 'floor')).toBe(-4n);
    expect(divRound(-1n, 3n, 'floor')).toBe(-1n);
  });

  it('ceils toward positive infinity', () => {
    expect(divRound(7n, 2n, 'ceil')).toBe(4n);
    expect(divRound(-7n, 2n, 'ceil')).toBe(-3n);
    expect(divRound(1n, 3n, 'ceil')).toBe(1n);
  });

  it('rounds halves away from zero under half-up', () => {
    expect(divRound(5n, 2n, 'half-up')).toBe(3n);
    expect(divRound(-5n, 2n, 'half-up')).toBe(-3n);
    expect(divRound(7n, 2n, 'half-up')).toBe(4n);
    expect(divRound(-7n, 2n, 'half-up')).toBe(-4n);
  });

  it('rounds halves to the even neighbour under half-even', () => {
    expect(divRound(5n, 2n, 'half-even')).toBe(2n); // 2.5 -> 2
    expect(divRound(7n, 2n, 'half-even')).toBe(4n); // 3.5 -> 4
    expect(divRound(-5n, 2n, 'half-even')).toBe(-2n);
    expect(divRound(-7n, 2n, 'half-even')).toBe(-4n);
    expect(divRound(9n, 2n, 'half-even')).toBe(4n); // 4.5 -> 4
    expect(divRound(11n, 2n, 'half-even')).toBe(6n); // 5.5 -> 6
  });

  it('rounds non-halves the same way under both half modes', () => {
    expect(divRound(11n, 4n, 'half-even')).toBe(3n); // 2.75 -> 3
    expect(divRound(11n, 4n, 'half-up')).toBe(3n);
    expect(divRound(9n, 4n, 'half-even')).toBe(2n); // 2.25 -> 2
    expect(divRound(9n, 4n, 'half-up')).toBe(2n);
  });

  it('gives the same answer whichever side carries the sign', () => {
    for (const mode of ['trunc', 'floor', 'ceil', 'half-up', 'half-even'] as const) {
      expect(divRound(7n, -2n, mode)).toBe(divRound(-7n, 2n, mode));
      expect(divRound(-7n, -2n, mode)).toBe(divRound(7n, 2n, mode));
    }
  });

  it('is unbiased over a long run, which half-up is not', () => {
    // Every half from 0.5 to 19.5. Half-even should land exactly on the true
    // sum; half-up drifts upward by one unit for each of the ten odd halves.
    let even = 0n;
    let up = 0n;
    for (let i = 1n; i <= 39n; i += 2n) {
      even += divRound(i, 2n, 'half-even');
      up += divRound(i, 2n, 'half-up');
    }
    // The true total of 0.5 + 1.5 + ... + 19.5 is exactly 200.
    expect(even).toBe(200n);
    expect(up).toBe(210n); // ten halves, each pushed up by one
  });

  it('refuses to divide by zero', () => {
    expect(() => divRound(1n, 0n)).toThrow(DivisionByZeroError);
  });

  it('handles values far beyond a double', () => {
    const huge = 10n ** 30n + 1n;
    expect(divRound(huge * 3n, 3n, 'half-even')).toBe(huge);
    expect(divRound(huge, 1n)).toBe(huge);
  });
});

describe('pow10', () => {
  it('computes and caches powers', () => {
    expect(pow10(0)).toBe(1n);
    expect(pow10(2)).toBe(100n);
    expect(pow10(3)).toBe(1000n);
    expect(pow10(12)).toBe(1_000_000_000_000n);
    expect(pow10(12)).toBe(1_000_000_000_000n); // cached path
  });

  it('rejects nonsense exponents', () => {
    expect(() => pow10(-1)).toThrow(RangeError);
    expect(() => pow10(1.5)).toThrow(RangeError);
  });
});

describe('absBigInt', () => {
  it('drops the sign', () => {
    expect(absBigInt(-5n)).toBe(5n);
    expect(absBigInt(5n)).toBe(5n);
    expect(absBigInt(0n)).toBe(0n);
  });
});
