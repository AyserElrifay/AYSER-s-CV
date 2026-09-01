'use client';

import { useState, useTransition } from 'react';
import { logWorkAction } from '@/app/actions/team';
import { Figure } from './figure';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

export interface AssignmentView {
  dealId: string;
  dealTitle: string;
  clientName: string | null;
  rate: string;
  currency: string;
  daysLogged: string;
  /** "days" / "أيام", already agreeing with the count. Arabic has three forms in play. */
  daysNoun: string;
  logged: string;
}

export interface LoggedDayView {
  id: string;
  dealTitle: string | null;
  workedOn: string;
  days: string;
  amount: string;
  currency: string;
  note: string | null;
}

/**
 * A Member's whole product.
 *
 * Aggressively plain, on purpose. This person opens the app to answer one
 * question — what am I on, and did I write down Tuesday — and every element
 * that is not that answer is an element that makes them stop opening it.
 *
 * There is no margin here, no price, and no colour. Not because the interface
 * is hiding them: the database will not return them to this session at all.
 */
export function MyWork({
  assignments,
  logged,
  locale,
}: {
  assignments: AssignmentView[];
  logged: LoggedDayView[];
  locale: Locale;
}) {
  const t = translator(locale);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[15px] font-medium">{t('work.myDeals')}</h2>
        {assignments.length === 0 ? (
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-soft">
            {t('work.none')}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {assignments.map((assignment) => (
              <li key={assignment.dealId}>
                <AssignmentCard assignment={assignment} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {logged.length > 0 ? (
        <section>
          <h2 className="text-[15px] font-medium">{t('work.recent')}</h2>
          <ul className="mt-3 max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
            {logged.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{entry.dealTitle ?? '—'}</span>
                  {entry.note ? (
                    <span className="block truncate text-[11px] text-ink-faint">{entry.note}</span>
                  ) : null}
                </span>
                <span className="reading shrink-0 text-[12px] text-ink-soft">
                  <Figure>{entry.days}</Figure>
                  <span className="mx-1.5 font-sans text-ink-faint">·</span>
                  <Figure>{entry.amount}</Figure>
                  <span className="ms-1.5 font-sans text-[11px] text-ink-faint" dir="ltr">
                    {entry.workedOn}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * One deal, and the form for putting a day against it.
 *
 * The card is the light material here, not the dark one. The dark card is the
 * deal's economics, and this person is not being shown economics — showing them
 * the same body would be promising a number that is not coming.
 */
function AssignmentCard({
  assignment,
  locale,
}: {
  assignment: AssignmentView;
  locale: Locale;
}) {
  const t = translator(locale);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await logWorkAction({
        dealId: assignment.dealId,
        days: String(form.get('days') ?? ''),
        workedOn: String(form.get('workedOn') ?? today),
        note: String(form.get('note') ?? ''),
      });
      if (result.ok) setOpen(false);
      else setError(result.error.includes(' ') ? result.error : t(result.error as StringKey));
    });
  };

  return (
    <article className="max-w-2xl rounded-[12px] border border-line bg-paper-raised p-5">
      <header className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium">{assignment.dealTitle}</h3>
          {assignment.clientName ? (
            <p className="mt-0.5 truncate text-[12px] text-ink-faint">{assignment.clientName}</p>
          ) : null}
        </div>
        <span className="reading shrink-0 text-[13px] text-ink-soft">
          <Figure>{assignment.rate}</Figure>
          <span className="ms-1 font-sans text-[11px] text-ink-faint">
            {assignment.currency} {t('staff.perDay')}
          </span>
        </span>
      </header>

      <p className="mt-3 text-[12px] text-ink-faint">
        {t('work.totalLogged')} <Figure>{assignment.daysLogged}</Figure> {assignment.daysNoun}
        <span className="mx-1.5">·</span>
        <Figure>{assignment.logged}</Figure>
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-[8px] border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
        >
          {t('work.logDay')}
        </button>
      ) : (
        <form action={submit} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="flex-1">
              <span className="text-[12px] text-ink-soft">{t('work.days')}</span>
              <input
                name="days"
                inputMode="decimal"
                required
                autoFocus
                defaultValue="1"
                className="reading mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
              />
            </label>
            <label className="flex-1">
              <span className="text-[12px] text-ink-soft">{t('work.when')}</span>
              <input
                name="workedOn"
                type="date"
                defaultValue={today}
                className="reading mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
              />
            </label>
          </div>
          <p className="text-[11px] text-ink-faint">{t('work.daysHint')}</p>

          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('work.note')}</span>
            <input
              name="note"
              className="mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
            />
          </label>

          {error ? (
            <p role="alert" className="text-[12px] text-below-ink">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[8px] bg-ink px-3 py-1.5 text-[13px] font-medium text-paper disabled:opacity-60"
            >
              {pending ? `${t('work.saving')}…` : t('work.save')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] text-ink-faint hover:text-ink-soft"
            >
              {t('cost.cancel')}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
