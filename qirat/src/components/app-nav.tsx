'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

/**
 * One set of destinations, rendered twice.
 *
 * A phone and a desktop are not the same screen with different margins. On a
 * desktop the navigation is a column you keep in your eye while you work; on a
 * phone it belongs under your thumb, because the person holding it is standing
 * in a print shop or on a shoot with one hand full.
 *
 * Both come from this array, so a section can never exist in one shape and be
 * missing from the other — which is the failure mode of maintaining two
 * navigations, and the reason people stop trusting the small one.
 */
export interface NavItem {
  href: string;
  key: StringKey;
  icon: 'deals' | 'payouts' | 'conversations' | 'month' | 'team' | 'settings';
}

/** Line icons, not filled: this is an instrument, and its marks are drawn. */
function Icon({ name }: { name: NavItem['icon'] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'deals':
      // A card, which is what a deal is here.
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M7 10h6" />
        </svg>
      );
    case 'payouts':
      // A balance: two pans, which is what a split is.
      return (
        <svg {...common}>
          <path d="M12 4v16M5 8h14" />
          <path d="M8 8l-3 6h6zM16 8l3 6h-6z" />
        </svg>
      );
    case 'conversations':
      return (
        <svg {...common}>
          <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.5A7 7 0 0 1 6 5h7a7 7 0 0 1 7 7Z" />
        </svg>
      );
    case 'month':
      // A waterfall: what comes in, and what is left after each step down.
      return (
        <svg {...common}>
          <path d="M4 5h16M6 10h12M9 15h6M11 20h2" />
        </svg>
      );
    case 'team':
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2-4.2" />
        </svg>
      );
    case 'settings':
      // A dial with one mark on it. The product is a measuring instrument.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}

function isCurrent(pathname: string, href: string): boolean {
  // "/app" must not light up on "/app/team", but "/app/team" should stay lit on
  // any child route it grows later.
  return href === '/app' ? pathname === '/app' : pathname.startsWith(href);
}

/** The desktop column. Kept in the eye, never in the way. */
export function SideNav({
  items,
  locale,
  orgName,
  roleLabel,
  footer,
}: {
  items: NavItem[];
  locale: Locale;
  orgName: string;
  roleLabel: string;
  /** Language and the way out. Server-rendered, because signing out is an action. */
  footer: React.ReactNode;
}) {
  const t = translator(locale);
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('nav.sections')}
      /*
       * Sticky and exactly one screen tall, with its own scroll.
       *
       * Without this the column stretches to the height of the page, and on a
       * long list the role chip and the way out end up somewhere below the
       * fold — present in the markup and unreachable in practice.
       */
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-e border-line bg-paper-raised px-4 py-5 lg:flex"
    >
      <div className="px-2">
        <span className="block text-[16px] font-semibold tracking-tight">{t('brand.name')}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-faint">{orgName}</span>
      </div>

      <ul className="mt-7 flex flex-col gap-0.5">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href as never}
                aria-current={current ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[14px] transition-colors ${
                  current
                    ? 'bg-paper font-medium text-ink'
                    : 'text-ink-soft hover:bg-paper hover:text-ink'
                }`}
              >
                <Icon name={item.icon} />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Everything the top bar used to carry. On a desktop there is no top
          bar at all: a strip holding two links above a page that already has a
          column is a band of empty pixels across the widest screen. */}
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <span className="rounded-full border border-line px-2.5 py-0.5 text-center text-[12px] text-ink-soft">
          {roleLabel}
        </span>
        <div className="flex items-center justify-between gap-2 px-1">{footer}</div>
      </div>
    </nav>
  );
}

/**
 * The phone bar.
 *
 * Fixed to the bottom, inside the safe area, with targets big enough for a
 * thumb rather than a cursor. The label stays under the icon: an icon alone is
 * a guess, and this product is used by people who opened it twice.
 */
export function TabBar({ items, locale }: { items: NavItem[]; locale: Locale }) {
  const t = translator(locale);
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('nav.sections')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper-raised/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href as never}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] ${
                  current ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                <Icon name={item.icon} />
                <span className="max-w-full truncate">{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
