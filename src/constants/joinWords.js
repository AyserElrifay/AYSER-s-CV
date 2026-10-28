/* ─── CLAIM A SEAT, THEN THE PLACE ────────────────────────────────────
   Ayser, October 2026: every plan card reads the same three steps —
   seats left, claim one, and the exact place 12 hours before. English
   and Arabic; the rest read English until written. */
const W = {
  en: {
    seats: '{n} / {m} Seats Claimed • {l} Spots Left', going: '{n} going', full: 'Table full',
    lock: 'Exact venue & Google Maps pin unlock 12h before start',
    claim: 'Claim Seat', impact: 'Join Impact Drop', reserved: '✓ Seat Reserved • Open Table Chat', hosting: 'You are hosting',
    maps: 'Open in Google Maps', arrive: 'Ask for the Moments Table & scan the table QR code when you arrive.',
    lensDrops: 'Drops to Join', lensPartners: 'Partner Places',
  },
  ar: {
    seats: '{n} / {m} كراسي اتحجزت • فاضل {l}', going: '{n} رايحين', full: 'الترابيزة كملت',
    lock: 'المكان بالظبط ودبوس جوجل ماب بيظهروا قبلها بـ ١٢ ساعة',
    claim: 'احجز كرسي', impact: 'انضم ليوم التطوّع', reserved: '✓ كرسيك محجوز • افتح شات الترابيزة', hosting: 'إنت المنظّم',
    maps: 'افتح في جوجل ماب', arrive: 'اسأل على ترابيزة مومنتس وامسح كود الـ QR أول ما توصل.',
    lensDrops: 'خروجات تنضم لها', lensPartners: 'أماكن شركائنا',
  },
};
export const jw = (lang, k, vars) => {
  let s = (W[lang === 'ar' ? 'ar' : 'en'][k]) || W.en[k] || '';
  Object.keys(vars || {}).forEach((v) => { s = s.split('{' + v + '}').join(String(vars[v])); });
  return s;
};
export const mapsLink = (g) => (g && g.lat != null && g.lng != null
  ? 'https://www.google.com/maps/search/?api=1&query=' + g.lat + ',' + g.lng
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((g && (g.place_name || g.city)) || ''));
