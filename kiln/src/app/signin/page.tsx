import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from './signin-form';
import { LanguageToggle } from '@/components/language-toggle';
import { translator } from '@/i18n/dictionary';
import { currentUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

export default async function SignInPage() {
  if (await currentUser()) redirect('/app');
  const locale = await resolveLocale();
  const t = translator(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-baseline justify-between">
        <span className="text-[17px] font-semibold tracking-tight">{t('brand.name')}</span>
        <LanguageToggle locale={locale} returnTo="/signin" />
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight">{t('auth.signIn')}</h1>
      <p className="mt-1 mb-6 text-[13px] text-ink-soft">{t('brand.tagline')}</p>
      <SignInForm locale={locale} />
      <p className="mt-6 text-[13px] text-ink-soft">
        {t('auth.noAccount')}{' '}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-2">
          {t('auth.signUp')}
        </Link>
      </p>
    </main>
  );
}
