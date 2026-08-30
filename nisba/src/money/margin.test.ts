import { describe, expect, it } from 'vitest';
import { splitByBasisPoints } from './allocate';
import { CurrencyMismatchError, fromMajor, toMajorString } from './money';
import {
  DEFAULT_MARGIN_THRESHOLDS,
  PriceBandError,
  assertPriceBand,
  bandPositionBp,
  computeMargin,
  marginBasisPoints,
  marginHealth,
  marginSignal,
  routeForClose,
  requiresOwnerApproval,
} from './margin';

const egp = (v: string) => fromMajor(v, 'EGP');

describe('computeMargin', () => {
  it('works the headline example end to end', () => {
    // 100,000 revenue, 40,000 costs, 50% house rate.
    const m = computeMargin(egp('100000.00'), egp('40000.00'), 5_000);
    expect(toMajorString(m.grossProfit)).toBe('60000.00');
    expect(toMajorString(m.houseShare)).toBe('30000.00');
    expect(toMajorString(m.distributable)).toBe('30000.00');
    expect(m.marginBasisPoints).toBe(6_000); // 60%
    expect(m.isLoss).toBe(false);
  });

  it('always balances: house share plus distributable is the whole profit', () => {
    for (const rate of [0, 1, 3_333, 5_000, 6_667, 9_999, 10_000]) {
      const m = computeMargin(egp('12345.67'), egp('4321.09'), rate);
      expect(m.houseShare.minor + m.distributable.minor).toBe(m.grossProfit.minor);
    }
  });

  it('handles a zero-cost deal', () => {
    const m = computeMargin(egp('50000.00'), egp('0.00'), 5_000);
    expect(toMajorString(m.grossProfit)).toBe('50000.00');
    expect(m.marginBasisPoints).toBe(10_000); // 100%
    expect(marginSignal({ marginBasisPoints: m.marginBasisPoints })).toBe('healthy');
  });

  it('reports a pro-bono deal as unpriced rather than as a total loss', () => {
    const m = computeMargin(egp('0.00'), egp('0.00'), 5_000);
    expect(m.marginBasisPoints).toBeNull();
    expect(marginSignal({ marginBasisPoints: m.marginBasisPoints })).toBe('unpriced');
    expect(m.isLoss).toBe(false);
  });

  it('gives the house the whole loss and the split engine nothing', () => {
    const m = computeMargin(egp('10000.00'), egp('14000.00'), 5_000);
    expect(toMajorString(m.grossProfit)).toBe('-4000.00');
    expect(toMajorString(m.houseShare)).toBe('-4000.00');
    expect(toMajorString(m.distributable)).toBe('0.00');
    expect(m.isLoss).toBe(true);
    // A freelancer must never receive a statement asking them for money.
    expect(m.distributable.minor >= 0n).toBe(true);
  });

  it('treats break-even as not a loss', () => {
    const m = computeMargin(egp('100.00'), egp('100.00'), 5_000);
    expect(m.isLoss).toBe(false);
    expect(m.marginBasisPoints).toBe(0);
    expect(toMajorString(m.distributable)).toBe('0.00');
  });

  it('makes a discount cost the account manager their own commission', () => {
    const full = computeMargin(egp('100000.00'), egp('40000.00'), 5_000);
    const discounted = computeMargin(egp('85000.00'), egp('40000.00'), 5_000);
    // 15,000 off the price takes 7,500 off the pool the AM is paid from.
    expect(full.distributable.minor - discounted.distributable.minor).toBe(750_000n);
  });

  it('rounds the house share once, not per line', () => {
    // 33.33% of 0.01 profit is a third of a piastre.
    const m = computeMargin(egp('0.01'), egp('0.00'), 3_333);
    expect(m.houseShare.minor).toBe(0n);
    expect(m.distributable.minor).toBe(1n);
    expect(m.houseShare.minor + m.distributable.minor).toBe(m.grossProfit.minor);
  });

  it('refuses to net costs against revenue in another currency', () => {
    expect(() => computeMargin(egp('100.00'), fromMajor('100.00', 'USD'), 5_000)).toThrow(
      CurrencyMismatchError,
    );
  });

  it('rejects a house rate above 100% or below zero', () => {
    expect(() => computeMargin(egp('100.00'), egp('0.00'), 10_001)).toThrow();
    expect(() => computeMargin(egp('100.00'), egp('0.00'), -1)).toThrow();
  });
});

