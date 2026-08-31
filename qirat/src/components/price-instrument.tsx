'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import {
  type CurrencyCode,
  type MarginSignal,
  computeMargin,
  formatMoney,
  marginHealth,
  marginSignal,
  money,
  niceStepFor,
  snapToStep,
} from '@/money';
import { type Locale, type StringKey, translator } from '@/i18n/dictionary';
import {
  type DealActionResult,
  closeDealAction,
  savePriceAction,
  sendForApprovalAction,
} from '@/app/actions/deal';
import { MarginBar } from './margin-bar';
import { Figure } from './figure';

/**
 * The instrument.
 *
 * Everything else in Qirat is a surface to work on. This is the one thing
 * people are meant to remember: your hand drags the price, and the bar
 * underneath moves with it. So it is given a body — detents you can feel at the
 * floor, the target and the ceiling, and real resistance as the price
 * approaches the floor, because the floor is a threshold and it should take
 * effort to push through.
 *
 * The margin is recomputed in the browser by the same money module the server
 * uses. Not a re-implementation of it, not an approximation in floats — the
 * identical pure functions, imported. That is why the number on screen mid-drag
 * and the number stored on release cannot disagree.
 */

/** How much of a pointer movement survives below the floor. Lower is heavier. */
const RESISTANCE_BELOW_FLOOR = 0.45;
/** How close, in track fractions, before the handle takes hold of a detent. */
const DETENT_GRAB = 0.014;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface PriceInstrumentProps {
  dealId: string;
  currency: CurrencyCode;
  /** Minor units as strings: bigint does not survive the server boundary. */
  priceMinor: string;
  costMinor: string;
  houseRateBp: number;
  band: { floorMinor: string; targetMinor: string; ceilingMinor: string } | null;
  thresholds: { healthyFromBp: number; warningFromBp: number };
  locale: Locale;
  direction: 'ltr' | 'rtl';
  status: 'draft' | 'pending_approval' | 'won' | 'lost';
  canEdit: boolean;
}

