// Real Egyptian real-estate market data (2026), grounded in public market
// reports. Prices are in EGP. Sources are listed at the bottom and surfaced
// in the UI so the numbers are traceable, not invented.
//
// These are the STABLE facts (catalog + benchmarks). The live layer that
// evolves over time (availability, ticker, KPIs) is in lib/market.ts.

export type PropType = "شقة" | "تاون هاوس" | "توين هاوس" | "فيلا" | "شاليه" | "تجاري";

// Price-per-m² ranges by area (EGP), 2026 market reports.
export const AREA_PRICE_PER_M: Record<string, [number, number]> = {
  "القاهرة الجديدة": [20000, 38000],
  "العاصمة الإدارية": [28000, 50000],
  "الشيخ زايد": [22000, 32000],
  "زايد الجديدة": [23000, 34000],
  "المستقبل سيتي": [19000, 28000],
  "الساحل الشمالي": [110000, 185000],
};

// Type premium relative to the area base price-per-m².
export const TYPE_FACTOR: Record<PropType, number> = {
  "شقة": 1.0,
  "تاون هاوس": 1.12,
  "توين هاوس": 1.2,
  "فيلا": 1.45,
  "شاليه": 1.0, // already priced high via the coastal area range
  "تجاري": 1.7,
};

// Real market demand share by type (2026): apartments dominate (~80-85%).
export const MARKET_SHARE: { type: PropType; share: number; avgPricePerM: number }[] = [
  { type: "شقة", share: 82, avgPricePerM: 33000 },
  { type: "تاون هاوس", share: 7, avgPricePerM: 40000 },
  { type: "توين هاوس", share: 4, avgPricePerM: 45000 },
  { type: "فيلا", share: 3, avgPricePerM: 55000 },
  { type: "شاليه", share: 3, avgPricePerM: 135000 },
  { type: "تجاري", share: 1, avgPricePerM: 62000 },
];

// Live-ticker base price-per-m² per area (midpoints of the ranges above),
// plus the reported year-over-year momentum used to bias the drift.
export const AREA_TICKER: { area: string; basePricePerM: number; yoy: number; hot?: boolean }[] = [
  { area: "القاهرة الجديدة", basePricePerM: 29000, yoy: 20 },
  { area: "العاصمة الإدارية", basePricePerM: 40000, yoy: 22 },
  { area: "الشيخ زايد", basePricePerM: 27000, yoy: 14 },
  { area: "زايد الجديدة", basePricePerM: 28500, yoy: 18, hot: true },
  { area: "المستقبل سيتي", basePricePerM: 24000, yoy: 20, hot: true },
  { area: "الساحل الشمالي", basePricePerM: 140000, yoy: 24, hot: true },
];

// Real developers × real flagship compounds, with the unit mix each sells.
export type CompoundSpec = {
  name: string;
  developer: string;
  area: string;
  types: PropType[];
  units: number;          // total inventory in this compound (for availability)
  sqm: [number, number];
  beds: [number, number];
  delivery: number;       // handover year
  image: string;          // gradient token
};

