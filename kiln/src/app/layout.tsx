import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { directionOf } from '@/i18n/dictionary';
import { resolveLocale } from '@/server/locale';
import './globals.css';

/**
 * Both scripts are loaded for every viewer, in the same weights.
 *
 * IBM Plex Sans Arabic is drawn as Arabic, not derived from the Latin, and the
 * two families are metrically compatible — which is what lets a bilingual
 * financial table keep one baseline grid when the language switches.
 */
const plexLatin = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-latin',
  display: 'swap',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kiln',
  description: 'Every deal an agency signs becomes a proposal, a board, a margin and a payout.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${plexLatin.variable} ${plexArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
