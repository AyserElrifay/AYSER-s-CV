import 'server-only';
import { sql as raw } from 'drizzle-orm';
import { type TenantContext, withTenant } from '@/db/client';

/**
 * Calls, meetings, and what was actually said.
 *
 * The one part of an agency that lives entirely in people's heads and in a
 * WhatsApp thread nobody else can read — and it is where deals are won and
 * lost. There is no money on this screen: a conversation has no price and no
 * margin, and putting a figure here would be the product guessing.
 *
 * What it does have is one measurement worth making, and the product is built
 * around measurements: a conversation that happened and says nothing is a
 * conversation that did not happen, three weeks later, for everyone who was not
 * in the room.
 */

export type ConversationKind = 'call' | 'meeting' | 'site_visit' | 'message';
export type ConversationState = 'scheduled' | 'happened' | 'no_answer' | 'cancelled';

export const CONVERSATION_KINDS: ConversationKind[] = ['call', 'meeting', 'site_visit', 'message'];
export const CONVERSATION_STATES: ConversationState[] = [
  'scheduled',
  'happened',
  'no_answer',
  'cancelled',
];

export interface ConversationRow {
  id: string;
  clientId: string | null;
  clientName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  dealId: string | null;
  dealTitle: string | null;
  ownerUserId: string;
  ownerName: string | null;
  kind: ConversationKind;
  state: ConversationState;
  subject: string;
  happensAt: Date;
  minutes: number | null;
  place: string | null;
  agenda: string | null;
  notes: string | null;
  nextStep: string | null;
  nextStepOn: string | null;
}

export class ConversationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ConversationError';
  }
}

const SELECT = raw`
  select v.id, v.client_id, c.name as client_name,
         v.contact_id, k.name as contact_name, k.phone as contact_phone,
         v.deal_id, d.title as deal_title,
         v.owner_user_id, u.name as owner_name,
         v.kind::text as kind, v.state::text as state, v.subject, v.happens_at,
         v.minutes, v.place, v.agenda, v.notes, v.next_step,
         v.next_step_on::text as next_step_on
  from conversations v
  left join clients c on c.id = v.client_id
  left join client_contacts k on k.id = v.contact_id
  left join deals d on d.id = v.deal_id
  left join users u on u.id = v.owner_user_id`;

interface Raw {
  [column: string]: unknown;
  id: string;
  client_id: string | null;
  client_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  deal_id: string | null;
  deal_title: string | null;
  owner_user_id: string;
  owner_name: string | null;
  kind: ConversationKind;
  state: ConversationState;
  subject: string;
  // The driver hands timestamptz back as a string here. Typed as it arrives and
  // converted once, below, so every caller gets a real Date and none of them
  // has to discover this the way the first one did — at render time, in
  // production, as a page that would not load.
  happens_at: string | Date;
  minutes: number | null;
  place: string | null;
  agenda: string | null;
  notes: string | null;
  next_step: string | null;
  next_step_on: string | null;
}

const shape = (row: Raw): ConversationRow => ({
  id: row.id,
  clientId: row.client_id,
  clientName: row.client_name,
  contactId: row.contact_id,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  dealId: row.deal_id,
  dealTitle: row.deal_title,
  ownerUserId: row.owner_user_id,
  ownerName: row.owner_name,
  kind: row.kind,
  state: row.state,
  subject: row.subject,
  happensAt: row.happens_at instanceof Date ? row.happens_at : new Date(row.happens_at),
  minutes: row.minutes,
  place: row.place,
  agenda: row.agenda,
  notes: row.notes,
  nextStep: row.next_step,
  nextStepOn: row.next_step_on,
});

/** What is coming: still scheduled, and not yet in the past. */
export async function upcoming(ctx: TenantContext, limit = 20): Promise<ConversationRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<Raw>(raw`
      ${SELECT}
      where v.state = 'scheduled' and v.happens_at >= now() - interval '2 hours'
      order by v.happens_at
      limit ${limit}`),
  );
  return Array.from(rows).map(shape);
}

/**
 * What already happened, most recent first.
 *
 * Includes anything scheduled that is now in the past: a meeting whose time has
 * come and gone without being marked is precisely the row somebody needs to see
 * and act on, not one to hide until they remember it.
 */
export async function recent(ctx: TenantContext, limit = 30): Promise<ConversationRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<Raw>(raw`
      ${SELECT}
      where v.state <> 'scheduled' or v.happens_at < now() - interval '2 hours'
      order by v.happens_at desc
      limit ${limit}`),
  );
  return Array.from(rows).map(shape);
}

export interface Silence {
  /** Conversations that happened and say nothing. */
  unwritten: number;
  /** Next steps whose date has passed with nothing since. */
  overdue: number;
  /** Clients with no conversation at all in the last 60 days. */
  quietClients: Array<{ id: string; name: string; days: number | null }>;
}

/**
 * The measurement.
 *
 * Three questions a calendar never asks: what did you have and not write down,
 * what did you promise and not do, and who have you not spoken to. Each is
 * cheap to answer here and impossible to answer from memory, which is the only
 * reason this screen is worth more than a phone's calendar app.
 */
