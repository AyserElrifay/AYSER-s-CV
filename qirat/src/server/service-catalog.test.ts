import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  DEFAULT_SERVICES,
  EUROPE_SERVICES,
  type ServiceSeed,
  startingPointFor,
} from './service-catalog';
import {
  type CurrencyCode,
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
 *
 * Two catalogues now, held to exactly the same standard. A European agency that
 * signs up and finds a service whose floor loses money has been handed the same
 * broken product, in euros.
 */
const CATALOGUES: Array<[string, ServiceSeed[], CurrencyCode]> = [
  ['MENA', DEFAULT_SERVICES, DEFAULT_CURRENCY],
  ['Europe', EUROPE_SERVICES, 'EUR'],
];

describe.each(CATALOGUES)('%s catalogue', (_region, services, currency) => {
  it.each(services.map((service) => [service.name, service] as const))(
    '%s: the cost build-up totals inside its own range',
    (_name, service) => {
      const total = costTemplateTotal(service.costs, currency);
      const floor = fromMajor(service.costMin, currency);
      const ceiling = fromMajor(service.costMax, currency);
      expect(greaterThanOrEqual(total, floor), `${toMajorString(total)} < ${service.costMin}`).toBe(
        true,
      );
      expect(lessThanOrEqual(total, ceiling), `${toMajorString(total)} > ${service.costMax}`).toBe(
        true,
      );
    },
  );

  it.each(services.map((service) => [service.name, service] as const))(
    '%s: still makes money at its own floor price',
    (_name, service) => {
      // The floor is the price the owner said never to go under. If delivering
      // at that price loses money, the band itself is wrong and the product
      // would be routing people to approval for a deal that can never work.
      const margin = computeMargin(
        fromMajor(service.floor, currency),
        costTemplateTotal(service.costs, currency),
        5_000,
      );
      expect(margin.isLoss).toBe(false);
      expect(margin.marginBasisPoints).toBeGreaterThan(0);
    },
  );

  it.each(services.map((service) => [service.name, service] as const))(
    '%s: the band is ordered and the target beats the floor',
    (_name, service) => {
      const floor = fromMajor(service.floor, currency);
      const target = fromMajor(service.target, currency);
      const ceiling = fromMajor(service.ceiling, currency);
      expect(greaterThanOrEqual(target, floor)).toBe(true);
      expect(greaterThanOrEqual(ceiling, target)).toBe(true);

      const cost = costTemplateTotal(service.costs, currency);
      const atFloor = computeMargin(floor, cost, 5_000).marginBasisPoints ?? 0;
      const atTarget = computeMargin(target, cost, 5_000).marginBasisPoints ?? 0;
      expect(atTarget).toBeGreaterThan(atFloor);
    },
  );

  it.each(services.map((service) => [service.name, service] as const))(
    '%s: every cost line is priceable and named in both languages',
    (_name, service) => {
      expect(service.costs.length).toBeGreaterThan(0);
      expect(() => priceCostTemplate(service.costs, currency)).not.toThrow();
      for (const line of service.costs) {
        expect(line.label.trim(), 'an unnamed cost line').not.toBe('');
        expect(line.labelAr.trim(), `${line.label} has no Arabic label`).not.toBe('');
        expect(line.labelAr, `${line.label} was not translated`).not.toBe(line.label);
      }
    },
  );

  it('has a task template for every service', () => {
    for (const service of services) {
      expect(service.tasks.length, `${service.name} has no tasks`).toBeGreaterThan(0);
      const offsets = service.tasks.map((task) => task.offsetDays);
      // Delivery milestones that go backwards would put the timeline out of order
      // on the first screen, before anyone has typed anything.
      expect(offsets, `${service.name} tasks are out of order`).toEqual([...offsets].sort((a, b) => a - b));
    }
  });
});

describe('the two catalogues describe the same business', () => {
  it('sells the same kinds of work', () => {
    // Not the same names — a European studio says "Brand Identity System" where
    // a Cairo one says "Brand Book" — but the same count and the same shape, so
    // neither market is being sold a thinner product than the other.
    expect(EUROPE_SERVICES).toHaveLength(DEFAULT_SERVICES.length);
    for (const service of EUROPE_SERVICES) {
      expect(service.costs.length).toBeGreaterThan(0);
    }
  });

  it('prices the video shoot with the same structure in both', () => {
    const cairo = DEFAULT_SERVICES.find((s) => s.name === 'Video Production')!;
    const berlin = EUROPE_SERVICES.find((s) => s.name === 'Video Production')!;
    expect(berlin.costs.map((line) => line.label)).toEqual(cairo.costs.map((line) => line.label));
  });
});

describe('where a new agency starts', () => {
  it('gives a euro-zone agency euros and the European catalogue', () => {
    const berlin = startingPointFor('DE');
    expect(berlin.currency).toBe('EUR');
    expect(berlin.services).toBe(EUROPE_SERVICES);
    expect(berlin.vatRateBp).toBe(1_900);
  });

  it('gives a European agency outside the euro its own currency', () => {
    expect(startingPointFor('GB').currency).toBe('GBP');
    expect(startingPointFor('SE').currency).toBe('SEK');
    expect(startingPointFor('CH').currency).toBe('CHF');
    expect(startingPointFor('PL').services).toBe(EUROPE_SERVICES);
  });

  it('leaves Cairo where it was', () => {
    const cairo = startingPointFor('EG');
    expect(cairo.currency).toBe('EGP');
    expect(cairo.services).toBe(DEFAULT_SERVICES);
    expect(cairo.vatRateBp).toBe(1_400);
  });

  it('falls back to the MENA catalogue when the country is unknown', () => {
    for (const unknown of [null, undefined, '', 'ZZ']) {
      const start = startingPointFor(unknown);
      expect(start.currency).toBe(DEFAULT_CURRENCY);
      expect(start.services).toBe(DEFAULT_SERVICES);
      expect(start.vatRateBp).toBe(0);
    }
  });

  it('never registers an agency for VAT on its behalf', () => {
    // Whether an agency is registered is a fact about that agency, not about its
    // address. Assuming it would put tax on invoices that must not carry it.
    for (const country of ['DE', 'FR', 'GB', 'EG', 'SA', null]) {
      const start = startingPointFor(country);
      expect(start.vatRegistered).toBe(false);
      expect(start.taxTreatment).toBe('not_registered');
    }
  });

  it('seeds a currency the money module actually knows', () => {
    // A country mapped to a currency the module rejects is a signup that throws
    // on its first insert, in a market nobody here tested by hand.
    const countries = 'DE FR GB SE NO DK CH PL CZ HU RO TR MA EG SA AE QA JO TN ZZ'.split(' ');
    for (const country of countries) {
      const { currency } = startingPointFor(country);
      expect(() => fromMajor('1.00', currency), `${country} -> ${currency}`).not.toThrow();
    }
  });
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

  it('is the thinnest service at its floor in Europe too', () => {
    // Same shape, same warning: the shoot is where a missed cost hurts most,
    // whichever currency it is billed in.
    const marginAtFloor = (service: ServiceSeed) =>
      computeMargin(
        fromMajor(service.floor, 'EUR'),
        costTemplateTotal(service.costs, 'EUR'),
        5_000,
      ).marginBasisPoints ?? 0;
    const ranked = [...EUROPE_SERVICES].sort((a, b) => marginAtFloor(a) - marginAtFloor(b));
    expect(ranked[0]!.name).toBe('Video Production');
  });
});
