'use client';

import { useState, useTransition } from 'react';
import { type CostPosition, formatBasisPoints, formatMoney } from '@/money';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import { addCostAction } from '@/app/actions/deal';
import { Figure } from './figure';

/**
 * What was actually spent, and what that does to the margin above.
 *
 * The form is three fields and it is three fields on purpose. Every field added
 * here is one somebody has to fill in while standing in a print shop, and the
 * moment that takes longer than a few seconds costs stop being recorded — at
 * which point every margin in the product quietly goes back to being a guess.
 *
 * The receipt photo belongs here and is not here: it needs object storage. The
 * column is waiting for it, and so is the WhatsApp capture that will actually
 * make this happen without anyone opening the app.
 */
export function CostStrip({
  dealId,
  cost,
  vat,
  entryCount,
  unconvertedCount,
  locale,
  canEdit,
}: {
  dealId: string;
  cost: CostPosition;
  /**
   * The agency's own tax position.
   *
   * The gross/net question is only asked of an agency that can reclaim its input
   * VAT. For one that cannot, the tax is simply part of what the work cost, the
   * whole figure is the cost, and asking would be a field to fill in for no
   * change in the answer.
   */
  vat: { registered: boolean; rateBp: number };
  entryCount: number;
  unconvertedCount: number;
  locale: Locale;
  canEdit: boolean;
}) {
  const t = translator(locale);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<StringKey | null>(null);
  const [pending, startTransition] = useTransition();
  // Defaults to on, because an invoice arrives with the tax already in it and
  // the person copying the number is copying gross whether they notice or not.
  const [includesVat, setIncludesVat] = useState(true);
  const asksAboutVat = vat.registered && vat.rateBp > 0;

  const fmt = (value: Parameters<typeof formatMoney>[0]) =>
    formatMoney(value, { locale, display: 'none' });

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await addCostAction({
        dealId,
        amount: String(form.get('amount') ?? ''),
        vendor: String(form.get('vendor') ?? ''),
        spentOn: String(form.get('spentOn') ?? ''),
        includesVat: asksAboutVat && includesVat,
      });
      if (result.ok) setOpen(false);
      else setError(result.error as StringKey);
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mt-5 border-t border-card-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-card-ink-faint">{t('cost.title')}</span>
        <span className="reading text-[13px] text-card-ink-soft">
          <Figure>{fmt(cost.actual)}</Figure>
          <span className="mx-1.5 font-sans text-card-ink-faint">{t('cost.of')}</span>
          <Figure>{fmt(cost.estimated)}</Figure>
        </span>
      </div>

      {entryCount === 0 ? (
        <p className="mt-2 text-[12px] leading-relaxed text-card-ink-faint">{t('cost.none')}</p>
      ) : cost.driftBasisPoints !== null ? (
        <p
          className={`mt-2 text-[12px] ${
            cost.alerting ? 'text-below' : 'text-card-ink-faint'
          }`}
        >
          <Figure>{formatBasisPoints(Math.abs(cost.driftBasisPoints), { locale })}</Figure>{' '}
          {cost.driftBasisPoints >= 0 ? t('cost.over') : t('cost.under')}
        </p>
      ) : null}

      {/* The alert is the whole point of Phase 4: the moment spending passes the
          estimate, the number the deal has been reporting to everyone who looked
          at it has stopped being true. */}
      {cost.alerting ? (
        <p className="mt-2 text-[12px] leading-relaxed text-below">{t('cost.driftAlert')}</p>
      ) : null}

      {unconvertedCount > 0 ? (
        <p className="mt-2 text-[12px] text-card-ink-faint">
          <Figure>{unconvertedCount}</Figure> {t('cost.unconverted')}
        </p>
      ) : null}

      {canEdit && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-[8px] border border-card-line px-3 py-1.5 text-[12px] text-card-ink-soft hover:text-card-ink"
        >
          {t('cost.add')}
        </button>
      ) : null}

      {canEdit && open ? (
        <form action={submit} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">{t('cost.amount')}</span>
              <input
                name="amount"
                inputMode="decimal"
                autoFocus
                required
                placeholder={t('cost.amount')}
                className="reading w-full rounded-[8px] border border-card-line bg-card-raised px-2.5 py-1.5 text-[13px] text-card-ink placeholder:font-sans placeholder:text-card-ink-faint"
              />
            </label>
            <label className="flex-1">
              <span className="sr-only">{t('cost.vendor')}</span>
              <input
                name="vendor"
                placeholder={t('cost.vendor')}
                className="w-full rounded-[8px] border border-card-line bg-card-raised px-2.5 py-1.5 text-[13px] text-card-ink placeholder:text-card-ink-faint"
              />
            </label>
          </div>
          {/* One checkbox, not a second amount field. The split is arithmetic the
              product can do; what it cannot know is which number was typed. */}
          {asksAboutVat ? (
            <label className="flex items-center gap-2 text-[12px] text-card-ink-soft">
              <input
                type="checkbox"
                name="includesVat"
                checked={includesVat}
                onChange={(event) => setIncludesVat(event.target.checked)}
                className="size-3.5 accent-card-ink"
              />
              <span>
                {t('cost.includesVat')}{' '}
                <span className="reading text-card-ink-faint">
                  <Figure>{formatBasisPoints(vat.rateBp, { locale })}</Figure>
                </span>
              </span>
            </label>
          ) : null}

          <label className="block">
            <span className="sr-only">{t('cost.date')}</span>
            <input
              name="spentOn"
              type="date"
              defaultValue={today}
              className="reading w-full rounded-[8px] border border-card-line bg-card-raised px-2.5 py-1.5 text-[13px] text-card-ink"
            />
          </label>

          {asksAboutVat && includesVat ? (
            <p className="text-[11px] leading-relaxed text-card-ink-faint">
              {t('cost.vatSplitNote')}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-[12px] text-below">
              {t(error)}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[8px] bg-card-ink px-3 py-1.5 text-[13px] font-medium text-card disabled:opacity-60"
            >
              {pending ? `${t('cost.saving')}…` : t('cost.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="text-[12px] text-card-ink-faint hover:text-card-ink-soft"
            >
              {t('cost.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
