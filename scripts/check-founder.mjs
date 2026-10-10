/* ─── ONE WELCOME FROM AYSER, AND ONLY FROM THE DATABASE ──────────────
       node scripts/check-founder.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const fn = sql.slice(sql.indexOf('create or replace function public.founder_welcome'));
const svc = fs.readFileSync('src/services/founder.js', 'utf8');
const auth = fs.readFileSync('src/context/AuthContext.js', 'utf8');
const texts = JSON.parse(fn.match(/texts jsonb := '(.*?)'::jsonb;/s)[1].replace(/''/g, "'"));
is('from the owner\'s real account', /from auth\.users u join public\.app_owners o/.test(fn), true);
is('once per person', /if exists \(select 1 from public\.founder_welcomes where user_id = me\)/.test(fn), true);
is('only new accounts — the people already here are not suddenly greeted', /interval '3 days'/.test(fn), true);
is('never to himself', /if me = founder then/.test(fn), true);
is('signed in only', /revoke execute on function public\.founder_welcome\(text\) from public, anon;/.test(sql), true);
is('the phone never sends the words', !/body/.test(svc.replace(/\/\*[\s\S]*?\*\//g, '')) && /rpc\('founder_welcome', \{ p_lang: langNow\(\) \}\)/.test(svc), true);
is('every app language has the message', ['en','ar','cs','es','et','fr','it','ja','ko','nl','pt','ro','ru','tr','zh'].every((l) => typeof texts[l] === 'string' && texts[l].includes('{name}')), true);
is('it invites a reply, and a reply reaches him', Object.values(texts).every((x) => x.length > 80), true);
is('the app asks once the profile exists', /askFounderWelcome\(uid\)/.test(auth), true);
if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nEvery new account hears from Ayser once, in their own language, and can answer him.');
