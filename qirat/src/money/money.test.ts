import { describe, expect, it } from 'vitest';
import { UnknownCurrencyError, assertCurrencyCode, exponentOf, isCurrencyCode } from './currency';
import {
  CurrencyMismatchError,
  MoneyParseError,
  abs,
  add,
  clamp,
  compare,
  equals,
  fromDb,
  fromMajor,
  greaterThan,
  isNegative,
  isPositive,
  isZero,
  lessThan,
  max,
  min,
  money,
  multiply,
  niceStepFor,
  snapToStep,
  multiplyRatio,
  negate,
  parseUserAmount,
  subtract,
  sum,
  toDb,
  toMajorString,
  zero,
} from './money';

describe('currency table', () => {
  it('knows the exponent of each currency it lists', () => {
    expect(exponentOf('EGP')).toBe(2);
    expect(exponentOf('USD')).toBe(2);
    expect(exponentOf('KWD')).toBe(3);
    expect(exponentOf('BHD')).toBe(3);
    expect(exponentOf('JPY')).toBe(0);
  });

  it('rejects codes it does not know', () => {
    expect(isCurrencyCode('EGP')).toBe(true);
    expect(isCurrencyCode('XXX')).toBe(false);
    expect(() => assertCurrencyCode('XXX')).toThrow(UnknownCurrencyError);
    // A prototype key must not read as a currency.
    expect(isCurrencyCode('toString')).toBe(false);
  });
});

describe('fromMajor', () => {
  it('reads a two-decimal amount exactly', () => {
    expect(fromMajor('1234.56', 'EGP').minor).toBe(123456n);
    expect(fromMajor('0.01', 'EGP').minor).toBe(1n);
    expect(fromMajor('0', 'EGP').minor).toBe(0n);
  });

  it('pads a short fraction rather than misreading it', () => {
    expect(fromMajor('12.5', 'EGP').minor).toBe(1250n);
    expect(fromMajor('12.', 'EGP').minor).toBe(1200n);
    expect(fromMajor('12', 'EGP').minor).toBe(1200n);
  });

  it('respects three-decimal and zero-decimal currencies', () => {
    expect(fromMajor('1.234', 'KWD').minor).toBe(1234n);
    expect(fromMajor('1.2', 'KWD').minor).toBe(1200n);
    expect(fromMajor('1500', 'JPY').minor).toBe(1500n);
  });

  it('handles signs', () => {
    expect(fromMajor('-1234.56', 'EGP').minor).toBe(-123456n);
    expect(fromMajor('+12.00', 'EGP').minor).toBe(1200n);
    expect(fromMajor('-0.00', 'EGP').minor).toBe(0n);
  });

  it('refuses to silently drop precision', () => {
    expect(() => fromMajor('1.005', 'EGP')).toThrow(MoneyParseError);
    expect(() => fromMajor('1.2345', 'KWD')).toThrow(MoneyParseError);
    expect(() => fromMajor('1.5', 'JPY')).toThrow(MoneyParseError);
  });

  it('rounds surplus precision only when told to', () => {
    expect(fromMajor('1.005', 'EGP', { excessPrecision: 'half-up' }).minor).toBe(101n);
    expect(fromMajor('1.005', 'EGP', { excessPrecision: 'half-even' }).minor).toBe(100n);
    expect(fromMajor('1.004', 'EGP', { excessPrecision: 'half-up' }).minor).toBe(100n);
    expect(fromMajor('-1.005', 'EGP', { excessPrecision: 'half-up' }).minor).toBe(-101n);
  });

  it('rejects anything ambiguous instead of guessing', () => {
    for (const bad of ['', ' ', 'abc', '1,234.56', '1e3', '1.2.3', '--1', '1 2', 'NaN', 'Infinity']) {
      expect(() => fromMajor(bad, 'EGP'), `should reject ${JSON.stringify(bad)}`).toThrow(
        MoneyParseError,
      );
    }
  });

  it('carries amounts larger than a double can hold', () => {
    const big = fromMajor('99999999999999999999.99', 'EGP');
    expect(big.minor).toBe(9999999999999999999999n);
    expect(toMajorString(big)).toBe('99999999999999999999.99');
  });
});

describe('parseUserAmount', () => {
  it('accepts what a human types', () => {
    expect(parseUserAmount('  1,234.56 ', 'EGP').minor).toBe(123456n);
    expect(parseUserAmount('1 234.56', 'EGP').minor).toBe(123456n);
  });

  it('accepts Arabic-Indic digits and the Arabic decimal separator', () => {
    expect(parseUserAmount('١٢٣٤٫٥٦', 'EGP').minor).toBe(123456n);
    expect(parseUserAmount('١٢٣٤٬٥٦٧٫٨٩', 'EGP').minor).toBe(123456789n);
    expect(parseUserAmount('۱۲۳۴٫۵۶', 'EGP').minor).toBe(123456n);
  });

  it('still refuses input with no digits', () => {
    expect(() => parseUserAmount('   ', 'EGP')).toThrow(MoneyParseError);
    expect(() => parseUserAmount('-', 'EGP')).toThrow(MoneyParseError);
  });
});

