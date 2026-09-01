import {
  type CostTemplateLine,
  type CurrencyCode,
  type TaxTreatment,
  defaultVatRateFor,
} from '@/money';

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
  /**
   * What the work is actually made of.
   *
   * These rates are a starting structure, not researched market data. They are
   * plausible Cairo day rates that total inside each service's cost range, and
   * an agency is expected to replace them with its own in the first week. The
   * structure is the part that matters: an estimate you can take apart is one
   * you can defend to a client and argue about internally, and an estimate
   * nobody argues about is how a margin quietly becomes fiction.
   */
  costs: CostTemplateLine[];
  tasks: Array<{ title: string; titleAr: string; offsetDays: number }>;
}

export const DEFAULT_CURRENCY: CurrencyCode = 'EGP';

/** Renamed for clarity now that there is more than one starting catalogue. */
export const MENA_CURRENCY: CurrencyCode = 'EGP';

export const DEFAULT_SERVICES: ServiceSeed[] = [
  {
    name: 'Brand Book',
    nameAr: 'دليل الهوية',
    floor: '50000.00',
    target: '75000.00',
    ceiling: '120000.00',
    costMin: '15000.00',
    costMax: '30000.00',
    costs: [
      { label: 'Senior designer', labelAr: 'مصمم أول', amount: '1500.00', quantity: 12, unit: 'day' },
      { label: 'Junior designer', labelAr: 'مصمم مبتدئ', amount: '700.00', quantity: 6, unit: 'day' },
      { label: 'Copywriter', labelAr: 'كاتب محتوى', amount: '1200.00', quantity: 3, unit: 'day' },
      { label: 'Imagery and type licences', labelAr: 'صور وخطوط مرخّصة', amount: '2500.00', quantity: 1, unit: 'item' },
      { label: 'Print proofs', labelAr: 'بروفات طباعة', amount: '1200.00', quantity: 1, unit: 'item' },
    ],
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
    costs: [
      { label: 'Director and DoP', labelAr: 'مخرج ومدير تصوير', amount: '4000.00', quantity: 1, unit: 'day' },
      { label: 'Camera and lens kit', labelAr: 'كاميرا وعدسات', amount: '2500.00', quantity: 1, unit: 'day' },
      { label: 'Lighting and grip', labelAr: 'إضاءة ومعدات', amount: '1800.00', quantity: 1, unit: 'day' },
      { label: 'Sound recordist', labelAr: 'مهندس صوت', amount: '1500.00', quantity: 1, unit: 'day' },
      { label: 'Location and permits', labelAr: 'موقع وتصاريح', amount: '2000.00', quantity: 1, unit: 'item' },
      { label: 'Talent and voiceover', labelAr: 'ممثلون وتعليق صوتي', amount: '3000.00', quantity: 1, unit: 'item' },
      { label: 'Transport and catering', labelAr: 'انتقالات وضيافة', amount: '1200.00', quantity: 1, unit: 'item' },
      { label: 'Editor', labelAr: 'مونتير', amount: '900.00', quantity: 4, unit: 'day' },
      { label: 'Colour and sound mix', labelAr: 'تصحيح ألوان ومكساج', amount: '1800.00', quantity: 1, unit: 'item' },
    ],
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
    costs: [
      { label: 'Strategist', labelAr: 'استراتيجي', amount: '1800.00', quantity: 6, unit: 'day' },
      { label: 'Research and listening tools', labelAr: 'أدوات بحث وتحليل', amount: '1500.00', quantity: 1, unit: 'month' },
      { label: 'Copywriter', labelAr: 'كاتب محتوى', amount: '1200.00', quantity: 3, unit: 'day' },
    ],
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
    costs: [
      { label: 'Designer', labelAr: 'مصمم', amount: '1200.00', quantity: 5, unit: 'day' },
      { label: 'Narrative and copy', labelAr: 'السرد والنصوص', amount: '1200.00', quantity: 2, unit: 'day' },
      { label: 'Imagery and icon licences', labelAr: 'صور وأيقونات مرخّصة', amount: '500.00', quantity: 1, unit: 'item' },
    ],
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
    costs: [
      { label: 'Media buyer', labelAr: 'مشتري إعلانات', amount: '1100.00', quantity: 8, unit: 'day' },
      { label: 'Creative production', labelAr: 'إنتاج إبداعي', amount: '3000.00', quantity: 1, unit: 'item' },
      { label: 'Tooling and reporting', labelAr: 'أدوات وتقارير', amount: '900.00', quantity: 1, unit: 'month' },
    ],
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

// --- a second starting catalogue ---------------------------------------------

/**
 * The same five services, priced for a European agency.
 *
 * A studio in Berlin signing up and finding Cairo day rates in Egyptian pounds
 * learns in one screen that this product was not built for them. The structure
 * is identical — the same work, the same build-up — and only the currency and
 * the rates move, which is exactly the claim the product makes about itself.
 *
 * As with the MENA catalogue, these are a starting structure and not researched
 * market data. They are plausible European day rates that clear each service's
 * own floor, and an agency replaces them in the first week.
 */
export const EUROPE_SERVICES: ServiceSeed[] = [
  {
    name: 'Brand Identity System',
    nameAr: 'نظام الهوية',
    floor: '15000.00',
    target: '24000.00',
    ceiling: '38000.00',
    costMin: '6000.00',
    costMax: '12000.00',
    costs: [
      { label: 'Senior designer', labelAr: 'مصمم أول', amount: '450.00', quantity: 12, unit: 'day' },
      { label: 'Junior designer', labelAr: 'مصمم مبتدئ', amount: '220.00', quantity: 6, unit: 'day' },
      { label: 'Copywriter', labelAr: 'كاتب محتوى', amount: '380.00', quantity: 3, unit: 'day' },
      { label: 'Imagery and type licences', labelAr: 'صور وخطوط مرخّصة', amount: '600.00', quantity: 1, unit: 'item' },
      { label: 'Print proofs', labelAr: 'بروفات طباعة', amount: '350.00', quantity: 1, unit: 'item' },
    ],
    tasks: [
      { title: 'Discovery workshop', titleAr: 'ورشة الاستكشاف', offsetDays: 3 },
      { title: 'Direction and territories', titleAr: 'الاتجاهات البصرية', offsetDays: 10 },
      { title: 'Logo and mark', titleAr: 'الشعار والعلامة', offsetDays: 21 },
      { title: 'Type and colour system', titleAr: 'نظام الخطوط والألوان', offsetDays: 30 },
      { title: 'Guidelines document', titleAr: 'وثيقة الإرشادات', offsetDays: 45 },
    ],
  },
  {
    name: 'Video Production',
    nameAr: 'إنتاج الفيديو',
    floor: '9000.00',
    target: '15000.00',
    ceiling: '25000.00',
    costMin: '3000.00',
    costMax: '7000.00',
    costs: [
      { label: 'Director and DoP', labelAr: 'مخرج ومدير تصوير', amount: '900.00', quantity: 1, unit: 'day' },
      { label: 'Camera and lens kit', labelAr: 'كاميرا وعدسات', amount: '550.00', quantity: 1, unit: 'day' },
      { label: 'Lighting and grip', labelAr: 'إضاءة ومعدات', amount: '400.00', quantity: 1, unit: 'day' },
      { label: 'Sound recordist', labelAr: 'مهندس صوت', amount: '350.00', quantity: 1, unit: 'day' },
      { label: 'Location and permits', labelAr: 'موقع وتصاريح', amount: '500.00', quantity: 1, unit: 'item' },
      { label: 'Talent and voiceover', labelAr: 'ممثلون وتعليق صوتي', amount: '800.00', quantity: 1, unit: 'item' },
      { label: 'Transport and catering', labelAr: 'انتقالات وضيافة', amount: '300.00', quantity: 1, unit: 'item' },
      { label: 'Editor', labelAr: 'مونتير', amount: '320.00', quantity: 4, unit: 'day' },
      { label: 'Colour and sound mix', labelAr: 'تصحيح ألوان ومكساج', amount: '450.00', quantity: 1, unit: 'item' },
    ],
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
    floor: '8000.00',
    target: '12000.00',
    ceiling: '20000.00',
    costMin: '3000.00',
    costMax: '6000.00',
    costs: [
      { label: 'Strategist', labelAr: 'استراتيجي', amount: '550.00', quantity: 6, unit: 'day' },
      { label: 'Research and listening tools', labelAr: 'أدوات بحث وتحليل', amount: '400.00', quantity: 1, unit: 'month' },
      { label: 'Copywriter', labelAr: 'كاتب محتوى', amount: '380.00', quantity: 3, unit: 'day' },
    ],
    tasks: [
      { title: 'Audience and channel audit', titleAr: 'تحليل الجمهور والقنوات', offsetDays: 7 },
      { title: 'Pillars and tone', titleAr: 'المحاور ونبرة الصوت', offsetDays: 14 },
      { title: 'Monthly calendar', titleAr: 'التقويم الشهري', offsetDays: 21 },
    ],
  },
  {
    name: 'Pitch Deck',
    nameAr: 'عرض تقديمي',
    floor: '5000.00',
    target: '7500.00',
    ceiling: '12000.00',
    costMin: '2000.00',
    costMax: '4000.00',
    costs: [
      { label: 'Designer', labelAr: 'مصمم', amount: '400.00', quantity: 5, unit: 'day' },
      { label: 'Narrative and copy', labelAr: 'السرد والنصوص', amount: '450.00', quantity: 2, unit: 'day' },
      { label: 'Imagery and icon licences', labelAr: 'صور وأيقونات مرخّصة', amount: '150.00', quantity: 1, unit: 'item' },
    ],
    tasks: [
      { title: 'Narrative and structure', titleAr: 'السرد والهيكل', offsetDays: 4 },
      { title: 'Design pass', titleAr: 'مرحلة التصميم', offsetDays: 10 },
      { title: 'Rehearsal and handover', titleAr: 'التدريب والتسليم', offsetDays: 14 },
    ],
  },
  {
    name: 'Performance Marketing',
    nameAr: 'التسويق الأدائي',
    floor: '7500.00',
    target: '11000.00',
    ceiling: '18000.00',
    costMin: '3000.00',
    costMax: '6000.00',
    costs: [
      { label: 'Media buyer', labelAr: 'مشتري إعلانات', amount: '420.00', quantity: 8, unit: 'day' },
      { label: 'Creative production', labelAr: 'إنتاج إبداعي', amount: '800.00', quantity: 1, unit: 'item' },
      { label: 'Tooling and reporting', labelAr: 'أدوات وتقارير', amount: '250.00', quantity: 1, unit: 'month' },
    ],
    tasks: [
      { title: 'Account and pixel setup', titleAr: 'إعداد الحساب والبيكسل', offsetDays: 3 },
      { title: 'Creative testing round', titleAr: 'جولة اختبار الإعلانات', offsetDays: 12 },
      { title: 'Monthly performance report', titleAr: 'تقرير الأداء الشهري', offsetDays: 30 },
    ],
  },
];

/** Where a new agency starts: its currency, its catalogue and its tax position. */
export interface StartingPoint {
  currency: CurrencyCode;
  services: ServiceSeed[];
  vatRateBp: number;
  vatRegistered: boolean;
  taxTreatment: TaxTreatment;
}

const EUROPE = new Set([
  'AT','BE','BG','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE',
  'IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK',
]);

const EURO_ZONE = new Set([
  'AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT','LT','LU','LV','MT',
  'NL','PT','SI','SK',
]);

const LOCAL_CURRENCY: Record<string, CurrencyCode> = {
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY',
  SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD', BH: 'BHD',
  OM: 'OMR', JO: 'JOD', TN: 'TND', MA: 'MAD', EG: 'EGP',
};

/**
 * What to seed for an agency in a given country.
 *
 * Two catalogues, chosen by where the agency actually is. The rates are a
 * starting structure either way; what changes is that a European agency does
 * not open the product to a screen full of Egyptian pounds, and an Egyptian one
 * does not open it to euros.
 *
 * A new agency starts **not registered** for VAT whatever its country, because
 * whether it is registered is a fact about that agency and not about its
 * address. Getting that wrong in the optimistic direction would put tax on
 * invoices that should not carry it.
 */
export function startingPointFor(country: string | null | undefined): StartingPoint {
  const code = country?.toUpperCase() ?? '';
  const european = EUROPE.has(code) || code === 'GB';
  const currency: CurrencyCode = european
    ? EURO_ZONE.has(code)
      ? 'EUR'
      : (LOCAL_CURRENCY[code] ?? 'EUR')
    : (LOCAL_CURRENCY[code] ?? MENA_CURRENCY);

  return {
    currency,
    services: european ? EUROPE_SERVICES : DEFAULT_SERVICES,
    vatRateBp: defaultVatRateFor(code),
    vatRegistered: false,
    taxTreatment: 'not_registered',
  };
}
