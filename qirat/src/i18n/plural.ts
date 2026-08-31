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

/**
 * The unit a cost line is counted in.
 *
 * Same problem as the deals, one layer down: "12 يوم" is wrong for twelve, and
 * "٢ يوم" is wrong for two, which takes the dual. A cost sheet full of that is
 * a cost sheet an Arabic-speaking producer stops reading.
 */
const UNITS: Record<'day' | 'person' | 'item' | 'month', Record<Locale, PluralForms>> = {
  day: {
    en: { one: 'day', other: 'days' },
    ar: { one: 'يوم', two: 'يومان', few: 'أيام', many: 'يوماً', other: 'يوم' },
  },
  person: {
    en: { one: 'person', other: 'people' },
    ar: { one: 'فرد', two: 'فردان', few: 'أفراد', many: 'فرداً', other: 'فرد' },
  },
  item: {
    en: { one: 'item', other: 'items' },
    ar: { one: 'بند', two: 'بندان', few: 'بنود', many: 'بنداً', other: 'بند' },
  },
  month: {
    en: { one: 'month', other: 'months' },
    ar: { one: 'شهر', two: 'شهران', few: 'أشهر', many: 'شهراً', other: 'شهر' },
  },
};

export function unitNoun(
  unit: 'day' | 'person' | 'item' | 'month',
  count: number,
  locale: Locale,
): string {
  return pick(UNITS[unit][locale], count, locale);
}
