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
  marginState,
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
    expect(marginState(m.marginBasisPoints)).toBe('healthy');
  });

  it('reports a pro-bono deal as unpriced rather than as a total loss', () => {
    const m = computeMargin(egp('0.00'), egp('0.00'), 5_000);
    expect(m.marginBasisPoints).toBeNull();
    expect(marginState(m.marginBasisPoints)).toBe('unpriced');
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

describe('marginState', () => {
  it('uses the default thresholds', () => {
    expect(marginState(6_000)).toBe('healthy');
    expect(marginState(4_000)).toBe('healthy'); // boundary is inclusive
    expect(marginState(3_999)).toBe('warning');
    expect(marginState(2_000)).toBe('warning');
    expect(marginState(1_999)).toBe('critical');
    expect(marginState(-5_000)).toBe('critical');
    expect(marginState(null)).toBe('unpriced');
  });

  it('respects thresholds an org has moved', () => {
    const strict = { healthyFromBp: 6_000, warningFromBp: 4_500 };
    expect(marginState(5_000, strict)).toBe('warning');
    expect(marginState(5_000, DEFAULT_MARGIN_THRESHOLDS)).toBe('healthy');
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
