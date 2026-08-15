/* ─── EVERY LANGUAGE SAYS EVERYTHING ─────────────────────────────────
   src/constants/i18n.js opens by promising that every supported
   language has real, hand-written translations for the same set of
   keys, and that no language quietly falls back to English.

   It was not true. Thirty-one keys existed only in English and Arabic —
   the whole of لمّة among them — so somebody playing in French tapped
   "Let's go" and read "Waiting for everyone…" in the middle of a French
   app. Nothing was broken enough to notice: the fallback did its job
   and hid the gap, which is exactly why the gap grew.

   A key added to English is a key owed to twelve other languages. This
   is the bill.

       node scripts/check-i18n.mjs
*/

import { STRINGS, LANGS } from '../src/constants/i18n.js';

const en = Object.keys(STRINGS.en);
const codes = LANGS.map((l) => l.code);
const problems = [];

for (const code of codes) {
  const dict = STRINGS[code];
  if (!dict) { problems.push({ code, missing: en, extra: [] }); continue; }
  const missing = en.filter((k) => !(k in dict));
  const extra = Object.keys(dict).filter((k) => !(k in STRINGS.en));
  if (missing.length || extra.length) problems.push({ code, missing, extra });
}

/* A translation that is character-for-character the English is almost
   always a key somebody pasted and meant to come back to. But short
   labels, brand names and mostly-placeholder strings genuinely do match
   across languages — "total {total} ÷ {n}" is the same in four of
   them — so what counts is real WORDS, not characters. Four or more,
   and an identical string is not a coincidence. */
const SHARED_OK = /^(Moments|Lamma|Bardi|Vibe|OK|Reels|Stack|Horror|Drama|Animation|Romance|SF)$/;
const suspicious = [];
for (const code of codes) {
  if (code === 'en') continue;
  const dict = STRINGS[code] || {};
  for (const k of en) {
    const a = STRINGS.en[k];
    const b = dict[k];
    if (typeof a !== 'string' || typeof b !== 'string') continue;
    if (a !== b) continue;
    if (SHARED_OK.test(a)) continue;
    const words = a.replace(/\{[^}]*\}/g, ' ').match(/[A-Za-z][A-Za-z'’-]{1,}/g) || [];
    if (words.length < 4) continue;
    suspicious.push(code + '.' + k + '  "' + a.slice(0, 46) + '…"');
  }
}

if (problems.length || suspicious.length) {
  for (const p of problems) {
    if (p.missing.length) {
      console.log('\n' + p.code + ' is missing ' + p.missing.length + ' key(s):');
      console.log('  ' + p.missing.slice(0, 12).join(', ') + (p.missing.length > 12 ? ', …' : ''));
    }
    if (p.extra.length) {
      console.log('\n' + p.code + ' has ' + p.extra.length + ' key(s) English does not:');
      console.log('  ' + p.extra.slice(0, 12).join(', ') + (p.extra.length > 12 ? ', …' : ''));
    }
  }
  if (suspicious.length) {
    console.log('\nStill word-for-word English in ' + suspicious.length + ' place(s):');
    suspicious.slice(0, 20).forEach((s) => console.log('  ' + s));
  }
  console.log('\nA key added to English is a key owed to every other language.');
  process.exit(1);
}

console.log('Checked ' + codes.length + ' languages: all ' + en.length + ' keys present in every one.');
