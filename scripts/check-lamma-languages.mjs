/* ─── THE PICKER MAY ONLY OFFER LANGUAGES THE QUESTIONS EXIST IN ─────
   لمّة asks which language you want to PLAY in, separately from the
   language the app is in. Five chips: Arabic, English, French, Spanish,
   Romanian.

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

   It checks EVERY pack that claims the five languages, not one known
   by heart. A check that knows one pack id passes forever while the
   second pack goes unread, which is the same silence it exists to
   break.

       node scripts/check-lamma-languages.mjs
*/

import { readFileSync } from 'fs';
import { PLAY_LANGS, say } from '../src/components/lamma/languages.js';

const sql = readFileSync('supabase/RUN_ME.sql', 'utf8');
const unquote = (s) => s.replace(/''/g, "'");

/* ── WHICH PACKS ARE CLAIMING WHAT ──────────────────────────────────
   The shelf shows a flag per language a pack says it is written in.
   That claim lives in one statement, and every pack makes it the same
   way, on purpose — a second spelling is a second thing to keep in
   step. */
const claims = [...sql.matchAll(
  /set languages = array\[([^\]]*)\]\s*where id = '([0-9a-f-]{36})'/g)];

if (claims.length === 0) {
  console.log('No pack says which languages it is written in — the shelf would show no flags.');
  process.exit(1);
}

const offered = [...new Set(PLAY_LANGS.map((l) => l.code))].sort();
const problems = [];
let questions = 0;
let options = 0;

for (const c of claims) {
  const PACK = c[2];
  const claimed = c[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean).sort();

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

  /* …and then the languages that came later, in jsonb. Anything may sit
     between the options and the WHERE — the newer questions carry their
     teaching note in the same statement — so the middle is skipped
     rather than assumed away. Insisting on the exact old shape is how
     ten new questions came back as "never written in French" when every
     one of them was.

     But the middle may not leave the STATEMENT it started in. Skipping
     with a plain lazy [\s\S]*? let one pack's translations be read off
     and stamped onto another pack's question numbers, because the
     nearest matching WHERE was thousands of lines away in a different
     pack — and the check went on saying all five languages were
     written while a French line that had been deleted was reported as
     present. So the middle is anything that is not a bare semicolon,
     quoted text (which may contain semicolons, and does) excepted. One
     statement, its own WHERE, nobody else's. */
  const update = new RegExp(
    "update public\\.questions set\\s+text_i18n = '((?:[^']|'')*)'::jsonb,\\s+options\\s*= '((?:[^']|'')*)'::jsonb"
    + "(?:[^;']|'(?:[^']|'')*')*?where pack_id = '"
    + PACK + "' and order_index = (\\d+);", 'g');
  while ((m = update.exec(sql))) {
    const row = rows.get(Number(m[3]));
    if (!row) continue;
    row.text_i18n = JSON.parse(unquote(m[1]));
    row.options = JSON.parse(unquote(m[2]));
  }

  if (rows.size === 0) {
    problems.push(PACK + ': claims ' + claimed.length
      + ' languages but has no questions the check can read — has the pack id changed?');
    continue;
  }

  if (claimed.join() !== offered.join()) {
    problems.push(PACK + ': the shelf claims [' + claimed.join(', ')
      + '] but the picker offers [' + offered.join(', ') + ']');
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

  for (const l of PLAY_LANGS) {
    for (const [order, row] of rows) {
      const parts = [{ what: 'question', row }].concat(
        row.options.map((o, i) => ({ what: 'option ' + i, row: o })));
      for (const p of parts) {
        const mine = written(p.row, l.code);
        if (!mine) {
          problems.push(PACK.slice(0, 4) + '… ' + l.code + ' q' + order + ' ' + p.what
            + ': never written — the screen would show English');
        } else if (say(p.row, l.code) !== mine) {
          // the resolver and the data disagree, which is worse than either
          problems.push(PACK.slice(0, 4) + '… ' + l.code + ' q' + order + ' ' + p.what
            + ': written "' + mine + '" but the app would show "' + say(p.row, l.code) + '"');
        }
      }
    }
  }

  questions += rows.size;
  options += [...rows.values()].reduce((n, r) => n + r.options.length, 0);
}

if (problems.length) {
  console.log('The language picker offers ' + PLAY_LANGS.length
    + ' languages a pack does not fully have (' + problems.length + ' place(s)):\n');
  problems.slice(0, 15).forEach((p) => console.log('  ' + p));
  if (problems.length > 15) console.log('  … and ' + (problems.length - 15) + ' more');
  console.log('\nEither write the questions in that language, or stop offering it.');
  process.exit(1);
}

console.log('Checked ' + claims.length + ' pack(s), ' + questions + ' questions and '
  + options + ' options: all ' + PLAY_LANGS.length + ' offered languages ('
  + PLAY_LANGS.map((l) => l.code).join(', ') + ') are really written, none falling back.');
