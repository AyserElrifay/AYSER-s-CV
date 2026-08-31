'use client';

import { useState, useTransition } from 'react';
import { closePeriodAction } from '@/app/actions/payout';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import { dealsClosedNoun } from '@/i18n/plural';
import { Figure } from './figure';

export interface PreviewLine {
  name: string;
  currency: string;
  amount: string;
}

/**
 * Closing the period.
 *
 * The brief asks for this to be a moment rather than a dialog, so it is one
 * button that produces something real, and the whole thing is shown before it
 * is pressed: every person, every number, and what stays with the agency. The
 * owner is agreeing to a specific set of payments, not running a report.
 *
 * After it is pressed the numbers stop being editable, anywhere, by anyone —
 * which is exactly why the preview above it has to be complete.
 */
export function PeriodClose({
  periodId,
  locale,
  lines,
  dealCount,
  distributable,
  bonusPool,
  retained,
  canClose,
}: {
  periodId: string;
  locale: Locale;
  lines: PreviewLine[];
  dealCount: number;
  distributable: string;
  bonusPool: string;
  retained: string;
  canClose: boolean;
}) {
  const t = translator(locale);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setError(null);
    startTransition(async () => {
      const result = await closePeriodAction(periodId);
      if (!result.ok) setError(result.error);
    });
  };

  // An unbalanced run carries its detail after a colon. It is a bug, and the
  // message says so rather than pretending it is a rounding difference.
  const [errorKey, errorDetail] = error ? splitError(error) : [null, null];

  return (
    <div>
      <dl className="grid grid-cols-3 gap-3 border-t border-card-line pt-4 text-[12px]">
        <Cell label={t('payouts.distributable')} value={distributable} />
        <Cell label={t('payouts.bonusPool')} value={bonusPool} />
        <Cell label={t('payouts.retained')} value={retained} />
      </dl>

      {lines.length > 0 ? (
        <ul className="mt-5 divide-y divide-card-line border-t border-card-line">
          {lines.map((line, index) => (
            <li
              key={`${line.name}-${line.currency}-${index}`}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <span className="text-[14px] text-card-ink">{line.name}</span>
              <span className="reading text-[14px] text-card-ink">
                <Figure>{line.amount}</Figure>
                <span className="ms-1.5 font-sans text-[11px] text-card-ink-faint">
                  {line.currency}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed text-card-ink-faint">{t('payouts.nothing')}</p>
      )}

      {errorKey ? (
        <p role="alert" className="mt-4 text-[12px] leading-relaxed text-below">
          {t(errorKey as StringKey)} {errorDetail}
        </p>
      ) : null}

      {canClose ? (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={close}
            disabled={pending || lines.length === 0}
            className="rounded-[8px] bg-card-ink px-4 py-2 text-[14px] font-medium text-card disabled:opacity-50"
          >
            {pending ? `${t('payouts.closing')}…` : t('payouts.close')}
          </button>
          <span className="text-[12px] text-card-ink-faint">
            <Figure>{new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(dealCount)}</Figure>{' '}
            {dealsClosedNoun(dealCount, locale)}
          </span>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-card-ink-faint">
        {t('payouts.immutableNote')}
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-card-ink-faint">{label}</dt>
      <dd className="reading mt-1 text-[14px] text-card-ink-soft">
        <Figure>{value}</Figure>
      </dd>
    </div>
  );
}

function splitError(error: string): [string, string | null] {
  const at = error.indexOf(':');
  return at === -1 ? [error, null] : [error.slice(0, at), error.slice(at + 1)];
}
