/* ─── THE HOLES THAT WERE FOUND, KEPT SHUT ─────────────────────────────
   Each line here is a hole that existed and was closed. They are checked
   on every deploy so that none of them quietly comes back.

       node scripts/check-security.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const last = (re) => { const all = [...sql.matchAll(re)]; return all.length ? all[all.length - 1][0] : ''; };

console.log('nobody can forge a notification');
is('notify() is not callable from outside', /revoke execute on function public\.notify\(uuid, uuid, text, uuid, text\) from public, anon, authenticated/.test(sql), true);
is('a missed call is always from the real caller', /public\.notify\(recipient, auth\.uid\(\), 'call'/.test(last(/create or replace function public\.notify_call[\s\S]*?\$\$;/g)), true);
is('matching and reminders for other people are database-only', ['bardi_match_for(uuid)', 'bardi_match()', 'plan_reminders()', 'talk_me_at(uuid)', 'trust_unlocked(uuid)'].every((f) => sql.includes('revoke execute on function public.' + f + ' from public, anon, authenticated')), true);

console.log('\nnobody approves their own organisation');
is('a venue is applied for as pending, never inserted as live', /"signed-in users can apply as a venue"[\s\S]{0,120}with check \(auth\.uid\(\) = owner_id and status = 'pending'\)/.test(last(/create policy "signed-in users can apply as a venue"[\s\S]*?;/g)), true);
is('an owner edits only a pending application, and cannot make it live', /status = 'pending'\) with check \(auth\.uid\(\) = owner_id and status = 'pending'\)/.test(last(/create policy "owners can update own pending venue"[\s\S]*?;/g)), true);
is('approving is checked against the owner email in the database', /venue_decide[\s\S]{0,200}is_app_owner\(\)/.test(sql) && /venues_pending[\s\S]{0,200}is_app_owner\(\)/.test(sql), true);
is('where people are is for signed-in people only', /live locations are viewable by everyone" on public\.live_locations for select to authenticated/.test(last(/create policy "live locations are viewable by everyone"[^;]*;/g)), true);

console.log('\nnothing a user typed runs as code in someone else\'s browser');
const map = read('src/components/LeafletMap.js');
is('every picture on the map goes through safeSrc', (map.match(/<img src="' \+ (?!safeSrc\()/g) || []).length, 0);
is('safeSrc lets through only web and our own image addresses', /\^\(https\?:\\\/\\\/\|data:image\\\/\|blob:\)/.test(map), true);
is('no raw HTML insertion anywhere in the app', (() => {
  const out = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js') && /dangerouslySetInnerHTML|insertAdjacentHTML|document\.write\(|new Function\(/.test(read(q))) out.push(q); } })('src');
  return out;
})(), []);

console.log('\nno keys in the repository');
const leaks = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const q = d + '/' + f;
    if (/node_modules|\.git$|dist$|\.expo/.test(q)) continue;
    if (fs.statSync(q).isDirectory()) walk(q);
    else if (/\.(js|ts|json|yml|yaml|sql|md|html)$/.test(q) && /(sk-ant-api|gsk_[A-Za-z0-9]{20}|sbp_[a-f0-9]{20}|"role":"service_role"|-----BEGIN (RSA |EC )?PRIVATE KEY)/.test(read(q))) leaks.push(q);
  }
})('.');
is('no secret keys in any file', leaks, []);

console.log('\nthe owner\'s tools stay out of everyone\'s app');
is('Settings has no owner-only rows (the Studio opens from a private link)', /isOwner\(/.test(read('src/screens/SettingsScreen.js')), false);
is('the Studio opens only for the owner', /studioRequested\(\) && isOwner\(user\)/.test(read('App.js')), true);

console.log(bad ? '\n' + bad + ' wrong.' : '\nSecurity: every hole found so far is still shut.');
process.exit(bad ? 1 : 0);
