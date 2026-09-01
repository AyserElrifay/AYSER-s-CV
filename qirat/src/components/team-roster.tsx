'use client';

import { useState, useTransition } from 'react';
import { addPersonAction, setDayRateAction, setPersonActiveAction } from '@/app/actions/team';
import { SelectField, TextField } from './field';
import { Figure } from './figure';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import { type AppRole } from '@/db/roles';

export interface PersonView {
  id: string;
  name: string;
  username: string | null;
  role: AppRole;
  title: string | null;
  phone: string | null;
  rate: string | null;
  currency: string | null;
  isActive: boolean;
  neverSignedIn: boolean;
  mustChangePassword: boolean;
  isYou: boolean;
}

/**
 * The roster.
 *
 * A list before a form, because an owner opening this screen wants to see who
 * is here, not to be asked a question. The form is one click away and closes
 * itself when it succeeds — the answer to "did that work" is the new row.
 */
export function TeamRoster({
  people,
  locale,
  currency,
}: {
  people: PersonView[];
  locale: Locale;
  currency: string;
}) {
  const t = translator(locale);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    setError(null);
    setAdded(null);
    startTransition(async () => {
      const result = await addPersonAction({
        name: String(form.get('name') ?? ''),
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
        role: String(form.get('role') ?? 'member'),
        title: String(form.get('title') ?? ''),
        phone: String(form.get('phone') ?? ''),
        email: String(form.get('email') ?? ''),
        dayRate: String(form.get('dayRate') ?? ''),
      });
      if (result.ok) {
        setOpen(false);
        setAdded(result.message ?? null);
      } else {
        // The server sends a sentence for a real problem and a key for a rule
        // the interface already knows how to say.
        setError(result.error.includes(' ') ? result.error : t(result.error as StringKey));
      }
    });
  };

  return (
    <div className="space-y-6">
      {added ? (
        <p className="rounded-[10px] border border-line bg-paper-raised px-4 py-3 text-[13px]">
          {t('team.added')} <strong className="reading">{added}</strong>
        </p>
      ) : null}

      <ul className="max-w-2xl divide-y divide-line rounded-[10px] border border-line bg-paper-raised">
        {people.length === 0 ? (
          <li className="px-4 py-4 text-[13px] leading-relaxed text-ink-soft">{t('team.empty')}</li>
        ) : (
          people.map((person) => (
            <PersonRow key={person.id} person={person} locale={locale} />
          ))
        )}
      </ul>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[8px] bg-ink px-4 py-2 text-[14px] font-medium text-paper"
        >
          {t('team.add')}
        </button>
      ) : (
        <form action={submit} className="max-w-xl space-y-4 rounded-[12px] border border-line bg-paper-raised p-5">
          <TextField name="name" label={t('team.name')} autoComplete="off" />
          <TextField
            name="username"
            label={t('team.username')}
            hint={t('team.usernameHint')}
            autoComplete="off"
          />
          <TextField
            name="password"
            type="text"
            label={t('team.password')}
            hint={t('team.passwordHint')}
            autoComplete="off"
          />
          <SelectField
            name="role"
            label={t('team.roleLabel')}
            defaultValue="member"
            options={(['member', 'account_manager', 'partner', 'owner'] as AppRole[]).map(
              (role) => ({ value: role, label: t(`role.${role}` as StringKey) }),
            )}
          />
          <TextField
            name="dayRate"
            label={`${t('team.dayRate')} (${currency})`}
            hint={t('team.dayRateHint')}
            required={false}
            autoComplete="off"
          />
          <TextField name="title" label={t('team.jobTitle')} required={false} autoComplete="off" />
          <TextField
            name="phone"
            label={t('team.phone')}
            hint={t('team.phoneHint')}
            required={false}
            autoComplete="off"
          />
          <TextField
            name="email"
            type="email"
            label={t('team.emailOptional')}
            required={false}
            autoComplete="off"
          />

          {error ? (
            <p role="alert" className="text-[13px] text-below-ink">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[8px] bg-ink px-4 py-2 text-[14px] font-medium text-paper disabled:opacity-60"
            >
              {pending ? `${t('team.saving')}…` : t('team.save')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] text-ink-faint hover:text-ink-soft"
            >
              {t('cost.cancel')}
            </button>
          </div>
        </form>
      )}

      <p className="max-w-xl text-[12px] leading-relaxed text-ink-faint">{t('team.rateNote')}</p>
    </div>
  );
}

function PersonRow({ person, locale }: { person: PersonView; locale: Locale }) {
  const t = translator(locale);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className={`px-4 py-3 ${person.isActive ? '' : 'opacity-55'}`}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0">
          <span className="text-[14px]">{person.name}</span>
          {person.username ? (
            <span className="reading ms-2 text-[12px] text-ink-faint">
              <Figure>{person.username}</Figure>
            </span>
          ) : null}
          <span className="mt-0.5 block text-[12px] text-ink-faint">
            {t(`role.${person.role}` as StringKey)}
            {person.title ? ` · ${person.title}` : ''}
            {!person.isActive ? ` · ${t('team.inactive')}` : ''}
            {person.isActive && person.neverSignedIn ? ` · ${t('team.neverSignedIn')}` : ''}
          </span>
        </span>

        <span className="shrink-0 text-end">
          {editing ? (
            <RateField
              userId={person.id}
              initial={person.rate ?? ''}
              onDone={() => setEditing(false)}
              locale={locale}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="reading text-[13px] text-ink-soft hover:text-ink"
            >
              {person.rate ? (
                <>
                  <Figure>{person.rate}</Figure>
                  <span className="ms-1 font-sans text-[11px] text-ink-faint">
                    {person.currency} {t('staff.perDay')}
                  </span>
                </>
              ) : (
                <span className="font-sans text-[12px] text-ink-faint">{t('team.noRate')}</span>
              )}
            </button>
          )}
        </span>
      </div>

      {!person.isYou ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setPersonActiveAction(person.id, !person.isActive);
            })
          }
          className="mt-1.5 text-[11px] text-ink-faint hover:text-ink-soft disabled:opacity-50"
        >
          {person.isActive ? t('team.deactivate') : t('team.reactivate')}
        </button>
      ) : null}
    </li>
  );
}

/** Editing a rate in place. A rate is one number; a page for it would be a form. */
function RateField({
  userId,
  initial,
  onDone,
  locale,
}: {
  userId: string;
  initial: string;
  onDone: () => void;
  locale: Locale;
}) {
  const t = translator(locale);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-1.5">
      <input
        value={value}
        autoFocus
        inputMode="decimal"
        aria-label={t('team.dayRate')}
        onChange={(event) => setValue(event.target.value)}
        className="reading w-28 rounded-[6px] border border-line bg-paper px-2 py-1 text-[13px] text-ink"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setDayRateAction(userId, value);
            onDone();
          })
        }
        className="rounded-[6px] bg-ink px-2 py-1 text-[11px] text-paper disabled:opacity-60"
      >
        {t('settings.save')}
      </button>
    </span>
  );
}