export function PriceInstrument(props: PriceInstrumentProps) {
  const t = translator(props.locale);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastDetent = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  const [priceMinor, setPriceMinor] = useState<bigint>(() => BigInt(props.priceMinor));
  const [dragging, setDragging] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [status, setStatus] = useState(props.status);

  const cost = useMemo(
    () => money(BigInt(props.costMinor), props.currency),
    [props.costMinor, props.currency],
  );

  const band = useMemo(() => {
    if (!props.band) return null;
    return {
      floor: money(BigInt(props.band.floorMinor), props.currency),
      target: money(BigInt(props.band.targetMinor), props.currency),
      ceiling: money(BigInt(props.band.ceilingMinor), props.currency),
    };
  }, [props.band, props.currency]);

  /**
   * The track runs from below the floor to the ceiling.
   *
   * It has to extend past the floor, because going under it is a real move an
   * account manager makes — it just routes somewhere different. A slider that
   * stops at the floor would be telling a lie about what is allowed.
   */
  const track = useMemo(() => {
    if (!band) return null;
    const span = band.ceiling.minor - band.floor.minor;
    const headroom = span > 0n ? (span * 30n) / 100n : band.floor.minor / 4n;
    const min = band.floor.minor - headroom > 0n ? band.floor.minor - headroom : 0n;
    const max = band.ceiling.minor;
    return { min, max, width: max - min > 0n ? max - min : 1n };
  }, [band]);

  const step = useMemo(
    () => (track ? niceStepFor(money(track.width, props.currency)) : 1n),
    [track, props.currency],
  );

  const price = money(priceMinor, props.currency);
  const margin = computeMargin(price, cost, props.houseRateBp);
  const signal: MarginSignal = marginSignal({
    marginBasisPoints: margin.marginBasisPoints,
    price,
    ...(band ? { band } : {}),
    thresholds: props.thresholds,
  });
  const isBelowFloor = signal === 'below-floor' && band !== null;
  // The bar answers "how is the margin", the price answers "is this within the
  // band". Keeping them apart is what stops a 64% margin being drawn in red
  // because a pricing policy was crossed.
  const health = marginHealth(margin.marginBasisPoints, props.thresholds);

  const fractionOf = useCallback(
    (value: bigint): number => {
      if (!track) return 0;
      const clamped = value < track.min ? track.min : value > track.max ? track.max : value;
      return Number(((clamped - track.min) * 10_000n) / track.width) / 10_000;
    },
    [track],
  );

  const buzz = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Some browsers expose it and refuse it. Not worth a broken drag.
      }
    }
  }, []);

  /** Pointer fraction along the track, in reading order, 0 at the inline start. */
  const readPointer = useCallback(
    (clientX: number): number | null => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return null;
      const along =
        props.direction === 'rtl'
          ? (rect.right - clientX) / rect.width
          : (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, along));
    },
    [props.direction],
  );

  const applyFraction = useCallback(
    (rawFraction: number) => {
      if (!track || !band) return;

      const floorAt = fractionOf(band.floor.minor);
      const targetAt = fractionOf(band.target.minor);
      const ceilingAt = fractionOf(band.ceiling.minor);

      // Resistance. Below the floor the handle only travels part of the way the
      // finger does, so the floor is something you feel yourself pushing past
      // rather than a line the handle glides over without noticing.
      let fraction = rawFraction;
      if (rawFraction < floorAt) {
        fraction = floorAt - (floorAt - rawFraction) * RESISTANCE_BELOW_FLOOR;
      }

      // Detents. Within grabbing distance the handle takes the exact value, so
      // "on the floor" and "on target" are values you can actually land on
      // instead of approximately hit.
      const detents: Array<{ id: string; at: number; value: bigint }> = [
        { id: 'floor', at: floorAt, value: band.floor.minor },
        { id: 'target', at: targetAt, value: band.target.minor },
        { id: 'ceiling', at: ceilingAt, value: band.ceiling.minor },
      ];
      const caught = detents.find((detent) => Math.abs(fraction - detent.at) < DETENT_GRAB);

      let next: bigint;
      if (caught) {
        next = caught.value;
        if (lastDetent.current !== caught.id) {
          buzz(caught.id === 'floor' ? 18 : 8);
          lastDetent.current = caught.id;
        }
      } else {
        lastDetent.current = null;
        const raw = track.min + BigInt(Math.round(fraction * Number(track.width)));
        next = snapToStep(money(raw, props.currency), step).minor;
        if (next < 0n) next = 0n;
      }

      setPriceMinor(next);
    },
    [track, band, fractionOf, buzz, step, props.currency],
  );

  const persist = useCallback(
    (value: bigint) => {
      if (!props.canEdit) return;
      setSaveState('saving');
      startTransition(async () => {
        const result: DealActionResult = await savePriceAction(props.dealId, value.toString());
        setSaveState(result.ok ? 'saved' : 'error');
      });
    },
    [props.canEdit, props.dealId],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!props.canEdit || !track) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setSaveState('idle');
    const fraction = readPointer(event.clientX);
    if (fraction !== null) applyFraction(fraction);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const fraction = readPointer(event.clientX);
    if (fraction !== null) applyFraction(fraction);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(false);
    lastDetent.current = null;
    persist(priceMinor);
  };

  const nudge = (steps: number) => {
    if (!props.canEdit || !track) return;
    const moved = priceMinor + BigInt(steps) * step;
    const clamped = moved < 0n ? 0n : moved > track.max ? track.max : moved;
    setPriceMinor(clamped);
    persist(clamped);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!props.canEdit || !track) return;
    // In a right-to-left track the arrows follow the screen, not the number:
    // pressing the arrow that points at the ceiling raises the price.
    const rtl = props.direction === 'rtl';
    const up = rtl ? 'ArrowLeft' : 'ArrowRight';
    const down = rtl ? 'ArrowRight' : 'ArrowLeft';

    switch (event.key) {
      case up:
      case 'ArrowUp':
        event.preventDefault();
        nudge(1);
        break;
      case down:
      case 'ArrowDown':
        event.preventDefault();
        nudge(-1);
        break;
      case 'PageUp':
        event.preventDefault();
        nudge(10);
        break;
      case 'PageDown':
        event.preventDefault();
        nudge(-10);
        break;
      case 'Home':
        event.preventDefault();
        setPriceMinor(track.min);
        persist(track.min);
        break;
      case 'End':
        event.preventDefault();
        setPriceMinor(track.max);
        persist(track.max);
        break;
      default:
    }
  };

  const commit = () => {
    startTransition(async () => {
      setSaveState('saving');
      const action = isBelowFloor ? sendForApprovalAction : closeDealAction;
      const result = await action(props.dealId, priceMinor.toString());
      if (result.ok) {
        setStatus(result.status as PriceInstrumentProps['status']);
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    });
  };

  const fmt = (value: Parameters<typeof formatMoney>[0]) =>
    formatMoney(value, { locale: props.locale, display: 'none' });

  const handleAt = track ? fractionOf(priceMinor) * 100 : 0;
  const floorAt = band ? fractionOf(band.floor.minor) * 100 : 0;
  const targetAt = band ? fractionOf(band.target.minor) * 100 : 0;

  const fillClass =
    signal === 'healthy'
      ? 'bg-healthy'
      : signal === 'thin'
        ? 'bg-thin'
        : signal === 'below-floor'
          ? 'bg-below'
          : 'bg-card-ink-faint';

  return (
    <div>
      {/* The reading. Monospaced and tabular so the digits hold their columns
          while the price is moving; a proportional face makes the whole row
          twitch on every frame. */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-[11px] tracking-wide text-card-ink-faint uppercase">
            {t('deal.price')}
          </span>
          <div
            className={`reading mt-1 text-[34px] leading-none transition-colors ${
              isBelowFloor ? 'text-below' : 'text-card-ink'
            }`}
          >
            <Figure>{fmt(price)}</Figure>
          </div>
        </div>
        <span className="reading text-[11px] text-card-ink-faint">{props.currency}</span>
      </div>

      {track && band ? (
        <>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={props.canEdit ? 0 : -1}
            aria-label={t('deal.price')}
            aria-valuemin={Number(track.min)}
            aria-valuemax={Number(track.max)}
            aria-valuenow={Number(priceMinor)}
            aria-valuetext={`${fmt(price)} ${props.currency}. ${t(
              `margin.${signal === 'below-floor' ? 'belowFloor' : signal}` as StringKey,
            )}`}
            aria-disabled={!props.canEdit}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className={`relative mt-5 h-11 touch-none select-none ${
              props.canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
          >
            {/* The rail */}
            <div className="absolute inset-inline-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-card-line" />

            {/* Everything under the floor, marked as under the floor. */}
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-s-full bg-below/25"
              style={{ insetInlineStart: 0, inlineSize: `${floorAt}%` }}
            />

            {/* The fill: a quantity, so it grows from the inline start — left in
                English, right in Arabic. */}
            <div
              className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${fillClass} ${
                dragging ? '' : 'transition-[inline-size] duration-150'
              }`}
              style={{ insetInlineStart: 0, inlineSize: `${handleAt}%` }}
            />

            {[
              { at: floorAt, key: 'deal.floor' as StringKey, value: band.floor },
              { at: targetAt, key: 'deal.target' as StringKey, value: band.target },
            ].map((detent) => (
              <div
                key={detent.key}
                className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-card-ink-faint/60"
                style={{ insetInlineStart: `${detent.at}%` }}
                aria-hidden
              />
            ))}

            {/* The handle */}
            <div
              className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full border-2 bg-card-raised shadow-lg ${
                dragging ? 'scale-110' : 'transition-transform'
              } ${
                isBelowFloor ? 'border-below' : signal === 'thin' ? 'border-thin' : 'border-healthy'
              }`}
              style={{
                insetInlineStart: `${handleAt}%`,
                transform: 'translate(-50%, -50%)',
                marginInlineStart: 0,
              }}
              aria-hidden
            />
          </div>

          <div className="mt-1 flex justify-between text-[11px] text-card-ink-faint">
            <span>
              {t('deal.floor')} <Figure>{fmt(band.floor)}</Figure>
            </span>
            <span>
              {t('deal.ceiling')} <Figure>{fmt(band.ceiling)}</Figure>
            </span>
          </div>
        </>
      ) : null}

      <div className="mt-5">
        <MarginBar
          basisPoints={margin.marginBasisPoints}
          health={health}
          locale={props.locale}
          label={t('deal.margin')}
          onCard
        />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-card-line pt-4 text-[12px]">
        <Cell label={t('deal.cost')} value={fmt(margin.directCosts)} />
        <Cell label={t('deal.houseShare')} value={fmt(margin.houseShare)} />
        <Cell label={t('deal.distributable')} value={fmt(margin.distributable)} />
      </dl>

      {isBelowFloor ? (
        <p className="mt-4 text-[12px] leading-relaxed text-below">{t('deal.belowFloorNote')}</p>
      ) : null}

      {status === 'won' ? (
        <p className="mt-4 text-[12px] leading-relaxed text-card-ink-faint">
          {t('deal.frozenNote')}
        </p>
      ) : status === 'pending_approval' ? (
        <p className="mt-4 text-[12px] leading-relaxed text-card-ink-soft">
          {t('deal.sentForApproval')}
        </p>
      ) : props.canEdit ? (
        <div className="mt-5 flex items-center gap-3">
          {/*
            Below the floor the button does not grey out and nothing throws an
            error. It says something else. The limit is a door to somewhere,
            not a wall, and the interface changes its vocabulary rather than
            its temper.
          */}
          <button
            type="button"
            onClick={commit}
            disabled={saveState === 'saving'}
            className={`rounded-[8px] px-4 py-2 text-[14px] font-medium disabled:opacity-60 ${
              isBelowFloor
                ? 'bg-below text-card'
                : 'bg-card-ink text-card'
            }`}
          >
            {isBelowFloor ? t('deal.sendForApproval') : t('deal.close')}
          </button>
          <span className="text-[12px] text-card-ink-faint" aria-live="polite">
            {saveState === 'saving'
              ? `${t('deal.saving')}…`
              : saveState === 'saved'
                ? t('deal.saved')
                : saveState === 'error'
                  ? t('deal.saveFailed')
                  : props.canEdit && track
                    ? t('deal.dragHint')
                    : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-card-ink-faint">{label}</dt>
      <dd className="reading mt-1 text-[14px] text-card-ink-soft">
        <Figure>{value}</Figure>
      </dd>
    </div>
  );
}
