'use client';

import { useActionState } from 'react';
import { type FormState, signInAction } from '@/app/actions/auth';
import { TextField } from '@/components/field';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

export function SignInForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});

  return (
    <form action={action} className="space-y-4">
      {/* Not type="email": the field takes a username too, and the browser's
          own validation would refuse one before the form ever submitted. */}
      <TextField
        name="email"
        type="text"
        label={t('auth.email')}
        autoComplete="username"
        invalid={Boolean(state.error)}
      />
      <TextField
        name="password"
        type="password"
        label={t('auth.password')}
        autoComplete="current-password"
        invalid={Boolean(state.error)}
      />
      {state.needsWorkspace ? (
        <TextField
          name="workspace"
          label={t('auth.workspace')}
          hint={t('auth.workspaceHelp')}
          autoComplete="off"
        />
      ) : null}

      {state.error ? (
        <p role="alert" className="text-[13px] text-below-ink">
          {t(state.error as StringKey) ?? state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[8px] bg-ink px-4 py-2.5 text-[15px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? t('auth.signingIn') : t('auth.signIn')}
      </button>
    </form>
  );
}