export async function silence(ctx: TenantContext): Promise<Silence> {
  return withTenant(ctx, async (tx) => {
    const counts = await tx.execute<{
      [column: string]: unknown;
      unwritten: number;
      overdue: number;
    }>(raw`
      select
        (select count(*)::int from conversations
         where state = 'happened' and (notes is null or trim(notes) = '')) as unwritten,
        (select count(*)::int from conversations
         where next_step is not null and next_step_on is not null
           and next_step_on < current_date) as overdue`);
    const row = Array.from(counts)[0] ?? { unwritten: 0, overdue: 0 };

    /*
     * A client nobody has spoken to.
     *
     * `days` is null when there has never been a conversation at all, which is
     * a different and worse silence than a long one — the interface says so
     * rather than showing a large number that looks like an estimate.
     */
    const quiet = await tx.execute<{
      [column: string]: unknown;
      id: string;
      name: string;
      days: number | null;
    }>(raw`
      select c.id, c.name,
             (select (current_date - max(v.happens_at)::date)::int
              from conversations v where v.client_id = c.id) as days
      from clients c
      where not exists (
        select 1 from conversations v
        where v.client_id = c.id and v.happens_at > now() - interval '60 days'
      )
      order by c.name
      limit 10`);

    return {
      unwritten: row.unwritten,
      overdue: row.overdue,
      quietClients: Array.from(quiet).map((q) => ({ id: q.id, name: q.name, days: q.days })),
    };
  });
}

export interface ContactRow {
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

/** The directory. Who to call, and how long since anybody did. */
export async function contacts(ctx: TenantContext): Promise<ContactRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{
      [column: string]: unknown;
      id: string;
      client_id: string;
      client_name: string | null;
      name: string;
      title: string | null;
      phone: string | null;
      email: string | null;
      is_primary: boolean;
      last_spoke_days: number | null;
    }>(raw`
      select k.id, k.client_id, c.name as client_name, k.name, k.title, k.phone, k.email,
             k.is_primary,
             (select (current_date - max(v.happens_at)::date)::int
              from conversations v
              where v.contact_id = k.id and v.state = 'happened') as last_spoke_days
      from client_contacts k
      left join clients c on c.id = k.client_id
      order by c.name, k.is_primary desc, k.name`),
  );
  return Array.from(rows).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    name: row.name,
    title: row.title,
    phone: row.phone,
    email: row.email,
    isPrimary: row.is_primary,
    lastSpokeDays: row.last_spoke_days,
  }));
}

export interface ScheduleInput {
  clientId?: string;
  contactId?: string;
  dealId?: string;
  kind: ConversationKind;
  subject: string;
  happensAt: string;
  minutes?: string;
  place?: string;
  agenda?: string;
}

export async function schedule(ctx: TenantContext, input: ScheduleInput): Promise<string> {
  const subject = input.subject.trim();
  if (subject.length < 2) throw new ConversationError('Say what this is about.', 'subject');
  const when = new Date(input.happensAt);
  if (Number.isNaN(when.getTime())) throw new ConversationError('When?', 'happensAt');

  const minutes = input.minutes?.trim() ? Number(input.minutes) : null;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440)) {
    throw new ConversationError('How long, in minutes?', 'minutes');
  }

  return withTenant(ctx, async (tx) => {
    const rows = await tx.execute<{ [column: string]: unknown; id: string }>(raw`
      insert into conversations (org_id, client_id, contact_id, deal_id, owner_user_id,
                                 kind, state, subject, happens_at, minutes, place, agenda)
      values (${ctx.orgId}, ${input.clientId ?? null}, ${input.contactId ?? null},
              ${input.dealId ?? null}, ${ctx.userId}, ${input.kind}, 'scheduled', ${subject},
              ${when.toISOString()}::timestamptz, ${minutes}, ${input.place?.trim() || null},
              ${input.agenda?.trim() || null})
      returning id`);
    return Array.from(rows)[0]!.id;
  });
}

export interface RecordInput {
  id: string;
  state: ConversationState;
  notes?: string;
  nextStep?: string;
  nextStepOn?: string;
}

/**
 * Write down what was said.
 *
 * The note and the next step are one action, because they are one thought: a
 * conversation you have to come back to in order to record the follow-up is a
 * conversation whose follow-up is never recorded.
 */
export async function record(ctx: TenantContext, input: RecordInput): Promise<void> {
  const nextStep = input.nextStep?.trim() || null;
  const nextStepOn = input.nextStepOn && /^\d{4}-\d{2}-\d{2}$/.test(input.nextStepOn)
    ? input.nextStepOn
    : null;
  // A next step without a date is a wish. Refusing here is kinder than a list
  // of intentions nobody is ever reminded of.
  if (nextStep && !nextStepOn) {
    throw new ConversationError('When will you do that?', 'nextStepOn');
  }

  await withTenant(ctx, (tx) =>
    tx.execute(raw`
      update conversations
      set state = ${input.state},
          notes = ${input.notes?.trim() || null},
          next_step = ${nextStep},
          next_step_on = ${nextStepOn}::date
      where id = ${input.id}`),
  );
}

export interface ContactInput {
  clientId: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export async function addContact(ctx: TenantContext, input: ContactInput): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2) throw new ConversationError('Their name?', 'name');

  await withTenant(ctx, (tx) =>
    tx.execute(raw`
      insert into client_contacts (org_id, client_id, name, title, phone, email, is_primary)
      values (${ctx.orgId}, ${input.clientId}, ${name}, ${input.title?.trim() || null},
              ${input.phone?.trim() || null}, ${input.email?.trim() || null},
              ${input.isPrimary ?? false})`),
  );
}

/** Clients, for the pickers. Name only — this module has no business with money. */
export async function clientList(
  ctx: TenantContext,
): Promise<Array<{ id: string; name: string }>> {
  const rows = await withTenant(ctx, (tx) =>
    tx.execute<{ [column: string]: unknown; id: string; name: string }>(
      raw`select id, name from clients order by name`,
    ),
  );
  return Array.from(rows).map((row) => ({ id: row.id, name: row.name }));
}
