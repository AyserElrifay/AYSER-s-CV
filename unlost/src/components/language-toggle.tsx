import { type Locale, translator } from '@/i18n/dictionary';

/**
 * Switches the whole interface, including its direction.
 *
 * A plain anchor, not a Link and not a form: the browser must fetch a new
 * document so the root element arrives with the right `dir` already on it.
 */
export function LanguageToggle({ locale, returnTo = '/app' }: { locale: Locale; returnTo?: string }) {
  const t = translator(locale);
  const next: Locale = locale === 'ar' ? 'en' : 'ar';
  return (
    <a
      href={`/locale/${next}?next=${encodeURIComponent(returnTo)}`}
      className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
    >
      {t('nav.language')}
    </a>
  );
}
