/* ─── WHAT COUNTS AS GREEN MINDS ──────────────────────────────────────
   Ayser: "ده ملهوش علاقه بالتنمية المستدامة دي خروجات". Green Minds had
   become every plan in the week — football, opera, sketching. It is
   for looking after the places we share: clean-ups, planting, repair,
   recycling — and volunteering (a food bank, the Red Crescent, an
   orphanage afternoon, a school visit, an animal shelter). A plan belongs here when its kind says so, or when its own
   title or description does (a "Morning walk & pick-up" is a clean-up
   that happens to walk).

       node scripts/check-green-kinds.mjs
*/
import { activityOf } from './activityMatch.js';

export const GREEN_KINDS = ['cleanup', 'project'];

const WORDS = /clean|litter|pick-?up|plant(ing)?\b|trees?\b|recycl|compost|gardening|plastic|repair|upcycl|volunteer|charity|donat|blood drive|help(ing)? (people|out|others)|food bank|red crescent|red cross|resala|orphan|school visit|schools?\b|awareness|مدارس|توعي|نشر ثقافة|نشر الثقافة|animal|shelter|rescue|strays?\b|حيوان|قطط|كلاب|ملجأ|ملجا|تطوع|تبرع|خيري|خيرية|مساعدة الناس|نساعد|بنك الطعام|أيتام|مدرسة|تنضيف|تنظيف|نضافة|نظافة|زبال|شجر|زرع|نبات|تدوير|بلاستيك/i;

/* The kind alone isn't trusted: plans started without picking one used
   to be saved as a clean-up, so "Football in the park" came out green.
   A green kind counts unless the plan's own words say it is something
   else entirely. */
const GOOD = ['animals', 'cleanup', 'school', 'kids', 'volunteer'];
const isOther = (s) => { const a = activityOf(s); return !!a && GOOD.indexOf(a.id) < 0; };
const text = (g) => [g.title, g.title_en, g.title_ar, g.about, g.about_en].map((x) => String(x || '')).join(' ');

export const isGreen = (g) => !!g && (
  (GREEN_KINDS.indexOf(g.kind) >= 0 && !isOther(text(g)))
  || WORDS.test(String(g.title || ''))
  || WORDS.test(String(g.title_en || '') + ' ' + String(g.title_ar || '') + ' ' + String(g.about_en || ''))
  || WORDS.test(String(g.about || ''))
);
