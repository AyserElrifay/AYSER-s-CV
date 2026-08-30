import {
  type CurrencyCode,
  assertCurrencyCode,
  exponentOf,
} from './currency';
import {
  type Rounding,
  DEFAULT_ROUNDING,
  absBigInt,
  divRound,
  pow10,
} from './rounding';

/**
 * An amount of money, held as an integer count of minor units.
 *
 * 12.34 EGP is `{ currency: 'EGP', minor: 1234n }`. There is no float anywhere
 * in this type, and no operation below ever produces one. `minor` is a bigint
 * rather than a number so that a large deal in a weak currency cannot silently
 * pass 2^53 and start losing units.
 */
export interface Money {
  readonly currency: CurrencyCode;
  readonly minor: bigint;
}

export class CurrencyMismatchError extends Error {
  constructor(
    readonly left: CurrencyCode,
    readonly right: CurrencyCode,
  ) {
    super(
      `Cannot combine ${left} with ${right}. Convert through a recorded FX rate first.`,
    );
    this.name = 'CurrencyMismatchError';
  }
}

export class MoneyParseError extends Error {
  constructor(input: string, reason: string) {
    super(`Cannot read "${input}" as an amount: ${reason}`);
    this.name = 'MoneyParseError';
  }
}

// --- construction ------------------------------------------------------------

export function money(minor: bigint, currency: CurrencyCode): Money {
  return { currency, minor };
}

export function zero(currency: CurrencyCode): Money {
  return { currency, minor: 0n };
}

/** Strict: digits, one optional dot, one optional leading sign. Nothing else. */
const DECIMAL = /^[+-]?(\d+)(?:\.(\d*))?$/;

/**
 * Parse a major-unit decimal string exactly. "1234.56" EGP -> 123456n.
 *
 * Rejects anything ambiguous rather than guessing: scientific notation,
 * thousands separators, empty strings. Extra decimal places are an error by
 * default — silently dropping a third decimal on a KWD amount is exactly the
 * class of bug this module exists to prevent — but can be rounded explicitly.
 */
export function fromMajor(
  amount: string,
  currency: CurrencyCode,
  options: { excessPrecision?: 'throw' | Rounding } = {},
): Money {
  assertCurrencyCode(currency);
  const trimmed = amount.trim();
  const match = DECIMAL.exec(trimmed);
  if (!match) {
    throw new MoneyParseError(amount, 'expected a plain decimal number like 1234.56');
  }

  const negative = trimmed.startsWith('-');
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  const exponent = exponentOf(currency);

  let minor: bigint;
  if (fraction.length <= exponent) {
    const padded = fraction.padEnd(exponent, '0');
    minor = BigInt(whole + padded);
  } else {
    const mode = options.excessPrecision ?? 'throw';
    if (mode === 'throw') {
      throw new MoneyParseError(
        amount,
        `${currency} has ${exponent} decimal place${exponent === 1 ? '' : 's'}, got ${fraction.length}`,
      );
    }
    // Round the surplus digits away rather than truncating them.
    const scaled = BigInt(whole + fraction);
    minor = divRound(scaled, pow10(fraction.length - exponent), mode);
  }

  return { currency, minor: negative ? -minor : minor };
}

/**
 * Lenient parse for text a human typed into a field: strips spaces, ASCII and
 * Arabic thousands separators, and converts Arabic-Indic digits to ASCII.
 * Never used for anything arriving from the database or an API.
 */
export function parseUserAmount(
  input: string,
  currency: CurrencyCode,
  options: { excessPrecision?: 'throw' | Rounding } = {},
): Money {
  const normalised = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫]/g, '.') // Arabic decimal separator
    .replace(/[\s,٬  ]/g, '') // spaces and thousands separators
    .trim();
  if (normalised === '' || normalised === '-' || normalised === '+') {
    throw new MoneyParseError(input, 'no digits found');
  }
  return fromMajor(normalised, currency, options);
}

/** Exact major-unit string. Always carries the full precision of the currency. */
export function toMajorString(value: Money): string {
  const exponent = exponentOf(value.currency);
  const negative = value.minor < 0n;
  const digits = absBigInt(value.minor).toString().padStart(exponent + 1, '0');
  const sign = negative ? '-' : '';
  if (exponent === 0) return sign + digits;
  const whole = digits.slice(0, -exponent);
  const fraction = digits.slice(-exponent);
  return `${sign}${whole}.${fraction}`;
}

// --- arithmetic --------------------------------------------------------------

function sameCurrency(a: Money, b: Money): CurrencyCode {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  return a.currency;
}

