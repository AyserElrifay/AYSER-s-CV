import { describe, expect, it } from 'vitest';
import { LOCALES, type StringKey, translator } from './dictionary';
import { TAX_TREATMENTS } from '@/money';

/**
 * The dictionary is typed, so a missing Arabic string is a compile error. What
 * the type cannot catch is a *set* of keys drifting out of step with a set of
 * values elsewhere in the product: add a sixth tax treatment and the enum
 * compiles, the migration runs, and the interface renders `undefined` next to
 * somebody's price.
 */
describe('every tax treatment is spoken in both languages', () => {
  for (const locale of LOCALES) {
    it(`${locale}: names each treatment and says why it charges what it charges`, () => {
      const t = translator(locale);
      for (const treatment of TAX_TREATMENTS) {
        for (const prefix of ['tax.treatment', 'tax.why']) {
          const key = `${prefix}.${treatment}` as StringKey;
          const value = t(key);
          expect(value, `${key} is missing`).toBeTruthy();
          expect(value.trim(), `${key} is blank`).not.toBe('');
        }
      }
    });
  }

  it('says something different about each treatment', () => {
    // Four of the five charge nothing, and they charge nothing for four
    // different reasons. Collapsing them onto one sentence puts an obligation
    // on the page that the client does not have.
    const t = translator('en');
    const reasons = TAX_TREATMENTS.map((treatment) => t(`tax.why.${treatment}` as StringKey));
    expect(new Set(reasons).size).toBe(TAX_TREATMENTS.length);
  });

  it('does not leave English in the Arabic dictionary', () => {
    const en = translator('en');
    const ar = translator('ar');
    for (const treatment of TAX_TREATMENTS) {
      for (const prefix of ['tax.treatment', 'tax.why']) {
        const key = `${prefix}.${treatment}` as StringKey;
        expect(ar(key), `${key} was never translated`).not.toBe(en(key));
      }
    }
  });
});
