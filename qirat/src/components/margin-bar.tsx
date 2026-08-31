import { type MarginHealth, formatBasisPoints } from '@/money';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import { Figure } from './figure';

const HEALTH_LABEL: Record<MarginHealth, StringKey> = {
  healthy: 'margin.healthy',
  thin: 'margin.thin',
  loss: 'margin.loss',
  unpriced: 'margin.unpriced',
};

/** On the dark card the readings live; on paper they are only ever chips. */
const ON_CARD: Record<MarginHealth, { fill: string; text: string; track: string }> = {
  healthy: { fill: 'bg-healthy', text: 'text-healthy', track: 'bg-healthy/15' },
  thin: { fill: 'bg-thin', text: 'text-thin', track: 'bg-thin/15' },
  loss: { fill: 'bg-below', text: 'text-below', track: 'bg-below/15' },
  unpriced: { fill: 'bg-card-ink-faint', text: 'text-card-ink-faint', track: 'bg-card-line' },
};

const ON_PAPER: Record<MarginHealth, { fill: string; text: string; track: string }> = {
  healthy: { fill: 'bg-healthy-ink', text: 'text-healthy-ink', track: 'bg-healthy-ink/12' },
  thin: { fill: 'bg-thin-ink', text: 'text-thin-ink', track: 'bg-thin-ink/12' },
  loss: { fill: 'bg-below-ink', text: 'text-below-ink', track: 'bg-below-ink/12' },
  unpriced: { fill: 'bg-ink-faint', text: 'text-ink-faint', track: 'bg-paper-sunk' },
};

/**
 * The margin, as a quantity.
 *
 * It fills from the inline start — left in English, right in Arabic — because a
 * quantity follows reading direction. (A time axis would not: those run left to
 * right in both languages. The two rules look contradictory and are not, which
 * is why both are written down.)
 *
 * The fill is clamped to 0–100%, but the number above it is not: a deal at
 * -400% margin says so in figures rather than drawing an empty bar and leaving
 * the reader to guess.
 *
 * It reports margin health only. Whether the price broke the floor is a fact
 * about the price and is reported there — a 64% margin does not turn red
 * because a pricing policy was crossed.
 */
export function MarginBar({
  basisPoints,
  health,
  locale,
  label,
  onCard = false,
}: {
  basisPoints: number | null;
  health: MarginHealth;
  locale: Locale;
  label: string;
  onCard?: boolean;
}) {
  const t = translator(locale);
  const colours = (onCard ? ON_CARD : ON_PAPER)[health];
  const filled = basisPoints === null ? 0 : Math.max(0, Math.min(10_000, basisPoints)) / 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] ${onCard ? 'text-card-ink-faint' : 'text-ink-soft'}`}>
          {label}
        </span>
        <span className={`reading text-[15px] ${colours.text}`}>
          <Figure>{formatBasisPoints(basisPoints, { locale })}</Figure>
        </span>
      </div>
      <div
        className={`mt-2 h-2 w-full overflow-hidden rounded-full ${colours.track}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(filled)}
        aria-label={`${label}: ${t(HEALTH_LABEL[health])}`}
      >
        <div
          className={`h-full rounded-full ${colours.fill} transition-[inline-size] duration-100`}
          // Inline because the value is continuous; the palette stays in CSS.
          style={{ inlineSize: `${filled}%` }}
        />
      </div>
      <p className={`mt-1.5 text-[12px] ${colours.text}`}>{t(HEALTH_LABEL[health])}</p>
    </div>
  );
}
