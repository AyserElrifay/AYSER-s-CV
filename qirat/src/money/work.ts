import { type Money, sum, zero } from './money';
import { type Rounding, DEFAULT_ROUNDING, divRound } from './rounding';

/**
 * What a person's time costs.
 *
 * The other half of a margin. Costs paid out to suppliers are money that left
 * the bank and are easy to remember; the four days your own designer spent on
 * the deal are the cost nobody writes down, and a margin that ignores them is
 * the reason agencies think retainers are profitable.
 *
 * Days, not hours, and the choice is deliberate. Agencies quote crew, editors
 * and designers by the day; an hour is a unit people estimate badly and record
 * worse. Quarter-days are expressible, which covers the honest cases, and the
 * unit stays one somebody can actually answer at the end of a Thursday.
 */

/** Days held as hundredths, so 0.25 of a day is 25 and no float is involved. */
export type DayQuantity = number;

export const DAY_SCALE = 100n;

/** The most anybody can log against one deal on one day. Two shifts, not twenty. */
export const MAX_DAYS_PER_ENTRY = 2000; // 20.00 days

export class WorkQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkQuantityError';
  }
}

export function assertDayQuantity(hundredths: DayQuantity): void {
  if (!Number.isInteger(hundredths)) {
    throw new WorkQuantityError(`Days must be whole hundredths, got ${hundredths}`);
  }
  if (hundredths <= 0) {
    throw new WorkQuantityError('A logged day must be more than nothing');
  }
  if (hundredths > MAX_DAYS_PER_ENTRY) {
    throw new WorkQuantityError(`${hundredths / 100} days in one entry is not a day's work`);
  }
}

/**
 * Parse what somebody typed into hundredths of a day.
 *
 * Lenient the same way the cost field is: Arabic-Indic digits, an Arabic decimal
 * separator, stray spaces. Anything past two decimals is refused rather than
 * silently rounded — a person who types 0.333 means a third of a day and should
 * be told this system does not have thirds.
 */
export function parseDays(input: string): DayQuantity {
  const normalised = String(input)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[\s,٬  ]/g, '')
    .trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalised);
  if (!match) throw new WorkQuantityError(`Not a number of days: ${input}`);
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const hundredths = whole * 100 + fraction;
  assertDayQuantity(hundredths);
  return hundredths;
}

/** "1.5" from 150. The exact decimal, never a float formatted back. */
export function daysToString(hundredths: DayQuantity): string {
  const whole = Math.trunc(hundredths / 100);
  const rest = hundredths % 100;
  if (rest === 0) return String(whole);
  return `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}

/**
 * Days at a rate.
 *
 * One rounding, at the end, on exact integers: half a day at a rate with an odd
 * minor unit lands on a real amount rather than a repeating fraction somebody
 * has to reconcile later.
 */
export function priceWork(
  days: DayQuantity,
  dayRate: Money,
  mode: Rounding = DEFAULT_ROUNDING,
): Money {
  assertDayQuantity(days);
  return {
    currency: dayRate.currency,
    minor: divRound(dayRate.minor * BigInt(days), DAY_SCALE, mode),
  };
}

export interface WorkEntry {
  readonly days: DayQuantity;
  readonly rate: Money;
}

/**
 * What a deal's own people cost it.
 *
 * Summed entry by entry, each priced and rounded on its own, because that is
 * what the rows say. Totalling the days first and pricing once would produce a
 * different number from the sum of the lines, and the lines are what a person
 * checks their timesheet against.
 */
export function totalWork(entries: readonly WorkEntry[], currency: Money['currency']): Money {
  if (entries.length === 0) return zero(currency);
  // `sum` refuses a mismatched currency, which is the check that matters: a
  // day rate in euros on an Egyptian deal is a mistake, not a conversion.
  return sum(entries.map((entry) => priceWork(entry.days, entry.rate)), currency);
}
