/* ─── LICENSED GUIDES AND VERIFIED HOSTS ──────────────────────────────
   The badge is earned from the Moments team only, the documents stay
   private and are deleted after the decision, the numbers are counted
   and never padded, and every plan says who is responsible for it.

       node scripts/check-hosts.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.indexOf('HOSTS · LICENSED GUIDES AND VERIFIED HOSTS'));
const svc = code('src/services/hosts.js');
const sheet = read('src/components/HostApplySheet.js');   // has 'image/*' in it, which a comment-stripper would eat
const card = code('src/components/HostCard.js');
const admin = code('src/components/AdminPanel.js');
const en = read('src/constants/i18n.js');

is('nobody gives themselves the badge', /new\.host_role := old\.host_role/.test(part) && /new\.host_verified_at := old\.host_verified_at/.test(part), true);
is('the documents bucket is private', /'verification', 'verification', false/.test(part) && /on conflict \(id\) do update set public = false/.test(part), true);
is('each person writes only their own folder', /bucket_id = 'verification' and \(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text\)/.test(part), true);
is('a request cannot name somebody else\'s file', /split_part\(p_doc, '\/', 1\) <> me::text/.test(part) && /role is null and doc_path is null and selfie_path is null/.test(part), true);
is('the declaration is required and its version kept', /'no_terms'/.test(part) && /terms_accepted_at/.test(part) && /HOST_TERMS_VERSION/.test(svc), true);
is('only the owner sees the queue and decides', /hosts_pending[\s\S]{0,200}is_app_owner\(\)/.test(part) && /host_decide[\s\S]{0,400}is_app_owner\(\)/.test(part), true);
is('the documents are forgotten after the decision', /doc_path = null, selfie_path = null|doc_path = null,\s*selfie_path = null/.test(part) && /storage\.from\('verification'\)\.remove\(paths\)/.test(svc), true);
is('documents are opened through short links, never public ones', /createSignedUrl\(path, 600\)/.test(svc) && !/getPublicUrl/.test(svc), true);
is('the numbers come from plans where somebody really checked in', /checked_in_at is not null/.test(part.slice(part.indexOf('host_stats'))), true);
is('a number still at 0 is not shown', /stats\.led > 0/.test(card) && /stats\.people > 0/.test(card) && /stats\.hours > 0/.test(card), true);
is('the form asks for the document, a selfie and the declaration', /ready = !!doc && !!selfie && agree/.test(sheet), true);
is('the owner reviews them in the Studio', /fetchPendingHosts\(\)/.test(admin) && /decideHost\(h\.user_id, yes\)/.test(admin), true);
is('each plan says who is responsible', /hc_liability/.test(code('src/screens/TogetherScreen.js')) && /hc_liability: "Run by the host, who is responsible/.test(en), true);
is('the declaration says Moments is not the organiser', /ha_terms: "I run the activities I host and I am responsible for them[^"]*not the organiser/.test(en), true);
const keys = ['ha_title', 'ha_terms', 'hb_guide', 'hb_host', 'hc_liability', 'notif_host_ok'];
const langs = fs.readdirSync('public/i18n').filter((f) => f.endsWith('.json'));
const missing = langs.filter((f) => { const d = JSON.parse(read('public/i18n/' + f)); return keys.some((k) => !d[k]); });
is('every language has the words', missing, []);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nGuides and hosts are checked by a person, their papers stay private, and every plan says who runs it.');
