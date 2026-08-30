import { MarginBar } from './margin-bar';
import { type DealCardModel } from '@/server/queries';
import { type Locale, translator } from '@/i18n/dictionary';
import { formatMoney } from '@/money';

/**
 * The deal card is the home screen.
 *
 * A dashboard is what you check; a card is what you do. Five fields, as the
 * brief has it, and the margin underneath them — the only place on the screen
 * where colour is allowed to mean anything.
 */
export function DealCard({ deal, locale }: { deal: DealCardModel; locale: Locale }) {
  const t = translator(locale);
  const fmt = (value: Parameters<typeof formatMoney>[0]) =>
    formatMoney(value, { locale, display: 'code' });

  return (
    <article className="rounded-[10px] border border-line bg-surface p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium">{deal.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-soft">
            {deal.clientName}
            {deal.serviceName ? ` · ${deal.serviceName}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-surface-sunk px-2.5 py-0.5 text-[12px] text-ink-soft">
          {t(`deal.status.${deal.status}`)}
        </span>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <Field label={t('deal.price')} value={fmt(deal.margin.revenue)} />
        <Field label={t('deal.cost')} value={fmt(deal.margin.directCosts)} />
        <Field label={t('deal.houseShare')} value={fmt(deal.margin.houseShare)} />
        <Field label={t('deal.distributable')} value={fmt(deal.margin.distributable)} />
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <MarginBar
          basisPoints={deal.margin.marginBasisPoints}
          state={deal.state}
          locale={locale}
          label={t('deal.margin')}
        />
      </div>

      <footer className="mt-4 flex items-center justify-between text-[12px] text-ink-faint">
        <span>{t('deal.delivery')}</span>
        <span className="tabular">
          {deal.deliveryDate ?? t('deal.noDelivery')}
        </span>
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
