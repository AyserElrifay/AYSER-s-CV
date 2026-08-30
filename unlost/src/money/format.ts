import { type CurrencyCode, exponentOf } from './currency';
import { type Money, toMajorString } from './money';

export type Locale = 'en' | 'ar';

/**
 * Which digits Arabic actually shows.
 *
 * `arab` gives ٠١٢٣٤٥٦٧٨٩, `latn` gives 0123456789. Both are correct Arabic;
 * which one an agency wants is a preference, not a fact, and Gulf finance teams
 * frequently prefer Latin digits on money even in a fully Arabic interface.
 * Defaults to Arabic-Indic, overridable per organisation.
 */
export type NumberingSystem = 'arab' | 'latn';

export interface FormatOptions {
  readonly locale?: Locale;
  readonly numberingSystem?: NumberingSystem;
  /** `symbol` gives "E£1,234.56", `code` gives "EGP 1,234.56", `none` omits it. */
  readonly display?: 'symbol' | 'code' | 'none';
}

function resolveLocale(options: FormatOptions): string {
  const base = options.locale === 'ar' ? 'ar-EG' : 'en-US';
  const system =
    options.numberingSystem ?? (options.locale === 'ar' ? 'arab' : 'latn');
  return `${base}-u-nu-${system}`;
}

/**
 * Format for display. Takes the exact decimal string, never a float, so an
 * amount too large for a double still prints every digit correctly.
 */
export function formatMoney(value: Money, options: FormatOptions = {}): string {
  const display = options.display ?? 'symbol';
  const major = toMajorString(value);

  const formatter = new Intl.NumberFormat(resolveLocale(options), {
    ...(display === 'none'
      ? { style: 'decimal' as const }
      : {
          style: 'currency' as const,
          currency: value.currency,
          currencyDisplay: display === 'code' ? ('code' as const) : ('narrowSymbol' as const),
        }),
    minimumFractionDigits: fractionDigits(value.currency),
    maximumFractionDigits: fractionDigits(value.currency),
  });

  // Intl.NumberFormat accepts a string for arbitrary precision (ECMA-402 v3),
  // which is the only way a bigint amount survives formatting intact.
  return formatter.format(major as unknown as number);
}

function fractionDigits(currency: CurrencyCode): number {
  // Our own table, not Intl's: the currency exponent decides how many minor
  // units an amount has, so the same number must drive storage and display.
  return exponentOf(currency);
}

/** "42.5%" from 4250 basis points. Null margins read as an em dash. */
export function formatBasisPoints(
  bp: number | null,
  options: FormatOptions = {},
): string {
  if (bp === null) return '—';
  return new Intl.NumberFormat(resolveLocale(options), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(bp / 10_000);
}
