import { useEffect, useState } from 'react';

/* ─── THE CHALLENGES IN EVERY LANGUAGE ────────────────────────────────
   The day's and the week's challenges are written in English and Arabic
   in challenges.js. The other fifteen languages live in
   public/i18n/challenges/<lang>.json — the English line and its
   translation — fetched only by somebody reading in that language, so
   the app's own download carries none of them. Until one arrives (or
   if it never does) the English line shows. */

const dict = {};
const asked = {};

const urlFor = (lang) => {
  let base = '/';
  try { if (typeof document !== 'undefined' && document.baseURI) base = document.baseURI; } catch (e) { /* root */ }
  return String(base).replace(/[^/]*$/, '') + 'i18n/challenges/' + lang + '.json';
};

/* the line in this language: Arabic from the pair, the rest from the file */
export const sayCh = (lang, o) => {
  if (!o) return '';
  if (lang === 'ar') return o.ar || o.en;
  return (dict[lang] && dict[lang][o.en]) || o.en;
};

/* fetch this language's file once; re-render when it lands */
export function useChallengeWords(lang) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!lang || lang === 'en' || lang === 'ar' || dict[lang]) return undefined;
    let alive = true;
    if (!asked[lang]) {
      asked[lang] = fetch(urlFor(lang)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) dict[lang] = j; }).catch(() => {});
    }
    asked[lang].then(() => { if (alive) bump((n) => n + 1); });
    return () => { alive = false; };
  }, [lang]);
}
