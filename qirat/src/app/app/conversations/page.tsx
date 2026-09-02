import { redirect } from 'next/navigation';
import { sql as raw } from 'drizzle-orm';
import {
  Conversations,
  type ContactView,
  type SilenceView,
  type TalkView,
} from '@/components/conversations';
import { withTenant } from '@/db/client';
import { translator } from '@/i18n/dictionary';
import { clientList, contacts, recent, silence, upcoming } from '@/server/conversations';
import { contextFor, requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

export const dynamic = 'force-dynamic';

/**
 * The conversations.
 *
 * Reachable by the Owner and the account managers, because the client
 * relationship belongs to the agency rather than to whoever happened to make
 * the call. A Member and a Partner are sent away, and the database would refuse
 * them anyway — a freelancer does not need the client's mobile number and an
 * investor does not need to know who was called on Tuesday.
 */
export default async function ConversationsPage() {
  const user = await requireUser();
  if (user.role !== 'owner' && user.role !== 'account_manager') redirect('/app');

  const ctx = contextFor(user);
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);

  const [coming, past, directory, quiet, clients, deals] = await Promise.all([
    upcoming(ctx),
    recent(ctx),
    contacts(ctx),
    silence(ctx),
    clientList(ctx),
    // Titles only. This page has no business with what a deal is worth.
    withTenant(ctx, (tx) =>
      tx.execute<{ [column: string]: unknown; id: string; title: string }>(
        raw`select id, title from deals where status <> 'lost' order by created_at desc limit 50`,
      ),
    ).then((rows) => Array.from(rows).map((row) => ({ id: row.id, title: row.title }))),
  ]);

  /*
   * Dates are formatted on the server, in the reader's locale and calendar.
   *
   * Doing it in the browser would mean the first paint shows one thing and the
   * hydrated page another — and in Arabic that flash is the difference between
   * Arabic-Indic digits and Latin ones, which is not a subtle wobble.
   */
  const when = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const today = new Date().toISOString().slice(0, 10);

  const shape = (row: Awaited<ReturnType<typeof recent>>[number]): TalkView => ({
    id: row.id,
    clientName: row.clientName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    dealTitle: row.dealTitle,
    ownerName: row.ownerName,
    kind: row.kind,
    state: row.state,
    subject: row.subject,
    when: when.format(row.happensAt),
    day: row.happensAt.toISOString().slice(0, 10),
    minutes: row.minutes,
    place: row.place,
    agenda: row.agenda,
    notes: row.notes,
    nextStep: row.nextStep,
    nextStepOn: row.nextStepOn,
    overdue: row.nextStepOn !== null && row.nextStepOn < today,
  });

  const contactViews: ContactView[] = directory.map((contact) => ({
    id: contact.id,
    clientId: contact.clientId,
    clientName: contact.clientName,
    name: contact.name,
    title: contact.title,
    phone: contact.phone,
    email: contact.email,
    isPrimary: contact.isPrimary,
    lastSpokeDays: contact.lastSpokeDays,
  }));

  const silenceView: SilenceView = {
    unwritten: quiet.unwritten,
    overdue: quiet.overdue,
    quiet: quiet.quietClients,
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('talk.title')}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
          {t('talk.intro')}
        </p>
      </section>

      <Conversations
        upcoming={coming.map(shape)}
        past={past.map(shape)}
        contacts={contactViews}
        silence={silenceView}
        clients={clients}
        deals={deals}
        locale={locale}
      />
    </div>
  );
}
