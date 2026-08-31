import { redirect } from 'next/navigation';
import { sql as raw } from 'drizzle-orm';
import { EmptyState } from '@/components/empty-state';
import { Figure } from '@/components/figure';
import { OpenPeriod } from '@/components/open-period';
import { PeriodClose, type PreviewLine } from '@/components/period-close';
import { withTenant } from '@/db/client';
import { type StringKey, translator } from '@/i18n/dictionary';
import { formatBasisPoints, formatMoney, money } from '@/money';
import { buildPayoutRun, getPeriods, getSplitRules, getStatements } from '@/server/payouts';
import { currentMonth } from '@/server/onboarding';
import { contextFor, requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const user = await requireUser();
  // A Member has no business on this screen, and the database would refuse
  // every query on it anyway. Sending them away is kinder than an error.
  if (user.role === 'member') redirect('/app');

  const ctx = contextFor(user);
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);
  const fmt = (minor: bigint, currency: Parameters<typeof money>[1]) =>
    formatMoney(money(minor, currency), { locale, display: 'none' });

  const statements = await getStatements(ctx);

  // --- everyone who is not the owner sees their own statements and stops -----
  if (user.role !== 'owner') {
    return (
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('payouts.myStatements')}</h1>
        {statements.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t('payouts.statements')} body={t('payouts.noStatements')} />
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {statements.map((statement) => (
              <li key={statement.id}>
                <StatementCard
                  periodStartsOn={statement.periodStartsOn}
                  periodEndsOn={statement.periodEndsOn}
                  amount={fmt(statement.amountMinor, statement.currency)}
                  adjusted={
                    statement.adjustmentMinor === 0n
                      ? null
                      : fmt(statement.amountMinor + statement.adjustmentMinor, statement.currency)
                  }
                  currency={statement.currency}
                  adjustedLabel={t('payouts.adjusted')}
                  receivedLabel={t('payouts.received')}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-[12px] leading-relaxed text-ink-faint">
          {t('payouts.immutableNote')}
        </p>
      </section>
    );
  }

  // --- the owner ------------------------------------------------------------
  const [rules, periods] = await Promise.all([getSplitRules(ctx), getPeriods(ctx)]);
  const openPeriod = periods.find((period) => period.status === 'open') ?? null;

  let preview: { lines: PreviewLine[]; dealCount: number; distributable: string; bonusPool: string; retained: string } | null =
    null;

  if (openPeriod) {
    const { run, dealCount } = await buildPayoutRun(ctx, openPeriod.id);
    const names = await namesFor(ctx, run.statements.map((s) => s.beneficiaryUserId));
    preview = {
      dealCount,
      lines: run.statements.map((statement) => ({
        name: names.get(statement.beneficiaryUserId) ?? '—',
        currency: statement.currency,
        amount: fmt(statement.total.minor, statement.currency),
      })),
      distributable: run.distributable.map((v) => fmt(v.minor, v.currency)).join(' · ') || '—',
      bonusPool: run.bonusPool.map((v) => fmt(v.minor, v.currency)).join(' · ') || '—',
      retained: run.retained.map((v) => fmt(v.minor, v.currency)).join(' · ') || '—',
    };
  }

  const claimed = rules.reduce((total, rule) => total + rule.rateBp, 0);

  // The month containing the day after the latest period ended, so the offer is
  // always the obvious next one and never overlaps what has already been paid.
  const latest = periods[0];
  const nextPeriod = latest ? monthAfter(latest.endsOn) : currentMonth();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('payouts.title')}</h1>

        {openPeriod && preview ? (
          <article className="mt-5 max-w-2xl rounded-[14px] bg-card p-6 text-card-ink shadow-[0_1px_2px_rgba(20,26,24,0.08),0_12px_28px_-12px_rgba(20,26,24,0.35)]">
            <header className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] tracking-wide text-card-ink-faint uppercase">
                  {t('payouts.period')}
                </span>
                <p className="reading mt-1 text-[20px] text-card-ink">
                  <Figure>{`${openPeriod.startsOn} — ${openPeriod.endsOn}`}</Figure>
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-card-line px-2.5 py-0.5 text-[11px] text-card-ink-soft">
                {t('payouts.open')}
              </span>
            </header>

            <div className="mt-5">
              <PeriodClose periodId={openPeriod.id} locale={locale} canClose {...preview} />
            </div>
          </article>
        ) : (
          <div className="mt-5 max-w-2xl space-y-4">
            <EmptyState title={t('payouts.period')} body={t('payouts.allClosed')} />
            <OpenPeriod locale={locale} startsOn={nextPeriod.startsOn} endsOn={nextPeriod.endsOn} />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-medium">{t('payouts.policy')}</h2>
        <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-ink-faint">
          {t('payouts.policyNote')}
        </p>
        {rules.length === 0 ? (
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-soft">
            {t('payouts.noRules')}
          </p>
        ) : (
          <ul className="mt-4 max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="text-[14px]">
                  {t(`payouts.rule.${rule.kind}` as StringKey)}
                  {rule.beneficiaryName ? (
                    <span className="text-ink-soft"> · {rule.beneficiaryName}</span>
                  ) : null}
                </span>
                <span className="reading text-[13px] text-ink-soft">
                  <Figure>{formatBasisPoints(rule.rateBp, { locale })}</Figure>
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="text-[14px] text-ink-soft">{t('payouts.retainedRule')}</span>
              <span className="reading text-[13px] text-ink-faint">
                <Figure>{formatBasisPoints(10_000 - claimed, { locale })}</Figure>
              </span>
            </li>
          </ul>
        )}
      </section>

      {statements.length > 0 ? (
        <section>
          <h2 className="text-[15px] font-medium">{t('payouts.statements')}</h2>
          <ul className="mt-4 max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
            {statements.map((statement) => (
              <li
                key={statement.id}
                className="flex items-baseline justify-between gap-4 px-4 py-3 text-[13px]"
              >
                <span className="flex items-baseline gap-2">
                  <span>{statement.beneficiaryName ?? '—'}</span>
                  <span className="reading text-[11px] text-ink-faint">
                    <Figure>{statement.periodStartsOn}</Figure>
                  </span>
                </span>
                <span className="reading text-ink-soft">
                  <Figure>{fmt(statement.amountMinor, statement.currency)}</Figure>
                  <span className="ms-1.5 font-sans text-[11px] text-ink-faint">
                    {statement.currency}
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

function StatementCard({
  periodStartsOn,
  periodEndsOn,
  amount,
  adjusted,
  currency,
  adjustedLabel,
  receivedLabel,
}: {
  periodStartsOn: string;
  periodEndsOn: string;
  amount: string;
  adjusted: string | null;
  currency: string;
  adjustedLabel: string;
  receivedLabel: string;
}) {
  return (
    <article className="max-w-2xl rounded-[14px] bg-card p-6 text-card-ink shadow-[0_1px_2px_rgba(20,26,24,0.08),0_12px_28px_-12px_rgba(20,26,24,0.35)]">
      <span className="text-[11px] tracking-wide text-card-ink-faint uppercase">
        {receivedLabel}
      </span>
      <p className="reading mt-1 text-[30px] leading-none text-card-ink">
        <Figure>{adjusted ?? amount}</Figure>
        <span className="ms-2 font-sans text-[12px] text-card-ink-faint">{currency}</span>
      </p>
      {adjusted ? (
        <p className="reading mt-2 text-[12px] text-card-ink-faint">
          <Figure>{amount}</Figure>{' '}
          <span className="font-sans">{adjustedLabel}</span>
        </p>
      ) : null}
      <p className="reading mt-4 border-t border-card-line pt-3 text-[12px] text-card-ink-faint">
        <Figure>{`${periodStartsOn} — ${periodEndsOn}`}</Figure>
      </p>
    </article>
  );
}

/** The calendar month that begins the day after a period ended. */
function monthAfter(endsOn: string): { startsOn: string; endsOn: string } {
  // Midday UTC so a timezone can never push the date back into the old month.
  const dayAfter = new Date(`${endsOn}T12:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  return currentMonth(dayAfter);
}

/** Names for the preview. Read under the caller's own policies, like everything else. */
async function namesFor(
  ctx: Parameters<typeof withTenant>[0],
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{ [column: string]: unknown; id: string; name: string }>(
      raw`select id, name from users`,
    ),
  );
  return new Map(Array.from(rows).map((row) => [row.id, row.name]));
}
