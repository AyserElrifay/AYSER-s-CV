import { PriceInstrument } from './price-instrument';
import { type DealCardModel } from '@/server/queries';
import { type Locale, directionOf, translator } from '@/i18n/dictionary';
import { type AppRole } from '@/db/roles';

/**
 * The deal card is the home screen.
 *
 * A dashboard is something you check; a card is something you do. So the card
 * is not a panel on a page — it is a different material from the page: a solid
 * dark body sitting on the paper. Every number in the product lives inside this
 * body, and the workspace around it holds nothing but context.
 *
 * That is also why the colour rule survives. Saturation only ever appears in
 * here, attached to a margin. Outside the card the product is ink on paper.
 */
export function DealCard({
  deal,
  locale,
  role,
  thresholds,
}: {
  deal: DealCardModel;
  locale: Locale;
  role: AppRole;
  thresholds: { healthyFromBp: number; warningFromBp: number };
}) {
  const t = translator(locale);
  // A frozen deal is read-only for everyone: its terms are the record of what
  // was agreed, not a field.
  const canEdit = !deal.isFrozen && (role === 'owner' || role === 'account_manager');

  return (
    <article className="rounded-[14px] bg-card p-6 text-card-ink shadow-[0_1px_2px_rgba(20,26,24,0.08),0_12px_28px_-12px_rgba(20,26,24,0.35)]">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium text-card-ink">{deal.title}</h3>
          <p className="mt-0.5 truncate text-[12px] text-card-ink-faint">
            {deal.clientName}
            {deal.serviceName ? ` · ${deal.serviceName}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-card-line px-2.5 py-0.5 text-[11px] text-card-ink-soft">
          {t(`deal.status.${deal.status}`)}
        </span>
      </header>

      <div className="mt-5">
        <PriceInstrument
          dealId={deal.id}
          currency={deal.currency}
          priceMinor={deal.margin.revenue.minor.toString()}
          costMinor={deal.margin.directCosts.minor.toString()}
          houseRateBp={deal.houseRateBp}
          band={
            deal.band
              ? {
                  floorMinor: deal.band.floor.minor.toString(),
                  targetMinor: deal.band.target.minor.toString(),
                  ceilingMinor: deal.band.ceiling.minor.toString(),
                }
              : null
          }
          thresholds={thresholds}
          locale={locale}
          direction={directionOf(locale)}
          status={deal.status}
          canEdit={canEdit}
        />
      </div>

      <footer className="mt-5 flex items-center justify-between border-t border-card-line pt-4 text-[11px] text-card-ink-faint">
        <span>{t('deal.delivery')}</span>
        {/* A date is not a quantity: it is isolated so the bidi algorithm cannot
            reorder its parts inside Arabic text. */}
        <span className="reading" dir="ltr">
          {deal.deliveryDate ?? t('deal.noDelivery')}
        </span>
      </footer>
    </article>
  );
}
