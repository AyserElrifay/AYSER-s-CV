import { type CurrencyCode } from '@/money';

/**
 * The catalogue a new organisation starts with.
 *
 * A new org must reach a populated, usable screen — not an empty state with a
 * "create your first service" button. These are the five things a Cairo
 * creative agency actually sells, priced in the range they actually sell them
 * in, so the first deal card an owner sees has real numbers in it.
 *
 * Every one of them is editable the moment they land.
 */
export interface ServiceSeed {
  name: string;
  nameAr: string;
  /** Major units. Converted to minor units on insert. */
  floor: string;
  target: string;
  ceiling: string;
  costMin: string;
  costMax: string;
  tasks: Array<{ title: string; titleAr: string; offsetDays: number }>;
}

export const DEFAULT_CURRENCY: CurrencyCode = 'EGP';

export const DEFAULT_SERVICES: ServiceSeed[] = [
  {
    name: 'Brand Book',
    nameAr: 'دليل الهوية',
    floor: '50000.00',
    target: '75000.00',
    ceiling: '120000.00',
    costMin: '15000.00',
    costMax: '30000.00',
    tasks: [
      { title: 'Discovery workshop', titleAr: 'ورشة الاستكشاف', offsetDays: 3 },
      { title: 'Moodboard and direction', titleAr: 'لوحة الإلهام والاتجاه', offsetDays: 10 },
      { title: 'Logo and mark', titleAr: 'الشعار والعلامة', offsetDays: 21 },
      { title: 'Type and colour system', titleAr: 'نظام الخطوط والألوان', offsetDays: 30 },
      { title: 'Guidelines document', titleAr: 'وثيقة الإرشادات', offsetDays: 45 },
    ],
  },
  {
    name: 'Video Production',
    nameAr: 'إنتاج الفيديو',
    floor: '25000.00',
    target: '40000.00',
    ceiling: '60000.00',
    costMin: '10000.00',
    costMax: '22000.00',
    tasks: [
      { title: 'Script and storyboard', titleAr: 'النص واللوحة القصصية', offsetDays: 5 },
      { title: 'Pre-production and casting', titleAr: 'التحضير واختيار الممثلين', offsetDays: 12 },
      { title: 'Shoot day', titleAr: 'يوم التصوير', offsetDays: 18 },
      { title: 'Edit and grade', titleAr: 'المونتاج والتصحيح اللوني', offsetDays: 28 },
      { title: 'Client review and delivery', titleAr: 'مراجعة العميل والتسليم', offsetDays: 35 },
    ],
  },
  {
    name: 'Content Strategy',
    nameAr: 'استراتيجية المحتوى',
    floor: '30000.00',
    target: '45000.00',
    ceiling: '70000.00',
    costMin: '8000.00',
    costMax: '18000.00',
    tasks: [
      { title: 'Audience and channel audit', titleAr: 'تحليل الجمهور والقنوات', offsetDays: 7 },
      { title: 'Pillars and tone', titleAr: 'المحاور ونبرة الصوت', offsetDays: 14 },
      { title: 'Monthly calendar', titleAr: 'التقويم الشهري', offsetDays: 21 },
    ],
  },
  {
    name: 'Pitch Deck',
    nameAr: 'عرض تقديمي',
    floor: '15000.00',
    target: '25000.00',
    ceiling: '40000.00',
    costMin: '4000.00',
    costMax: '9000.00',
    tasks: [
      { title: 'Narrative and structure', titleAr: 'السرد والهيكل', offsetDays: 4 },
      { title: 'Design pass', titleAr: 'مرحلة التصميم', offsetDays: 10 },
      { title: 'Rehearsal and handover', titleAr: 'التدريب والتسليم', offsetDays: 14 },
    ],
  },
  {
    name: 'Performance Marketing',
    nameAr: 'التسويق الأدائي',
    floor: '20000.00',
    target: '35000.00',
    ceiling: '55000.00',
    costMin: '6000.00',
    costMax: '14000.00',
    tasks: [
      { title: 'Account and pixel setup', titleAr: 'إعداد الحساب والبيكسل', offsetDays: 3 },
      { title: 'Creative testing round', titleAr: 'جولة اختبار الإعلانات', offsetDays: 12 },
      { title: 'Monthly performance report', titleAr: 'تقرير الأداء الشهري', offsetDays: 30 },
    ],
  },
];

/** The brand kit an org starts with. The Owner edits it; nobody else can. */
export const DEFAULT_BRAND_KIT = {
  palette: {
    ink: '#16181A',
    ground: '#F1F2EF',
    surface: '#FBFBFA',
    line: '#DCDDD7',
    // Saturation is reserved for margin state and nothing else.
    healthy: '#2F6F4F',
    warning: '#A86A12',
    critical: '#A63A2E',
  },
  fonts: {
    latin: 'IBM Plex Sans',
    arabic: 'IBM Plex Sans Arabic',
  },
  lockedConfig: {
    slideOrder: ['cover', 'about', 'approach', 'scope', 'timeline', 'pricing', 'terms'],
    editableByOwnerOnly: ['palette', 'fonts', 'logoUrl', 'slideOrder', 'legalTerms'],
  },
} as const;
