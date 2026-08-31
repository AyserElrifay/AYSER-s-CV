import { describe, expect, it } from 'vitest';
import {
  type DealContribution,
  type SplitRule,
  PayoutRuleError,
  assertSplitRules,
  checkPayoutRunBalances,
  computePayouts,
} from './payouts';
import { type CurrencyCode } from './currency';
import { fromMajor, toMajorString } from './money';

const egp = (v: string) => fromMajor(v, 'EGP');

const AMIRA = 'user-amira';
const OMAR = 'user-omar';
const NOUR = 'user-nour';

const rule = (
  id: string,
  kind: SplitRule['kind'],
  rateBp: number,
  beneficiaryUserId: string | null = null,
): SplitRule => ({ id, kind, rateBp, beneficiaryUserId });

/** Two partners on 30/20, the deal's manager on 25, 10 to the bonus pool. */
const HOUSE_RULES: SplitRule[] = [
  rule('r1', 'partner_equity', 3_000, AMIRA),
  rule('r2', 'partner_equity', 2_000, OMAR),
  rule('r3', 'manager_commission', 2_500),
  rule('r4', 'bonus_pool', 1_000),
];

function deal(
  overrides: Partial<DealContribution> & Pick<DealContribution, 'dealId'>,
): DealContribution {
  return {
    ownerUserId: NOUR,
    currency: 'EGP' as CurrencyCode,
    revenue: egp('100000.00'),
    directCosts: egp('40000.00'),
    houseRateBp: 5_000,
    rules: HOUSE_RULES,
    ...overrides,
  };
}

const statementFor = (run: ReturnType<typeof computePayouts>, userId: string) =>
  run.statements.find((s) => s.beneficiaryUserId === userId);

describe('assertSplitRules', () => {
  it('accepts a well-formed policy', () => {
    expect(() => assertSplitRules(HOUSE_RULES)).not.toThrow();
    expect(() => assertSplitRules([])).not.toThrow();
  });

  it('refuses to hand out more profit than exists', () => {
    expect(() =>
      assertSplitRules([rule('a', 'partner_equity', 6_000, AMIRA), rule('b', 'bonus_pool', 5_000)]),
    ).toThrow(PayoutRuleError);
    expect(() =>
      assertSplitRules([rule('a', 'partner_equity', 6_000, AMIRA), rule('b', 'bonus_pool', 5_000)]),
    ).toThrow(/110%|cannot exceed/);
  });

  it('requires a partner equity rule to name its partner', () => {
    expect(() => assertSplitRules([rule('a', 'partner_equity', 1_000, null)])).toThrow(
      PayoutRuleError,
    );
  });

  it('refuses a commission or pool rule that names one', () => {
    // These pay whoever the deal decides; naming somebody would be a lie the
    // engine would then have to honour.
    expect(() => assertSplitRules([rule('a', 'manager_commission', 1_000, AMIRA)])).toThrow(
      PayoutRuleError,
    );
    expect(() => assertSplitRules([rule('a', 'bonus_pool', 1_000, AMIRA)])).toThrow(
      PayoutRuleError,
    );
  });
});

