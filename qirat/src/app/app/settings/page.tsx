import { redirect } from 'next/navigation';
import { Figure } from '@/components/figure';
import { TaxSettings } from '@/components/tax-settings';
import { translator } from '@/i18n/dictionary';
import { countryName } from '@/i18n/countries';
import { formatBasisPoints } from '@/money';
import { getOrgSettings } from '@/server/queries';
import { contextFor, requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Settings, which is one page and is meant to stay one page.
 *
 * Everything here changes how money is counted, which is why it is the Owner's
 * alone and why the audit log records each change. Anything that does not change
 * how money is counted does not belong on this screen.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role !== 'owner') redirect('/app');

  const locale = await resolveLocale(user.locale);
  const t = translator(locale);
  const settings = await getOrgSettings(contextFor(user));
  if (!settings) redirect('/app');

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-soft">
          {t('settings.taxIntro')}
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-medium">{t('settings.tax')}</h2>
        <div className="mt-4">
          <TaxSettings
            locale={locale}
            country={settings.country}
            vatRegistered={settings.vatRegistered}
            vatRateBp={settings.vatRateBp}
            defaultTaxTreatment={settings.defaultTaxTreatment}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-medium">{t('settings.asItStands')}</h2>
        <dl className="mt-3 max-w-xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised text-[13px]">
          <Row label={t('settings.country')}>
            {settings.country ? countryName(settings.country, locale) : '—'}
          </Row>
          <Row label={t('settings.currency')}>
            <span className="reading">
              <Figure>{settings.defaultCurrency}</Figure>
            </span>
          </Row>
          <Row label={t('settings.vatRegistered')}>
            {settings.vatRegistered ? t('settings.yes') : t('settings.no')}
          </Row>
          {/* An agency that is not registered charges nothing, so a rate here
              would contradict the row above it. */}
          <Row label={t('settings.rateRow')}>
            {settings.vatRegistered ? (
              <span className="reading">
                <Figure>{formatBasisPoints(settings.vatRateBp, { locale })}</Figure>
              </span>
            ) : (
              t('settings.rateNone')
            )}
          </Row>
        </dl>
        <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-ink-faint">
          {t('settings.currencyNote')}
        </p>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
