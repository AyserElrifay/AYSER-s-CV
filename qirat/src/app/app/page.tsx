import { DealCard } from '@/components/deal-card';
import { EmptyState } from '@/components/empty-state';
import { Figure } from '@/components/figure';
import { translator } from '@/i18n/dictionary';
import {
  formatBasisPoints,
  formatMoney,
  marginBasisPoints,
  money,
  priceCostTemplate,
} from '@/money';
import { unitNoun } from '@/i18n/plural';
import { requireUser, contextFor } from '@/server/session';
import { resolveLocale } from '@/server/locale';
import {
  getDealCards,
  getOrgSettings,
  getRecentAudit,
  getServiceBands,
} from '@/server/queries';

export const dynamic = 'force-dynamic';

export default async function AppHome() {
  const user = await requireUser();
  const ctx = contextFor(user);
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);

  // A Member or Partner never reaches a query that selects a financial column.
  // The database would refuse it anyway; not asking is how the refusal stays a
  // safety net rather than the control.
  if (user.role === 'member') {
    return (
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('home.member.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{user.name}</p>
        <div className="mt-6">
          <EmptyState title={t('empty.tasks.title')} body={t('empty.tasks.body')} />
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-ink-faint">{t('member.plain')}</p>
      </section>
    );
  }

  if (user.role === 'partner') {
    return (
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('home.partner.title')}</h1>
        <div className="mt-6">
          <EmptyState title={t('empty.statements.title')} body={t('empty.statements.body')} />
        </div>
      </section>
    );
  }

  const settings = await getOrgSettings(ctx);
  if (!settings) {
    return <EmptyState title={t('empty.deals.title')} body={t('empty.deals.body')} />;
  }

  const [cards, bands, audit] = await Promise.all([
    getDealCards(ctx, settings),
    getServiceBands(ctx),
    user.role === 'owner' ? getRecentAudit(ctx) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">
          {user.role === 'owner' ? t('home.owner.title') : t('home.manager.title')}
        </h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {cards.length === 0 ? (
            <div className="sm:col-span-2">
              <EmptyState title={t('empty.deals.title')} body={t('empty.deals.body')} />
            </div>
          ) : (
            cards.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                locale={locale}
                role={user.role}
                thresholds={{
                  healthyFromBp: settings.marginHealthyBp,
                  warningFromBp: settings.marginWarningBp,
                }}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-medium">{t('catalogue.title')}</h2>
        <p className="mt-0.5 text-[12px] text-ink-faint">{t('catalogue.internal')}</p>
        <ul className="mt-4 max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
          {bands.map((band) => {
            const priced = priceCostTemplate(band.costTemplate, band.currency);
            const atFloor = marginBasisPoints(
              money(band.floorMinor, band.currency),
              priced.total,
            );
            return (
            <li key={band.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-4">
              <span className="text-[14px]">
                {locale === 'ar' && band.nameAr ? band.nameAr : band.name}
              </span>
              <span className="reading text-[13px] text-ink-soft">
                <Figure>
                  {formatMoney(money(band.floorMinor, band.currency), { locale, display: 'none' })}
                </Figure>
                {' · '}
                <span className="font-medium text-ink">
                  <Figure>
                    {formatMoney(money(band.targetMinor, band.currency), {
                      locale,
                      display: 'none',
                    })}
                  </Figure>
                </span>
                {' · '}
                <Figure>
                  {formatMoney(money(band.ceilingMinor, band.currency), {
                    locale,
                    display: 'none',
                  })}
                </Figure>
              </span>
              </div>

              {/*
                The build-up, one click away. Folded by default because the
                catalogue is a list of prices; opened, it is the answer to
                "why is that the cost", which is the question that decides
                whether anyone trusts the margin above it.
              */}
              {band.costTemplate.length > 0 ? (
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-[12px] text-ink-faint hover:text-ink-soft">
                    {t('catalogue.costToDeliver')}{' '}
                    <span className="reading">
                      <Figure>
                        {formatMoney(priced.total, { locale, display: 'none' })}
                      </Figure>
                    </span>
                    {atFloor !== null ? (
                      <>
                        {' · '}
                        {t('catalogue.marginAtFloor')}{' '}
                        <span className="reading">
                          <Figure>{formatBasisPoints(atFloor, { locale })}</Figure>
                        </span>
                      </>
                    ) : null}
                  </summary>
                  <ul className="mt-2 space-y-1 border-s-2 border-line ps-3">
                    {priced.rows.map((row, index) => (
                      <li
                        key={`${band.id}-${index}`}
                        className="flex items-baseline justify-between gap-3 text-[12px]"
                      >
                        <span className="text-ink-soft">
                          {locale === 'ar' ? row.line.labelAr : row.line.label}
                          <span className="text-ink-faint">
                            {' · '}
                            <Figure>
                              {new Intl.NumberFormat(
                                locale === 'ar' ? 'ar-EG' : 'en-US',
                              ).format(row.line.quantity)}
                            </Figure>{' '}
                            {unitNoun(row.line.unit, row.line.quantity, locale)}
                          </span>
                        </span>
                        <span className="reading text-ink-soft">
                          <Figure>
                            {formatMoney(row.total, { locale, display: 'none' })}
                          </Figure>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
            );
          })}
        </ul>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ink-faint">
          {t('catalogue.startingRates')}
        </p>
      </section>

      {user.role === 'owner' && (
        <section>
          <h2 className="text-[15px] font-medium">{t('audit.title')}</h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-faint">{t('audit.empty')}</p>
          ) : (
            <ul className="mt-4 max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised text-[13px]">
              {audit.map((entry) => (
                <li key={String(entry.id)} className="flex justify-between gap-4 px-4 py-2.5">
                  <span className="text-ink-soft">{entry.action}</span>
                  <span className="reading text-ink-faint" dir="ltr">
                    {entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
