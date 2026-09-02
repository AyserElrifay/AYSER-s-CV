'use client';

import { useState, useTransition } from 'react';
import { addContactAction, recordAction, scheduleAction } from '@/app/actions/conversations';
import { Figure } from './figure';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

export interface TalkView {
  id: string;
  clientName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  dealTitle: string | null;
  ownerName: string | null;
  kind: string;
  state: string;
  subject: string;
  when: string;
  day: string;
  minutes: number | null;
  place: string | null;
  agenda: string | null;
  notes: string | null;
  nextStep: string | null;
  nextStepOn: string | null;
  overdue: boolean;
}

export interface ContactView {
  id: string;
  clientId: string;
  clientName: string | null;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  lastSpokeDays: number | null;
}

export interface SilenceView {
  unwritten: number;
  overdue: number;
  quiet: Array<{ id: string; name: string; days: number | null }>;
}

/**
 * What is coming, what was said, and who has not been spoken to.
 *
 * Two shapes. On a phone it is one column and you scroll: coming up, then what
 * happened, then the numbers to call. On a desktop the directory moves to a
 * column of its own beside the log, because both are things you glance between
 * while you are on a call — and a person on a call does not scroll.
 *
 * No money anywhere on this screen. A conversation has no price and no margin,
 * and putting a figure here would be the product guessing at the one thing it
 * cannot know. The colour rule holds by having nothing to attach to.
 */
