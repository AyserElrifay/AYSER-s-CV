import { describe, expect, it } from 'vitest';
import {
  FxRateError,
  convert,
  fxRateFromDecimal,
  identityRate,
  invertRate,
  rateToDecimalString,
  sumConverted,
} from './fx';
import { MoneyParseError, fromMajor, toMajorString } from './money';

const AT = new Date('2026-02-14T09:00:00Z');
const rate = (from: Parameters<typeof fxRateFromDecimal>[0], to: Parameters<typeof fxRateFromDecimal>[1], value: string) =>
  fxRateFromDecimal(from, to, value, { capturedAt: AT, source: 'test' });

describe('fxRateFromDecimal', () => {
  it('reads a rate exactly', () => {
    const r = rate('USD', 'EGP', '48.75');
    expect(r.from).toBe('USD');
    expect(r.to).toBe('EGP');
    expect(r.numerator).toBe(48_750_000_000_000n); // 48.75 scaled by 1e12
    expect(r.denominator).toBe(1_000_000_000_000n);
  });

  it('keeps the capture time and provenance for the audit trail', () => {
    const r = rate('USD', 'EGP', '48.75');
    expect(r.capturedAt).toEqual(AT);
    expect(r.source).toBe('test');
  });

  it('rejects a rate that would not survive storage', () => {
    expect(() => rate('USD', 'EGP', '1.9999999999999')).toThrow(FxRateError);
  });

  it('rejects zero, negative and malformed rates', () => {
    expect(() => rate('USD', 'EGP', '0')).toThrow(FxRateError);
    expect(() => rate('USD', 'EGP', '0.000000000000')).toThrow(FxRateError);
    expect(() => rate('USD', 'EGP', '-1')).toThrow(MoneyParseError);
    expect(() => rate('USD', 'EGP', 'abc')).toThrow(MoneyParseError);
    expect(() => rate('USD', 'EGP', '')).toThrow(MoneyParseError);
  });

  it('round-trips through its stored decimal string', () => {
    expect(rateToDecimalString(rate('USD', 'EGP', '48.75'))).toBe('48.750000000000');
    expect(rateToDecimalString(identityRate('EGP', AT))).toBe('1.000000000000');
  });
});

describe('convert', () => {
  it('converts between two-decimal currencies', () => {
    const converted = convert(fromMajor('100.00', 'USD'), rate('USD', 'EGP', '48.75'));
    expect(converted.currency).toBe('EGP');
    expect(toMajorString(converted)).toBe('4875.00');
  });

  it('rounds once, at the end', () => {
    // 33.33 USD at 48.7654 = 1625.35... EGP
    const converted = convert(fromMajor('33.33', 'USD'), rate('USD', 'EGP', '48.7654'));
    expect(toMajorString(converted)).toBe('1625.35');
  });

  it('changes scale correctly when the exponents differ', () => {
    // EGP has 2 decimals, KWD has 3. The scale shifts underneath the rate.
    const converted = convert(fromMajor('100.00', 'EGP'), rate('EGP', 'KWD', '0.0062'));
    expect(converted.currency).toBe('KWD');
    expect(toMajorString(converted)).toBe('0.620');
  });

  it('converts into a zero-decimal currency', () => {
    // JPY has no minor unit at all, so the whole fractional part rounds away.
    const converted = convert(fromMajor('10.00', 'USD'), rate('USD', 'JPY', '157.26'));
    expect(converted.currency).toBe('JPY');
    expect(toMajorString(converted)).toBe('1573'); // 1572.6
  });

  it('applies the rounding mode it is given', () => {
    const half = convert(fromMajor('10.00', 'USD'), rate('USD', 'JPY', '157.25'), 'half-even');
    const up = convert(fromMajor('10.00', 'USD'), rate('USD', 'JPY', '157.25'), 'half-up');
    expect(toMajorString(half)).toBe('1572'); // 1572.5 -> even
    expect(toMajorString(up)).toBe('1573');
  });

  it('passes an amount through untouched when the currency is unchanged', () => {
    const amount = fromMajor('100.00', 'EGP');
    expect(convert(amount, identityRate('EGP', AT))).toEqual(amount);
  });

  it('converts a negative amount symmetrically', () => {
    const converted = convert(fromMajor('-100.00', 'USD'), rate('USD', 'EGP', '48.75'));
    expect(toMajorString(converted)).toBe('-4875.00');
  });

  it('refuses a rate that does not match the amount', () => {
    expect(() => convert(fromMajor('100.00', 'SAR'), rate('USD', 'EGP', '48.75'))).toThrow(
      FxRateError,
    );
    expect(() => convert(fromMajor('100.00', 'SAR'), rate('USD', 'EGP', '48.75'))).toThrow(
      /USD.*EGP.*SAR/,
    );
  });

  it('inverts a rate', () => {
    const forward = rate('USD', 'EGP', '48.75');
    const back = invertRate(forward);
    expect(back.from).toBe('EGP');
    expect(back.to).toBe('USD');
    const roundTrip = convert(convert(fromMajor('100.00', 'USD'), forward), back);
    expect(toMajorString(roundTrip)).toBe('100.00');
    expect(back.source).toBe('inverse:test');
  });
});

describe('sumConverted', () => {
  it('totals costs invoiced in three currencies into the deal currency', () => {
    const rates = {
      'USD>EGP': rate('USD', 'EGP', '48.75'),
      'SAR>EGP': rate('SAR', 'EGP', '13.00'),
    } as const;
    const total = sumConverted(
      [fromMajor('1000.00', 'EGP'), fromMajor('100.00', 'USD'), fromMajor('200.00', 'SAR')],
      'EGP',
      (from, to) => {
        const found = rates[`${from}>${to}` as keyof typeof rates];
        if (!found) throw new FxRateError(`no frozen rate for ${from}->${to}`);
        return found;
      },
    );
    // 1000 + 4875 + 2600
    expect(toMajorString(total)).toBe('8475.00');
  });

  it('needs no rate when everything is already in the target currency', () => {
    const total = sumConverted(
      [fromMajor('1.00', 'EGP'), fromMajor('2.00', 'EGP')],
      'EGP',
      () => {
        throw new Error('should not be called');
      },
    );
    expect(toMajorString(total)).toBe('3.00');
  });

  it('totals an empty list to zero', () => {
    expect(sumConverted([], 'EGP', () => identityRate('EGP', AT)).minor).toBe(0n);
  });

  it('catches a resolver that hands back the wrong rate', () => {
    expect(() =>
      sumConverted([fromMajor('1.00', 'USD')], 'EGP', () => rate('SAR', 'EGP', '13.00')),
    ).toThrow(FxRateError);
  });
});

describe('the frozen rate', () => {
  it('gives February its February number no matter what August says', () => {
    const february = rate('USD', 'EGP', '48.75');
    const august = rate('USD', 'EGP', '61.20');
    const deal = fromMajor('10000.00', 'USD');

    // The deal record carries February's rate. Recomputing with today's rate
    // would restate a margin that has already been paid out against.
    expect(toMajorString(convert(deal, february))).toBe('487500.00');
    expect(toMajorString(convert(deal, august))).toBe('612000.00');
    expect(february.capturedAt).toEqual(AT);
  });
});