describe('a single deal', () => {
  it('splits the distributable and nothing else', () => {
    // 100,000 revenue − 40,000 cost = 60,000 profit. Half is the house rate, so
    // 30,000 is distributable and only that reaches the rules.
    const run = computePayouts([deal({ dealId: 'd1' })]);

    expect(toMajorString(run.distributable[0]!)).toBe('30000.00');
    expect(toMajorString(statementFor(run, AMIRA)!.total)).toBe('9000.00'); // 30%
    expect(toMajorString(statementFor(run, OMAR)!.total)).toBe('6000.00'); // 20%
    expect(toMajorString(statementFor(run, NOUR)!.total)).toBe('7500.00'); // 25% commission
    expect(toMajorString(run.bonusPool[0]!)).toBe('3000.00'); // 10%
    expect(toMajorString(run.retained[0]!)).toBe('4500.00'); // the unclaimed 15%
  });

  it('balances exactly', () => {
    expect(checkPayoutRunBalances(computePayouts([deal({ dealId: 'd1' })]))).toEqual([]);
  });

  it('pays the commission to whoever owns the deal', () => {
    const run = computePayouts([deal({ dealId: 'd1', ownerUserId: AMIRA })]);
    // Amira is a partner and closed this one herself, so both lines are hers.
    const hers = statementFor(run, AMIRA)!;
    expect(hers.lines.map((l) => l.kind).sort()).toEqual(['manager_commission', 'partner_equity']);
    expect(toMajorString(hers.total)).toBe('16500.00'); // 9,000 + 7,500
    expect(statementFor(run, NOUR)).toBeUndefined();
  });

  it('shows its working on every line', () => {
    const run = computePayouts([deal({ dealId: 'd1' })]);
    const line = statementFor(run, AMIRA)!.lines[0]!;
    expect(line.dealId).toBe('d1');
    expect(line.rateBp).toBe(3_000);
    // The pool the share came out of, so the arithmetic can be checked by hand.
    expect(toMajorString(line.dealDistributable)).toBe('30000.00');
  });
});

describe('a deal that made no money', () => {
  it('pays nobody and invoices nobody', () => {
    const run = computePayouts([
      deal({ dealId: 'loss', revenue: egp('10000.00'), directCosts: egp('25000.00') }),
    ]);
    expect(run.statements).toEqual([]);
    expect(run.skipped).toEqual([{ dealId: 'loss', reason: 'loss' }]);
    // The house absorbed it; no partner receives a bill.
    expect(toMajorString(run.distributable[0]!)).toBe('0.00');
  });

  it('records a break-even deal rather than dropping it silently', () => {
    const run = computePayouts([
      deal({ dealId: 'flat', revenue: egp('40000.00'), directCosts: egp('40000.00') }),
    ]);
    expect(run.skipped).toEqual([{ dealId: 'flat', reason: 'no-profit' }]);
  });

  it('still balances when every deal lost money', () => {
    const run = computePayouts([
      deal({ dealId: 'l1', revenue: egp('1000.00'), directCosts: egp('9000.00') }),
      deal({ dealId: 'l2', revenue: egp('500.00'), directCosts: egp('7000.00') }),
    ]);
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });
});

describe('a period of many deals', () => {
  it('gathers each person into one statement', () => {
    const run = computePayouts([
      deal({ dealId: 'd1' }),
      deal({ dealId: 'd2', revenue: egp('50000.00'), directCosts: egp('20000.00') }),
      deal({ dealId: 'd3', ownerUserId: AMIRA, revenue: egp('80000.00'), directCosts: egp('30000.00') }),
    ]);

    const amira = statementFor(run, AMIRA)!;
    expect(amira.lines).toHaveLength(4); // equity on all three, plus her own commission
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });

  it('never loses a piastre across an awkward set', () => {
    const run = computePayouts([
      deal({ dealId: 'a', revenue: egp('33333.33'), directCosts: egp('11111.11') }),
      deal({ dealId: 'b', revenue: egp('7777.77'), directCosts: egp('1234.56') }),
      deal({ dealId: 'c', revenue: egp('0.03'), directCosts: egp('0.01') }),
    ]);
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });

  it('balances across a thousand generated periods', () => {
    // Deterministic pseudo-random, so a failure is reproducible rather than a
    // haunting. This is the invariant the whole engine exists to hold.
    let seed = 20260831;
    const next = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };

    for (let round = 0; round < 1000; round++) {
      const deals: DealContribution[] = [];
      for (let i = 0; i < 1 + next(6); i++) {
        deals.push(
          deal({
            dealId: `d${i}`,
            ownerUserId: [AMIRA, OMAR, NOUR][next(3)]!,
            revenue: { currency: 'EGP', minor: BigInt(next(5_000_000)) },
            directCosts: { currency: 'EGP', minor: BigInt(next(5_000_000)) },
            houseRateBp: next(10_001),
          }),
        );
      }
      const run = computePayouts(deals);
      expect(checkPayoutRunBalances(run), `round ${round}`).toEqual([]);
    }
  });

  it('closes the same period identically twice', () => {
    const period = [deal({ dealId: 'd1' }), deal({ dealId: 'd2', ownerUserId: OMAR })];
    expect(JSON.stringify(computePayouts(period), replacer)).toBe(
      JSON.stringify(computePayouts(period), replacer),
    );
  });
});

