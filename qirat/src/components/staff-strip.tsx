'use client';

import { useState, useTransition } from 'react';
import { assignAction, unassignAction } from '@/app/actions/team';
import { Figure } from './figure';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

export interface StaffMember {
  userId: string;
  name: string;
  rate: string;
  daysLogged: string;
  logged: string;
}

/**
 * Who is on this deal.
 *
 * It sits inside the dark card because it is part of the deal's economics: the
 * days these people log are the cost the margin above was previously pretending
 * did not exist. An empty strip says so out loud rather than showing nothing,
 * because "nobody is staffed" and "labour is free" look identical on a card
 * that stays quiet.
 */
export function StaffStrip({
  dealId,
  on,
  available,
  locale,
  canEdit,
}: {
  dealId: string;
  on: StaffMember[];
  available: Array<{ id: string; name: string }>;
  locale: Locale;
  canEdit: boolean;
}) {
  const t = translator(locale);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unstaffed = available.filter((person) => !on.some((s) => s.userId === person.id));

  return (
    <section className="mt-5 border-t border-card-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-card-ink-faint">{t('staff.title')}</span>
      </div>

      {on.length === 0 ? (
        <p className="mt-2 text-[12px] leading-relaxed text-card-ink-faint">{t('staff.none')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {on.map((person) => (
            <li key={person.userId} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate text-card-ink-soft">
                {person.name}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await unassignAction(dealId, person.userId);
                      })
                    }
                    className="ms-2 text-[11px] text-card-ink-faint hover:text-below disabled:opacity-50"
                  >
                    {t('staff.remove')}
                  </button>
                ) : null}
              </span>
              <span className="reading shrink-0 text-card-ink-faint">
                <Figure>{person.daysLogged}</Figure>{' '}
                <span className="font-sans">{t('staff.daysLogged')}</span>
                <span className="mx-1.5">·</span>
                <Figure>{person.logged}</Figure>
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && unstaffed.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label={t('staff.add')}
            defaultValue=""
            disabled={pending}
            onChange={(event) => {
              const userId = event.target.value;
              if (!userId) return;
              event.target.value = '';
              setError(null);
              startTransition(async () => {
                const result = await assignAction(dealId, userId);
                if (!result.ok) {
                  setError(
                    result.error.includes(' ') ? result.error : t(result.error as StringKey),
                  );
                }
              });
            }}
            className="rounded-[8px] border border-card-line bg-card-raised px-2.5 py-1.5 text-[12px] text-card-ink-soft"
          >
            <option value="">{t('staff.add')}</option>
            {unstaffed.map((person) => (
              <option key={person.id} value={person.id} className="text-ink">
                {person.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* A person with no rate cannot be staffed, and the refusal says which
          person and what to do about it — that sentence comes from the server. */}
      {error ? (
        <p role="alert" className="mt-2 text-[12px] leading-relaxed text-below">
          {error}
        </p>
      ) : null}
    </section>
  );
}
