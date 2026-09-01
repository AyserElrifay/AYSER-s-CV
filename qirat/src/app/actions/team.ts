'use server';

import { revalidatePath } from 'next/cache';
import { PasswordError } from '@/auth/password';
import { TeamError, addPerson, changeOwnPassword, setDayRate, setPersonActive } from '@/server/team';
import { AssignmentError, assignToDeal, logWork, removeFromDeal } from '@/server/work';
import { getOrgSettings } from '@/server/queries';
import { contextFor, requireUser } from '@/server/session';
import { type AppRole } from '@/db/roles';

/**
 * Adding people, paying them, and recording what they did.
 *
 * Every one of these re-checks the role on the server. The client decides what
 * to render; the database decides what is allowed; this layer is the courteous
 * refusal in between, so a Member who reaches a URL gets a sentence rather than
 * a stack trace.
 */

export type TeamResult = { ok: true; message?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: AppRole[] = ['owner', 'account_manager', 'member', 'partner'];

export async function addPersonAction(input: {
  name: string;
  username: string;
  password: string;
  role: string;
  title?: string;
  phone?: string;
  email?: string;
  dayRate?: string;
}): Promise<TeamResult> {
  const user = await requireUser();
  if (user.role !== 'owner') return { ok: false, error: 'team.ownerOnly' };
  if (!ROLES.includes(input.role as AppRole)) return { ok: false, error: 'team.badRole' };

  const ctx = contextFor(user);
  const settings = await getOrgSettings(ctx);
  if (!settings) return { ok: false, error: 'team.failed' };

  try {
    const created = await addPerson(ctx, {
      name: input.name,
      username: input.username,
      password: input.password,
      role: input.role as AppRole,
      ...(input.title ? { title: input.title } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.dayRate ? { dayRate: input.dayRate } : {}),
      currency: settings.defaultCurrency,
    });
    revalidatePath('/app/team');
    // The username is echoed back so the owner can send it on with the password
    // they just chose — over WhatsApp, which is where this agency already talks.
    return { ok: true, message: created.username };
  } catch (error) {
    if (error instanceof TeamError) return { ok: false, error: error.message };
    if (error instanceof PasswordError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function setDayRateAction(userId: string, dayRate: string): Promise<TeamResult> {
  const user = await requireUser();
  if (user.role !== 'owner') return { ok: false, error: 'team.ownerOnly' };
  if (!UUID.test(userId)) return { ok: false, error: 'team.failed' };

  const ctx = contextFor(user);
  const settings = await getOrgSettings(ctx);
  if (!settings) return { ok: false, error: 'team.failed' };

  try {
    await setDayRate(ctx, userId, dayRate, settings.defaultCurrency);
  } catch (error) {
    if (error instanceof TeamError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/team');
  return { ok: true };
}

export async function setPersonActiveAction(
  userId: string,
  isActive: boolean,
): Promise<TeamResult> {
  const user = await requireUser();
  if (user.role !== 'owner') return { ok: false, error: 'team.ownerOnly' };
  if (!UUID.test(userId)) return { ok: false, error: 'team.failed' };
  try {
    await setPersonActive(contextFor(user), userId, isActive);
  } catch (error) {
    if (error instanceof TeamError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/team');
  return { ok: true };
}

export async function changePasswordAction(newPassword: string): Promise<TeamResult> {
  const user = await requireUser();
  try {
    await changeOwnPassword(contextFor(user), newPassword);
  } catch (error) {
    if (error instanceof PasswordError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app');
  return { ok: true };
}

// --- staffing ---------------------------------------------------------------

export async function assignAction(dealId: string, userId: string): Promise<TeamResult> {
  const user = await requireUser();
  if (!UUID.test(dealId) || !UUID.test(userId)) return { ok: false, error: 'team.failed' };
  try {
    await assignToDeal(contextFor(user), dealId, userId);
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app');
  return { ok: true };
}

export async function unassignAction(dealId: string, userId: string): Promise<TeamResult> {
  const user = await requireUser();
  if (!UUID.test(dealId) || !UUID.test(userId)) return { ok: false, error: 'team.failed' };
  try {
    await removeFromDeal(contextFor(user), dealId, userId);
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app');
  return { ok: true };
}

/**
 * Log a day.
 *
 * Note what this does not take: a rate. The rate comes off the assignment,
 * server-side. A form that could name its own rate is a form that can price an
 * afternoon at anything it likes.
 */
export async function logWorkAction(input: {
  dealId: string;
  days: string;
  workedOn: string;
  note?: string;
}): Promise<TeamResult> {
  const user = await requireUser();
  if (!UUID.test(input.dealId)) return { ok: false, error: 'work.failed' };
  try {
    await logWork(contextFor(user), input);
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app');
  return { ok: true };
}