export const COMPOUNDS: CompoundSpec[] = [
  // New Cairo
  { name: "إيستاون", developer: "سوديك", area: "القاهرة الجديدة", types: ["شقة"], units: 340, sqm: [110, 210], beds: [2, 4], delivery: 2027, image: "from-sky-100 to-indigo-100" },
  { name: "ميفيدا", developer: "إعمار مصر", area: "القاهرة الجديدة", types: ["تاون هاوس", "فيلا"], units: 180, sqm: [200, 380], beds: [3, 5], delivery: 2027, image: "from-emerald-100 to-teal-100" },
  { name: "آي سيتي القاهرة", developer: "ماونتن فيو", area: "القاهرة الجديدة", types: ["شقة", "توين هاوس"], units: 420, sqm: [130, 300], beds: [2, 4], delivery: 2028, image: "from-amber-100 to-orange-100" },
  { name: "هايد بارك", developer: "هايد بارك", area: "القاهرة الجديدة", types: ["شقة"], units: 260, sqm: [120, 220], beds: [2, 4], delivery: 2026, image: "from-rose-100 to-pink-100" },
  { name: "زد إيست", developer: "أورا", area: "القاهرة الجديدة", types: ["شقة"], units: 300, sqm: [115, 240], beds: [2, 4], delivery: 2028, image: "from-violet-100 to-purple-100" },

  // New Capital
  { name: "إل بوسكو", developer: "مصر إيطاليا", area: "العاصمة الإدارية", types: ["شقة"], units: 380, sqm: [120, 230], beds: [2, 4], delivery: 2027, image: "from-cyan-100 to-blue-100" },
  { name: "فينشي", developer: "مصر إيطاليا", area: "العاصمة الإدارية", types: ["شقة", "تجاري"], units: 220, sqm: [90, 200], beds: [1, 3], delivery: 2027, image: "from-lime-100 to-emerald-100" },

  // Sheikh Zayed
  { name: "ويستاون", developer: "سوديك", area: "الشيخ زايد", types: ["شقة"], units: 280, sqm: [120, 220], beds: [2, 4], delivery: 2026, image: "from-indigo-100 to-sky-100" },
  { name: "كايرو جيت", developer: "إعمار مصر", area: "الشيخ زايد", types: ["شقة", "تاون هاوس"], units: 200, sqm: [130, 280], beds: [2, 4], delivery: 2027, image: "from-teal-100 to-emerald-100" },

  // New Zayed (hot: townhouses/twinhouses)
  { name: "فاي", developer: "سوديك", area: "زايد الجديدة", types: ["تاون هاوس", "توين هاوس"], units: 240, sqm: [200, 320], beds: [3, 4], delivery: 2028, image: "from-fuchsia-100 to-purple-100" },
  { name: "بادية", developer: "بالم هيلز", area: "زايد الجديدة", types: ["شقة", "تاون هاوس"], units: 360, sqm: [140, 300], beds: [2, 4], delivery: 2028, image: "from-orange-100 to-amber-100" },

  // Mostakbal City (hot)
  { name: "بلوم فيلدز", developer: "تطوير مصر", area: "المستقبل سيتي", types: ["شقة", "تاون هاوس"], units: 320, sqm: [130, 290], beds: [2, 4], delivery: 2028, image: "from-green-100 to-lime-100" },
  { name: "سوديك إيست", developer: "سوديك", area: "المستقبل سيتي", types: ["تاون هاوس"], units: 190, sqm: [190, 300], beds: [3, 4], delivery: 2029, image: "from-blue-100 to-cyan-100" },

  // North Coast — Ras El Hekma (premium)
  { name: "ماونتن فيو راس الحكمة", developer: "ماونتن فيو", area: "الساحل الشمالي", types: ["شاليه"], units: 210, sqm: [95, 180], beds: [1, 3], delivery: 2028, image: "from-cyan-100 to-sky-100" },
  { name: "جون", developer: "سوديك", area: "الساحل الشمالي", types: ["شاليه"], units: 160, sqm: [100, 190], beds: [2, 3], delivery: 2028, image: "from-sky-100 to-blue-100" },
  { name: "مراسي", developer: "إعمار مصر", area: "الساحل الشمالي", types: ["شاليه", "فيلا"], units: 240, sqm: [110, 350], beds: [2, 5], delivery: 2027, image: "from-teal-100 to-cyan-100" },
  { name: "فوكا باي", developer: "تطوير مصر", area: "الساحل الشمالي", types: ["شاليه"], units: 180, sqm: [90, 160], beds: [1, 3], delivery: 2027, image: "from-blue-100 to-indigo-100" },
];

// Traceability — shown in the UI footer.
export const MARKET_SOURCES: { label: string; url: string }[] = [
  { label: "Global Property Guide — Egypt 2026", url: "https://www.globalpropertyguide.com/middle-east/egypt/price-history" },
  { label: "Sands of Wealth — Egypt Market 2026", url: "https://sandsofwealth.com/blogs/news/egypt-real-estate-market" },
  { label: "Aqarmap — دليل الأسعار", url: "https://aqarmap.com.eg/en/neighborhood/cairo/" },
  { label: "خمس خطوات — أسعار المدن الجديدة 2026", url: "https://5khtawat.com/متوسط-أسعار-الشقق-في-المدن-الجديدة" },
];

export const MARKET_UPDATED_LABEL = "بيانات السوق: تقارير 2026";
