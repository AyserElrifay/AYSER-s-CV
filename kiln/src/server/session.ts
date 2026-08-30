import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/auth/config';
import { type TenantContext } from '@/db/client';
import { type AppRole } from '@/db/roles';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: AppRole;
  locale: 'en' | 'ar';
}

/**
 * Tenant context comes from the signed session and from nowhere else.
 *
 * This is the trust boundary of the whole design. RLS will faithfully enforce
 * whatever organisation it is told about, so the only thing that must never be
 * true is that a request can name its own org. Nothing here reads a header, a
 * query parameter, a path segment or a body field.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.orgId || !session.user.id) return null;
  return session.user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/signin');
  return user;
}

export function contextFor(user: SessionUser): TenantContext {
  return { orgId: user.orgId, userId: user.id, role: user.role };
}

export async function requireContext(): Promise<{ user: SessionUser; ctx: TenantContext }> {
  const user = await requireUser();
  return { user, ctx: contextFor(user) };
}

/** Guard a page or action to particular roles. Server-side, always. */
export async function requireRole(...allowed: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect('/app');
  return user;
}
