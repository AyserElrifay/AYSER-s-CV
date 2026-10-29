/* ─── THE WORDS OF THE MEMORY BOOK ────────────────────────────────────
   Ayser, October 2026: what a moment becomes after its 48 hours in the
   feed. English and Arabic; other languages read English until they
   are written. On its own so only the book carries them. */

const W = {
  en: {
    kicker: 'THE MEMORY BOOK',
    title: 'Your moments, kept',
    subMember: 'Every moment you share is saved here for good.',
    subFree: '{n} of {max} pins used. Pinned moments stay forever.',
    empty: 'Share today’s photo prompt and your first page starts here.',
    chapter: '{m} Chapter',
    count1: '1 Moment',
    countN: '{n} Moments',
    recap: 'Share Monthly Recap',
    recapMaking: 'Making your recap…',
    recapSaved: 'Recap saved to your photos.',
    flip: 'Tap to flip',
    back: 'Notes on this moment',
    backBuddies: 'From your Table Buddies',
    noNotes: 'No notes yet. Notes from your Table Buddies show here.',
    buddy: 'Table Buddy',
    pin: 'Pin to my Memory Book',
    pinShort: 'Pin',
    unpin: 'Unpin',
    pinned: 'Pinned',
    full: 'All {max} free pins are used. Unpin one, or keep everything with Moments+.',
    live: 'In the feed · {t}',
    grace: 'Leaves your book in {t}',
    lock: 'Unlock Unlimited Memory Book with Moments+',
    lockSub: 'Keep your memories forever',
    highlight: 'Show on my profile',
    highlighted: 'On my profile',
    highlights: 'Highlights',
    hours: '{n}h',
    minutes: '{n}m',
    err: 'That did not go through. Try again.',
  },
  ar: {
    kicker: 'كتاب الذكريات',
    title: 'لحظاتك، محفوظة',
    subMember: 'كل لحظة بتشاركها بتتحفظ هنا على طول.',
    subFree: 'استخدمت {n} من {max} تثبيتات. اللحظة المثبّتة بتفضل على طول.',
    empty: 'شارك صورة النهارده، وأول صفحة في كتابك هتبدأ هنا.',
    chapter: 'فصل {m}',
    count1: 'لحظة واحدة',
    countN: '{n} لحظات',
    recap: 'شارك ملخص الشهر',
    recapMaking: 'بنجهّز الملخص…',
    recapSaved: 'الملخص اتحفظ في صورك.',
    flip: 'دوس عشان تقلبها',
    back: 'كلام على اللحظة دي',
    backBuddies: 'من أصحاب الترابيزة',
    noNotes: 'لسه مفيش كلام. كلام أصحاب الترابيزة بيظهر هنا.',
    buddy: 'صاحب ترابيزة',
    pin: 'ثبّتها في كتاب ذكرياتي',
    pinShort: 'ثبّت',
    unpin: 'شيل التثبيت',
    pinned: 'متثبّتة',
    full: 'استخدمت الـ{max} تثبيتات المجانية. شيل واحدة، أو احتفظ بكل حاجة مع مومنتس+.',
    live: 'في الفيد · {t}',
    grace: 'هتمشي من كتابك بعد {t}',
    lock: 'افتح كتاب ذكريات من غير حد مع مومنتس+',
    lockSub: 'احتفظ بذكرياتك على طول',
    highlight: 'اعرضها على بروفايلي',
    highlighted: 'على بروفايلي',
    highlights: 'المختارات',
    hours: '{n} ساعة',
    minutes: '{n} دقيقة',
    err: 'ماتمّتش. جرّب تاني.',
  },
};

const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const mw = (lang, k, vars) => {
  const row = W[lang === 'ar' ? 'ar' : 'en'];
  let s = row[k] != null ? row[k] : W.en[k];
  Object.keys(vars || {}).forEach((v) => { s = s.replace('{' + v + '}', lang === 'ar' ? AR(vars[v]) : String(vars[v])); });
  return s;
};
/* "31h" / "40m" until a time, or null once it has passed */
export const until = (lang, at, now = Date.now()) => {
  const ms = new Date(at).getTime() - now;
  if (!(ms > 0)) return null;
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? mw(lang, 'hours', { n: h }) : mw(lang, 'minutes', { n: Math.max(1, Math.ceil(ms / 60000)) });
};
