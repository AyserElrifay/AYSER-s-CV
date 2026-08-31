import { type BasisPoints, assertBasisPoints, splitByBasisPoints } from './allocate';
import { type CurrencyCode } from './currency';
import { type Money, sum, zero } from './money';
import { computeMargin } from './margin';

/**
 * The payout engine.
 *
 * This is the part nobody else has. Everything upstream — the deal card, the
 * margin, the costs — exists so that this can be correct: when a period closes,
 * every person who touched a deal gets a number, and the numbers add up.
 *
 * "Add up" is meant literally. For each currency:
 *
 *     every statement + the bonus pool + what the agency retained
 *       = the distributable profit of every deal in the period
 *
 * exactly, to the last piastre, with no rounding residue anywhere. A payout
 * engine that loses a unit is one a partner will eventually catch, and the
 * moment they do, they stop believing the number above it too.
 */

export type SplitRuleKind = 'partner_equity' | 'manager_commission' | 'bonus_pool';

export interface SplitRule {
  readonly id: string;
  readonly kind: SplitRuleKind;
  /**
   * Who this pays.
   *
   * Required for partner equity, which names a person. Null for a manager
   * commission, which pays whoever owns the deal, and null for the bonus pool,
   * which pays a pool rather than a person.
   */
  readonly beneficiaryUserId: string | null;
  readonly rateBp: BasisPoints;
}

export interface DealContribution {
  readonly dealId: string;
  readonly ownerUserId: string;
  readonly currency: CurrencyCode;
  readonly revenue: Money;
  readonly directCosts: Money;
  readonly houseRateBp: BasisPoints;
  /** The rules frozen onto this deal when it closed, never today's rules. */
  readonly rules: readonly SplitRule[];
}

export interface StatementLine {
  readonly dealId: string;
  readonly kind: SplitRuleKind;
  readonly rateBp: BasisPoints;
  /** The pool this line was a share of, shown so a partner can check the maths. */
  readonly dealDistributable: Money;
  readonly amount: Money;
}

export interface Statement {
  readonly beneficiaryUserId: string;
  readonly currency: CurrencyCode;
  readonly lines: readonly StatementLine[];
  readonly total: Money;
}

export interface PayoutRun {
  /** One per person per currency, ordered so the same period closes identically twice. */
  readonly statements: readonly Statement[];
  /** Set aside for the team; the owner decides who it reaches. */
  readonly bonusPool: readonly Money[];
  /** What the rules did not claim. Stays with the agency, on top of the house share. */
  readonly retained: readonly Money[];
  /** Total distributable across the period, per currency. */
  readonly distributable: readonly Money[];
  /** Deals that produced nothing to split, and why. */
  readonly skipped: readonly { dealId: string; reason: 'loss' | 'no-profit' }[];
}

export class PayoutRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayoutRuleError';
  }
}

export function assertSplitRules(rules: readonly SplitRule[]): void {
  let claimed = 0;
  for (const rule of rules) {
    assertBasisPoints(rule.rateBp);
    if (rule.kind === 'partner_equity' && !rule.beneficiaryUserId) {
      throw new PayoutRuleError('A partner equity rule must name the partner it pays');
    }
    if (rule.kind !== 'partner_equity' && rule.beneficiaryUserId) {
      throw new PayoutRuleError(
        `A ${rule.kind} rule pays whoever the deal decides, so it must not name a beneficiary`,
      );
    }
    claimed += rule.rateBp;
  }
  if (claimed > 10_000) {
    throw new PayoutRuleError(
      `Split rules claim ${claimed / 100}% of profit. They cannot exceed 100%.`,
    );
  }
}

/** Who a rule pays on a given deal. Null means the bonus pool. */
function beneficiaryFor(rule: SplitRule, deal: DealContribution): string | null {
  switch (rule.kind) {
    case 'partner_equity':
      return rule.beneficiaryUserId;
    case 'manager_commission':
      // This is what makes a discount cost the account manager personally: the
      // pool they are paid from is the same pool the discount came out of.
      return deal.ownerUserId;
    case 'bonus_pool':
      return null;
  }
}

/**
 * Run the period.
 *
 * Every deal is split independently, using the rules frozen onto it, and the
 * results are then gathered per person. Splitting per deal rather than pooling
 * first is what lets a statement show its working: a partner sees each deal,
 * the pool it produced, and their share of it — which is the only form of a
 * payout number anyone can actually dispute or agree with.
 */
