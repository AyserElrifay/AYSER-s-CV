import Link from 'next/link';
import { LanguageToggle } from '@/components/language-toggle';
import { signOutAction } from '@/app/actions/auth';
import { translator } from '@/i18n/dictionary';
import { requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

/**
 * Two shells, deliberately.
 *
 * An Owner is running a business and gets an instrument panel. A Member is
 * doing a job today and gets a page with almost nothing on it. They should not
 * feel like two views of one product, because they are not: one of them has no
 * business knowing what anything costs.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);
  const plain = user.role === 'member';

  return (
    <div className="min-h-dvh">
      <header
        className={
          plain
            ? 'border-b border-line bg-paper-raised'
            : 'border-b border-line bg-paper-raised/80 backdrop-blur'
        }
      >
        <div
          className={`mx-auto flex items-center justify-between gap-4 px-6 py-3 ${
            plain ? 'max-w-xl' : 'max-w-5xl'
          }`}
        >
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="text-[15px] font-semibold tracking-tight">{t('brand.name')}</span>
            {!plain && (
              <span className="truncate text-[13px] text-ink-soft">{user.orgName}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* A Member gets no navigation at all: their screen is today's work
                and nothing else. Everyone else needs to reach their payouts. */}
            {!plain && (
              <>
                <Link
                  href="/app"
                  className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
                >
                  {t(user.role === 'partner' ? 'nav.statements' : 'nav.deals')}
                </Link>
                <Link
                  href="/app/payouts"
                  className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
                >
                  {t('nav.payouts')}
                </Link>
                {/* Settings change how money is counted, so only the Owner
                    reaches them — and the page redirects anyone else anyway. */}
                {user.role === 'owner' && (
                  <>
                    <Link
                      href="/app/team"
                      className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
                    >
                      {t('nav.team')}
                    </Link>
                    <Link
                      href="/app/settings"
                      className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
                    >
                      {t('nav.settings')}
                    </Link>
                  </>
                )}
              </>
            )}
            {!plain && (
              <span className="me-2 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-soft">
                {t(`role.${user.role}`)}
              </span>
            )}
            <LanguageToggle locale={locale} />
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
              >
                {t('nav.signOut')}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-6 py-8 ${plain ? 'max-w-xl' : 'max-w-5xl'}`}>{children}</main>
    </div>
  );
}
