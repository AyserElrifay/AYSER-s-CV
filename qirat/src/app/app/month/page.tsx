import { redirect } from 'next/navigation';
import { sql as raw } from 'drizzle-orm';
import { Month, type Line, type OverheadView, type ShareView } from '@/components/month';
import { withTenant } from '@/db/client';
import { translator } from '@/i18n/dictionary';
import { formatBasisPoints, formatMoney, money } from '@/money';
import { monthOf, monthPicture } from '@/server/company';
import { getOrgSettings } from '@/server/queries';
import { contextFor, requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

export const dynamic = 'force-dynamic';

/**
 * How the month is actually going.
 *
 * The owner's screen, and the database agrees: overheads and salaries are
 * granted to that role alone. An account manager sees their own deals'
 * economics and has no business with what the company costs to keep open.
 */
export default async function MonthPage() {
  const user = await requireUser();
  if (user.role !== 'owner') redirect('/app');

  const ctx = contextFor(user);
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);

  const settings = await getOrgSettings(ctx);
  if (!settings) redirect('/app');

  const month = monthOf();
  const view = await monthPicture(ctx, month, settings.defaultCurrency);
  const f = view.figures;
  const fmt = (value: { minor: bigint; currency: Parameters<typeof money>[1] }) =>
    formatMoney(money(value.minor, value.currency), { locale, display: 'none' });
  const pct = (bp: number | null) => (bp === null ? null : formatBasisPoints(bp, { locale }));

  /*
   * The waterfall, in the order somebody would check it.
   *
   * Gross profit first, because every deal card in the product already adds up
   * to it and the owner has been watching it all month. Then the three lines a
   * deal card cannot see, and then the number that answers the question.
   */
  const zero = (value: { minor: bigint }) => value.minor === 0n;
  const lines: Line[] = [
    { key: 'month.revenue', value: fmt(f.revenue) },
    { key: 'month.directCosts', value: fmt(f.directCosts), deduct: true, isZero: zero(f.directCosts) },
    { key: 'month.labour', value: fmt(f.labour), deduct: true, isZero: zero(f.labour) },
    {
      key: 'month.grossProfit',
      value: fmt(f.grossProfit),
      emphasis: 'gross',
      ...(pct(f.grossMarginBp) ? { marginLabel: pct(f.grossMarginBp)! } : {}),
    },
    { key: 'month.earnedSplits', value: fmt(f.earnedSplits), deduct: true, isZero: zero(f.earnedSplits) },
    { key: 'month.salaries', value: fmt(f.salaries), deduct: true, isZero: zero(f.salaries) },
    { key: 'month.overheads', value: fmt(f.overheads), deduct: true, isZero: zero(f.overheads) },
    {
      key: 'month.operating',
      value: fmt(f.operatingProfit),
      emphasis: 'operating',
      ...(pct(f.operatingMarginBp) ? { marginLabel: pct(f.operatingMarginBp)! } : {}),
    },
  ];

  // Names for the partner shares, read under the owner's own policies.
  const names = new Map<string, string>();
  if (f.partnerShares.some((share) => share.beneficiaryUserId)) {
    const rows = await withTenant(ctx, (tx) =>
      tx.execute<{ [column: string]: unknown; id: string; name: string }>(
        raw`select id, name from users`,
      ),
    );
    for (const row of Array.from(rows)) names.set(row.id, row.name);
  }

  const shares: ShareView[] = f.partnerShares.map((share) => ({
    name: share.beneficiaryUserId
      ? (names.get(share.beneficiaryUserId) ?? t('month.partner'))
      : t('month.partner'),
    amount: fmt(share.amount),
  }));

  const overheads: OverheadView[] = view.overheads.map((overhead) => ({
    id: overhead.id,
    name: overhead.name,
    category: overhead.category,
    amount: fmt({ minor: overhead.amountMinor, currency: overhead.currency }),
    perMonth: fmt({ minor: overhead.perMonthMinor, currency: overhead.currency }),
    cadence: overhead.cadence,
    endedOn: overhead.activeTo,
  }));

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('month.title')}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
          {t('month.intro')}
        </p>
      </section>

      <Month
        lines={lines}
        currency={view.currency}
        grossMargin={pct(f.grossMarginBp)}
        operatingMargin={pct(f.operatingMarginBp)}
        isLoss={f.isLoss}
        dealCount={view.dealCount}
        breakEven={
          view.breakEvenMinor === null
            ? null
            : fmt({ minor: view.breakEvenMinor, currency: view.currency })
        }
        shares={shares}
        retained={fmt(f.retained)}
        overheads={overheads}
        period={view.period}
        locale={locale}
      />
    </div>
  );
}
