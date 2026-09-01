'use client';

import { useActionState } from 'react';
import { type FormState, signUpAction } from '@/app/actions/auth';
import { SelectField, TextField } from '@/components/field';
import { countriesFor } from '@/i18n/countries';
import { type Locale, translator } from '@/i18n/dictionary';

export function SignUpForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const countries = countriesFor(locale);

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
      <SelectField
        name="country"
        label={t('auth.country')}
        hint={t('auth.countryHint')}
        options={countries.map((country) => ({ value: country.code, label: country.name }))}
        defaultValue={locale === 'ar' ? 'EG' : 'DE'}
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
        <p role="alert" className="text-[13px] text-below-ink">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[8px] bg-ink px-4 py-2.5 text-[15px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? t('auth.creating') : t('auth.signUp')}
      </button>
    </form>
  );
}
