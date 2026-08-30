import { type MarginState, formatBasisPoints } from '@/money';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';

const STATE_LABEL: Record<MarginState, StringKey> = {
  healthy: 'margin.healthy',
  warning: 'margin.warning',
  critical: 'margin.critical',
  unpriced: 'margin.unpriced',
};

const STATE_CLASS: Record<MarginState, { fill: string; text: string; track: string }> = {
  healthy: { fill: 'bg-healthy', text: 'text-healthy', track: 'bg-healthy-soft' },
  warning: { fill: 'bg-warning', text: 'text-warning', track: 'bg-warning-soft' },
  critical: { fill: 'bg-critical', text: 'text-critical', track: 'bg-critical-soft' },
  unpriced: { fill: 'bg-ink-faint', text: 'text-ink-faint', track: 'bg-surface-sunk' },
};

/**
 * The signature element.
 *
 * In Phase 0 it reports; in Phase 1 it becomes the thing you drag, and the
 * weight and resistance go here. It is the only saturated colour on the screen,
 * which is what makes a red bar impossible to skim past.
 *
 * The fill is clamped to the 0–100% band, but the number above it is not: a
 * deal at -400% margin says so in words rather than drawing an empty bar.
 */
export function MarginBar({
  basisPoints,
  state,
  locale,
  label,
}: {
  basisPoints: number | null;
  state: MarginState;
  locale: Locale;
  label: string;
}) {
  const t = translator(locale);
  const colours = STATE_CLASS[state];
  const filled = basisPoints === null ? 0 : Math.max(0, Math.min(10_000, basisPoints)) / 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-soft">{label}</span>
        <span className={`tabular text-[15px] font-medium ${colours.text}`}>
          {formatBasisPoints(basisPoints, { locale })}
        </span>
      </div>
      <div
        className={`mt-2 h-2 w-full overflow-hidden rounded-full ${colours.track}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(filled)}
        aria-label={`${label}: ${t(STATE_LABEL[state])}`}
      >
        <div
          className={`h-full rounded-full ${colours.fill}`}
          // Inline width because the value is continuous; the palette stays in CSS.
          style={{ inlineSize: `${filled}%` }}
        />
      </div>
      <p className={`mt-1.5 text-[12px] ${colours.text}`}>{t(STATE_LABEL[state])}</p>
    </div>
  );
}
