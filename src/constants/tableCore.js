/* ─── A TABLE'S FLAG AND THE FEW WORDS ITS CARD NEEDS ─────────────────
   Kept tiny: the Drop cards and the Table Chats list are on screens that
   load first. Everything else a table says lives in tableWords.js, which
   only the event page loads. */

/* the four Moments Flags: the colour on the table, and the ink on it */
export const FLAGS = {
  tables: { bg: '#6C3CE9', ink: '#FAF9F6', name: 'TABLE DROP', en: 'Violet', ar: 'البنفسجي' },
  culture: { bg: '#DCD3FF', ink: '#1B1640', name: 'CULTURE CIRCLE', en: 'Lavender', ar: 'اللافندر' },
  roam: { bg: '#CBE8D6', ink: '#1F3D2B', name: 'ROAM CREW', en: 'Mint', ar: 'النعناعي' },
  impact: { bg: '#CDE8FF', ink: '#13294B', name: 'IMPACT TRIBE', en: 'Sky Blue', ar: 'السماوي' },
};
export const flagOf = (cat) => FLAGS[cat] || FLAGS.tables;
export const tableNo = (n) => String(Math.max(1, Number(n) || 1)).padStart(2, '0');

export const CORE = {
  en: {
    queued: 'Unlocks automatically once the current Drop reaches 80% capacity',
    interest: 'Tap to pre-register interest',
    interested: 'You are on the list — we tell you the moment it opens',
    lastSeats: 'Last {n} Seats!',
    lastSeat: 'Last Seat!',
    tableN: 'Table #{n}',
    nowTable: 'Table #{n} is open — same place, same time',
    look: 'Look for the {c} Flag #{n}',
    chats: 'Table Chats',
    opensIn: 'Opens in {t}',
    open: 'Open now',
    host: 'You host',
    h: '{n}h', m: '{n}m',
  },
  ar: {
    queued: 'بتتفتح لوحدها أول ما الـ Drop اللي قبلها توصل ٨٠٪',
    interest: 'دوس عشان تسجّل اهتمامك',
    interested: 'إنت على القايمة — هنقولك أول ما تتفتح',
    lastSeats: 'آخر {n} كراسي!',
    lastSeat: 'آخر كرسي!',
    tableN: 'ترابيزة رقم {n}',
    nowTable: 'ترابيزة رقم {n} اتفتحت — نفس المكان ونفس المعاد',
    look: 'دوّر على العلم {c} رقم {n}',
    chats: 'شات الترابيزات',
    opensIn: 'بيتفتح بعد {t}',
    open: 'مفتوح دلوقتي',
    host: 'إنت المنظّم',
    h: '{n} ساعة', m: '{n} دقيقة',
  },
};

const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const fill = (lang, s, vars) => {
  Object.keys(vars || {}).forEach((v) => { s = s.replace('{' + v + '}', lang === 'ar' ? AR(vars[v]) : String(vars[v])); });
  return s;
};
export const tcw = (lang, k, vars) => {
  const row = CORE[lang === 'ar' ? 'ar' : 'en'];
  return fill(lang, row[k] != null ? row[k] : CORE.en[k], vars);
};
/* "3h 12m" until a time */
export const countdown = (lang, at, now = Date.now()) => {
  const ms = Math.max(0, new Date(at).getTime() - now);
  const h = Math.floor(ms / 3600000), m = Math.ceil((ms % 3600000) / 60000);
  if (h <= 0) return tcw(lang, 'm', { n: Math.max(1, m) });
  return tcw(lang, 'h', { n: h }) + ' ' + tcw(lang, 'm', { n: m === 60 ? 59 : m });
};
/* "Look for the Violet Flag #01" */
export const lookFor = (lang, cat, n) => {
  const f = flagOf(cat);
  return tcw(lang, 'look', { c: lang === 'ar' ? f.ar : f.en, n: tableNo(n) });
};
