'use client';

import { useState, useTransition } from 'react';
import {
  addOverheadAction,
  endOverheadAction,
  reopenPeriodAction,
} from '@/app/actions/company';
import { Figure } from './figure';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

export interface Line {
  key: StringKey;
  value: string;
  /** True when the figure is zero, so nothing is subtracted from nothing. */
  isZero?: boolean;
  /** A subtraction from the line above, rather than a total in its own right. */
  deduct?: boolean;
  /** The two figures the whole screen exists to put next to each other. */
  emphasis?: 'gross' | 'operating';
  marginLabel?: string;
}

export interface OverheadView {
  id: string;
  name: string;
  category: string | null;
  amount: string;
  perMonth: string;
  cadence: string;
  endedOn: string | null;
}

export interface ShareView {
  name: string;
  amount: string;
}

/**
 * The month.
 *
 * A waterfall, because that is what an owner already draws on the back of an
 * envelope: bill, take away what it cost, take away what the company costs, and
 * look at what is left. Writing it down in that order is most of the value —
 * each line is a number they can check, and the last one is the only one that
 * answers the question they actually asked.
 *
 * Two figures carry weight and the rest are quiet: gross margin, which every
 * deal card in the product already agrees with, and the real margin, which none
 * of them can see. Putting them one above the other is the entire argument.
 */
