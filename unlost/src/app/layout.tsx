import type { Metadata } from 'next';
import {
  Alexandria,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
} from 'next/font/google';
import { directionOf } from '@/i18n/dictionary';
import { resolveLocale } from '@/server/locale';
import './globals.css';

/**
 * Three faces, each doing one job.
 *
 * Alexandria carries the headings. It is drawn for Arabic and Latin together by
 * a designer working in both, which is the bar — not Cairo, which by now is the
 * default on everything Egyptian and reads as one.
 *
 * IBM Plex Sans and IBM Plex Sans Arabic carry the text. The Arabic is drawn as
 * Arabic rather than derived from the Latin, and the two are metrically
 * compatible, so a bilingual financial table keeps one baseline grid across a
 * language switch.
 *
 * IBM Plex Mono carries the readings. Numbers are the content here, and a
 * proportional face lets them change width as they change value — the row
 * twitches on every frame of a drag. Tabular monospace is the difference
 * between a readout and a paragraph with digits in it.
 */
const display = Alexandria({
  subsets: ['latin', 'arabic'],
  weight: ['400', '500', '600'],
  variable: '--font-alexandria',
  display: 'swap',
});

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

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Unlost',
  description:
    'Every deal an agency signs becomes a proposal, a board, a live margin and a payout.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${display.variable} ${plexLatin.variable} ${plexArabic.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
