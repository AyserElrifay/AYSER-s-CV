/**
 * Currency is a property of a deal, never of an organisation. A Cairo agency
 * bills an Egyptian client in EGP and a Riyadh client in SAR in the same week,
 * and both deals land in the same payout period.
 */

export const CURRENCIES = {
  EGP: { exponent: 2, name: 'Egyptian Pound' },
  USD: { exponent: 2, name: 'US Dollar' },
  SAR: { exponent: 2, name: 'Saudi Riyal' },
  AED: { exponent: 2, name: 'UAE Dirham' },
  QAR: { exponent: 2, name: 'Qatari Riyal' },
  EUR: { exponent: 2, name: 'Euro' },
  GBP: { exponent: 2, name: 'Pound Sterling' },
  // Three-decimal Gulf currencies. These are the reason the exponent is data
  // and not the constant 2 that half of every finance codebase assumes.
  KWD: { exponent: 3, name: 'Kuwaiti Dinar' },
  BHD: { exponent: 3, name: 'Bahraini Dinar' },
  OMR: { exponent: 3, name: 'Omani Rial' },
  JOD: { exponent: 3, name: 'Jordanian Dinar' },
  TND: { exponent: 3, name: 'Tunisian Dinar' },
  // Zero-decimal. A "piastre" of JPY does not exist.
  JPY: { exponent: 0, name: 'Japanese Yen' },

  // Europe outside the euro, and the rest of the market. Appended in this
  // order because a Postgres enum only grows at the end, and a test asserts
  // this list and that enum are the same list.
  CHF: { exponent: 2, name: 'Swiss Franc' },
  SEK: { exponent: 2, name: 'Swedish Krona' },
  NOK: { exponent: 2, name: 'Norwegian Krone' },
  DKK: { exponent: 2, name: 'Danish Krone' },
  PLN: { exponent: 2, name: 'Polish Złoty' },
  CZK: { exponent: 2, name: 'Czech Koruna' },
  HUF: { exponent: 2, name: 'Hungarian Forint' },
  RON: { exponent: 2, name: 'Romanian Leu' },
  TRY: { exponent: 2, name: 'Turkish Lira' },
  MAD: { exponent: 2, name: 'Moroccan Dirham' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export class UnknownCurrencyError extends Error {
  constructor(code: string) {
    super(`Unknown currency: ${code}`);
    this.name = 'UnknownCurrencyError';
  }
}

export function isCurrencyCode(code: string): code is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

export function assertCurrencyCode(code: string): CurrencyCode {
  if (!isCurrencyCode(code)) throw new UnknownCurrencyError(code);
  return code;
}

/** Number of minor units in one major unit: 100 for EGP, 1000 for KWD, 1 for JPY. */
export function exponentOf(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}
