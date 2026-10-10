/* ─── THE STUDIO TEAM: THE OWNER MAKES IT, THE SERVER ENFORCES IT ─────
   Team members sign in with a username and password the owner chose.
   Only the owner can create, pause, re-password or remove one; what a
   member may open is decided by their role on the server; a paused
   member loses access at once.

       node scripts/check-team.mjs
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
const part = sql.slice(sql.indexOf('STUDIO TEAM · USERNAMES, ROLES'));
const fn = read('supabase/functions/team-admin/index.ts');
const admin = read('src/components/AdminPanel.js');
const app = read('App.js');
import { signInAddress } from '../src/lib/teamAddress.js';

is('only the owner can call team-admin, checked on every request', /from\('app_owners'\)\.select\('email'\)\.ilike\('email', email\)/.test(fn) && /return json\(403, \{ error: 'not_owner' \}\)/.test(fn), true);
is('it only ever touches team accounts, never a user', /never touch an account that is not a team account/.test(fn) && (fn.match(/await isTeam\(\)/g) || []).length === 5, true);
is('no password is logged or stored by us', !/console\./.test(fn) && !/password['"]?\s*:\s*b\.password[\s\S]{0,40}team_members/.test(fn), true);
is('team addresses are on a reserved domain that can never get mail', /team\.moments\.invalid/.test(fn), true);
is('nobody writes the team table but the function', /create policy "team: see yourself" on public\.team_members for select using \(user_id = auth\.uid\(\)\)/.test(part) && !/on public\.team_members for (insert|update|delete|all)/.test(part), true);
is('a paused member loses access at once', /m\.disabled_at is null/.test(part.slice(part.indexOf('studio_can'))) && /ban_duration: '876000h'/.test(fn), true);
is('safety and verify reviews follow the role', /studio_can\('safety'\) then return jsonb_build_object\('ok', false/.test(part) && /create or replace function public\.hosts_pending\(\)[\s\S]{0,200}studio_can\('verify'\)/.test(part), true);
is('the team list is the owner\'s only', /team_list\(\)[\s\S]{0,120}not public\.is_app_owner\(\)/.test(part), true);
is('the Studio opens for whoever the server says, and only them', /myStudio\(\)\.then/.test(app) && /<AdminPanel access=\{access\}/.test(app), true);
is('tabs without an area are the owner\'s', /canOpen = \(access, t\) => !!access && \(access\.owner \|\| \(!!t\.area/.test(admin) && /\{ k: 'team', label: 'Team', icon: 'people-outline' \}/.test(admin), true);
is('the Team tab draws only for the owner', /tab === 'team' && owner \? <TeamTab \/>/.test(admin), true);
{
  is('a username signs in as its team address', signInAddress('Mona'), 'mona@team.moments.invalid');
  is('a real email is left alone', signInAddress('someone@gmail.com'), 'someone@gmail.com');
}

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nThe owner makes the team; the server decides, every time, what each of them can open.');
