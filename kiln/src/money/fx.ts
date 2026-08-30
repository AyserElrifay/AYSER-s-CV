import { type CurrencyCode, assertCurrencyCode, exponentOf } from './currency';
import { type Money, MoneyParseError } from './money';
import { type Rounding, DEFAULT_ROUNDING, divRound, pow10 } from './rounding';

/**
 * A conversion rate, held as an exact rational and stamped with the moment it
 * was captured.
 *
 * The rate is frozen onto a deal when the deal closes and is never looked up
 * again. Recomputing a February margin with August's rate does not correct the
 * February margin — it destroys it, along with the payout that was already
 * paid against it.
 */
export interface FxRate {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  readonly numerator: bigint;
  readonly denominator: bigint;
  /** When this rate was observed. Part of the audit trail, not decoration. */
  readonly capturedAt: Date;
  /** Where it came from: a provider name, or 'manual' when a human typed it. */
  readonly source: string;
}

/** Decimal places kept when a rate round-trips through Postgres numeric. */
export const FX_RATE_SCALE = 12;

export class FxRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxRateError';
  }
}

const RATE_DECIMAL = /^(\d+)(?:\.(\d*))?$/;

/** Build a rate from the decimal string a provider or a human gave us. */
export function fxRateFromDecimal(
  from: CurrencyCode,
  to: CurrencyCode,
  rate: string,
  meta: { capturedAt: Date; source: string },
): FxRate {
  assertCurrencyCode(from);
  assertCurrencyCode(to);
  const match = RATE_DECIMAL.exec(rate.trim());
  if (!match) throw new MoneyParseError(rate, 'expected a positive decimal rate');

  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  if (fraction.length > FX_RATE_SCALE) {
    throw new FxRateError(
      `Rate ${rate} carries more than ${FX_RATE_SCALE} decimal places and would not survive storage`,
    );
  }
  const numerator = BigInt(whole + fraction.padEnd(FX_RATE_SCALE, '0'));
  if (numerator === 0n) throw new FxRateError('Rate must be greater than zero');

  return {
    from,
    to,
    numerator,
    denominator: pow10(FX_RATE_SCALE),
    capturedAt: meta.capturedAt,
    source: meta.source,
  };
}

/** A currency against itself. Always 1, never fetched, never stale. */
export function identityRate(currency: CurrencyCode, capturedAt: Date): FxRate {
  return {
    from: currency,
    to: currency,
    numerator: 1n,
    denominator: 1n,
    capturedAt,
    source: 'identity',
  };
}

export function invertRate(rate: FxRate): FxRate {
  return {
    from: rate.to,
    to: rate.from,
    numerator: rate.denominator,
    denominator: rate.numerator,
    capturedAt: rate.capturedAt,
    source: `inverse:${rate.source}`,
  };
}

/** The exact decimal string to persist alongside the deal. */
export function rateToDecimalString(rate: FxRate): string {
  const scaled = divRound(rate.numerator * pow10(FX_RATE_SCALE), rate.denominator, 'half-even');
  const digits = scaled.toString().padStart(FX_RATE_SCALE + 1, '0');
  return `${digits.slice(0, -FX_RATE_SCALE)}.${digits.slice(-FX_RATE_SCALE)}`;
}

/**
 * Convert, accounting for the two currencies having different minor units.
 *
 * EGP has two decimal places and KWD has three, so the conversion is not just a
 * multiplication — the scale changes underneath it. Everything stays rational
 * until a single rounding at the end.
 */
export function convert(
  value: Money,
  rate: FxRate,
  mode: Rounding = DEFAULT_ROUNDING,
): Money {
  if (value.currency !== rate.from) {
    throw new FxRateError(
      `Rate converts ${rate.from} to ${rate.to}, but the amount is in ${value.currency}`,
    );
  }
  if (rate.from === rate.to) return value;

  const scaleIn = pow10(exponentOf(rate.from));
  const scaleOut = pow10(exponentOf(rate.to));
  const numerator = value.minor * rate.numerator * scaleOut;
  const denominator = rate.denominator * scaleIn;

  return { currency: rate.to, minor: divRound(numerator, denominator, mode) };
}

/**
 * Total a mixed-currency list into one currency.
 *
 * Costs arrive in whatever the vendor invoiced: an EGP videographer and a USD
 * stock licence on the same AED deal. `resolveRate` must return the rate frozen
 * on the deal, never a live lookup.
 */
export function sumConverted(
  values: readonly Money[],
  target: CurrencyCode,
  resolveRate: (from: CurrencyCode, to: CurrencyCode) => FxRate,
  mode: Rounding = DEFAULT_ROUNDING,
): Money {
  let total = 0n;
  for (const value of values) {
    if (value.currency === target) {
      total += value.minor;
      continue;
    }
    const rate = resolveRate(value.currency, target);
    if (rate.from !== value.currency || rate.to !== target) {
      throw new FxRateError(
        `resolveRate returned a ${rate.from}->${rate.to} rate for a ${value.currency}->${target} conversion`,
      );
    }
    total += convert(value, rate, mode).minor;
  }
  return { currency: target, minor: total };
}
