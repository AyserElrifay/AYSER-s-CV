/* ─── THE PICKER MAY ONLY OFFER LANGUAGES THE QUESTIONS EXIST IN ─────
   لمّة now asks which language you want to PLAY in, separately from
   the language the app is in. Five chips: Arabic, English, French,
   Spanish, Romanian.

   The failure this exists to stop is quiet and specific. Somebody adds
   a sixth chip — Italian, say — because the app speaks Italian. The
   build is fine. The chip appears. Every question falls back to
   English, and the player finds out mid-countdown that the choice they
   made did nothing. Nothing throws; it just quietly is not true.

   So the check runs the app's OWN resolver — say() from
   src/components/lamma/languages.js, the same function the screen
   calls — over the questions as they are actually written in
   supabase/RUN_ME.sql, and asks: does every offered language produce
   text that is genuinely IN that language, for every question and
   every option? Falling back to English counts as failing, which is
   the whole point.

       node scripts/check-lamma-languages.mjs
*/

import { readFileSync } from 'fs';
import { PLAY_LANGS, say } from '../src/components/lamma/languages.js';

const PACK = 'eeee5555-0000-4000-8000-000000000001';
const sql = readFileSync('supabase/RUN_ME.sql', 'utf8');

const unquote = (s) => s.replace(/''/g, "'");

/* The pack as it is first written: Arabic and English, in columns. */
const rows = new Map();
const insert = new RegExp(
  "\\('" + PACK + "',(\\d+),'((?:[^']|'')*)','((?:[^']|'')*)',\\d+,\\s*'(\\[[\\s\\S]*?\\])',\\d+,'\\w+'\\)", 'g');
let m;
while ((m = insert.exec(sql))) {
  rows.set(Number(m[1]), {
    text_ar: unquote(m[2]),
    text_en: unquote(m[3]),
    options: JSON.parse(unquote(m[4])),
  });
}

/* …and then the languages that came later, in jsonb. */
const update = new RegExp(
  "update public\\.questions set\\s+text_i18n = '((?:[^']|'')*)'::jsonb,\\s+options\\s*= '((?:[^']|'')*)'::jsonb\\s+where pack_id = '"
  + PACK + "' and order_index = (\\d+);", 'g');
while ((m = update.exec(sql))) {
  const row = rows.get(Number(m[3]));
  if (!row) continue;
  row.text_i18n = JSON.parse(unquote(m[1]));
  row.options = JSON.parse(unquote(m[2]));
}

if (rows.size === 0) {
  console.log('No questions found for the Egypt pack — has the pack id changed?');
  process.exit(1);
}

/* A language is offered only if the text was WRITTEN for it. What is
   asked is where the words came from, not what they look like: "Marco
   Polo" is Marco Polo in five languages, and the Romanian for Cairo is
   Cairo. Comparing the strings would flag every proper noun in the
   pack and teach whoever hits it to ignore this check. Comparing the
   SOURCE cannot be fooled either way. */
const written = (row, code) => {
  if (code === 'ar') return row.text_ar;
  if (code === 'en') return row.text_en;
  const i18n = row.text_i18n;
  return (i18n && typeof i18n === 'object' ? i18n[code] : null) || row['text_' + code];
};

const problems = [];
for (const l of PLAY_LANGS) {
  for (const [order, row] of rows) {
    const parts = [{ what: 'question', row }].concat(
      row.options.map((o, i) => ({ what: 'option ' + i, row: o })));
    for (const p of parts) {
      const mine = written(p.row, l.code);
      if (!mine) {
        problems.push(l.code + ' q' + order + ' ' + p.what + ': never written — the screen would show English');
      } else if (say(p.row, l.code) !== mine) {
        // the resolver and the data disagree, which is worse than either
        problems.push(l.code + ' q' + order + ' ' + p.what + ': written "' + mine
          + '" but the app would show "' + say(p.row, l.code) + '"');
      }
    }
  }
}

if (problems.length) {
  console.log('The language picker offers ' + PLAY_LANGS.length
    + ' languages the pack does not fully have (' + problems.length + ' place(s)):\n');
  problems.slice(0, 15).forEach((p) => console.log('  ' + p));
  if (problems.length > 15) console.log('  … and ' + (problems.length - 15) + ' more');
  console.log('\nEither write the questions in that language, or stop offering it.');
  process.exit(1);
}

const opts = [...rows.values()].reduce((n, r) => n + r.options.length, 0);
console.log('Checked ' + rows.size + ' questions and ' + opts + ' options: all '
  + PLAY_LANGS.length + ' offered languages (' + PLAY_LANGS.map((l) => l.code).join(', ')
  + ') are really written, none falling back.');