export function Month({
  lines,
  currency,
  grossMargin,
  operatingMargin,
  isLoss,
  dealCount,
  breakEven,
  shares,
  retained,
  overheads,
  period,
  locale,
}: {
  lines: Line[];
  currency: string;
  grossMargin: string | null;
  operatingMargin: string | null;
  isLoss: boolean;
  dealCount: number;
  breakEven: string | null;
  shares: ShareView[];
  retained: string;
  overheads: OverheadView[];
  period: { id: string; status: 'open' | 'closed'; reopenCount: number } | null;
  locale: Locale;
}) {
  const t = translator(locale);

  return (
    <div className="space-y-8">
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
        <div className="max-w-xl">
          <dl className="divide-y divide-line rounded-[12px] border border-line bg-paper-raised">
            {lines.map((line) => (
              <div
                key={line.key}
                className={`flex items-baseline justify-between gap-4 px-4 ${
                  line.emphasis ? 'py-4' : 'py-2.5'
                }`}
              >
                <dt
                  className={
                    line.emphasis
                      ? 'text-[14px] font-medium'
                      : line.deduct
                        ? 'text-[13px] text-ink-faint'
                        : 'text-[13px] text-ink-soft'
                  }
                >
                  {t(line.key)}
                  {line.marginLabel ? (
                    <span className="ms-2 text-[12px] font-normal text-ink-faint">
                      {line.marginLabel}
                    </span>
                  ) : null}
                </dt>
                <dd
                  className={`reading shrink-0 ${
                    line.emphasis === 'operating'
                      ? `text-[20px] ${isLoss ? 'text-below-ink' : 'text-ink'}`
                      : line.emphasis === 'gross'
                        ? 'text-[16px] text-ink'
                        : line.deduct
                          ? 'text-[13px] text-ink-faint'
                          : 'text-[13px] text-ink-soft'
                  }`}
                >
                  {/* A deduction of nothing is not "−0.00": there is nothing
                      being taken away, and the minus sign says there is. */}
                  <Figure>{line.deduct && !line.isZero ? `−${line.value}` : line.value}</Figure>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-2 text-[12px] text-ink-faint">
            <Figure>{dealCount}</Figure> {t('month.deals')}
            {grossMargin && operatingMargin ? (
              <>
                {' · '}
                {t('month.grossMargin')} <Figure>{grossMargin}</Figure>
                {' · '}
                {t('month.operatingMargin')} <Figure>{operatingMargin}</Figure>
              </>
            ) : null}
          </p>

          {isLoss ? (
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-below-ink">
              {t('month.lossNote')}
            </p>
          ) : null}
        </div>

        <div className="mt-6 space-y-4 lg:mt-0">
          <div className="rounded-[12px] border border-line bg-paper-raised p-4">
            <span className="block text-[12px] leading-snug text-ink-faint">
              {t('month.breakEven')}
            </span>
            <span className="reading mt-1 block text-[20px] text-ink">
              {breakEven ? <Figure>{breakEven}</Figure> : '—'}
              <span className="ms-1.5 font-sans text-[11px] text-ink-faint">{currency}</span>
            </span>
            {!breakEven ? (
              <span className="mt-1 block text-[11px] text-ink-faint">
                {t('month.breakEvenNone')}
              </span>
            ) : null}
          </div>

          <div className="rounded-[12px] border border-line bg-paper-raised p-4">
            <span className="block text-[12px] text-ink-faint">{t('month.splitTitle')}</span>
            {shares.length === 0 ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                {t('month.noPartners')}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {shares.map((share) => (
                  <li
                    key={share.name}
                    className="flex items-baseline justify-between gap-3 text-[13px]"
                  >
                    <span className="truncate text-ink-soft">{share.name}</span>
                    <span className="reading shrink-0 text-ink">
                      <Figure>{share.amount}</Figure>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 text-[13px]">
              <span className="text-ink-soft">{t('month.retained')}</span>
              <span className="reading text-ink">
                <Figure>{retained}</Figure>
              </span>
            </div>
          </div>

          {period && (period.status === 'closed' || period.reopenCount > 0) ? (
            <PeriodLock period={period} locale={locale} />
          ) : null}
        </div>
      </section>

      <Overheads overheads={overheads} currency={currency} locale={locale} />
    </div>
  );
}

/** Closing and — when somebody finds last month's invoice — reopening. */
function PeriodLock({
  period,
  locale,
}: {
  period: { id: string; status: 'open' | 'closed'; reopenCount: number };
  locale: Locale;
}) {
  const t = translator(locale);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[12px] border border-line bg-paper-raised p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-ink-faint">
          {period.status === 'closed' ? t('month.locked') : t('month.open')}
        </span>
        {period.reopenCount > 0 ? (
          <span className="text-[11px] text-ink-faint">
            {t('month.reopened')} <Figure>{period.reopenCount}</Figure>{' '}
            {t('month.reopenTimes')}
          </span>
        ) : null}
      </div>

      {period.status === 'closed' && !asking ? (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="mt-2 rounded-[8px] border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
        >
          {t('month.reopen')}
        </button>
      ) : null}

      {asking ? (
        <form
          action={(form) =>
            startTransition(async () => {
              setError(null);
              const result = await reopenPeriodAction(
                period.id,
                String(form.get('reason') ?? ''),
              );
              if (result.ok) setAsking(false);
              else
                setError(
                  result.error.includes(' ') ? result.error : t(result.error as StringKey),
                );
            })
          }
          className="mt-3 space-y-2"
        >
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('month.reopenWhy')}</span>
            <input
              name="reason"
              required
              autoFocus
              className="mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
            />
          </label>
          <p className="text-[11px] leading-relaxed text-ink-faint">{t('month.reopenNote')}</p>
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
              {t('month.reopen')}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="text-[12px] text-ink-faint hover:text-ink-soft"
            >
              {t('cost.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Overheads({
  overheads,
  currency,
  locale,
}: {
  overheads: OverheadView[];
  currency: string;
  locale: Locale;
}) {
  const t = translator(locale);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field =
    'mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink';

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-medium">{t('month.overheadTitle')}</h2>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
        >
          {t('month.addOverhead')}
        </button>
      </div>

      {adding ? (
        <form
          action={(form) =>
            startTransition(async () => {
              setError(null);
              const result = await addOverheadAction({
                name: String(form.get('name') ?? ''),
                category: String(form.get('category') ?? ''),
                amount: String(form.get('amount') ?? ''),
                cadence: String(form.get('cadence') ?? 'monthly'),
              });
              if (result.ok) setAdding(false);
              else
                setError(
                  result.error.includes(' ') ? result.error : t(result.error as StringKey),
                );
            })
          }
          className="mt-4 max-w-xl space-y-3 rounded-[12px] border border-line bg-paper-raised p-4"
        >
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('month.overheadName')}</span>
            <input name="name" required autoFocus className={field} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] text-ink-soft">
                {t('month.overheadAmount')} ({currency})
              </span>
              <input name="amount" inputMode="decimal" required className={`reading ${field}`} />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-soft">{t('month.cadence')}</span>
              <select name="cadence" defaultValue="monthly" className={`${field} appearance-none`}>
                {['monthly', 'quarterly', 'yearly', 'one_off'].map((cadence) => (
                  <option key={cadence} value={cadence}>
                    {t(`month.cadence.${cadence}` as StringKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
              {pending ? `${t('team.saving')}…` : t('settings.save')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-[12px] text-ink-faint hover:text-ink-soft"
            >
              {t('cost.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {overheads.length === 0 ? (
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-soft">
          {t('month.overheadNone')}
        </p>
      ) : (
        <ul className="mt-4 max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
          {overheads.map((overhead) => (
            <li
              key={overhead.id}
              className={`flex items-baseline justify-between gap-4 px-4 py-3 ${
                overhead.endedOn ? 'opacity-55' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px]">{overhead.name}</span>
                <span className="block text-[12px] text-ink-faint">
                  {t(`month.cadence.${overhead.cadence}` as StringKey)}
                  {overhead.endedOn ? ` · ${t('month.stopped')} ${overhead.endedOn}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="reading block text-[13px] text-ink-soft">
                  <Figure>{overhead.perMonth}</Figure>
                  <span className="ms-1 font-sans text-[11px] text-ink-faint">
                    {t('month.perMonth')}
                  </span>
                </span>
                {!overhead.endedOn ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await endOverheadAction(overhead.id);
                      })
                    }
                    className="mt-1 text-[11px] text-ink-faint hover:text-ink-soft disabled:opacity-50"
                  >
                    {t('month.stop')}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-ink-faint">
        {t('month.spreadNote')}
      </p>
    </section>
  );
}
