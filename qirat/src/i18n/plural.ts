import { type Locale } from './dictionary';

/**
 * Counted nouns, done properly.
 *
 * English has two forms. Arabic has six, and three of them are in everyday use:
 * one deal is صفقة, two is the dual صفقتان, and three to ten takes the plural
 * صفقات while eleven and up returns to the singular. "3 صفقة" is the sort of
 * thing that tells an Arabic reader immediately that the interface was written
 * in English and translated by a machine.
 *
 * This lives outside the flat dictionary on purpose: the dictionary maps one key
 * to one string, and a counted noun is not one string.
 */
type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const DEALS_CLOSED: Record<Locale, PluralForms> = {
  en: {
    one: 'deal closed',
    other: 'deals closed',
  },
  ar: {
    one: 'صفقة مغلقة',
    two: 'صفقتان مغلقتان',
    few: 'صفقات مغلقة',
    many: 'صفقة مغلقة',
    other: 'صفقة مغلقة',
  },
};

const RULES: Partial<Record<Locale, Intl.PluralRules>> = {};

function rulesFor(locale: Locale): Intl.PluralRules {
  const existing = RULES[locale];
  if (existing) return existing;
  const created = new Intl.PluralRules(locale === 'ar' ? 'ar-EG' : 'en-US');
  RULES[locale] = created;
  return created;
}

function pick(forms: PluralForms, count: number, locale: Locale): string {
  return forms[rulesFor(locale).select(count)] ?? forms.other;
}

/** "3 deals closed" / "٣ صفقات مغلقة" — the noun only, so the figure can be isolated. */
export function dealsClosedNoun(count: number, locale: Locale): string {
  return pick(DEALS_CLOSED[locale], count, locale);
}