export function add(a: Money, b: Money): Money {
  return { currency: sameCurrency(a, b), minor: a.minor + b.minor };
}

export function subtract(a: Money, b: Money): Money {
  return { currency: sameCurrency(a, b), minor: a.minor - b.minor };
}

/** Sum of a list. The currency argument makes the empty case unambiguous. */
export function sum(values: readonly Money[], currency: CurrencyCode): Money {
  let total = 0n;
  for (const value of values) {
    if (value.currency !== currency) throw new CurrencyMismatchError(currency, value.currency);
    total += value.minor;
  }
  return { currency, minor: total };
}

export function negate(value: Money): Money {
  return { currency: value.currency, minor: -value.minor };
}

export function abs(value: Money): Money {
  return { currency: value.currency, minor: absBigInt(value.minor) };
}

/** Multiply by a whole number: three units of the same line item. */
export function multiply(value: Money, factor: bigint): Money {
  return { currency: value.currency, minor: value.minor * factor };
}

/** Multiply by an exact rational, rounding once at the end. */
export function multiplyRatio(
  value: Money,
  numerator: bigint,
  denominator: bigint,
  mode: Rounding = DEFAULT_ROUNDING,
): Money {
  return {
    currency: value.currency,
    minor: divRound(value.minor * numerator, denominator, mode),
  };
}

/**
 * Round to the nearest step. 63,847 becomes 64,000 at a step of 1,000.
 *
 * A price slider that reports whatever value a pixel happens to land on
 * produces numbers nobody would ever say out loud to a client. Snapping keeps
 * the reading quotable while the drag stays continuous.
 */
export function snapToStep(
  value: Money,
  stepMinor: bigint,
  mode: Rounding = DEFAULT_ROUNDING,
): Money {
  if (stepMinor <= 0n) throw new RangeError('Step must be a positive number of minor units');
  return { currency: value.currency, minor: divRound(value.minor, stepMinor, mode) * stepMinor };
}

/**
 * A step that divides a range into roughly 100–400 stops, landing on 1, 2.5 or
 * 5 times a power of ten — the increments people actually quote in.
 */
export function niceStepFor(span: Money): bigint {
  const magnitude = absBigInt(span.minor);
  if (magnitude === 0n) return 1n;

  // Aim for ~200 stops, then climb to the next round increment at or above it.
  const targetStep = magnitude / 200n;
  if (targetStep <= 1n) return 1n;

  let unit = 1n;
  while (unit * 10n <= targetStep) unit *= 10n;
  for (const multiple of [1n, 2n, 5n, 10n]) {
    if (unit * multiple >= targetStep) return unit * multiple;
  }
  return unit * 10n;
}

// --- comparison --------------------------------------------------------------

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b);
  if (a.minor < b.minor) return -1;
  if (a.minor > b.minor) return 1;
  return 0;
}

export const equals = (a: Money, b: Money): boolean => compare(a, b) === 0;
export const lessThan = (a: Money, b: Money): boolean => compare(a, b) < 0;
export const greaterThan = (a: Money, b: Money): boolean => compare(a, b) > 0;
export const lessThanOrEqual = (a: Money, b: Money): boolean => compare(a, b) <= 0;
export const greaterThanOrEqual = (a: Money, b: Money): boolean => compare(a, b) >= 0;

export const isZero = (value: Money): boolean => value.minor === 0n;
export const isNegative = (value: Money): boolean => value.minor < 0n;
export const isPositive = (value: Money): boolean => value.minor > 0n;

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}

/** Clamp into [low, high]. Used by the pricing slider's floor and ceiling. */
export function clamp(value: Money, low: Money, high: Money): Money {
  if (compare(low, high) > 0) {
    throw new RangeError('clamp called with a floor above its ceiling');
  }
  return min(max(value, low), high);
}

// --- persistence -------------------------------------------------------------

/**
 * Postgres returns bigint columns as strings (int8 exceeds Number.MAX_SAFE_INTEGER).
 * This is the only sanctioned way to rebuild a Money from a row.
 */
export function fromDb(minor: string | number | bigint, currency: string): Money {
  const code = assertCurrencyCode(currency);
  if (typeof minor === 'number' && !Number.isSafeInteger(minor)) {
    throw new MoneyParseError(String(minor), 'not a safe integer');
  }
  return { currency: code, minor: BigInt(minor) };
}

/** The shape written back to Postgres: a string, so no driver rounds it. */
export function toDb(value: Money): { minor: string; currency: CurrencyCode } {
  return { minor: value.minor.toString(), currency: value.currency };
}
