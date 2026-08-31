import { describe, expect, it } from 'vitest';
import {
  CostTemplateError,
  costDriftBasisPoints,
  costPosition,
  costTemplateTotal,
  effectiveCost,
  priceCostTemplate,
} from './costs';
import { CurrencyMismatchError, fromMajor, toMajorString } from './money';
import { computeMargin } from './margin';

const egp = (v: string) => fromMajor(v, 'EGP');

describe('effectiveCost', () => {
  it('keeps the estimate while spending is under it', () => {
    // Three of five invoices in does not mean the deal came in cheap.
    expect(toMajorString(effectiveCost(egp('15000.00'), egp('6000.00')))).toBe('15000.00');
    expect(toMajorString(effectiveCost(egp('15000.00'), egp('0.00')))).toBe('15000.00');
  });

  it('takes over once spending passes the estimate', () => {
    expect(toMajorString(effectiveCost(egp('15000.00'), egp('19000.00')))).toBe('19000.00');
  });

  it('is indifferent at the boundary', () => {
    expect(toMajorString(effectiveCost(egp('15000.00'), egp('15000.00')))).toBe('15000.00');
  });
});

describe('costDriftBasisPoints', () => {
  it('measures overspend as a share of the estimate', () => {
    expect(costDriftBasisPoints(egp('10000.00'), egp('12000.00'))).toBe(2_000); // +20%
    expect(costDriftBasisPoints(egp('10000.00'), egp('10000.00'))).toBe(0);
    expect(costDriftBasisPoints(egp('10000.00'), egp('25000.00'))).toBe(15_000); // +150%
  });

  it('goes negative when a quote was cautious', () => {
    expect(costDriftBasisPoints(egp('10000.00'), egp('7500.00'))).toBe(-2_500);
    expect(costDriftBasisPoints(egp('10000.00'), egp('0.00'))).toBe(-10_000);
  });

  it('is null against an estimate of nothing, not infinite', () => {
    // Spending 8,000 against an estimate of zero is an un-estimated deal, not
    // a drift of infinity, and the card has to be able to say so.
    expect(costDriftBasisPoints(egp('0.00'), egp('8000.00'))).toBeNull();
    expect(costDriftBasisPoints(egp('0.00'), egp('0.00'))).toBeNull();
  });

  it('refuses to compare two currencies', () => {
    expect(() => costDriftBasisPoints(egp('1.00'), fromMajor('1.00', 'USD'))).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe('costPosition', () => {
  it('alerts once overspend crosses the threshold', () => {
    const under = costPosition(egp('10000.00'), egp('11400.00'), 1_500);
    const over = costPosition(egp('10000.00'), egp('11500.00'), 1_500);
    expect(under.alerting).toBe(false);
    expect(over.alerting).toBe(true); // the boundary itself alerts
  });

  it('does not alert on coming in under budget', () => {
    // Worth showing, not worth an alarm: a cautious quote does not mean a
    // margin on a card has stopped being true.
    const frugal = costPosition(egp('10000.00'), egp('4000.00'), 1_500);
    expect(frugal.driftBasisPoints).toBe(-6_000);
    expect(frugal.alerting).toBe(false);
  });

  it('never alerts on an un-estimated deal', () => {
    expect(costPosition(egp('0.00'), egp('9000.00'), 1_500).alerting).toBe(false);
  });

  it('reports the variance as money, in both directions', () => {
    expect(toMajorString(costPosition(egp('10000.00'), egp('12500.00'), 1_500).variance)).toBe(
      '2500.00',
    );
    expect(toMajorString(costPosition(egp('10000.00'), egp('7500.00'), 1_500).variance)).toBe(
      '-2500.00',
    );
  });

  it('refuses to mix currencies', () => {
    expect(() => costPosition(egp('1.00'), fromMajor('1.00', 'USD'), 1_500)).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe('what the actuals do to the margin', () => {
  it('leaves the margin on the estimate while spending is under it', () => {
    const position = costPosition(egp('15000.00'), egp('6000.00'), 1_500);
    const margin = computeMargin(egp('75000.00'), position.effective, 5_000);
    expect(margin.marginBasisPoints).toBe(8_000); // 80%, on the estimate
  });

  it('recomputes the margin once the estimate is disproved', () => {
    // The deal was reporting 80%. Then the shoot ran two days over.
    const optimistic = computeMargin(egp('75000.00'), egp('15000.00'), 5_000);
    expect(optimistic.marginBasisPoints).toBe(8_000);

    const position = costPosition(egp('15000.00'), egp('41000.00'), 1_500);
    const honest = computeMargin(egp('75000.00'), position.effective, 5_000);
    expect(position.alerting).toBe(true);
    expect(honest.marginBasisPoints).toBe(4_533); // 45.3%
    expect(toMajorString(honest.distributable)).toBe('17000.00');

    // The pool the account manager is paid from halved, and it halved because
    // of what was spent, not because anyone re-quoted.
    expect(optimistic.distributable.minor - honest.distributable.minor).toBe(1_300_000n);
  });

  it('can turn a deal that looked healthy into a loss', () => {
    const position = costPosition(egp('15000.00'), egp('90000.00'), 1_500);
    const margin = computeMargin(egp('75000.00'), position.effective, 5_000);
    expect(margin.isLoss).toBe(true);
    // And the house eats it: no freelancer is invoiced for a bad shoot.
    expect(toMajorString(margin.distributable)).toBe('0.00');
    expect(toMajorString(margin.houseShare)).toBe('-15000.00');
  });
});

describe('pricing a cost template', () => {
  const line = (label: string, amount: string, quantity: number, unit: 'day' | 'item' = 'day') => ({
    label,
    labelAr: label,
    amount,
    quantity,
    unit,
  });

  it('multiplies each line by its units and sums them exactly', () => {
    const { rows, total } = priceCostTemplate(
      [
        line('Director', '4000.00', 1),
        line('Editor', '900.00', 4),
        line('Location', '2000.00', 1, 'item'),
      ],
      'EGP',
    );
    expect(rows.map((r) => toMajorString(r.total))).toEqual(['4000.00', '3600.00', '2000.00']);
    expect(toMajorString(total)).toBe('9600.00');
  });

  it('keeps the rate alongside the total, so the line can be read back', () => {
    const { rows } = priceCostTemplate([line('Editor', '900.00', 4)], 'EGP');
    expect(toMajorString(rows[0]!.rate)).toBe('900.00');
    expect(rows[0]!.line.unit).toBe('day');
  });

  it('totals an empty template to nothing rather than throwing', () => {
    expect(toMajorString(costTemplateTotal([], 'EGP'))).toBe('0.00');
  });

  it('handles a zero-quantity line without dropping it', () => {
    // A line the agency has turned off for this deal still belongs on the sheet.
    const { rows, total } = priceCostTemplate([line('Talent', '3000.00', 0)], 'EGP');
    expect(rows).toHaveLength(1);
    expect(toMajorString(total)).toBe('0.00');
  });

  it('refuses a fractional or negative quantity', () => {
    expect(() => priceCostTemplate([line('Editor', '900.00', 2.5)], 'EGP')).toThrow(
      CostTemplateError,
    );
    expect(() => priceCostTemplate([line('Editor', '900.00', -1)], 'EGP')).toThrow(
      CostTemplateError,
    );
  });

  it('names the line it is complaining about', () => {
    expect(() => priceCostTemplate([line('Sound recordist', '900.00', 1.5)], 'EGP')).toThrow(
      /Sound recordist/,
    );
  });

  it('refuses an amount that is not a plain decimal', () => {
    expect(() => priceCostTemplate([line('Editor', '9,00', 1)], 'EGP')).toThrow();
  });

  it('respects the currency it is priced in', () => {
    // KWD has three decimal places, so the same string is a different amount.
    expect(toMajorString(costTemplateTotal([line('Editor', '1.500', 2)], 'KWD'))).toBe('3.000');
  });

  it('feeds an estimate a margin can be computed on', () => {
    const estimate = costTemplateTotal(
      [line('Director', '4000.00', 1), line('Editor', '900.00', 4)],
      'EGP',
    );
    const margin = computeMargin(egp('40000.00'), estimate, 5_000);
    expect(toMajorString(estimate)).toBe('7600.00');
    expect(margin.marginBasisPoints).toBe(8_100); // 81%
  });
});
