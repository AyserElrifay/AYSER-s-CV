'use client';

import { useTransition } from 'react';
import { setDealTaxTreatmentAction } from '@/app/actions/settings';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import { TAX_TREATMENTS, type TaxTreatment } from '@/money';

/**
 * How this one deal is treated.
 *
 * A select rather than a page: the question is asked where the deal is, at the
 * moment somebody is looking at its price, because that is the moment they know
 * whether the client is in Munich or in Paris. Sending them to a settings screen
 * to answer it is how every deal ends up on the agency default.
 *
 * It saves on change and says nothing when it succeeds — the gross figure beside
 * it moves, which is the confirmation.
 */
export function TaxTreatmentPicker({
  dealId,
  treatment,
  locale,
}: {
  dealId: string;
  treatment: TaxTreatment;
  locale: Locale;
}) {
  const t = translator(locale);
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={treatment}
      disabled={pending}
      aria-label={t('deal.taxTreatment')}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          await setDealTaxTreatmentAction(dealId, next);
        });
      }}
      className="-mx-1 min-w-0 appearance-none truncate rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-card-ink-faint hover:border-card-line hover:text-card-ink-soft disabled:opacity-50"
    >
      {TAX_TREATMENTS.map((option) => (
        <option key={option} value={option} className="text-ink">
          {t(`tax.treatment.${option}` as StringKey)}
        </option>
      ))}
    </select>
  );
}
