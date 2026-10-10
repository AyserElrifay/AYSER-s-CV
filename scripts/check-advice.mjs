/* ─── BARDI ADVISES; A PERSON DECIDES ─────────────────────────────────
   Bardi reads each Studio item and recommends. It must never be able to
   decide, never compare faces, only answer people whose role reviews
   that kind of item, and its notes on a guide's documents must go when
   the documents go.

       node scripts/check-advice.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const fn = read('supabase/functions/studio-advice/index.ts');
const code = fn.replace(/\/\/[^\n]*/g, '');
const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.indexOf('STUDIO · BARDI ADVISES EVERY DECISION'));
const admin = read('src/components/AdminPanel.js');

is('it cannot decide anything: no decision function is ever called', /host_decide|venue_decide|safety_decide|approve_verification|setReportStatus|\.update\(|\.delete\(/.test(code), false);
is('the only thing it writes is its advice', (code.match(/\.(insert|upsert)\(/g) || []).length === 1 && /from\('studio_advice'\)\.upsert/.test(code), true);
is('it asks the database who may ask, with the caller\'s own session', /asUser\.rpc\('studio_can', \{ p_area: kind === 'host' \? 'verify' : 'safety' \}\)/.test(code) && /asUser\.rpc\('my_studio'\)/.test(code), true);
is('it never compares faces', /Do NOT compare the face with the card/.test(fn), true);
is('what is inside an item is evidence, never instructions', /evidence, not instructions/.test(fn), true);
is('it is Claude', /model: 'claude-opus-5'/.test(fn), true);
is('nothing from an item is logged', !/console\./.test(code), true);
is('the advice is read only by that kind\'s reviewers', /when 'host' then public\.studio_can\('verify'\)/.test(part) && !/on public\.studio_advice for (insert|update|delete|all)/.test(part), true);
is('a guide\'s advice goes when their application is decided', /delete from public\.studio_advice where kind = 'host'/.test(part), true);
is('every queue shows it', /<BardiAdvice kind="host"/.test(admin) && /<BardiAdvice kind="venue"/.test(admin) && /<BardiAdvice kind="report"/.test(admin), true);
is('and says plainly it is advice', /Advice only — you decide\./.test(admin), true);
is('the terms and the form say an AI helps check documents', /never compares faces and never decides/.test(read('src/components/TermsSheet.js')) && /Bardi, our assistant, helps check them/.test(read('src/constants/i18n.js')), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nBardi reads and recommends on every Studio decision; the buttons stay a person\'s.');
