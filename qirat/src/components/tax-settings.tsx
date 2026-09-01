'use client';

import { useState, useTransition } from 'react';
import { saveTaxSettingsAction } from '@/app/actions/settings';
import { countriesFor } from '@/i18n/countries';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import { TAX_TREATMENTS } from '@/money';

/**
 * The one screen where an agency states its tax position.
 *
 * Four answers, and the product asks for no more than that. It does not ask for
 * a VAT number, because it does not validate one; it does not ask which supplies
 * are exempt, because that is a question for an accountant and a wrong answer
 * here would be worse than no answer. What it needs is the one thing that
 * changes every margin in the system: whether the tax an agency pays comes back.
 */
export function TaxSettings({
  locale,
  country,
  vatRegistered,
  vatRateBp,
  defaultTaxTreatment,
}: {
  locale: Locale;
  country: string | null;
  vatRegistered: boolean;
  vatRateBp: number;
  defaultTaxTreatment: string;
}) {
  const t = translator(locale);
  const countries = countriesFor(locale);
  const [registered, setRegistered] = useState(vatRegistered);
  const [error, setError] = useState<StringKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveTaxSettingsAction({
        country: String(form.get('country') ?? ''),
        vatRegistered: registered,
        vatRatePercent: String(form.get('vatRatePercent') ?? '0'),
        defaultTaxTreatment: String(form.get('defaultTaxTreatment') ?? 'not_registered'),
      });
      if (result.ok) setSaved(true);
      else setError(result.error as StringKey);
    });
  };

  return (
    <form action={submit} className="max-w-xl space-y-5">
      <label className="block">
        <span className="text-[13px] text-ink-soft">{t('settings.country')}</span>
        <select
          name="country"
          defaultValue={country ?? ''}
          className="mt-1.5 block w-full appearance-none rounded-[8px] border border-line bg-paper-raised px-3 py-2 text-[15px] text-ink"
        >
          <option value="">{t('settings.countryNone')}</option>
          {countries.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={registered}
          onChange={(event) => setRegistered(event.target.checked)}
          className="mt-0.5 size-4 accent-ink"
        />
        <span>
          <span className="block text-[14px]">{t('settings.vatRegistered')}</span>
          {/* The sentence that explains the whole feature, in the place where
              somebody is deciding whether it applies to them. */}
          <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-faint">
            {t('settings.vatRegisteredHint')}
          </span>
        </span>
      </label>

      {/* Disabled rather than hidden: an agency about to register should be able
          to see the two questions it is going to be asked. */}
      <div className={registered ? '' : 'pointer-events-none opacity-40'}>
        <label className="block">
          <span className="text-[13px] text-ink-soft">{t('settings.vatRate')}</span>
          <input
            name="vatRatePercent"
            inputMode="decimal"
            defaultValue={(vatRateBp / 100).toString()}
            disabled={!registered}
            className="reading mt-1.5 block w-full rounded-[8px] border border-line bg-paper-raised px-3 py-2 text-[15px] text-ink"
          />
        </label>

        <label className="mt-5 block">
          <span className="text-[13px] text-ink-soft">{t('settings.defaultTreatment')}</span>
          <select
            name="defaultTaxTreatment"
            defaultValue={defaultTaxTreatment}
            disabled={!registered}
            className="mt-1.5 block w-full appearance-none rounded-[8px] border border-line bg-paper-raised px-3 py-2 text-[15px] text-ink"
          >
            {TAX_TREATMENTS.map((treatment) => (
              <option key={treatment} value={treatment}>
                {t(`tax.treatment.${treatment}` as StringKey)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] leading-relaxed text-ink-faint">
            {t('settings.defaultTreatmentHint')}
          </span>
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-below-ink">
          {t(error)}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] bg-ink px-4 py-2 text-[14px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? `${t('settings.saving')}…` : t('settings.save')}
        </button>
        {saved && !pending ? (
          <span className="text-[13px] text-ink-faint">{t('settings.saved')}</span>
        ) : null}
      </div>
    </form>
  );
}
