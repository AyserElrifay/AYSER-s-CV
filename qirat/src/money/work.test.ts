import { describe, expect, it } from 'vitest';
import {
  MAX_DAYS_PER_ENTRY,
  WorkQuantityError,
  daysToString,
  parseDays,
  priceWork,
  totalWork,
} from './work';
import { CurrencyMismatchError, fromMajor, toMajorString } from './money';

const EGP = (major: string) => fromMajor(major, 'EGP');

describe('reading a number of days', () => {
  it.each([
    ['1', 100],
    ['0.5', 50],
    ['0.25', 25],
    ['2.75', 275],
    ['10', 1000],
    ['1.0', 100],
    ['1.50', 150],
  ])('%s is %i hundredths', (input, expected) => {
    expect(parseDays(input)).toBe(expected);
  });

  it('reads Arabic-Indic digits and the Arabic decimal separator', () => {
    // The producer typing this is on an Arabic keyboard, on a phone, on set.
    expect(parseDays('٠٫٥')).toBe(50);
    expect(parseDays('١٫٢٥')).toBe(125);
    expect(parseDays('٣')).toBe(300);
  });

  it('refuses a third of a day rather than rounding it away', () => {
    // Somebody typing 0.333 means a third. This system does not have thirds,
    // and silently storing 0.33 would be answering a different question.
    expect(() => parseDays('0.333')).toThrow(WorkQuantityError);
  });

  it.each(['', '-1', 'half', '0', '1,5,0', '٫٥', '1.'])('refuses %o', (input) => {
    expect(() => parseDays(input)).toThrow(WorkQuantityError);
  });

  it('refuses more days than a day can hold', () => {
    expect(() => parseDays('21')).toThrow(WorkQuantityError);
    expect(parseDays('20')).toBe(MAX_DAYS_PER_ENTRY);
  });

  it('round-trips through its own string form', () => {
    for (const input of ['1', '0.5', '0.25', '2.75', '12.1', '20']) {
      expect(daysToString(parseDays(input))).toBe(input.replace(/\.0$/, ''));
    }
  });
});

describe('pricing a day', () => {
  it('charges a full day at the rate', () => {
    expect(toMajorString(priceWork(100, EGP('1200.00')))).toBe('1200.00');
  });

  it('charges a half day at half the rate', () => {
    expect(toMajorString(priceWork(50, EGP('1200.00')))).toBe('600.00');
  });

  it('rounds a quarter of an odd rate once, and to even', () => {
    // 1,000.50 × 0.25 = 250.125 → 250.12 under half-even, not 250.13.
    expect(toMajorString(priceWork(25, EGP('1000.50')))).toBe('250.12');
  });

  it('keeps the currency of the rate', () => {
    expect(priceWork(100, fromMajor('800.00', 'EUR')).currency).toBe('EUR');
  });

  it('handles a rate far past what a float holds exactly', () => {
    const big = { currency: 'EGP' as const, minor: 9_007_199_254_740_993n };
    expect(priceWork(200, big).minor).toBe(18_014_398_509_481_986n);
  });

  it('refuses a quantity that is not whole hundredths', () => {
    expect(() => priceWork(12.5, EGP('1000.00'))).toThrow(WorkQuantityError);
  });

  it('refuses zero and negative days', () => {
    expect(() => priceWork(0, EGP('1000.00'))).toThrow(WorkQuantityError);
    expect(() => priceWork(-100, EGP('1000.00'))).toThrow(WorkQuantityError);
  });
});

describe('what a deal’s own people cost it', () => {
  it('totals nothing when nobody has logged anything', () => {
    expect(toMajorString(totalWork([], 'EGP'))).toBe('0.00');
  });

  it('sums the lines, each rounded on its own', () => {
    /*
     * Three quarter-days at 1,000.50 is 250.12 three times — 750.36 — and not
     * 0.75 of a day priced once, which would be 750.38. The lines are what a
     * person checks their timesheet against, so the lines are what is summed.
     */
    const entries = [
      { days: 25, rate: EGP('1000.50') },
      { days: 25, rate: EGP('1000.50') },
      { days: 25, rate: EGP('1000.50') },
    ];
    expect(toMajorString(totalWork(entries, 'EGP'))).toBe('750.36');
    expect(toMajorString(priceWork(75, EGP('1000.50')))).toBe('750.38');
  });

  it('adds up a mixed week', () => {
    const entries = [
      { days: 100, rate: EGP('1200.00') }, // a designer, one day
      { days: 250, rate: EGP('800.00') }, // an editor, two and a half
      { days: 50, rate: EGP('2500.00') }, // a director, half
    ];
    expect(toMajorString(totalWork(entries, 'EGP'))).toBe('4450.00');
  });

  it('refuses to total two currencies as though they were one', () => {
    // A euro day rate on an Egyptian deal is somebody's mistake, not a
    // conversion this function is entitled to perform.
    expect(() =>
      totalWork([{ days: 100, rate: fromMajor('800.00', 'EUR') }], 'EGP'),
    ).toThrow(CurrencyMismatchError);
  });
});
