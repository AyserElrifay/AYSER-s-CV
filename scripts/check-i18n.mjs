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

/* The twelve other languages left the bundle and became files in
   public/i18n — 424 KB that no longer reaches a phone to be unread.
   This check follows them there, because a safety net that stops
   watching the moment the thing it guards moves is worse than none:
   the whole reason the gap grew last time is that nothing was looking. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRINGS, LANGS } from '../src/constants/i18n.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, '..', 'public', 'i18n');

const en = Object.keys(STRINGS.en);
const codes = LANGS.map((l) => l.code);
const problems = [];

for (const code of codes) {
  let dict = STRINGS[code];
  if (!dict) {
    const file = path.join(DIR, code + '.json');
    if (!fs.existsSync(file)) {
      problems.push({ code, missing: en, extra: [], note: 'public/i18n/' + code + '.json is not there' });
      continue;
    }
    try {
      dict = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push({ code, missing: en, extra: [], note: 'public/i18n/' + code + '.json is not valid JSON' });
      continue;
    }
  }
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

/* ─── A WORD FROM THE WRONG LANGUAGE ──────────────────────────────
   Twice while filling these in I pasted one language's word into
   another's sentence: Russian into the middle of a Japanese line, and
   "música" into a different Japanese one. Both read as normal text to
   anybody who does not speak the language, and both would have shipped.

   Languages written in another script have no business containing Latin
   words, apart from names the app uses everywhere. */
const OTHER_SCRIPT = new Set(['ar', 'ru', 'zh', 'ko', 'ja']);
/* Names the app uses everywhere, plus words that really are borrowed
   into these languages as-is: Email in Russian, Vlog in Chinese, and
   the YYYY-MM-DD of a date format. */
const BRANDS = /^(Moments|Lamma|Bardi|Vibe|CC0|OK|SF|SOS|WhatsApp|Instagram|TikTok|Snapchat|YouTube|Uber|OpenStreetMap|Waffarha|Supabase|Safari|Ayser|reel|reels|Email|Vlog|YYYY|MM|DD)$/i;
const strays = [];
for (const code of codes) {
  if (!OTHER_SCRIPT.has(code)) continue;
  const dict = STRINGS[code] || {};
  for (const [k, v] of Object.entries(dict)) {
    if (typeof v !== 'string') continue;
    // {name}, {total}, {date} are placeholders the code fills in — they
    // are Latin on purpose and are not text anybody reads.
    const words = v.replace(/\{[^}]*\}/g, ' ').match(/[A-Za-z\u00C0-\u024F]{3,}/g) || [];
    const odd = words.filter((w) => !BRANDS.test(w));
    if (odd.length) strays.push(code + '.' + k + '  → ' + odd.join(', ') + '   in "' + v.slice(0, 40) + '…"');
  }
}

if (problems.length || suspicious.length || strays.length) {
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
  if (strays.length) {
    console.log('\nWords from another language, in ' + strays.length + ' place(s):');
    strays.slice(0, 20).forEach((x) => console.log('  ' + x));
  }
  if (suspicious.length) {
    console.log('\nStill word-for-word English in ' + suspicious.length + ' place(s):');
    suspicious.slice(0, 20).forEach((s) => console.log('  ' + s));
  }
  console.log('\nA key added to English is a key owed to every other language.');
  process.exit(1);
}

console.log('Checked ' + codes.length + ' languages: all ' + en.length + ' keys present in every one.');