describe('more than one currency', () => {
  it('keeps a statement per currency rather than converting', () => {
    const run = computePayouts([
      deal({ dealId: 'eg' }),
      deal({
        dealId: 'sa',
        currency: 'SAR',
        revenue: fromMajor('50000.00', 'SAR'),
        directCosts: fromMajor('20000.00', 'SAR'),
      }),
    ]);

    const amiras = run.statements.filter((s) => s.beneficiaryUserId === AMIRA);
    expect(amiras.map((s) => s.currency).sort()).toEqual(['EGP', 'SAR']);
    // No FX guess anywhere: two currencies, two statements, both exact.
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });
});

describe('the rules the owner set', () => {
  it('retains everything when there are no rules yet', () => {
    const run = computePayouts([deal({ dealId: 'd1', rules: [] })]);
    expect(run.statements).toEqual([]);
    expect(toMajorString(run.retained[0]!)).toBe('30000.00');
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });

  it('retains nothing when the rules claim all of it', () => {
    const run = computePayouts([
      deal({
        dealId: 'd1',
        rules: [
          rule('a', 'partner_equity', 5_000, AMIRA),
          rule('b', 'partner_equity', 5_000, OMAR),
        ],
      }),
    ]);
    expect(toMajorString(run.retained[0]!)).toBe('0.00');
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });

  it('splits an indivisible remainder rather than dropping it', () => {
    // 0.03 distributable across three equal partners.
    const run = computePayouts([
      deal({
        dealId: 'tiny',
        revenue: egp('0.06'),
        directCosts: egp('0.00'),
        houseRateBp: 5_000,
        rules: [
          rule('a', 'partner_equity', 3_333, AMIRA),
          rule('b', 'partner_equity', 3_333, OMAR),
          rule('c', 'partner_equity', 3_334, NOUR),
        ],
      }),
    ]);
    const paid = run.statements.reduce((total, s) => total + s.total.minor, 0n);
    expect(paid + run.retained[0]!.minor).toBe(3n);
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });

  it('uses the rules frozen on each deal, not one policy for the period', () => {
    // February closed at 30% for Amira. In March the owner cut it to 10%. The
    // February deal keeps February's number, because that is what was agreed
    // and, quite possibly, already paid.
    const february = deal({
      dealId: 'feb',
      rules: [rule('a', 'partner_equity', 3_000, AMIRA)],
    });
    const march = deal({
      dealId: 'mar',
      rules: [rule('a', 'partner_equity', 1_000, AMIRA)],
    });
    const run = computePayouts([february, march]);
    const lines = statementFor(run, AMIRA)!.lines;
    expect(lines.find((l) => l.dealId === 'feb')!.rateBp).toBe(3_000);
    expect(lines.find((l) => l.dealId === 'mar')!.rateBp).toBe(1_000);
    expect(toMajorString(statementFor(run, AMIRA)!.total)).toBe('12000.00'); // 9,000 + 3,000
  });

  it('refuses a deal whose frozen rules are impossible', () => {
    expect(() =>
      computePayouts([
        deal({ dealId: 'bad', rules: [rule('a', 'partner_equity', 12_000, AMIRA)] }),
      ]),
    ).toThrow();
  });
});

describe('an empty period', () => {
  it('produces nothing and balances', () => {
    const run = computePayouts([]);
    expect(run.statements).toEqual([]);
    expect(run.distributable).toEqual([]);
    expect(checkPayoutRunBalances(run)).toEqual([]);
  });
});

function replacer(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}
