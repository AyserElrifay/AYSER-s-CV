import { describe, expect, it } from 'vitest';
import {
  type TaxTreatment,
  TAX_TREATMENTS,
  applyVat,
  chargesVat,
  defaultVatRateFor,
  removeVat,
  supplierCost,
  vatPosition,
} from './tax';
import { CurrencyMismatchError, fromMajor, toMajorString } from './money';
import { computeMargin } from './margin';

const eur = (v: string) => fromMajor(v, 'EUR');

describe('applyVat', () => {
  it('adds VAT to a standard-rated sale', () => {
    const sale = applyVat(eur('10000.00'), 'standard', 1900);
    expect(toMajorString(sale.vat)).toBe('1900.00');
    expect(toMajorString(sale.gross)).toBe('11900.00');
    expect(toMajorString(sale.net)).toBe('10000.00');
  });

  it('charges nothing under every other treatment', () => {
    for (const treatment of ['reverse_charge', 'zero_rated', 'exempt', 'not_registered'] as const) {
      const sale = applyVat(eur('10000.00'), treatment, 1900);
      expect(toMajorString(sale.vat), treatment).toBe('0.00');
      expect(toMajorString(sale.gross), treatment).toBe('10000.00');
    }
  });

  it('forgets a rate it did not apply', () => {
    // Storing the rate that was not charged is an invitation for something
    // downstream to charge it.
    expect(applyVat(eur('100.00'), 'reverse_charge', 1900).rateBp).toBe(0);
    expect(applyVat(eur('100.00'), 'standard', 1900).rateBp).toBe(1900);
  });

  it('rounds a rate that does not divide evenly, once', () => {
    // Finland's 25.5% on an awkward amount.
    const sale = applyVat(eur('333.33'), 'standard', 2550);
    expect(toMajorString(sale.vat)).toBe('85.00');
    expect(toMajorString(sale.gross)).toBe('418.33');
  });

  it('never lets net plus VAT drift from gross', () => {
    for (let cents = 1n; cents <= 400n; cents++) {
      const sale = applyVat({ currency: 'EUR', minor: cents }, 'standard', 1900);
      expect(sale.net.minor + sale.vat.minor).toBe(sale.gross.minor);
    }
  });

  it('refuses a rate over 100%', () => {
    expect(() => applyVat(eur('100.00'), 'standard', 10_001)).toThrow();
  });
});

describe('removeVat', () => {
  it('works backwards from a gross invoice', () => {
    const invoice = removeVat(eur('11900.00'), 'standard', 1900);
    expect(toMajorString(invoice.net)).toBe('10000.00');
    expect(toMajorString(invoice.vat)).toBe('1900.00');
  });

  it('leaves net plus VAT exactly equal to the gross handed in', () => {
    // The reason VAT is taken as the remainder rather than computed separately:
    // two roundings would let a cent appear or vanish between them.
    for (let cents = 1n; cents <= 400n; cents++) {
      const invoice = removeVat({ currency: 'EUR', minor: cents }, 'standard', 1900);
      expect(invoice.net.minor + invoice.vat.minor).toBe(cents);
    }
  });

  it('round-trips against applyVat', () => {
    for (const amount of ['0.01', '19.99', '4000.00', '123456.78']) {
      const out = applyVat(eur(amount), 'standard', 1900);
      const back = removeVat(out.gross, 'standard', 1900);
      expect(toMajorString(back.net), amount).toBe(amount);
    }
  });

  it('treats the whole amount as net when no VAT was charged', () => {
    const invoice = removeVat(eur('4000.00'), 'reverse_charge', 1900);
    expect(toMajorString(invoice.net)).toBe('4000.00');
    expect(toMajorString(invoice.vat)).toBe('0.00');
  });

  it('treats a zero rate as no VAT', () => {
    expect(toMajorString(removeVat(eur('100.00'), 'standard', 0).net)).toBe('100.00');
  });
});

describe('what a supplier invoice really costs', () => {
  const freelancer = applyVat(eur('4000.00'), 'standard', 1900);

  it('is the net when the agency can reclaim', () => {
    // 4,760 leaves the bank, but 760 comes back. It was never the agency's money.
    expect(toMajorString(supplierCost(freelancer, true))).toBe('4000.00');
  });

  it('is the gross when it cannot', () => {
    // Under the registration threshold: the tax is money it will never see again.
    expect(toMajorString(supplierCost(freelancer, false))).toBe('4760.00');
  });
});

