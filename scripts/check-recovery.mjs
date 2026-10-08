/* ─── FORGETTING YOUR PASSWORD CANNOT BE A DEAD END ───────────────────
   Ayser: "لو حد نسي الباسورد ده حوار".

   It was not a hard problem, it was a closed door. The app asked
   Supabase for a reset email, Supabase sent it, the person tapped the
   link, the browser came back carrying the recovery token — and the
   client had been created with `detectSessionInUrl: false`, so the
   token was read by nobody and dropped. The person landed on the same
   login screen, with the same password they had already forgotten,
   and nothing on the screen said why.

   What this proves, in order:
     · the token is recognised wherever Supabase puts it;
     · an expired or already-spent link is recognised as an error
       rather than silently ignored;
     · an ordinary visit is NOT mistaken for a recovery, which would
       lock everybody out of the app behind a password form;
     · the token never stays in the address bar;
     · and the screen that asks for the new password is actually
       reachable, because a flow nobody can get to is not a flow.

       node scripts/check-recovery.mjs
*/
import fs from 'node:fs';
import { parseRecovery } from '../src/lib/recovery.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got)
    + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};

const APP = 'https://ayserelrifay.github.io/AYSER-s-CV/';

console.log('the link as Supabase actually sends it');
const good = parseRecovery(APP + '#access_token=eyJabc.def.ghi&expires_in=3600&refresh_token=r1r1r1&token_type=bearer&type=recovery');
is('it is recognised as a recovery', !!good, true);
is('the access token comes out whole', good && good.accessToken, 'eyJabc.def.ghi');
is('and the refresh token with it', good && good.refreshToken, 'r1r1r1');
is('with no error', good && good.error, null);

console.log('\na link that has expired, or that was already used once');
const dead = parseRecovery(APP + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
is('it is still recognised as ours', !!dead, true);
is('there is no token to use', dead && dead.accessToken, null);
is('and the reason is readable by a person', dead && dead.error, 'Email link is invalid or has expired');

console.log('\nan ordinary visit must not be mistaken for one');
is('the bare app', parseRecovery(APP), null);
is('somebody arriving on a deep link', parseRecovery(APP + '#/profile'), null);
is('a magic-link sign-in, which is a different flow', parseRecovery(APP + '#access_token=x&type=magiclink'), null);
is('an email confirmation, likewise', parseRecovery(APP + '#access_token=x&type=signup'), null);
is('and the studio link, which has its own gate', parseRecovery(APP + '?studio=1'), null);

console.log('\nthe token must not be left in the address');
const src = fs.readFileSync('src/lib/recovery.js', 'utf8');
is('the address is rewritten as soon as it is read', /history\.replaceState/.test(src), true);
is('and it is replaceState, so back does not return to it', !/history\.pushState/.test(src), true);
is('stripping happens at import, not on a later render', /const found = readUrl\(\);\s*\nif \(found\) stripUrl\(\);/.test(src), true);

console.log('\nand the screen has to be reachable');
const app = fs.readFileSync('App.js', 'utf8');
is('App asks whether somebody is recovering', /isRecovering\(\)/.test(app), true);
/* The gate order is the whole point: setting the session signs them in,
   so an isAuthenticated check placed first would send somebody who
   still does not know their password straight past the form. */
const recAt = app.indexOf('if (recovering)');
const authAt = app.indexOf('if (!isAuthenticated)');
is('and it checks that BEFORE the signed-in gate', recAt > -1 && recAt < authAt, true);

const scr = fs.readFileSync('src/screens/AuthScreen.js', 'utf8');
is('the screen takes the recovery flag', /AuthScreen = \(\{ recovery/.test(scr), true);
is('it trades the token for a session first', /setSessionFromTokens/.test(scr), true);
is('it offers the new-password field', /auth_recovery_title/.test(scr), true);
is('it says so plainly when the link is dead', /auth_recovery_expired/.test(scr), true);
is('and saving releases the gate rather than looping', /clearRecovery\(\); if \(onDone\) onDone\(\)/.test(scr), true);

const strings = fs.readFileSync('src/constants/i18n.js', 'utf8');
const ar = JSON.parse(fs.readFileSync('public/i18n/ar.json', 'utf8'));
for (const k of ['auth_recovery_title', 'auth_recovery_sub', 'auth_recovery_expired', 'auth_recovery_again']) {
  is('"' + k + '" exists in English', strings.includes(k + ':'), true);
  is('   and in Arabic', typeof ar[k] === 'string' && ar[k].length > 0, true);
}

if (bad) {
  console.log('\n' + bad + ' wrong. Somebody who forgot their password still cannot get back in.');
  process.exit(1);
}
console.log('\nThe link in the email lands on a form that sets a new password.');
