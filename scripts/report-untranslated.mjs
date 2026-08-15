/* ─── WHAT IS STILL ONLY IN ENGLISH ──────────────────────────────────
   Walking the app in Arabic finds what a person can reach by tapping;
   it never opens the sheets, the modals or the screens behind a state
   you cannot get into from a fresh account. This reads every file
   instead: JSX text and the props that become visible text.

   It REPORTS, it does not fail. Six hundred strings is a job to work
   through a screen at a time, and a check that fails the build on day
   one gets switched off on day two. When the number reaches zero this
   can become a gate; until then it is a map.

       node scripts/report-untranslated.mjs                  # the tally
       node scripts/report-untranslated.mjs src/screens/MapScreen.js
                                                             # one file

   Two things it lists on purpose that are NOT jobs:
     · AdminPanel — the Studio, which only Ayser opens
     · TermsSheet — legal text, which is not something to translate
       casually
*/
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default || _traverse;

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (p.endsWith('.js')) files.push(p);
  }
})('src');

const VISIBLE_PROPS = new Set(['label', 'placeholder', 'title', 'kicker', 'text', 'caption', 'subtitle']);
const looksLikeProse = (s) => {
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/^[A-Z_]+$/.test(t)) return false;                 // CONSTANT
  if (/^[a-z-]+$/.test(t) && t.length < 12) return false; // an icon name / key
  if (/^(https?:|#|\/|data:)/.test(t)) return false;
  return /[A-Za-z]{3}/.test(t);
};

const byFile = new Map();
const push = (f, line, kind, text) => {
  const a = byFile.get(f) || [];
  a.push({ line, kind, text: text.trim().replace(/\s+/g, ' ').slice(0, 74) });
  byFile.set(f, a);
};

for (const f of files) {
  let ast;
  try {
    ast = parse(readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) { continue; }
  traverse(ast, {
    JSXText(p) {
      if (!looksLikeProse(p.node.value)) return;
      push(f, p.node.loc.start.line, 'text', p.node.value);
    },
    JSXAttribute(p) {
      const n = p.node.name && p.node.name.name;
      if (!VISIBLE_PROPS.has(n)) return;
      const v = p.node.value;
      if (!v || v.type !== 'StringLiteral') return;
      if (!looksLikeProse(v.value)) return;
      push(f, v.loc.start.line, n, v.value);
    },
  });
}

const rows = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
let total = 0;
for (const [f, list] of rows) {
  total += list.length;
  console.log(String(list.length).padStart(4) + '  ' + f);
}
console.log('\nTOTAL English strings drawn straight into JSX: ' + total + ' across ' + rows.length + ' files');
if (process.argv[2]) {
  const want = process.argv[2];
  console.log('\n── ' + want + ' ──');
  (byFile.get(want) || []).forEach((r) => console.log('  ' + r.line + ' [' + r.kind + '] ' + r.text));
}
