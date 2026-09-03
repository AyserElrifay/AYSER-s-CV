'use server';

import { revalidatePath } from 'next/cache';
import { CompanyError, addOverhead, endOverhead, reopenPeriod, setSalary } from '@/server/company';
import { getOrgSettings } from '@/server/queries';
import { contextFor, requireUser } from '@/server/session';
import { type OverheadCadence } from '@/money';

export type CompanyResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CADENCES: OverheadCadence[] = ['monthly', 'quarterly', 'yearly', 'one_off'];

/** Everything on this screen is the owner's. The database agrees. */
async function ownerContext() {
  const user = await requireUser();
  if (user.role !== 'owner') return null;
  return user;
}

export async function addOverheadAction(input: {
  name: string;
  category?: string;
  amount: string;
  cadence: string;
}): Promise<CompanyResult> {
  const user = await ownerContext();
  if (!user) return { ok: false, error: 'team.ownerOnly' };
  if (!CADENCES.includes(input.cadence as OverheadCadence)) {
    return { ok: false, error: 'team.failed' };
  }
  const ctx = contextFor(user);
  const settings = await getOrgSettings(ctx);
  if (!settings) return { ok: false, error: 'team.failed' };

  try {
    await addOverhead(ctx, {
      name: input.name,
      ...(input.category ? { category: input.category } : {}),
      amount: input.amount,
      currency: settings.defaultCurrency,
      cadence: input.cadence as OverheadCadence,
    });
  } catch (error) {
    if (error instanceof CompanyError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/month');
  return { ok: true };
}

export async function endOverheadAction(id: string): Promise<CompanyResult> {
  const user = await ownerContext();
  if (!user) return { ok: false, error: 'team.ownerOnly' };
  if (!UUID.test(id)) return { ok: false, error: 'team.failed' };
  try {
    await endOverhead(contextFor(user), id, new Date().toISOString().slice(0, 10));
  } catch (error) {
    if (error instanceof CompanyError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/month');
  return { ok: true };
}

export async function setSalaryAction(userId: string, amount: string): Promise<CompanyResult> {
  const user = await ownerContext();
  if (!user) return { ok: false, error: 'team.ownerOnly' };
  if (!UUID.test(userId)) return { ok: false, error: 'team.failed' };
  const ctx = contextFor(user);
  const settings = await getOrgSettings(ctx);
  if (!settings) return { ok: false, error: 'team.failed' };
  try {
    await setSalary(ctx, userId, amount, settings.defaultCurrency);
  } catch (error) {
    if (error instanceof CompanyError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/team');
  revalidatePath('/app/month');
  return { ok: true };
}

export async function reopenPeriodAction(
  periodId: string,
  reason: string,
): Promise<CompanyResult> {
  const user = await ownerContext();
  if (!user) return { ok: false, error: 'team.ownerOnly' };
  if (!UUID.test(periodId)) return { ok: false, error: 'team.failed' };
  try {
    await reopenPeriod(contextFor(user), periodId, reason);
  } catch (error) {
    if (error instanceof CompanyError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/app/month');
  revalidatePath('/app/payouts');
  return { ok: true };
}
