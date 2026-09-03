import { LanguageToggle } from '@/components/language-toggle';
import { SideNav, TabBar, type NavItem } from '@/components/app-nav';
import { signOutAction } from '@/app/actions/auth';
import { translator } from '@/i18n/dictionary';
import { requireUser } from '@/server/session';
import { resolveLocale } from '@/server/locale';

/**
 * Two shells and two shapes.
 *
 * The shells are by role and were always here: an Owner is running a business
 * and gets an instrument panel; a Member is doing a job today and gets a page
 * with almost nothing on it. They should not feel like two views of one
 * product, because one of them has no business knowing what anything costs.
 *
 * The shapes are by device, and they are not the same page at two widths. On a
 * desktop the navigation is a column held in the eye while you work. On a phone
 * it sits under the thumb, because the person holding it is standing in a print
 * shop or on a shoot with one hand full — which is exactly when a cost gets
 * recorded or not.
 *
 * Both shapes read one array, so a section cannot exist in one and go missing
 * from the other.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await resolveLocale(user.locale);
  const t = translator(locale);

  // A Member gets no navigation at all: their screen is today's work and
  // nothing else, on either shape.
  const plain = user.role === 'member';

  const items: NavItem[] = plain
    ? []
    : [
        {
          href: '/app',
          key: user.role === 'partner' ? 'nav.statements' : 'nav.deals',
          icon: 'deals',
        },
        { href: '/app/payouts', key: 'nav.payouts', icon: 'payouts' },
        // The client relationship is the agency's, so an account manager reaches
        // it. A Partner does not: an investor has no business in the call log.
        ...(user.role === 'owner' || user.role === 'account_manager'
          ? ([{ href: '/app/conversations', key: 'nav.conversations', icon: 'conversations' }] as NavItem[])
          : []),
        // Settings change how money is counted; the team screen creates
        // accounts. Both are the Owner's, and both pages redirect anyone else.
        ...(user.role === 'owner'
          ? ([
              { href: '/app/month', key: 'nav.month', icon: 'month' },
              { href: '/app/team', key: 'nav.team', icon: 'team' },
              { href: '/app/settings', key: 'nav.settings', icon: 'settings' },
            ] as NavItem[])
          : []),
      ];

  const exit = (
    <>
      <LanguageToggle locale={locale} />
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink"
        >
          {t('nav.signOut')}
        </button>
      </form>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {items.length > 0 ? (
        <SideNav
          items={items}
          locale={locale}
          orgName={user.orgName}
          roleLabel={t(`role.${user.role}`)}
          footer={exit}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          The top bar carries what the sidebar already says on a desktop, so it
          keeps only what the sidebar cannot: the way out, and the language.
        */}
        {/*
          The top bar is the phone's, and only the phone's. A Member has no
          sidebar to move it into, so theirs stays at every width.
        */}
        <header
          className={`sticky top-0 z-10 border-b border-line bg-paper-raised/90 backdrop-blur ${
            plain ? '' : 'lg:hidden'
          }`}
        >
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="text-[15px] font-semibold tracking-tight">{t('brand.name')}</span>
              {!plain ? (
                <span className="truncate text-[12px] text-ink-faint">{user.orgName}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!plain ? (
                <span className="me-1 hidden rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-soft sm:block">
                  {t(`role.${user.role}`)}
                </span>
              ) : null}
              {exit}
            </div>
          </div>
        </header>

        {/*
          The bottom padding is the tab bar's height plus the safe area. Without
          it the last row of every list sits under the navigation, which is the
          single most common way a phone layout quietly loses its last item.
        */}
        <main
          className={`mx-auto w-full flex-1 px-4 pt-6 sm:px-6 lg:pt-10 ${
            plain ? 'max-w-xl' : 'max-w-5xl'
          }`}
          style={{
            paddingBottom:
              items.length > 0 ? 'calc(5.5rem + env(safe-area-inset-bottom))' : '2rem',
          }}
        >
          {children}
        </main>
      </div>

      {items.length > 0 ? <TabBar items={items} locale={locale} /> : null}
    </div>
  );
}