describe('toMajorString', () => {
  it('round-trips every currency shape', () => {
    for (const [amount, currency] of [
      ['1234.56', 'EGP'],
      ['0.00', 'EGP'],
      ['-0.07', 'EGP'],
      ['1.234', 'KWD'],
      ['-9.007', 'KWD'],
      ['1500', 'JPY'],
      ['-3', 'JPY'],
    ] as const) {
      expect(toMajorString(fromMajor(amount, currency))).toBe(amount);
    }
  });

  it('pads amounts smaller than one major unit', () => {
    expect(toMajorString(money(7n, 'EGP'))).toBe('0.07');
    expect(toMajorString(money(-7n, 'EGP'))).toBe('-0.07');
    expect(toMajorString(money(7n, 'KWD'))).toBe('0.007');
  });
});

describe('arithmetic', () => {
  const egp = (v: string) => fromMajor(v, 'EGP');

  it('adds and subtracts exactly', () => {
    expect(add(egp('10.10'), egp('0.20')).minor).toBe(1030n);
    expect(subtract(egp('10.00'), egp('12.50')).minor).toBe(-250n);
  });

  it('has no floating point error where 0.1 + 0.2 would show it', () => {
    expect(toMajorString(add(egp('0.10'), egp('0.20')))).toBe('0.30');
  });

  it('refuses to mix currencies', () => {
    expect(() => add(egp('1.00'), fromMajor('1.00', 'USD'))).toThrow(CurrencyMismatchError);
    expect(() => subtract(egp('1.00'), fromMajor('1.00', 'USD'))).toThrow(CurrencyMismatchError);
    expect(() => compare(egp('1.00'), fromMajor('1.00', 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('names both currencies when it refuses', () => {
    expect(() => add(egp('1.00'), fromMajor('1.00', 'USD'))).toThrow(/EGP.*USD/);
  });

  it('sums a list, including the empty one', () => {
    expect(sum([egp('1.00'), egp('2.50'), egp('-0.50')], 'EGP').minor).toBe(300n);
    expect(sum([], 'EGP')).toEqual(zero('EGP'));
    expect(() => sum([fromMajor('1.00', 'USD')], 'EGP')).toThrow(CurrencyMismatchError);
  });

  it('negates and absolutes', () => {
    expect(negate(egp('1.25')).minor).toBe(-125n);
    expect(negate(egp('-1.25')).minor).toBe(125n);
    expect(abs(egp('-1.25')).minor).toBe(125n);
    expect(abs(egp('1.25')).minor).toBe(125n);
    expect(negate(zero('EGP')).minor).toBe(0n);
  });

  it('multiplies by whole units', () => {
    expect(multiply(egp('19.99'), 3n).minor).toBe(5997n);
    expect(multiply(egp('19.99'), 0n).minor).toBe(0n);
    expect(multiply(egp('19.99'), -2n).minor).toBe(-3998n);
  });

  it('multiplies by a ratio, rounding once at the end', () => {
    // A third of 100.00 is 33.333..., which must not become 33.34.
    expect(multiplyRatio(egp('100.00'), 1n, 3n).minor).toBe(3333n);
    expect(multiplyRatio(egp('100.00'), 2n, 3n).minor).toBe(6667n);
    expect(multiplyRatio(egp('0.05'), 1n, 2n, 'half-even').minor).toBe(2n); // 2.5 -> 2
    expect(multiplyRatio(egp('0.05'), 1n, 2n, 'half-up').minor).toBe(3n);
    expect(multiplyRatio(egp('-0.05'), 1n, 2n, 'half-up').minor).toBe(-3n);
  });
});

describe('comparison', () => {
  const egp = (v: string) => fromMajor(v, 'EGP');

  it('orders amounts', () => {
    expect(compare(egp('1.00'), egp('2.00'))).toBe(-1);
    expect(compare(egp('2.00'), egp('1.00'))).toBe(1);
    expect(compare(egp('1.00'), egp('1.00'))).toBe(0);
    expect(equals(egp('1.00'), money(100n, 'EGP'))).toBe(true);
    expect(lessThan(egp('-1.00'), egp('0.00'))).toBe(true);
    expect(greaterThan(egp('0.01'), egp('0.00'))).toBe(true);
  });

  it('answers the sign questions', () => {
    expect(isZero(zero('EGP'))).toBe(true);
    expect(isNegative(egp('-0.01'))).toBe(true);
    expect(isPositive(egp('0.01'))).toBe(true);
    expect(isNegative(zero('EGP'))).toBe(false);
    expect(isPositive(zero('EGP'))).toBe(false);
  });

  it('picks minimum and maximum', () => {
    expect(min(egp('1.00'), egp('2.00')).minor).toBe(100n);
    expect(max(egp('1.00'), egp('2.00')).minor).toBe(200n);
  });

  it('clamps into a band', () => {
    const low = egp('10.00');
    const high = egp('20.00');
    expect(clamp(egp('5.00'), low, high).minor).toBe(1000n);
    expect(clamp(egp('25.00'), low, high).minor).toBe(2000n);
    expect(clamp(egp('15.00'), low, high).minor).toBe(1500n);
    expect(() => clamp(egp('15.00'), high, low)).toThrow(RangeError);
  });
});

describe('persistence', () => {
  it('rebuilds from the string Postgres returns for bigint columns', () => {
    expect(fromDb('123456', 'EGP').minor).toBe(123456n);
    expect(fromDb(123456, 'EGP').minor).toBe(123456n);
    expect(fromDb(123456n, 'EGP').minor).toBe(123456n);
    expect(fromDb('-1', 'EGP').minor).toBe(-1n);
  });

  it('refuses a currency it does not know and an unsafe number', () => {
    expect(() => fromDb('1', 'XXX')).toThrow(UnknownCurrencyError);
    expect(() => fromDb(Number.MAX_SAFE_INTEGER + 2, 'EGP')).toThrow(MoneyParseError);
  });

  it('writes back a string so no driver rounds it', () => {
    const big = fromMajor('99999999999999999999.99', 'EGP');
    expect(toDb(big)).toEqual({ minor: '9999999999999999999999', currency: 'EGP' });
    expect(fromDb(toDb(big).minor, toDb(big).currency)).toEqual(big);
  });
});

describe('snapToStep', () => {
  const egp = (v: string) => fromMajor(v, 'EGP');

  it('rounds to the nearest step', () => {
    expect(toMajorString(snapToStep(egp('63847.00'), 100_000n))).toBe('64000.00');
    expect(toMajorString(snapToStep(egp('63449.00'), 100_000n))).toBe('63000.00');
    expect(toMajorString(snapToStep(egp('63500.00'), 100_000n, 'half-up'))).toBe('64000.00');
  });

  it('leaves a value already on a step alone', () => {
    expect(toMajorString(snapToStep(egp('64000.00'), 100_000n))).toBe('64000.00');
    expect(toMajorString(snapToStep(egp('0.00'), 100_000n))).toBe('0.00');
  });

  it('snaps negatives symmetrically', () => {
    expect(toMajorString(snapToStep(egp('-63847.00'), 100_000n))).toBe('-64000.00');
  });

  it('is a no-op at a step of one minor unit', () => {
    expect(snapToStep(egp('12.34'), 1n).minor).toBe(1234n);
  });

  it('refuses a step that is not positive', () => {
    expect(() => snapToStep(egp('1.00'), 0n)).toThrow(RangeError);
    expect(() => snapToStep(egp('1.00'), -1n)).toThrow(RangeError);
  });
});

describe('niceStepFor', () => {
  const egp = (v: string) => fromMajor(v, 'EGP');

  it('picks an increment a person would actually quote', () => {
    // A 70,000 EGP band: 500 EGP steps, so the reading lands on round numbers.
    expect(niceStepFor(egp('70000.00'))).toBe(50_000n); // 500.00 EGP
    expect(niceStepFor(egp('700.00'))).toBe(500n); // 5.00 EGP
    expect(niceStepFor(egp('10.00'))).toBe(5n); // 0.05 EGP
  });

  it('always lands on 1, 2, 5 or 10 times a power of ten', () => {
    for (const span of ['1.00', '17.00', '250.00', '3300.00', '48000.00', '925000.00']) {
      const step = niceStepFor(egp(span));
      const digits = step.toString();
      const leading = digits[0]!;
      const rest = digits.slice(1);
      expect(['1', '2', '5'], `step ${step} for span ${span}`).toContain(leading);
      expect(/^0*$/.test(rest), `step ${step} has a ragged tail`).toBe(true);
    }
  });

  it('divides a range into a workable number of stops', () => {
    for (const span of ['70000.00', '3300.00', '925000.00']) {
      const money = egp(span);
      const stops = Number(money.minor / niceStepFor(money));
      expect(stops, `span ${span} gave ${stops} stops`).toBeGreaterThanOrEqual(100);
      expect(stops).toBeLessThanOrEqual(400);
    }
  });

  it('never returns zero, whatever the span', () => {
    expect(niceStepFor(egp('0.00'))).toBe(1n);
    expect(niceStepFor(egp('0.01'))).toBe(1n);
  });
});
