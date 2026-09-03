import { describe, expect, it } from 'vitest';
import {
  breakEvenRevenue,
  companyMonth,
  isActiveIn,
  overheadForMonth,
  overheadsForMonth,
} from './company';
import { fromMajor, toMajorString } from './money';

const EGP = (major: string) => fromMajor(major, 'EGP');

/**
 * The month that looks good and is not.
 *
 * A studio bills 300,000 and delivers it for 150,000. Every deal card in the
 * product says 50%, everyone agrees it was a strong month, and the owner still
 * cannot work out where the money went. This is where it went.
 */
const strongLookingMonth = {
  currency: 'EGP' as const,
  revenue: EGP('300000.00'),
  directCosts: EGP('110000.00'),
  labour: EGP('40000.00'),
  earnedSplits: EGP('30000.00'),
  salaries: EGP('95000.00'),
  overheads: EGP('38000.00'),
  partnerSplits: [{ beneficiaryUserId: 'partner-1', rateBp: 3000 }],
};

describe('the month a deal card cannot see', () => {
  const month = companyMonth(strongLookingMonth);

  it('agrees with the deal cards on gross profit', () => {
    // 300,000 − 110,000 − 40,000 = 150,000. Exactly the number every card in
    // the product has been adding up all month.
    expect(toMajorString(month.grossProfit)).toBe('150000.00');
    expect(month.grossMarginBp).toBe(5000); // 50%
  });

  it('and then takes away everything the cards never knew about', () => {
    // 150,000 − 30,000 commission − 95,000 salaries − 38,000 overheads.
    expect(toMajorString(month.operatingProfit)).toBe('-13000.00');
    expect(month.isLoss).toBe(true);
  });

  it('reports a 50% month as a losing one, which it was', () => {
    /*
     * The whole argument in two numbers. Gross margin 50%; operating margin
     * −4.3%. An owner looking only at the first spends money they do not have,
     * and finds out in about four months.
     */
    expect(month.grossMarginBp).toBe(5000);
    expect(month.operatingMarginBp).toBe(-433);
  });

  it('does not hand the partner a share of a loss', () => {
    // Inventing a debt nobody agreed to is worse than showing a zero — and
    // showing zero next to a visible loss is not hiding anything.
    expect(toMajorString(month.partnerShares[0]!.amount)).toBe('0.00');
    expect(toMajorString(month.retained)).toBe('-13000.00');
  });
});

describe('a month that actually worked', () => {
  const month = companyMonth({ ...strongLookingMonth, revenue: EGP('420000.00') });

  it('leaves something after everything', () => {
    // 420,000 − 110,000 − 40,000 = 270,000 gross; less 30,000, 95,000, 38,000.
    expect(toMajorString(month.grossProfit)).toBe('270000.00');
    expect(toMajorString(month.operatingProfit)).toBe('107000.00');
    expect(month.isLoss).toBe(false);
  });

  it('gives the partner their share and keeps the rest', () => {
    expect(toMajorString(month.partnerShares[0]!.amount)).toBe('32100.00'); // 30%
    expect(toMajorString(month.retained)).toBe('74900.00');
  });

  it('adds the parts back to the whole, to the minor unit', () => {
    const paid = month.partnerShares.reduce((total, share) => total + share.amount.minor, 0n);
    expect(paid + month.retained.minor).toBe(month.operatingProfit.minor);
  });
});

describe('splitting between partners', () => {
  it('allocates by largest remainder, so nothing is lost to rounding', () => {
    /*
     * Three partners on a third each, of a profit that does not divide by three.
     * Two get the extra minor unit and one does not, and the three shares are
     * exactly the amount being split — which is the only property that matters.
     */
    const month = companyMonth({
      ...strongLookingMonth,
      revenue: EGP('420000.01'),
      partnerSplits: [
        { beneficiaryUserId: 'a', rateBp: 3333 },
        { beneficiaryUserId: 'b', rateBp: 3333 },
        { beneficiaryUserId: 'c', rateBp: 3334 },
      ],
    });
    const paid = month.partnerShares.reduce((total, share) => total + share.amount.minor, 0n);
    expect(paid + month.retained.minor).toBe(month.operatingProfit.minor);
    // Claimed in full, so nothing is retained beyond the rounding.
    expect(month.retained.minor).toBe(0n);
  });

  it('keeps the remainder when the partners do not claim all of it', () => {
    const month = companyMonth({
      ...strongLookingMonth,
      revenue: EGP('420000.00'),
      partnerSplits: [{ beneficiaryUserId: 'a', rateBp: 1000 }],
    });
    expect(toMajorString(month.partnerShares[0]!.amount)).toBe('10700.00');
    expect(toMajorString(month.retained)).toBe('96300.00');
  });

  it('retains everything when there are no partners', () => {
    const month = companyMonth({
      ...strongLookingMonth,
      revenue: EGP('420000.00'),
      partnerSplits: [],
    });
    expect(toMajorString(month.retained)).toBe('107000.00');
  });
});