describe('marginBasisPoints', () => {
  it('computes the usual cases', () => {
    expect(marginBasisPoints(egp('100.00'), egp('60.00'))).toBe(4_000);
    expect(marginBasisPoints(egp('100.00'), egp('0.00'))).toBe(10_000);
    expect(marginBasisPoints(egp('100.00'), egp('100.00'))).toBe(0);
  });

  it('goes negative on a loss', () => {
    expect(marginBasisPoints(egp('100.00'), egp('150.00'))).toBe(-5_000);
    expect(marginBasisPoints(egp('1.00'), egp('101.00'))).toBe(-1_000_000); // -10000%
  });

  it('is null, never a division by zero, on zero revenue', () => {
    expect(marginBasisPoints(egp('0.00'), egp('0.00'))).toBeNull();
    expect(marginBasisPoints(egp('0.00'), egp('500.00'))).toBeNull();
  });
});

describe('marginSignal', () => {
  const band = { floor: egp('50000.00'), target: egp('75000.00'), ceiling: egp('100000.00') };

  it('reads the margin when there is no band to consult', () => {
    const at = (bp: number | null) => marginSignal({ marginBasisPoints: bp });
    expect(at(6_000)).toBe('healthy');
    expect(at(4_000)).toBe('healthy'); // the boundary is inclusive
    expect(at(3_999)).toBe('thin');
    expect(at(2_000)).toBe('thin');
    expect(at(1_999)).toBe('below-floor');
    expect(at(-5_000)).toBe('below-floor');
    expect(at(null)).toBe('unpriced');
  });

  it('lets the floor decide once there is a band, whatever the margin says', () => {
    // A fat margin on a price sold under the floor is still under the floor.
    // Usually it means the cost estimate is optimistic, which is precisely when
    // the interface should be saying something.
    expect(
      marginSignal({ marginBasisPoints: 9_000, price: egp('49999.99'), band }),
    ).toBe('below-floor');
    expect(marginSignal({ marginBasisPoints: 9_000, price: egp('50000.00'), band })).toBe(
      'healthy',
    );
  });

  it('does not call a thin deal red just because it is thin, once a band exists', () => {
    // 5% margin, but sold above the floor: thin, not below-floor. The floor is
    // the agency's own line and this price respects it.
    expect(marginSignal({ marginBasisPoints: 500, price: egp('60000.00'), band })).toBe('thin');
  });

  it('respects thresholds an org has moved', () => {
    const strict = { healthyFromBp: 6_000, warningFromBp: 4_500 };
    expect(marginSignal({ marginBasisPoints: 5_000, thresholds: strict })).toBe('thin');
    expect(
      marginSignal({ marginBasisPoints: 5_000, thresholds: DEFAULT_MARGIN_THRESHOLDS }),
    ).toBe('healthy');
  });

  it('reports an unpriced deal as unpriced, not as below the floor', () => {
    expect(marginSignal({ marginBasisPoints: null, price: egp('60000.00'), band })).toBe(
      'unpriced',
    );
  });
});

describe('the price band', () => {
  const band = { floor: egp('50000.00'), target: egp('75000.00'), ceiling: egp('100000.00') };

  it('accepts a well-ordered band', () => {
    expect(assertPriceBand(band)).toBe(band);
  });

  it('rejects a band that is out of order, mixed-currency, or negative', () => {
    expect(() =>
      assertPriceBand({ ...band, floor: egp('80000.00') }),
    ).toThrow(PriceBandError);
    expect(() =>
      assertPriceBand({ ...band, ceiling: egp('60000.00') }),
    ).toThrow(PriceBandError);
    expect(() =>
      assertPriceBand({ ...band, ceiling: fromMajor('100000.00', 'USD') }),
    ).toThrow(PriceBandError);
    expect(() =>
      assertPriceBand({ floor: egp('-1.00'), target: egp('0.00'), ceiling: egp('1.00') }),
    ).toThrow(PriceBandError);
  });

  it('routes a below-floor price to the owner instead of closing', () => {
    expect(requiresOwnerApproval(egp('49999.99'), band)).toBe(true);
    expect(requiresOwnerApproval(egp('50000.00'), band)).toBe(false);
    expect(requiresOwnerApproval(egp('120000.00'), band)).toBe(false);
  });

  it('places the slider handle', () => {
    expect(bandPositionBp(egp('50000.00'), band)).toBe(0);
    expect(bandPositionBp(egp('100000.00'), band)).toBe(10_000);
    expect(bandPositionBp(egp('75000.00'), band)).toBe(5_000);
    expect(bandPositionBp(egp('62500.00'), band)).toBe(2_500);
  });

  it('clamps the handle outside the band rather than running off the track', () => {
    expect(bandPositionBp(egp('10.00'), band)).toBe(0);
    expect(bandPositionBp(egp('500000.00'), band)).toBe(10_000);
  });

  it('survives a band with no width', () => {
    const fixed = { floor: egp('100.00'), target: egp('100.00'), ceiling: egp('100.00') };
    expect(bandPositionBp(egp('100.00'), fixed)).toBe(0);
    expect(bandPositionBp(egp('150.00'), fixed)).toBe(10_000);
  });
});

