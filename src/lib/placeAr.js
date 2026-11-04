/* ─── PLACE NAMES IN THE READER'S LANGUAGE ───────────────────────────
   Ayser: "كل حاجة مضبوطة في العربي". Cities and areas Moments runs in, in
   Arabic; a country's name comes from its flag (Intl.DisplayNames), so no
   list of countries to keep. Anything unknown is shown as it was written. */
const AR = {
  cairo: 'القاهرة', giza: 'الجيزة', alexandria: 'الإسكندرية', 'new cairo': 'القاهرة الجديدة', zamalek: 'الزمالك', maadi: 'المعادي',
  downtown: 'وسط البلد', 'downtown cairo': 'وسط البلد', heliopolis: 'مصر الجديدة', 'nasr city': 'مدينة نصر', dokki: 'الدقي', mohandessin: 'المهندسين',
  'garden city': 'جاردن سيتي', 'sheikh zayed': 'الشيخ زايد', '6th of october': '٦ أكتوبر', tagamoa: 'التجمع', 'fifth settlement': 'التجمع الخامس',
  rehab: 'الرحاب', agouza: 'العجوزة', manial: 'المنيل', 'east cairo': 'شرق القاهرة', 'west cairo': 'غرب القاهرة',
  dahab: 'دهب', siwa: 'سيوة', 'marsa alam': 'مرسى علم', hurghada: 'الغردقة', 'sharm el sheikh': 'شرم الشيخ', fayoum: 'الفيوم',
  'wadi el rayan': 'وادي الريان', luxor: 'الأقصر', aswan: 'أسوان', 'soma bay': 'سوما باي', 'el gouna': 'الجونة', 'ain sokhna': 'العين السخنة',
  'north coast': 'الساحل الشمالي', 'saint catherine': 'سانت كاترين', nuweiba: 'نويبع', bahariya: 'الواحات البحرية', 'white desert': 'الصحراء البيضاء',
  'western desert': 'الصحراء الغربية', 'red sea': 'البحر الأحمر', sinai: 'سيناء',
  tallinn: 'تالين', budapest: 'بودابست', berlin: 'برلين', 'timișoara': 'تيميشوارا', timisoara: 'تيميشوارا', dubai: 'دبي', paris: 'باريس',
  rome: 'روما', madrid: 'مدريد', barcelona: 'برشلونة', lisbon: 'لشبونة', istanbul: 'إسطنبول', marrakech: 'مراكش', london: 'لندن',
};
export function placeAr(name, lang) {
  if (lang !== 'ar' || !name) return name;
  return AR[String(name).trim().toLowerCase()] || name;
}
/* "🇪🇬" → "مصر" (or the English name in English) */
export function countryOfFlag(flag, lang, fallback) {
  try {
    const cps = [...String(flag || '')].map((c) => c.codePointAt(0) - 0x1F1E6);
    if (cps.length !== 2 || cps.some((n) => n < 0 || n > 25)) return fallback || '';
    const cc = String.fromCharCode(65 + cps[0], 65 + cps[1]);
    return new Intl.DisplayNames([lang || 'en'], { type: 'region' }).of(cc) || fallback || cc;
  } catch (e) { return fallback || ''; }
}
