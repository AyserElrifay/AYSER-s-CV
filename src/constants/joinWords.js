/* ─── CLAIM A SEAT, THEN THE PLACE ────────────────────────────────────
   Ayser, October 2026: every plan card reads the same three steps —
   seats left, claim one, and the exact place 12 hours before. English
   and Arabic; the rest read English until written. */
const W = {
  en: {
    seats: '{n} / {m} Seats Claimed • {l} Spots Left', going: '{n} going', full: 'Table full',
    lock: 'Exact venue & pin unlock 12h before start',
    claim: 'Claim Seat', impact: 'Join Impact Drop', reserved: '✓ Seat Reserved • Open Table Chat', hosting: 'You are hosting', seatsLeft: '{n} Seats Left', seatLeft: '1 Seat Left', tableFull: 'Table full',
    maps: 'View on Moments Map', arrive: 'Ask for the Moments Table & scan the table QR code when you arrive.',
    lensDrops: 'Drops to Join', lensPartners: 'Partner Places',
  },
  ar: {
    seats: '{n} / {m} كراسي اتحجزت • فاضل {l}', going: '{n} رايحين', full: 'الترابيزة كملت',
    lock: 'المكان بالظبط بيظهر قبلها بـ ١٢ ساعة',
    claim: 'احجز كرسي', impact: 'انضم ليوم التطوّع', reserved: '✓ كرسيك محجوز • افتح شات الترابيزة', hosting: 'إنت المنظّم', seatsLeft: 'فاضل {n} كراسي', seatLeft: 'فاضل كرسي واحد', tableFull: 'الترابيزة كملت',
    maps: 'شوفه على خريطة مومنتس', arrive: 'اسأل على ترابيزة مومنتس وامسح كود الـ QR أول ما توصل.',
    lensDrops: 'خروجات تنضم لها', lensPartners: 'أماكن شركائنا',
  },
};
export const jw = (lang, k, vars) => {
  let s = (W[lang === 'ar' ? 'ar' : 'en'][k]) || W.en[k] || '';
  Object.keys(vars || {}).forEach((v) => { s = s.split('{' + v + '}').join(String(vars[v])); });
  return s;
};
/* "3 Seats Left" — what a plan shows instead of "You're hosting" */
export const seatsLeftOf = (lang, g) => {
  const cap = Number(g && g.capacity) || 0;
  if (!cap) return null;
  const left = Math.max(0, cap - (Number(g.going) || 0));
  return left === 0 ? jw(lang, 'tableFull') : left === 1 ? jw(lang, 'seatLeft') : jw(lang, 'seatsLeft', { n: left });
};

export const mapsLink = (g) => (g && g.lat != null && g.lng != null
  ? 'https://www.google.com/maps/search/?api=1&query=' + g.lat + ',' + g.lng
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((g && (g.place_name || g.city)) || ''));

/* Ayser, November 2026 — the honest seat line, the same everywhere: a table
   is ten seats unless the team set another number; until it is half full it
   says what it is, then how many are left. Never "1 / 20", never "1 going". */
export const TABLE_SEATS = 10;
/* Ayser, November 2026: "never display exact low booking numbers". Three
   states only, every one of them true: under half full it says what the
   table is (a curated table, at most N seats); from half full the seats
   that are really left; full is full. */
export const seatState = (g) => {
  const cap = Number(g && g.capacity) || TABLE_SEATS;
  const n = Math.min(cap, Number(g && g.going) || 0);
  const left = cap - n;
  return { cap, left, level: left <= 0 ? 'full' : n / cap >= 0.5 ? 'fast' : 'curated' };
};
export const seatPillText = (lang, g, waitlist) => {
  const { cap, left, level } = seatState(g);
  const ar = lang === 'ar';
  if (level === 'full') return ar ? 'كمل العدد' + (waitlist ? ' • ادخل قايمة الانتظار' : '') : 'Sold out' + (waitlist ? ' • Join waitlist' : '');
  if (level === 'fast') return ar ? 'بيتملى بسرعة • فاضل ' + left + (left === 1 ? ' كرسي بس' : ' كراسي بس') : 'Filling fast • Only ' + left + (left === 1 ? ' seat' : ' seats') + ' left';
  return ar ? 'ترابيزة منتقاة (' + cap + ' كراسي بالكتير)' : 'Curated table (max ' + cap + ' seats)';
};
export const seatLine = (lang, g) => {
  const cap = Number(g && g.capacity) || TABLE_SEATS;
  const n = Math.min(cap, Number(g && g.going) || 0);
  const left = cap - n;
  if (left <= 0) return jw(lang, 'tableFull');
  if (n / cap >= 0.5) return lang === 'ar' ? 'باقي ' + left + (left === 1 ? ' كرسي بس' : ' كراسي بس') : 'Only ' + left + (left === 1 ? ' spot' : ' spots') + ' left';
  return lang === 'ar' ? '✦ ترابيزة منتقاة · ' + cap + ' كراسي بالكتير' : '✦ Curated table · max ' + cap + ' seats';
};
