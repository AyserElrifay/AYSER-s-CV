import { CostStrip } from './cost-strip';
import { TaxTreatmentPicker } from './tax-treatment-picker';
import { Figure } from './figure';
import { PriceInstrument } from './price-instrument';
import { type DealCardModel } from '@/server/queries';
import { type Locale, type StringKey, directionOf, translator } from '@/i18n/dictionary';
import { type AppRole } from '@/db/roles';
import { formatBasisPoints, formatMoney } from '@/money';

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
  vat,
}: {
  deal: DealCardModel;
  locale: Locale;
  role: AppRole;
  thresholds: { healthyFromBp: number; warningFromBp: number };
  /** The agency's own tax position, which decides whether costs are typed gross. */
  vat: { registered: boolean; rateBp: number };
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
          costMinor={deal.cost.effective.minor.toString()}
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

      <InvoiceLine deal={deal} locale={locale} canEdit={canEdit} registered={vat.registered} />

      <CostStrip
        dealId={deal.id}
        cost={deal.cost}
        vat={vat}
        entryCount={deal.costEntryCount}
        unconvertedCount={deal.unconvertedCostCount}
        locale={locale}
        canEdit={canEdit}
      />

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

/**
 * What the client is invoiced, when that is not what the agency earns.
 *
 * The instrument above reads net, always, because net is what the agency keeps
 * and net is what the margin is computed on. But somebody sending the invoice
 * needs the other number, and an account manager quoting over the phone needs
 * to know which of the two they are saying out loud.
 *
 * It is one quiet line and it carries no colour. Saturation in this card means
 * margin, and a tax rate is not a margin — the moment VAT is allowed to tint
 * anything, the one thing colour means here stops meaning it.
 */
function InvoiceLine({
  deal,
  locale,
  canEdit,
  registered,
}: {
  deal: DealCardModel;
  locale: Locale;
  canEdit: boolean;
  registered: boolean;
}) {
  const t = translator(locale);
  const treatment = deal.taxed.treatment;

  // An agency that is not registered has nothing to say here and is not made to
  // read a line about a tax it does not charge.
  if (!registered && treatment === 'not_registered') return null;

  const gross = formatMoney(deal.taxed.gross, { locale, display: 'none' });
  const charging = deal.taxed.vat.minor !== 0n;

  return (
    <div className="mt-3 flex items-baseline justify-between gap-3 text-[11px] text-card-ink-faint">
      {registered && canEdit ? (
        <TaxTreatmentPicker dealId={deal.id} treatment={treatment} locale={locale} />
      ) : (
        <span>{t(`tax.treatment.${treatment}` as StringKey)}</span>
      )}
      {charging ? (
        <span className="reading shrink-0 text-card-ink-soft">
          <Figure>{gross}</Figure>
          <span className="ms-1.5 font-sans text-card-ink-faint">
            {t('tax.inclusive')} <Figure>{formatBasisPoints(deal.taxed.rateBp, { locale })}</Figure>
          </span>
        </span>
      ) : (
        // Four treatments charge nothing and they charge nothing for four
        // different reasons. Saying "the client accounts for the tax" under an
        // exempt supply is worse than saying nothing: it describes an
        // obligation that nobody has.
        <span className="shrink-0">{t(`tax.why.${treatment}` as StringKey)}</span>
      )}
    </div>
  );
}
