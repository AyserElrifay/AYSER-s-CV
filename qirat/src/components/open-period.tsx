'use client';

import { useState, useTransition } from 'react';
import { openPeriodAction } from '@/app/actions/payout';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

/**
 * The next period.
 *
 * Offered rather than created automatically: opening a period is the owner
 * saying "this month starts here", and an agency's month does not always begin
 * on the first — retainers, Ramadan, a client whose year ends in June.
 */
export function OpenPeriod({
  locale,
  startsOn,
  endsOn,
}: {
  locale: Locale;
  startsOn: string;
  endsOn: string;
}) {
  const t = translator(locale);
  const [error, setError] = useState<StringKey | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await openPeriodAction(startsOn, endsOn);
            if (!result.ok) setError(result.error as StringKey);
          });
        }}
        className="rounded-[8px] bg-ink px-4 py-2 text-[14px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? `${t('payouts.opening')}…` : t('payouts.openNext')}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-below-ink">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
