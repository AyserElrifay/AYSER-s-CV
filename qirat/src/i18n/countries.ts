/**
 * Where the agency is.
 *
 * One question on the signup form, and it decides three things: the currency the
 * first screen is denominated in, which starting catalogue is seeded, and the VAT
 * rate offered as a default. Asking it is the difference between a Berlin studio
 * opening the product to euros and opening it to Egyptian pounds.
 *
 * The list is deliberately short. It covers the markets this is built for rather
 * than every country in the world, and an agency outside it still signs up — it
 * simply starts on the defaults and edits its currency, which it would do anyway.
 */
export interface Country {
  code: string;
  en: string;
  ar: string;
}

export const COUNTRIES: Country[] = [
  // --- European Union --------------------------------------------------------
  { code: 'AT', en: 'Austria', ar: 'النمسا' },
  { code: 'BE', en: 'Belgium', ar: 'بلجيكا' },
  { code: 'CZ', en: 'Czechia', ar: 'التشيك' },
  { code: 'DK', en: 'Denmark', ar: 'الدنمارك' },
  { code: 'EE', en: 'Estonia', ar: 'إستونيا' },
  { code: 'FI', en: 'Finland', ar: 'فنلندا' },
  { code: 'FR', en: 'France', ar: 'فرنسا' },
  { code: 'DE', en: 'Germany', ar: 'ألمانيا' },
  { code: 'GR', en: 'Greece', ar: 'اليونان' },
  { code: 'HU', en: 'Hungary', ar: 'المجر' },
  { code: 'IE', en: 'Ireland', ar: 'أيرلندا' },
  { code: 'IT', en: 'Italy', ar: 'إيطاليا' },
  { code: 'LU', en: 'Luxembourg', ar: 'لوكسمبورغ' },
  { code: 'NL', en: 'Netherlands', ar: 'هولندا' },
  { code: 'PL', en: 'Poland', ar: 'بولندا' },
  { code: 'PT', en: 'Portugal', ar: 'البرتغال' },
  { code: 'RO', en: 'Romania', ar: 'رومانيا' },
  { code: 'ES', en: 'Spain', ar: 'إسبانيا' },
  { code: 'SE', en: 'Sweden', ar: 'السويد' },
  // --- Europe, outside the EU ------------------------------------------------
  { code: 'GB', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { code: 'CH', en: 'Switzerland', ar: 'سويسرا' },
  { code: 'NO', en: 'Norway', ar: 'النرويج' },
  { code: 'TR', en: 'Türkiye', ar: 'تركيا' },
  // --- MENA ------------------------------------------------------------------
  { code: 'EG', en: 'Egypt', ar: 'مصر' },
  { code: 'SA', en: 'Saudi Arabia', ar: 'السعودية' },
  { code: 'AE', en: 'United Arab Emirates', ar: 'الإمارات' },
  { code: 'QA', en: 'Qatar', ar: 'قطر' },
  { code: 'KW', en: 'Kuwait', ar: 'الكويت' },
  { code: 'BH', en: 'Bahrain', ar: 'البحرين' },
  { code: 'OM', en: 'Oman', ar: 'عُمان' },
  { code: 'JO', en: 'Jordan', ar: 'الأردن' },
  { code: 'MA', en: 'Morocco', ar: 'المغرب' },
  { code: 'TN', en: 'Tunisia', ar: 'تونس' },
];

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function isKnownCountry(code: string | null | undefined): boolean {
  return !!code && BY_CODE.has(code.toUpperCase());
}

/**
 * The country's name in the reader's language.
 *
 * Sorted by the name being displayed, not by code: a list ordered AT, BE, CZ
 * reads as a list of codes, and an Arabic reader scanning for ألمانيا should not
 * have to know that Germany's code begins with D.
 */
export function countryName(code: string, locale: 'en' | 'ar'): string {
  const country = BY_CODE.get(code.toUpperCase());
  return country ? country[locale] : code.toUpperCase();
}

export function countriesFor(locale: 'en' | 'ar'): Array<{ code: string; name: string }> {
  return COUNTRIES.map((country) => ({ code: country.code, name: country[locale] })).sort((a, b) =>
    a.name.localeCompare(b.name, locale === 'ar' ? 'ar' : 'en'),
  );
}
