import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY, DEFAULT_SERVICES } from './service-catalog';
import {
  computeMargin,
  costTemplateTotal,
  fromMajor,
  greaterThanOrEqual,
  lessThanOrEqual,
  priceCostTemplate,
  toMajorString,
} from '@/money';

/**
 * The seeded catalogue is the first thing a new agency sees, and its numbers
 * have to hold together before anyone edits them. A template that totals outside
 * its own service's cost range would put a contradiction on screen on day one.
 */
describe('every seeded service', () => {
  it.each(DEFAULT_SERVICES.map((service) => [service.name, service] as const))(
    '%s: the cost build-up totals inside its own range',
    (_name, service) => {
      const total = costTemplateTotal(service.costs, DEFAULT_CURRENCY);
      const floor = fromMajor(service.costMin, DEFAULT_CURRENCY);
      const ceiling = fromMajor(service.costMax, DEFAULT_CURRENCY);
      expect(greaterThanOrEqual(total, floor), `${toMajorString(total)} < ${service.costMin}`).toBe(
        true,
      );
      expect(lessThanOrEqual(total, ceiling), `${toMajorString(total)} > ${service.costMax}`).toBe(
        true,
      );
    },
  );

  it.each(DEFAULT_SERVICES.map((service) => [service.name, service] as const))(
    '%s: still makes money at its own floor price',
    (_name, service) => {
      // The floor is the price the owner said never to go under. If delivering
      // at that price loses money, the band itself is wrong and the product
      // would be routing people to approval for a deal that can never work.
      const margin = computeMargin(
        fromMajor(service.floor, DEFAULT_CURRENCY),
        costTemplateTotal(service.costs, DEFAULT_CURRENCY),
        5_000,
      );
      expect(margin.isLoss).toBe(false);
      expect(margin.marginBasisPoints).toBeGreaterThan(0);
    },
  );

  it.each(DEFAULT_SERVICES.map((service) => [service.name, service] as const))(
    '%s: every cost line is priceable and named in both languages',
    (_name, service) => {
      expect(service.costs.length).toBeGreaterThan(0);
      expect(() => priceCostTemplate(service.costs, DEFAULT_CURRENCY)).not.toThrow();
      for (const line of service.costs) {
        expect(line.label.trim(), 'an unnamed cost line').not.toBe('');
        expect(line.labelAr.trim(), `${line.label} has no Arabic label`).not.toBe('');
        expect(line.labelAr, `${line.label} was not translated`).not.toBe(line.label);
      }
    },
  );
});

describe('the video shoot, priced out', () => {
  const video = DEFAULT_SERVICES.find((s) => s.name === 'Video Production')!;

  it('is the service most exposed to an uncounted cost', () => {
    // Nine lines, several of them cash on the day — catering, transport,
    // permits. These are exactly the costs that never reach a spreadsheet, and
    // together they are a fifth of the shoot.
    const { rows, total } = priceCostTemplate(video.costs, DEFAULT_CURRENCY);
    expect(rows).toHaveLength(9);
    expect(toMajorString(total)).toBe('21400.00');

    const onTheDay = rows.filter((row) =>
      ['Location and permits', 'Talent and voiceover', 'Transport and catering'].includes(
        row.line.label,
      ),
    );
    expect(toMajorString(onTheDay.reduce((a, r) => ({ ...a, minor: a.minor + r.total.minor }), {
      currency: DEFAULT_CURRENCY,
      minor: 0n,
    }))).toBe('6200.00');
  });

  it('leaves a healthy margin at target and a thin one at the floor', () => {
    const cost = costTemplateTotal(video.costs, DEFAULT_CURRENCY);
    const atTarget = computeMargin(fromMajor(video.target, DEFAULT_CURRENCY), cost, 5_000);
    const atFloor = computeMargin(fromMajor(video.floor, DEFAULT_CURRENCY), cost, 5_000);
    expect(atTarget.marginBasisPoints).toBe(4_650); // 46.5% at 40,000
    expect(atFloor.marginBasisPoints).toBe(1_440); // 14.4% at 25,000
  });
});
