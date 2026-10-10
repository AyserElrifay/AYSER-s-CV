/* ─── REAL EVENINGS, REAL PLANS, NOBODY SHOWN WITHOUT SAYING YES ──────
       node scripts/check-go-out.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.indexOf('HOME · WHAT A MOMENTS EVENING LOOKS LIKE'));
const rail = read('src/components/GoOutRail.js');
const admin = read('src/components/AdminPanel.js');
is('a highlight cannot go live without everyone\'s agreement — the database refuses', /if p_everyone_agreed is not true then return jsonb_build_object\('ok', false, 'reason', 'consent'\)/.test(part) && /consent_at  timestamptz not null/.test(part), true);
is('only the owner adds or removes one', /highlight_add[\s\S]{0,300}is_app_owner\(\)/.test(part) && !/on public\.app_highlights for (insert|update|delete|all)/.test(part), true);
is('the Studio asks the question in plain words', /Everyone who can be recognised in this agreed to be shown in the Moments app/.test(admin), true);
is('only plans with a real photo are on the rail', /filter\(\(g\) => planPhotoOf\(g\) && /.test(rail), true);
is('no stock pictures', !/unsplash|pexels|pixabay|stock/i.test(rail.replace(/\/\*[\s\S]*?\*\//g, '')), true);
is('nothing is drawn when there is nothing real', /if \(!hl && !plans\.length\) return null;/.test(rail), true);
is('a highlight video plays only on screen, never on data saver', /IntersectionObserver/.test(rail) && /isSaving\(/.test(rail) && /muted loop playsInline/.test(rail), true);
is('join right from the card', /joinGathering\(g\.id, true\)/.test(rail), true);
if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nHome shows real evenings and real plans — and nobody is in it who did not say yes.');