describe('a month with no revenue', () => {
  const month = companyMonth({
    ...strongLookingMonth,
    revenue: EGP('0.00'),
    directCosts: EGP('0.00'),
    labour: EGP('0.00'),
    earnedSplits: EGP('0.00'),
  });

  it('has no margin rather than a margin of zero', () => {
    // A quiet month did not achieve 0%. It has no ratio at all, and printing
    // "0%" would be the interface answering a question nobody asked.
    expect(month.grossMarginBp).toBeNull();
    expect(month.operatingMarginBp).toBeNull();
  });

  it('still costs what it costs', () => {
    expect(toMajorString(month.operatingProfit)).toBe('-133000.00');
  });
});

describe('what an overhead costs a month', () => {
  const rent = {
    amountMinor: 1800000n, // 18,000.00 a month
    currency: 'EGP' as const,
    cadence: 'monthly' as const,
    activeFrom: '2026-01-01',
    activeTo: null,
  };
  const software = { ...rent, amountMinor: 1200000n, cadence: 'yearly' as const };

  it('charges a monthly cost every month', () => {
    expect(toMajorString(overheadForMonth(rent, '2026-03'))).toBe('18000.00');
  });

  it('spreads a yearly bill across the year', () => {
    /*
     * Deliberate, and worth stating: a 12,000 annual licence paid in January
     * would otherwise make January look terrible and the other eleven look
     * better than they were. What left the bank in January is a different
     * question, and the ledger answers it.
     */
    expect(toMajorString(overheadForMonth(software, '2026-07'))).toBe('1000.00');
  });

  it('spreads a quarterly bill across three months', () => {
    expect(
      toMajorString(overheadForMonth({ ...rent, cadence: 'quarterly', amountMinor: 900000n }, '2026-05')),
    ).toBe('3000.00');
  });

  it('lands a one-off entirely in its own month', () => {
    const camera = { ...rent, cadence: 'one_off' as const, activeFrom: '2026-04-11' };
    expect(toMajorString(overheadForMonth(camera, '2026-04'))).toBe('18000.00');
    expect(toMajorString(overheadForMonth(camera, '2026-05'))).toBe('0.00');
  });

  it('costs nothing before it started or after it ended', () => {
    const office = { ...rent, activeFrom: '2026-02-01', activeTo: '2026-05-31' };
    expect(isActiveIn(office, '2026-01')).toBe(false);
    expect(isActiveIn(office, '2026-02')).toBe(true);
    expect(isActiveIn(office, '2026-05')).toBe(true);
    expect(isActiveIn(office, '2026-06')).toBe(false);
    // An office left in May was a real cost in April, and April keeps saying so.
    expect(toMajorString(overheadForMonth(office, '2026-04'))).toBe('18000.00');
    expect(toMajorString(overheadForMonth(office, '2026-06'))).toBe('0.00');
  });

  it('totals only the ones in the month’s own currency', () => {
    const euroThing = { ...rent, currency: 'EUR' as const, amountMinor: 50000n };
    expect(toMajorString(overheadsForMonth([rent, software, euroThing], '2026-03', 'EGP'))).toBe(
      '19000.00',
    );
  });
});

describe('what has to be earned before anybody takes anything', () => {
  it('turns "we need more work" into a number', () => {
    // 133,000 of salaries and overheads, at a 50% gross margin, needs 266,000
    // of revenue before the month breaks even.
    expect(toMajorString(breakEvenRevenue(EGP('133000.00'), 5000)!)).toBe('266000.00');
  });

  it('has no answer when there is no margin to earn it with', () => {
    expect(breakEvenRevenue(EGP('133000.00'), null)).toBeNull();
    expect(breakEvenRevenue(EGP('133000.00'), 0)).toBeNull();
    // A negative margin cannot reach break-even by selling more of it.
    expect(breakEvenRevenue(EGP('133000.00'), -400)).toBeNull();
  });
});
