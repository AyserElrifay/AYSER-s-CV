import { describe, expect, it } from 'vitest';
import { formatBasisPoints, formatMoney } from './format';
import { fromMajor, money } from './money';

/** Strip the bidi control marks Intl inserts, which are invisible but present. */
const plain = (s: string) => s.replace(/[‎‏؜]/g, '');

describe('formatMoney', () => {
  it('formats English with a narrow symbol by default', () => {
    expect(formatMoney(fromMajor('1234.56', 'EGP'))).toBe('E£1,234.56');
    expect(formatMoney(fromMajor('1234.56', 'USD'))).toBe('$1,234.56');
  });

  it('can show the code instead, for statements where the symbol is ambiguous', () => {
    // Intl separates a currency code from the number with a non-breaking space.
    expect(formatMoney(fromMajor('1234.56', 'EGP'), { display: 'code' })).toBe(
      'EGP\u00a01,234.56',
    );
  });

  it('can omit the currency entirely', () => {
    expect(formatMoney(fromMajor('1234.56', 'EGP'), { display: 'none' })).toBe('1,234.56');
  });

  it('formats Arabic with Arabic-Indic digits by default', () => {
    const out = plain(formatMoney(fromMajor('1234.56', 'EGP'), { locale: 'ar' }));
    expect(out).toContain('١٬٢٣٤٫٥٦');
  });

  it('lets an org keep Latin digits inside an Arabic interface', () => {
    const out = plain(
      formatMoney(fromMajor('1234.56', 'EGP'), { locale: 'ar', numberingSystem: 'latn' }),
    );
    expect(out).toContain('1,234.56');
  });

  it('shows the right number of decimals per currency', () => {
    expect(formatMoney(fromMajor('1.234', 'KWD'), { display: 'none' })).toBe('1.234');
    expect(formatMoney(fromMajor('1500', 'JPY'), { display: 'none' })).toBe('1,500');
    expect(formatMoney(fromMajor('1.50', 'EGP'), { display: 'none' })).toBe('1.50');
  });

  it('formats zero and negatives', () => {
    expect(formatMoney(fromMajor('0.00', 'EGP'), { display: 'none' })).toBe('0.00');
    expect(formatMoney(fromMajor('-1234.56', 'EGP'), { display: 'none' })).toBe('-1,234.56');
  });

  it('prints every digit of an amount too large for a double', () => {
    // The whole point of holding money as a bigint: this must not become
    // 100,000,000,000,000,000,000.00
    expect(formatMoney(money(9999999999999999999999n, 'EGP'), { display: 'none' })).toBe(
      '99,999,999,999,999,999,999.99',
    );
  });
});

describe('formatBasisPoints', () => {
  it('reads basis points back as a percentage', () => {
    expect(formatBasisPoints(4_250)).toBe('42.5%');
    expect(formatBasisPoints(10_000)).toBe('100%');
    expect(formatBasisPoints(0)).toBe('0%');
    expect(formatBasisPoints(-5_000)).toBe('-50%');
  });

  it('shows an unpriced margin as a dash, not as zero', () => {
    expect(formatBasisPoints(null)).toBe('—');
  });

  it('formats a percentage in Arabic', () => {
    expect(plain(formatBasisPoints(4_250, { locale: 'ar' }))).toContain('٤٢٫٥');
  });
});