export function Conversations({
  upcoming,
  past,
  contacts,
  silence,
  clients,
  deals,
  locale,
}: {
  upcoming: TalkView[];
  past: TalkView[];
  contacts: ContactView[];
  silence: SilenceView;
  clients: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; title: string }>;
  locale: Locale;
}) {
  const t = translator(locale);
  const [composing, setComposing] = useState(false);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <div className="space-y-8">
        <Silence silence={silence} locale={locale} />

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-medium">{t('talk.upcoming')}</h2>
            <button
              type="button"
              onClick={() => setComposing((open) => !open)}
              className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
            >
              {t('talk.schedule')}
            </button>
          </div>

          {composing ? (
            <ScheduleForm
              clients={clients}
              deals={deals}
              contacts={contacts}
              locale={locale}
              onDone={() => setComposing(false)}
            />
          ) : null}

          {upcoming.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              {t('talk.nothingPlanned')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((talk) => (
                <li key={talk.id}>
                  <TalkCard talk={talk} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-[15px] font-medium">{t('talk.past')}</h2>
          {past.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-soft">{t('talk.nothingYet')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {past.map((talk) => (
                <li key={talk.id}>
                  <TalkCard talk={talk} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* On a phone this follows the log. On a desktop it sits beside it, which
          is where a phone number is useful: in view while you read the note. */}
      <div className="mt-8 lg:mt-0 lg:sticky lg:top-10">
        <Directory contacts={contacts} clients={clients} locale={locale} />
      </div>
    </div>
  );
}

/**
 * The measurement.
 *
 * Three questions a calendar never asks. It is the only thing on this screen
 * that is not a list, and it earns that by being the reason the screen exists.
 */
function Silence({ silence, locale }: { silence: SilenceView; locale: Locale }) {
  const t = translator(locale);
  const quiet = silence.quiet;
  const clear = silence.unwritten === 0 && silence.overdue === 0 && quiet.length === 0;

  if (clear) {
    return (
      <p className="rounded-[10px] border border-line bg-paper-raised px-4 py-3 text-[13px] text-ink-soft">
        {t('talk.silenceClear')}
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {silence.unwritten > 0 ? (
        <li className="rounded-[10px] border border-line bg-paper-raised px-4 py-3">
          <span className="reading text-[22px] leading-none text-ink">
            <Figure>{silence.unwritten}</Figure>
          </span>
          <span className="mt-1.5 block text-[12px] leading-snug text-ink-soft">
            {t('talk.unwritten')}
          </span>
        </li>
      ) : null}
      {silence.overdue > 0 ? (
        <li className="rounded-[10px] border border-line bg-paper-raised px-4 py-3">
          <span className="reading text-[22px] leading-none text-ink">
            <Figure>{silence.overdue}</Figure>
          </span>
          <span className="mt-1.5 block text-[12px] leading-snug text-ink-soft">
            {t('talk.overdue')}
          </span>
        </li>
      ) : null}
      {quiet.length > 0 ? (
        <li className="rounded-[10px] border border-line bg-paper-raised px-4 py-3 sm:col-span-2 lg:col-span-1">
          <span className="block text-[12px] text-ink-faint">{t('talk.quiet')}</span>
          <span className="mt-1 block text-[13px] leading-snug text-ink-soft">
            {quiet.map((c) => c.name).join('، ')}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

/** One conversation, and the form for writing down what was said. */
function TalkCard({ talk, locale }: { talk: TalkView; locale: Locale }) {
  const t = translator(locale);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const needsNote = talk.state === 'happened' && !talk.notes;

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await recordAction({
        id: talk.id,
        state: String(form.get('state') ?? 'happened'),
        notes: String(form.get('notes') ?? ''),
        nextStep: String(form.get('nextStep') ?? ''),
        nextStepOn: String(form.get('nextStepOn') ?? ''),
      });
      if (result.ok) setWriting(false);
      else setError(result.error.includes(' ') ? result.error : t(result.error as StringKey));
    });
  };

  return (
    <article className="rounded-[12px] border border-line bg-paper-raised p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-[14px] font-medium">{talk.subject}</h3>
        <span className="reading shrink-0 text-[12px] text-ink-faint" dir="ltr">
          {talk.when}
        </span>
      </header>

      <p className="mt-1 text-[12px] text-ink-faint">
        {t(`talk.kind.${talk.kind}` as StringKey)}
        {talk.clientName ? ` · ${talk.clientName}` : ''}
        {talk.contactName ? ` · ${talk.contactName}` : ''}
        {talk.dealTitle ? ` · ${talk.dealTitle}` : ''}
        {talk.place ? ` · ${talk.place}` : ''}
      </p>

      {talk.agenda && !talk.notes ? (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{talk.agenda}</p>
      ) : null}

      {talk.notes ? (
        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
          {talk.notes}
        </p>
      ) : null}

      {talk.nextStep ? (
        <p
          className={`mt-2 text-[12px] ${talk.overdue ? 'text-below-ink' : 'text-ink-faint'}`}
        >
          {t('talk.nextStep')}: {talk.nextStep}
          {talk.nextStepOn ? (
            <>
              {' · '}
              <span className="reading" dir="ltr">
                {talk.nextStepOn}
              </span>
              {talk.overdue ? ` ${t('talk.overdueOn')}` : ''}
            </>
          ) : null}
        </p>
      ) : null}

      {/* The one thing this screen is for. A conversation that happened and says
          nothing is a conversation that did not happen, three weeks later. */}
      {needsNote ? (
        <p className="mt-2 text-[12px] text-below-ink">{t('talk.unwritten')}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {talk.contactPhone ? (
          <>
            <a
              href={`tel:${talk.contactPhone.replace(/[^\d+]/g, '')}`}
              className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
            >
              {t('talk.call')}
            </a>
            <a
              href={`https://wa.me/${talk.contactPhone.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
            >
              {t('talk.whatsapp')}
            </a>
          </>
        ) : null}
        {!writing ? (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] ${
              needsNote
                ? 'bg-ink font-medium text-paper'
                : 'border border-line text-ink-soft hover:text-ink'
            }`}
          >
            {t('talk.write')}
          </button>
        ) : null}
      </div>

      {writing ? (
        <form action={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('talk.notes')}</span>
            <textarea
              name="notes"
              rows={3}
              autoFocus
              defaultValue={talk.notes ?? ''}
              className="mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-2 text-[14px] leading-relaxed text-ink"
            />
            <span className="mt-1 block text-[11px] text-ink-faint">{t('talk.notesHint')}</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-[9rem]">
              <span className="text-[12px] text-ink-soft">{t('talk.nextStep')}</span>
              <input
                name="nextStep"
                defaultValue={talk.nextStep ?? ''}
                className="mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
              />
            </label>
            <label className="flex-1 min-w-[9rem]">
              <span className="text-[12px] text-ink-soft">{t('talk.nextStepOn')}</span>
              <input
                name="nextStepOn"
                type="date"
                defaultValue={talk.nextStepOn ?? ''}
                className="reading mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('talk.state.happened')}</span>
            <select
              name="state"
              defaultValue={talk.state === 'scheduled' ? 'happened' : talk.state}
              className="mt-1 block w-full appearance-none rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink"
            >
              {['happened', 'no_answer', 'cancelled', 'scheduled'].map((state) => (
                <option key={state} value={state}>
                  {t(`talk.state.${state}` as StringKey)}
                </option>
              ))}
            </select>
          </label>

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
              {pending ? `${t('talk.saving')}…` : t('talk.save')}
            </button>
            <button
              type="button"
              onClick={() => setWriting(false)}
              className="text-[12px] text-ink-faint hover:text-ink-soft"
            >
              {t('cost.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function ScheduleForm({
  clients,
  deals,
  contacts,
  locale,
  onDone,
}: {
  clients: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; title: string }>;
  contacts: ContactView[];
  locale: Locale;
  onDone: () => void;
}) {
  const t = translator(locale);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const forClient = clientId ? contacts.filter((c) => c.clientId === clientId) : contacts;

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await scheduleAction({
        clientId: String(form.get('clientId') ?? ''),
        contactId: String(form.get('contactId') ?? ''),
        dealId: String(form.get('dealId') ?? ''),
        kind: String(form.get('kind') ?? 'call'),
        subject: String(form.get('subject') ?? ''),
        happensAt: String(form.get('happensAt') ?? ''),
        minutes: String(form.get('minutes') ?? ''),
        place: String(form.get('place') ?? ''),
        agenda: String(form.get('agenda') ?? ''),
      });
      if (result.ok) onDone();
      else setError(result.error.includes(' ') ? result.error : t(result.error as StringKey));
    });
  };

  const soon = new Date(Date.now() + 60 * 60 * 1000);
  soon.setMinutes(0, 0, 0);
  const defaultWhen = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const field =
    'mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink';

  return (
    <form
      action={submit}
      className="mt-4 space-y-3 rounded-[12px] border border-line bg-paper-raised p-4 sm:p-5"
    >
      <label className="block">
        <span className="text-[12px] text-ink-soft">{t('talk.subject')}</span>
        <input name="subject" required autoFocus className={field} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12px] text-ink-soft">{t('talk.kind')}</span>
          <select name="kind" defaultValue="call" className={`${field} appearance-none`}>
            {['call', 'meeting', 'site_visit', 'message'].map((kind) => (
              <option key={kind} value={kind}>
                {t(`talk.kind.${kind}` as StringKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-ink-soft">{t('talk.when')}</span>
          <input
            name="happensAt"
            type="datetime-local"
            required
            defaultValue={defaultWhen}
            className={`reading ${field}`}
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-ink-soft">{t('talk.client')}</span>
          <select
            name="clientId"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className={`${field} appearance-none`}
          >
            <option value="">{t('talk.none')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-ink-soft">{t('talk.contact')}</span>
          <select name="contactId" className={`${field} appearance-none`}>
            <option value="">{t('talk.none')}</option>
            {forClient.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-ink-soft">{t('talk.deal')}</span>
          <select name="dealId" className={`${field} appearance-none`}>
            <option value="">{t('talk.noDeal')}</option>
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-ink-soft">{t('talk.place')}</span>
          <input name="place" className={field} />
        </label>
      </div>

      <label className="block">
        <span className="text-[12px] text-ink-soft">{t('talk.agenda')}</span>
        <textarea name="agenda" rows={2} className={field} />
      </label>

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
          {pending ? `${t('talk.saving')}…` : t('talk.save')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-[12px] text-ink-faint hover:text-ink-soft"
        >
          {t('cost.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Who to call, with the number one tap away. */
function Directory({
  contacts,
  clients,
  locale,
}: {
  contacts: ContactView[];
  clients: Array<{ id: string; name: string }>;
  locale: Locale;
}) {
  const t = translator(locale);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const field =
    'mt-1 block w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink';

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-medium">{t('talk.directory')}</h2>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="text-[12px] text-ink-faint hover:text-ink-soft"
        >
          {t('talk.addContact')}
        </button>
      </div>

      {adding ? (
        <form
          action={(form) =>
            startTransition(async () => {
              const result = await addContactAction({
                clientId: String(form.get('clientId') ?? ''),
                name: String(form.get('name') ?? ''),
                title: String(form.get('title') ?? ''),
                phone: String(form.get('phone') ?? ''),
                email: String(form.get('email') ?? ''),
                isPrimary: form.get('isPrimary') === 'on',
              });
              if (result.ok) setAdding(false);
            })
          }
          className="mt-3 space-y-2.5 rounded-[10px] border border-line bg-paper-raised p-4"
        >
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('talk.client')}</span>
            <select name="clientId" required className={`${field} appearance-none`}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('talk.contactName')}</span>
            <input name="name" required className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('talk.contactTitle')}</span>
            <input name="title" className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft">{t('talk.contactPhone')}</span>
            <input name="phone" type="tel" dir="ltr" className={`reading ${field}`} />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ink-soft">
            <input type="checkbox" name="isPrimary" className="size-3.5 accent-ink" />
            {t('talk.primary')}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[8px] bg-ink px-3 py-1.5 text-[13px] font-medium text-paper disabled:opacity-60"
          >
            {pending ? `${t('talk.saving')}…` : t('talk.save')}
          </button>
        </form>
      ) : null}

      {contacts.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{t('talk.noContacts')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
          {contacts.map((contact) => (
            <li key={contact.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px]">{contact.name}</span>
                  <span className="block truncate text-[12px] text-ink-faint">
                    {contact.clientName}
                    {contact.title ? ` · ${contact.title}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {contact.lastSpokeDays === null ? (
                    t('talk.neverSpoken')
                  ) : (
                    <>
                      <Figure>{contact.lastSpokeDays}</Figure> {t('talk.daysAgo')}
                    </>
                  )}
                </span>
              </div>

              {contact.phone ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="reading text-[12px] text-ink-soft" dir="ltr">
                    {contact.phone}
                  </span>
                  {/* One tap, not a number to copy. This is the whole reason a
                      phone number lives in the product rather than in a phone. */}
                  <a
                    href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                    className="rounded-[6px] border border-line px-2 py-0.5 text-[11px] text-ink-soft hover:text-ink"
                  >
                    {t('talk.call')}
                  </a>
                  <a
                    href={`https://wa.me/${contact.phone.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[6px] border border-line px-2 py-0.5 text-[11px] text-ink-soft hover:text-ink"
                  >
                    {t('talk.whatsapp')}
                  </a>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
