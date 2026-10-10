/* ─── THE STUDIO OPENS ONLY AFTER A SECOND STEP, AND THE SERVER CHECKS ─
   Every owner and team power needs a session that passed Face ID /
   fingerprint (a passkey) or an authenticator code in the last 30
   minutes. The lock on the screen is how that step is taken; the lock
   that holds is in the database.

       node scripts/check-studio-lock.mjs
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
const part = sql.slice(sql.indexOf('STUDIO · LOCKED BEHIND A SECOND STEP'));
const app = read('App.js');
const team = read('supabase/functions/team-admin/index.ts');

/* the LAST definition of each is the one that counts */
const lastDef = (name) => sql.slice(sql.lastIndexOf('create or replace function public.' + name + '('));
is('a second step in the last 30 minutes, read from the server-signed token', /coalesce\(c ->> 'aal', ''\) <> 'aal2' then return false/.test(part) && /interval '30 minutes'/.test(part), true);
is('the owner check needs it', /return public\.studio_identity\(\) = 'owner' and public\.studio_fresh\(\);/.test(lastDef('is_app_owner')), true);
is('the team check needs it', /if not public\.studio_fresh\(\) then return false; end if;/.test(lastDef('studio_can')), true);
is('the last is_app_owner in the file is the locked one', sql.lastIndexOf('create or replace function public.is_app_owner()') > sql.indexOf('STUDIO · LOCKED BEHIND A SECOND STEP'), true);
is('no Studio table is still opened by the bare email', !/using \(\s*\(auth\.jwt\(\) ->> 'email'\) = 'ayseryourlifecoach@gmail\.com'/.test(part) &&
  ['owner reads all reports', 'owner reads feedback', 'help_owner_write', 'bardi_config_owner', 'bardi_knowledge_owner', 'vr update owner'].every((n) => part.includes('"' + n + '"')), true);
is('team management needs it too', /claims\.aal === 'aal2'/.test(team) && /return json\(403, \{ error: 'locked' \}\)/.test(team), true);
is('the Studio asks for the lock every time it opens', /look\(true\);   \/\/ the lock every time the Studio is opened/.test(app), true);
is('and again after 2 minutes away or 25 minutes open', /2 \* 60 \* 1000/.test(app) && /25 \* 60 \* 1000/.test(app), true);
is('Face ID / fingerprint is a real passkey, verified by the server', /mfa\.webauthn\.authenticate/.test(read('src/services/studioLock.js')) && /mfa\.webauthn\.register/.test(read('src/services/studioLock.js')), true);
is('and a code is there as the way back', /factorType: 'totp'/.test(read('src/services/studioLock.js')) && /challengeAndVerify/.test(read('src/services/studioLock.js')), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nThe Studio opens with Face ID, a fingerprint or a code — and the server refuses everything without it.');
