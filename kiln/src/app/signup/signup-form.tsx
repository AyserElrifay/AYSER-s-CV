'use client';

import { useActionState } from 'react';
import { type FormState, signUpAction } from '@/app/actions/auth';
import { TextField } from '@/components/field';
import { type Locale, translator } from '@/i18n/dictionary';

export function SignUpForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <TextField
        name="agencyName"
        label={t('auth.agencyName')}
        autoComplete="organization"
        invalid={state.field === 'agencyName'}
      />
      <TextField
        name="ownerName"
        label={t('auth.yourName')}
        autoComplete="name"
        invalid={state.field === 'ownerName'}
      />
      <TextField
        name="email"
        type="email"
        label={t('auth.email')}
        autoComplete="username"
        invalid={state.field === 'email'}
      />
      <TextField
        name="password"
        type="password"
        label={t('auth.password')}
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        invalid={state.field === 'password'}
      />

      {state.error ? (
        <p role="alert" className="text-[13px] text-critical">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[8px] bg-ink px-4 py-2.5 text-[15px] font-medium text-ground disabled:opacity-60"
      >
        {pending ? t('auth.creating') : t('auth.signUp')}
      </button>
    </form>
  );
}
