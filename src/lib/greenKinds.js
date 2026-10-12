/* ─── WHAT COUNTS AS GREEN MINDS ──────────────────────────────────────
   Ayser: "ده ملهوش علاقه بالتنمية المستدامة دي خروجات". Green Minds had
   become every plan in the week — football, opera, sketching. It is
   for looking after the places we share: clean-ups, planting, repair,
   recycling — and volunteering (a food bank, the Red Crescent, an
   orphanage afternoon, a school visit). A plan belongs here when its kind says so, or when its own
   title or description does (a "Morning walk & pick-up" is a clean-up
   that happens to walk).

       node scripts/check-green-kinds.mjs
*/
export const GREEN_KINDS = ['cleanup', 'project'];

const WORDS = /clean|litter|pick-?up|plant(ing)?\b|trees?\b|recycl|compost|gardening|plastic|repair|upcycl|volunteer|food bank|red crescent|red cross|resala|orphan|school visit|تطوع|بنك الطعام|أيتام|مدرسة|تنضيف|تنظيف|زبال|شجر|زرع|نبات|تدوير|بلاستيك/i;

export const isGreen = (g) => !!g && (
  GREEN_KINDS.indexOf(g.kind) >= 0
  || WORDS.test(String(g.title || ''))
  || WORDS.test(String(g.title_en || '') + ' ' + String(g.title_ar || '') + ' ' + String(g.about_en || ''))
  || WORDS.test(String(g.about || ''))
);