export function computePayouts(deals: readonly DealContribution[]): PayoutRun {
  const byBeneficiary = new Map<string, { userId: string; currency: CurrencyCode; lines: StatementLine[] }>();
  const bonusByCurrency = new Map<CurrencyCode, bigint>();
  const retainedByCurrency = new Map<CurrencyCode, bigint>();
  const distributableByCurrency = new Map<CurrencyCode, bigint>();
  const skipped: { dealId: string; reason: 'loss' | 'no-profit' }[] = [];

  const bump = (map: Map<CurrencyCode, bigint>, currency: CurrencyCode, amount: bigint) => {
    map.set(currency, (map.get(currency) ?? 0n) + amount);
  };

  for (const deal of deals) {
    assertSplitRules(deal.rules);

    const margin = computeMargin(deal.revenue, deal.directCosts, deal.houseRateBp);
    const distributable = margin.distributable;
    bump(distributableByCurrency, deal.currency, distributable.minor);

    if (distributable.minor === 0n) {
      // A loss is absorbed by the house, so there is nothing to split and
      // nobody is invoiced. Recorded rather than dropped: a partner asking why
      // a deal they worked on is missing deserves an answer on the statement.
      skipped.push({ dealId: deal.dealId, reason: margin.isLoss ? 'loss' : 'no-profit' });
      continue;
    }

    const rates = deal.rules.map((rule) => rule.rateBp);
    const { shares, remainder } = splitByBasisPoints(distributable, rates);
    bump(retainedByCurrency, deal.currency, remainder.minor);

    deal.rules.forEach((rule, index) => {
      const amount = shares[index]!;
      if (amount.minor === 0n) return;

      const beneficiary = beneficiaryFor(rule, deal);
      if (beneficiary === null) {
        bump(bonusByCurrency, deal.currency, amount.minor);
        return;
      }

      const key = `${beneficiary}|${deal.currency}`;
      const entry = byBeneficiary.get(key) ?? {
        userId: beneficiary,
        currency: deal.currency,
        lines: [],
      };
      entry.lines.push({
        dealId: deal.dealId,
        kind: rule.kind,
        rateBp: rule.rateBp,
        dealDistributable: distributable,
        amount,
      });
      byBeneficiary.set(key, entry);
    });
  }

  const statements: Statement[] = [...byBeneficiary.values()]
    .map((entry) => ({
      beneficiaryUserId: entry.userId,
      currency: entry.currency,
      lines: entry.lines,
      total: sum(entry.lines.map((line) => line.amount), entry.currency),
    }))
    // Sorted, so closing the same period twice produces byte-identical output.
    .sort(
      (a, b) =>
        a.beneficiaryUserId.localeCompare(b.beneficiaryUserId) ||
        a.currency.localeCompare(b.currency),
    );

  const asMoney = (map: Map<CurrencyCode, bigint>): Money[] =>
    [...map.entries()]
      .map(([currency, minor]) => ({ currency, minor }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    statements,
    bonusPool: asMoney(bonusByCurrency),
    retained: asMoney(retainedByCurrency),
    distributable: asMoney(distributableByCurrency),
    skipped,
  };
}

/**
 * Prove a run balances, per currency.
 *
 * Called by the close action before anything is written. If this ever fails,
 * the correct response is to refuse to close the period — an unbalanced payout
 * run is not a rounding curiosity, it is money that exists on one side of the
 * books and not the other.
 */
export function checkPayoutRunBalances(run: PayoutRun): { currency: CurrencyCode; difference: Money }[] {
  const total = (values: readonly Money[], currency: CurrencyCode): bigint =>
    values.find((value) => value.currency === currency)?.minor ?? 0n;

  const currencies = new Set<CurrencyCode>(run.distributable.map((value) => value.currency));
  const faults: { currency: CurrencyCode; difference: Money }[] = [];

  for (const currency of currencies) {
    const paid = run.statements
      .filter((statement) => statement.currency === currency)
      .reduce((running, statement) => running + statement.total.minor, 0n);
    const difference =
      total(run.distributable, currency) -
      (paid + total(run.bonusPool, currency) + total(run.retained, currency));
    if (difference !== 0n) faults.push({ currency, difference: { currency, minor: difference } });
  }
  return faults;
}

/** An empty run, for a period with nothing closed in it. */
export function emptyPayoutRun(currency: CurrencyCode): PayoutRun {
  return {
    statements: [],
    bonusPool: [zero(currency)],
    retained: [zero(currency)],
    distributable: [zero(currency)],
    skipped: [],
  };
}