describe('a rule change mid-period', () => {
  it('leaves a closed deal exactly as it was closed', () => {
    // February: house takes 50%, two partners split the rest 60/40.
    const closedInFebruary = {
      revenue: egp('100000.00'),
      costs: egp('40000.00'),
      houseRate: 5_000,
      splits: [6_000, 4_000],
    };
    const february = computeMargin(
      closedInFebruary.revenue,
      closedInFebruary.costs,
      closedInFebruary.houseRate,
    );
    const februaryShares = splitByBasisPoints(february.distributable, closedInFebruary.splits);
    expect(toMajorString(februaryShares.shares[0]!)).toBe('18000.00');
    expect(toMajorString(februaryShares.shares[1]!)).toBe('12000.00');

    // March: the owner raises the house rate to 70%. The February deal was
    // frozen with its own rate, so recomputing it from the record reproduces
    // the same statement — the new rate has no reach backwards.
    const marchHouseRate = 7_000;
    const recomputed = computeMargin(
      closedInFebruary.revenue,
      closedInFebruary.costs,
      closedInFebruary.houseRate, // the frozen value, not marchHouseRate
    );
    const recomputedShares = splitByBasisPoints(recomputed.distributable, closedInFebruary.splits);
    expect(recomputedShares.shares.map((s) => s.minor)).toEqual(
      februaryShares.shares.map((s) => s.minor),
    );

    // And to show the difference the freeze is preventing:
    const ifItHadDrifted = computeMargin(
      closedInFebruary.revenue,
      closedInFebruary.costs,
      marchHouseRate,
    );
    expect(toMajorString(ifItHadDrifted.distributable)).toBe('18000.00');
    expect(ifItHadDrifted.distributable.minor).not.toBe(february.distributable.minor);
  });
});

describe('marginHealth', () => {
  it('reports the margin and nothing else', () => {
    expect(marginHealth(6_000)).toBe('healthy');
    expect(marginHealth(4_000)).toBe('healthy'); // inclusive boundary
    expect(marginHealth(3_999)).toBe('thin');
    expect(marginHealth(1)).toBe('thin');
    expect(marginHealth(0)).toBe('thin'); // break-even is thin, not a loss
    expect(marginHealth(-1)).toBe('loss');
    expect(marginHealth(null)).toBe('unpriced');
  });

  it('does not care where the price sits in the band', () => {
    // The whole reason this is separate from marginSignal: a deal sold under
    // the floor can still be carrying a healthy margin, and colouring that bar
    // red would be the interface telling a lie about the profit.
    const band = { floor: egp('50000.00'), target: egp('75000.00'), ceiling: egp('100000.00') };
    const underFloorButFat = computeMargin(egp('42000.00'), egp('15000.00'), 5_000);

    expect(marginSignal({ marginBasisPoints: underFloorButFat.marginBasisPoints, price: egp('42000.00'), band })).toBe(
      'below-floor',
    );
    expect(marginHealth(underFloorButFat.marginBasisPoints)).toBe('healthy');
  });

  it('respects thresholds an org has moved', () => {
    expect(marginHealth(5_000, { healthyFromBp: 6_000, warningFromBp: 4_500 })).toBe('thin');
  });
});

describe('routeForClose', () => {
  const band = { floor: egp('50000.00'), target: egp('75000.00'), ceiling: egp('100000.00') };

  it('closes at or above the floor', () => {
    expect(routeForClose(egp('50000.00'), band)).toBe('close');
    expect(routeForClose(egp('75000.00'), band)).toBe('close');
    expect(routeForClose(egp('999999.00'), band)).toBe('close');
  });

  it('routes to the owner below the floor, by any amount', () => {
    expect(routeForClose(egp('49999.99'), band)).toBe('owner-approval');
    expect(routeForClose(egp('0.00'), band)).toBe('owner-approval');
  });

  it('closes when there is no band to be under', () => {
    expect(routeForClose(egp('1.00'), null)).toBe('close');
  });

  it('closes rather than comparing a band quoted in another currency', () => {
    const usdBand = {
      floor: fromMajor('50000.00', 'USD'),
      target: fromMajor('75000.00', 'USD'),
      ceiling: fromMajor('100000.00', 'USD'),
    };
    // 40,000 EGP is far under 50,000 USD numerically, but the comparison is
    // meaningless, so it must not be made.
    expect(routeForClose(egp('40000.00'), usdBand)).toBe('close');
  });
});
