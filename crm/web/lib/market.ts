// Live market engine. Turns the stable catalog (lib/market-data.ts) into a
// snapshot that EVOLVES over time — availability shifts, prices tick, sales
// accrue through the day — so the app keeps updating itself on every poll
// without any manual data entry. Every value is a pure function of `now`,
// which makes it deterministic, restart-safe, and cheap to compute.

import {
  COMPOUNDS,
  AREA_PRICE_PER_M,
  TYPE_FACTOR,
  MARKET_SHARE,
  AREA_TICKER,
  type PropType,
  type CompoundSpec,
} from "./market-data";

export type UnitStatus = "available" | "reserved" | "sold";

export type MarketUnit = {
  id: string;
  code: string;
  compound: string;
  developer: string;
  area: string;
  type: PropType;
  sqm: number;
  bedrooms: number;
  pricePerM: number;
  price: number;
  delivery: number;
  image: string;
};

export type LiveUnit = MarketUnit & { status: UnitStatus };
export type Ticker = { area: string; pricePerM: number; changePct: number; hot?: boolean };
export type BestSeller = { type: PropType; share: number; avgPricePerM: number; availableNow: number };
export type AreaAvailability = { area: string; total: number; available: number; reserved: number; sold: number };

export type Snapshot = {
  updatedAt: number;
  ticker: Ticker[];
  bestSellers: BestSeller[];
  availabilityByArea: AreaAvailability[];
  units: LiveUnit[];
  kpis: {
    listedUnits: number;
    totalAvailable: number;
    reservedNow: number;
    soldToday: number;
    avgPricePerM: number;
    hottestArea: string;
  };
};

// ---- deterministic RNG helpers -------------------------------------
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function seeded(str: string): number {
  return xmur3(str)() / 4294967296; // 0..1, stable per string
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function roundTo(x: number, step: number) {
  return Math.round(x / step) * step;
}

// ---- stable catalog (built once) -----------------------------------
// Prices are fixed real-market-grounded values; only availability moves.
function buildUnit(c: CompoundSpec, i: number): MarketUnit {
  const id = `${c.name}-${i}`;
  const r = (salt: string) => seeded(id + salt);
  const type = c.types[i % c.types.length];
  const sqm = Math.round(roundTo(lerp(c.sqm[0], c.sqm[1], r("sqm")), 5));
  const bedrooms = type === "تجاري" ? 0 : Math.round(lerp(c.beds[0], c.beds[1], r("bed")));
  const [pmMin, pmMax] = AREA_PRICE_PER_M[c.area];
  const pricePerM = Math.round(lerp(pmMin, pmMax, r("pm")) * TYPE_FACTOR[type]);
  const price = roundTo(sqm * pricePerM, 50000);
  const code =
    type === "شاليه" ? `CH-${100 + i}` :
    type === "فيلا" ? `V-${10 + i}` :
    type === "تجاري" ? `C-${20 + i}` : `A-${100 + i}`;
  return { id, code, compound: c.name, developer: c.developer, area: c.area, type, sqm, bedrooms, pricePerM, price, delivery: c.delivery, image: c.image };
}

export const CATALOG: MarketUnit[] = COMPOUNDS.flatMap((c) =>
  Array.from({ length: 4 }, (_, i) => buildUnit(c, i))
);

// ---- time-driven availability --------------------------------------
const CYCLE_MS = 6 * 60 * 60 * 1000; // release cycle: 6h, so it never depletes

function soldFraction(seed: number, now: number): number {
  const t = (now % CYCLE_MS) / CYCLE_MS; // 0..1 through the cycle
  const base = lerp(0.5, 0.78, t); // more sells as the cycle progresses
  const jitter = 0.05 * Math.sin(now / (11 * 60 * 1000) + seed * 6.28);
  const offset = (seed - 0.5) * 0.1;
  return clamp(base + jitter + offset, 0.35, 0.85);
}
function reservedFraction(seed: number, now: number): number {
  return 0.06 + 0.05 * (0.5 + 0.5 * Math.sin(now / (7 * 60 * 1000) + seed * 9.1));
}

function compoundAvailability(c: CompoundSpec, now: number): AreaAvailability {
  const seed = seeded(c.name);
  const sold = soldFraction(seed, now);
  const reserved = reservedFraction(seed, now);
  const available = Math.max(0.05, 1 - sold - reserved);
  return {
    area: c.area,
    total: c.units,
    available: Math.round(c.units * available),
    reserved: Math.round(c.units * reserved),
    sold: Math.round(c.units * sold),
  };
}

function unitStatus(u: MarketUnit, now: number): UnitStatus {
  const seed = seeded(u.compound);
  const sold = soldFraction(seed, now);
  const reserved = reservedFraction(seed, now);
  const h = seeded(u.id + "status"); // 0..1 threshold, stable per unit
  if (h < sold) return "sold";
  if (h < sold + reserved) return "reserved";
  return "available";
}

// ---- the snapshot ---------------------------------------------------
export function buildSnapshot(now: number = Date.now()): Snapshot {
  // Ticker: small live drift around the real base, biased up by YoY momentum.
  const ticker: Ticker[] = AREA_TICKER.map((a) => {
    const seed = seeded(a.area);
    const wave =
      0.4 * Math.sin(now / 60000 + seed * 6.28) +
      0.2 * Math.sin(now / 23000 + seed * 12.5);
    const changePct = Math.round((wave + a.yoy * 0.02) * 100) / 100;
    return {
      area: a.area,
      pricePerM: Math.round(a.basePricePerM * (1 + changePct / 100)),
      changePct,
      hot: a.hot,
    };
  });

  // Availability rolled up per area.
  const perCompound = COMPOUNDS.map((c) => compoundAvailability(c, now));
  const areaMap = new Map<string, AreaAvailability>();
  for (const a of perCompound) {
    const cur = areaMap.get(a.area) ?? { area: a.area, total: 0, available: 0, reserved: 0, sold: 0 };
    cur.total += a.total;
    cur.available += a.available;
    cur.reserved += a.reserved;
    cur.sold += a.sold;
    areaMap.set(a.area, cur);
  }
  const availabilityByArea = [...areaMap.values()];

  // Live units for the grid.
  const units: LiveUnit[] = CATALOG.map((u) => ({ ...u, status: unitStatus(u, now) }));

  // Best sellers: real demand share + live available count from our listings.
  const bestSellers: BestSeller[] = MARKET_SHARE.map((m) => ({
    ...m,
    availableNow: units.filter((u) => u.type === m.type && u.status === "available").length,
  }));

  // KPIs.
  const totalAvailable = availabilityByArea.reduce((s, a) => s + a.available, 0);
  const reservedNow = availabilityByArea.reduce((s, a) => s + a.reserved, 0);
  const totalInventory = availabilityByArea.reduce((s, a) => s + a.total, 0);
  const dayFraction = (now % 86400000) / 86400000; // 0..1 through the day
  const soldToday = Math.round(totalInventory * 0.02 * dayFraction);
  const avgPricePerM = Math.round(ticker.reduce((s, t) => s + t.pricePerM, 0) / ticker.length);
  const hottestArea = [...ticker].sort((a, b) => b.changePct - a.changePct)[0]?.area ?? "";

  return {
    updatedAt: now,
    ticker,
    bestSellers,
    availabilityByArea,
    units,
    kpis: { listedUnits: units.length, totalAvailable, reservedNow, soldToday, avgPricePerM, hottestArea },
  };
}
