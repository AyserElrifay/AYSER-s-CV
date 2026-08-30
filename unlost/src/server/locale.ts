import 'server-only';
import { cookies } from 'next/headers';
import { type Locale } from '@/i18n/dictionary';

export const LOCALE_COOKIE = 'unlost_locale';

/** The viewer's language: their explicit choice, else their account default. */
export async function resolveLocale(fallback: Locale = 'en'): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  return chosen === 'ar' || chosen === 'en' ? chosen : fallback;
}
