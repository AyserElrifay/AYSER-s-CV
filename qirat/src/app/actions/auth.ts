'use server';

import { AuthError } from 'next-auth';
import { AMBIGUOUS_ACCOUNT, signIn, signOut } from '@/auth/config';
import { PasswordError } from '@/auth/password';
import { SignupError, signUp } from '@/server/onboarding';

export interface FormState {
  error?: string;
  field?: string;
  needsWorkspace?: boolean;
}

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

export async function signInAction(_prev: FormState, data: FormData): Promise<FormState> {
  const workspace = text(data, 'workspace');
  try {
    await signIn('credentials', {
      email: text(data, 'email'),
      password: text(data, 'password'),
      workspace,
      redirectTo: '/app',
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.cause?.err?.message === AMBIGUOUS_ACCOUNT) {
        return {
          needsWorkspace: true,
          error: 'auth.workspaceHelp',
        };
      }
      return { error: 'auth.failed' };
    }
    // A successful sign-in throws a redirect. Let it through.
    throw error;
  }
}

export async function signUpAction(_prev: FormState, data: FormData): Promise<FormState> {
  const email = text(data, 'email');
  const password = text(data, 'password');
  try {
    await signUp({
      agencyName: text(data, 'agencyName'),
      ownerName: text(data, 'ownerName'),
      email,
      password,
      locale: text(data, 'locale') === 'ar' ? 'ar' : 'en',
      country: text(data, 'country'),
    });
  } catch (error) {
    if (error instanceof SignupError) return { error: error.message, field: error.field };
    if (error instanceof PasswordError) return { error: error.message, field: 'password' };
    throw error;
  }

  // Separate try: the sign-in below throws a redirect on success, and that must
  // not be mistaken for the signup having failed.
  await signIn('credentials', { email, password, redirectTo: '/app' });
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/signin' });
}
