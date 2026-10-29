/* ─── THE WORDS OF THE MOMENTS BOOK ───────────────────────────────────
   Ayser, October 2026: one book of days on Space — the day's photo, the
   day's reflection and the tables you checked into, on one page.
   English and Arabic; other languages read English until they are
   written. On its own so only the book carries them. */

const W = {
  en: {
    kicker: 'THE MOMENTS BOOK',
    kicker2: 'The Moments Book',
    fromReflect: 'Your answer goes on today’s page, next to your photo.',
    title: 'Your days, kept',
    subMember: 'Every page — photos, reflections, check-ins — is kept for good.',
    subFree: '{n} of {max} pages kept. A kept page stays forever.',
    empty: 'Snap today’s prompt or answer today’s reflection, and your first page starts here.',
    chapter: '{m} Chapter',
    page1: '1 Page',
    pageN: '{n} Pages',
    checks1: '1 check-in',
    checksN: '{n} check-ins',
    recap: 'Share Monthly Recap',
    recapReady: 'Your {m} Chapter is ready',
    recapReadySub: 'Your best photos, your words and your tables, in one picture for your story.',
    recapSaved: 'Recap saved to your photos.',
    flip: 'Tap to open the page',
    back: 'Notes on this day',
    backBuddies: 'From your Table Buddies',
    noNotes: 'No notes yet. Notes from your Table Buddies show here.',
    buddy: 'Table Buddy',
    reflection: 'REFLECTION',
    moment: 'DAILY MOMENT',
    checkedIn: 'Checked in: {t}',
    keep: 'Keep this page',
    kept: 'Kept',
    pin: 'Pin to my Moments Book',
    full: 'All {max} free pages are kept. Let one go, or keep every page with Moments+.',
    live: 'Photo in the feed · {t}',
    grace: 'Photo leaves in {t}',
    photoGone: 'The photo left with the feed. Your words stay.',
    lock: 'Unlock Unlimited Moments Book with Moments+',
    lockPrice: 'Unlock Unlimited Moments Book with Moments+ ({p} {c}/mo)',
    lockSub: 'Keep your memories forever',
    unlockAll: 'Unlock all {n} saved memories with Moments+ ({p} {c}/mo)',
    subOpen: '{n} of your {t} pages are open. Every page is kept.',
    coverTitle: 'The Moments Book',
    coverSub: 'Tap to open your memories',
    highlight: 'Show on my profile',
    highlighted: 'On my profile',
    highlights: 'Highlights',
    close: 'Close',
    hours: '{n}h',
    minutes: '{n}m',
    err: 'That did not go through. Try again.',
    moods: ['Heavy', 'Okay', 'Good', 'Happy', 'Glowing'],
  },
  ar: {
    kicker: 'كتاب مومنتس',
    kicker2: 'كتاب مومنتس',
    fromReflect: 'إجابتك بتتكتب في صفحة النهارده، جنب صورتك.',
    title: 'أيامك، محفوظة',
    subMember: 'كل صفحة — صور وتأملات وتشيك إن — محفوظة على طول.',
    subFree: 'محفوظ {n} من {max} صفحات. الصفحة المحفوظة بتفضل على طول.',
    empty: 'صوّر صورة النهارده أو جاوب سؤال النهارده، وأول صفحة هتبدأ هنا.',
    chapter: 'فصل {m}',
    page1: 'صفحة واحدة',
    pageN: '{n} صفحات',
    checks1: 'تشيك إن واحد',
    checksN: '{n} تشيك إن',
    recap: 'شارك ملخص الشهر',
    recapReady: 'فصل {m} بتاعك جاهز',
    recapReadySub: 'أحلى صورك وكلامك والترابيزات اللي قعدت عليها، في صورة واحدة للستوري.',
    recapSaved: 'الملخص اتحفظ في صورك.',
    flip: 'دوس عشان تفتح الصفحة',
    back: 'كلام على اليوم ده',
    backBuddies: 'من أصحاب الترابيزة',
    noNotes: 'لسه مفيش كلام. كلام أصحاب الترابيزة بيظهر هنا.',
    buddy: 'صاحب ترابيزة',
    reflection: 'تأمل',
    moment: 'لحظة النهارده',
    checkedIn: 'تشيك إن: {t}',
    keep: 'احفظ الصفحة دي',
    kept: 'محفوظة',
    pin: 'ثبّتها في كتاب مومنتس',
    full: 'حفظت الـ{max} صفحات المجانية. سيب واحدة، أو احفظ كل الصفحات مع مومنتس+.',
    live: 'الصورة في الفيد · {t}',
    grace: 'الصورة هتمشي بعد {t}',
    photoGone: 'الصورة مشيت مع الفيد. كلامك فاضل.',
    lock: 'افتح كتاب مومنتس من غير حد مع مومنتس+',
    lockPrice: 'افتح كتاب مومنتس من غير حد مع مومنتس+ ({p} {c} في الشهر)',
    lockSub: 'احتفظ بذكرياتك على طول',
    unlockAll: 'افتح كل ذكرياتك الـ{n} المحفوظة مع مومنتس+ ({p} {c} في الشهر)',
    subOpen: '{n} من {t} صفحات مفتوحين. وكل الصفحات محفوظة.',
    coverTitle: 'كتاب مومنتس',
    coverSub: 'دوس عشان تفتح ذكرياتك',
    highlight: 'اعرضها على بروفايلي',
    highlighted: 'على بروفايلي',
    highlights: 'المختارات',
    close: 'اقفل',
    hours: '{n} ساعة',
    minutes: '{n} دقيقة',
    err: 'ماتمّتش. جرّب تاني.',
    moods: ['تقيل', 'عادي', 'كويس', 'مبسوط', 'منوّر'],
  },
};

const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const mw = (lang, k, vars) => {
  const row = W[lang === 'ar' ? 'ar' : 'en'];
  let s = row[k] != null ? row[k] : W.en[k];
  if (typeof s !== 'string') return s;
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
