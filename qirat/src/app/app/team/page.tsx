import { redirect } from 'next/navigation';
import { TeamRoster, type PersonView } from '@/components/team-roster';
import { translator } from '@/i18n/dictionary';
import { formatMoney, money } from '@/money';
import { getOrgSettings } from '@/server/queries';
import { listPeople } from '@/server/team';
import { contextFor, requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Who is here, and what a day of their time costs.
 *
 * The Owner's screen alone — `insert on users` is granted to that role and no
 * other, so this page could not be made to work for anybody else even if the
 * route forgot to send them away.
 */
export default async function TeamPage() {
  const user = await requireUser();
  if (user.role !== 'owner') redirect('/app');

  const ctx = contextFor(user);
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);

  const [settings, people] = await Promise.all([getOrgSettings(ctx), listPeople(ctx)]);
  if (!settings) redirect('/app');

  const view: PersonView[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    username: person.username,
    role: person.role,
    title: person.title,
    phone: person.phone,
    rate:
      person.dayRateMinor === null || person.rateCurrency === null
        ? null
        : formatMoney(money(person.dayRateMinor, person.rateCurrency), {
            locale,
            display: 'none',
          }),
    salary:
      person.monthlySalaryMinor === null || person.salaryCurrency === null
        ? null
        : formatMoney(money(person.monthlySalaryMinor, person.salaryCurrency), {
            locale,
            display: 'none',
          }),
    currency: person.rateCurrency,
    isActive: person.isActive,
    neverSignedIn: person.lastLoginAt === null,
    mustChangePassword: person.mustChangePassword,
    isYou: person.id === user.id,
  }));

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('team.title')}</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-soft">{t('team.intro')}</p>
      </section>

      <TeamRoster people={view} locale={locale} currency={settings.defaultCurrency} />
    </div>
  );
}
