'use server';

import { revalidatePath } from 'next/cache';
import {
  CONVERSATION_KINDS,
  CONVERSATION_STATES,
  ConversationError,
  type ConversationKind,
  type ConversationState,
  addContact,
  record,
  schedule,
} from '@/server/conversations';
import { contextFor, requireUser } from '@/server/session';

export type TalkResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optional = (value: string | undefined) =>
  value && UUID.test(value) ? value : undefined;

/** Owner and account manager. The relationship is the agency's; the crew is not in it. */
async function relationshipUser() {
  const user = await requireUser();
  if (user.role !== 'owner' && user.role !== 'account_manager') return null;
  return user;
}

export async function scheduleAction(input: {
  clientId?: string;
  contactId?: string;
  dealId?: string;
  kind: string;
  subject: string;
  happensAt: string;
  minutes?: string;
  place?: string;
  agenda?: string;
}): Promise<TalkResult> {
  const user = await relationshipUser();
  if (!user) return { ok: false, error: 'talk.failed' };
  if (!CONVERSATION_KINDS.includes(input.kind as ConversationKind)) {
    return { ok: false, error: 'talk.failed' };
  }
  try {
    await schedule(contextFor(user), {
      ...(optional(input.clientId) ? { clientId: optional(input.clientId)! } : {}),
      ...(optional(input.contactId) ? { contactId: optional(input.contactId)! } : {}),
      ...(optional(input.dealId) ? { dealId: optional(input.dealId)! } : {}),
      kind: input.kind as ConversationKind,
      subject: input.subject,
      happensAt: input.happensAt,
      ...(input.minutes ? { minutes: input.minutes } : {}),
      ...(input.place ? { place: input.place } : {}),
      ...(input.agenda ? { agenda: input.agenda } : {}),
    });
  } catch (error) {
    if (error instanceof ConversationError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/conversations');
  return { ok: true };
}

export async function recordAction(input: {
  id: string;
  state: string;
  notes?: string;
  nextStep?: string;
  nextStepOn?: string;
}): Promise<TalkResult> {
  const user = await relationshipUser();
  if (!user) return { ok: false, error: 'talk.failed' };
  if (!UUID.test(input.id)) return { ok: false, error: 'talk.failed' };
  if (!CONVERSATION_STATES.includes(input.state as ConversationState)) {
    return { ok: false, error: 'talk.failed' };
  }
  try {
    await record(contextFor(user), {
      id: input.id,
      state: input.state as ConversationState,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.nextStep ? { nextStep: input.nextStep } : {}),
      ...(input.nextStepOn ? { nextStepOn: input.nextStepOn } : {}),
    });
  } catch (error) {
    if (error instanceof ConversationError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/conversations');
  return { ok: true };
}

export async function addContactAction(input: {
  clientId: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}): Promise<TalkResult> {
  const user = await relationshipUser();
  if (!user) return { ok: false, error: 'talk.failed' };
  if (!UUID.test(input.clientId)) return { ok: false, error: 'talk.failed' };
  try {
    await addContact(contextFor(user), {
      clientId: input.clientId,
      name: input.name,
      ...(input.title ? { title: input.title } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
    });
  } catch (error) {
    if (error instanceof ConversationError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/conversations');
  return { ok: true };
}