describe('the mistake this module exists to prevent', () => {
  it('the Berlin agency, the Paris client and the German freelancer', () => {
    // Sale to France under the reverse charge: 10,000 net, no VAT added.
    const sale = applyVat(eur('10000.00'), 'reverse_charge', 1900);
    expect(toMajorString(sale.gross)).toBe('10000.00');

    // The freelancer is German and charges 19%.
    const invoice = applyVat(eur('4000.00'), 'standard', 1900);
    expect(toMajorString(invoice.gross)).toBe('4760.00');

    // What a spreadsheet does: gross in, gross out.
    const wrong = computeMargin(sale.gross, invoice.gross, 5_000);
    expect(wrong.marginBasisPoints).toBe(5_240); // 52.4%

    // What is true: the margin runs on net.
    const right = computeMargin(sale.net, supplierCost(invoice, true), 5_000);
    expect(right.marginBasisPoints).toBe(6_000); // 60%

    // Seven and a half points, and it lands on the account manager: the pool
    // their commission is paid from is short by 380 euros on one deal.
    expect(right.marginBasisPoints! - wrong.marginBasisPoints!).toBe(760);
    expect(
      toMajorString({
        currency: 'EUR',
        minor: right.distributable.minor - wrong.distributable.minor,
      }),
    ).toBe('380.00');
  });

  it('flips the other way for an agency that cannot reclaim', () => {
    // Below the threshold, so the input VAT is a real cost and using the net
    // would overstate the margin and overpay the commission.
    const invoice = applyVat(eur('4000.00'), 'standard', 1900);
    const honest = computeMargin(eur('10000.00'), supplierCost(invoice, false), 5_000);
    const flattering = computeMargin(eur('10000.00'), supplierCost(invoice, true), 5_000);
    expect(honest.marginBasisPoints).toBe(5_240);
    expect(flattering.marginBasisPoints).toBe(6_000);
  });

  it('agrees with the spreadsheet when everything is domestic and reclaimable', () => {
    // The case that lulls people: same rate both sides, and gross-based margin
    // happens to give the same percentage. It stops being true the moment a
    // cross-border sale or a non-registered supplier appears.
    const sale = applyVat(eur('10000.00'), 'standard', 1900);
    const invoice = applyVat(eur('4000.00'), 'standard', 1900);
    const onGross = computeMargin(sale.gross, invoice.gross, 5_000);
    const onNet = computeMargin(sale.net, supplierCost(invoice, true), 5_000);
    expect(onGross.marginBasisPoints).toBe(onNet.marginBasisPoints);
    // The percentages match; the money does not.
    expect(onGross.distributable.minor).not.toBe(onNet.distributable.minor);
  });
});

describe('vatPosition', () => {
  it('separates money owed to the authority from money that is the agency’s', () => {
    const sales = [applyVat(eur('10000.00'), 'standard', 1900)];
    const purchases = [applyVat(eur('4000.00'), 'standard', 1900)];
    const position = vatPosition(sales, purchases, true, 'EUR');
    expect(toMajorString(position.outputVat)).toBe('1900.00');
    expect(toMajorString(position.inputVat)).toBe('760.00');
    expect(toMajorString(position.due)).toBe('1140.00');
  });

  it('goes negative when more was paid than collected', () => {
    const position = vatPosition(
      [applyVat(eur('1000.00'), 'standard', 1900)],
      [applyVat(eur('4000.00'), 'standard', 1900)],
      true,
      'EUR',
    );
    expect(toMajorString(position.due)).toBe('-570.00');
  });

  it('reclaims nothing when the agency is not registered', () => {
    const position = vatPosition(
      [applyVat(eur('1000.00'), 'not_registered', 1900)],
      [applyVat(eur('4000.00'), 'standard', 1900)],
      false,
      'EUR',
    );
    expect(toMajorString(position.inputVat)).toBe('0.00');
    expect(toMajorString(position.due)).toBe('0.00');
  });

  it('refuses to total two currencies', () => {
    expect(() =>
      vatPosition([applyVat(fromMajor('100.00', 'GBP'), 'standard', 2000)], [], true, 'EUR'),
    ).toThrow(CurrencyMismatchError);
  });

  it('totals an empty period to nothing', () => {
    expect(toMajorString(vatPosition([], [], true, 'EUR').due)).toBe('0.00');
  });
});

describe('the treatments themselves', () => {
  it('only one of them charges', () => {
    expect(TAX_TREATMENTS.filter(chargesVat)).toEqual(['standard']);
  });

  it('is a closed set the interface can enumerate', () => {
    const seen = new Set<TaxTreatment>(TAX_TREATMENTS);
    expect(seen.size).toBe(TAX_TREATMENTS.length);
    expect(seen.has('reverse_charge')).toBe(true);
  });
});

describe('starting rates', () => {
  it('knows the places this is sold', () => {
    expect(defaultVatRateFor('DE')).toBe(1900);
    expect(defaultVatRateFor('de')).toBe(1900);
    expect(defaultVatRateFor('EG')).toBe(1400);
    expect(defaultVatRateFor('GB')).toBe(2000);
  });

  it('offers nothing rather than a guess for somewhere it does not know', () => {
    expect(defaultVatRateFor('ZZ')).toBe(0);
    expect(defaultVatRateFor(null)).toBe(0);
    expect(defaultVatRateFor(undefined)).toBe(0);
  });
});
