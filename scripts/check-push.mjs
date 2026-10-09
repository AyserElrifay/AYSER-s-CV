/* ─── ON THE PHONE, EVEN WITH THE APP CLOSED ──────────────────────────
   Web push, end to end in the repository: the database hands a
   notification to supabase/functions/push, which signs it and sends it;
   public/sw.js writes the sentence in the reader's language.

       node scripts/check-push.mjs
*/
import fs from 'node:fs';
import { readOpenTarget, b64ToBytes, isIos } from '../src/lib/pushCore.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const fn = read('supabase/functions/push/index.ts');
const sw = read('public/sw.js');
const wf = read('.github/workflows/setup-backend.yml');

console.log('only what is worth waking somebody for');
const kinds = (/new\.kind not in \(([^)]*)\)/.exec(sql) || [])[1] || '';
is('a like never buzzes a phone', /'vibe'|'laugh'|'repost'/.test(kinds), false);
is('a message, a plan about to start and a mate request do', ['message', 'plan_soon', 'mate_request'].every((k) => kinds.includes("'" + k + "'")), true);
is('a failed hand-off can never make the notification itself fail', /exception when others then null;\s*-- no pg_net/.test(sql), true);
is('the plan reminder fires once per person per plan', /not exists \(select 1 from public\.notifications x[\s\S]{0,160}plan_soon/.test(sql), true);

console.log('\nwhat a lock screen shows');
is('never the words of a message or a comment', /body: n\.kind === 'bardi_match' \? n\.body : ''/.test(fn), true);
is('a plan\'s own title, and a first name, are all that ride along', /TITLED = new Set\(\['plan_soon', 'bardi_match', 'green_invite'\]\)/.test(fn), true);
is('a phone that unsubscribed is forgotten (404/410)', /404 \|\| code === 410/.test(fn), true);

console.log('\nkeys');
is('the hook is made by the database, not typed by anyone', /gen_random_uuid\(\)::text \|\| gen_random_uuid\(\)/.test(sql), true);
is('no signed-in user can read it', /revoke all on public\.app_secrets from anon, authenticated/.test(sql), true);
is('the private key is masked in the log and never echoed', /::add-mask::\$priv/.test(wf) && !/echo "\$priv"|echo \$priv/.test(wf), true);
is('a re-run keeps the existing keys', /grep -q VAPID_PRIVATE_KEY/.test(wf), true);
is('no key is written in the repository', /BEGIN PRIVATE|VAPID_PRIVATE_KEY\s*=\s*['"][A-Za-z0-9_-]{20,}/.test(fn + sw + read('src/lib/push.js')), false);

console.log('\nthe phone side');
is('the service worker shows it', /addEventListener\('push'/.test(sw) && /showNotification/.test(sw), true);
is('and a tap opens the app at the right place', /addEventListener\('notificationclick'/.test(sw), true);
const en = read('src/constants/i18n.js');
const swKeys = [...sw.matchAll(/^\s+(push_[a-z_]+):/gm)].map((m) => m[1]);
is('every sentence the worker can write is in the app\'s own strings', swKeys.filter((k) => !en.includes('    ' + k + ':')), []);
is('a plan reminder opens Together', readOpenTarget('https://x.io/app/?tab=TOGETHER'), { tab: 'TOGETHER' });
is('anything else opens the list', readOpenTarget('https://x.io/app/?notifications=1'), { notifications: true });
is('a made-up tab is ignored', readOpenTarget('https://x.io/app/?tab=../../x'), null);
is('the public key decodes to the 65 bytes a browser wants', b64ToBytes('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U').length, 65);
is('an iPhone is told to add to Home Screen first', isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'), true);
is('asked once, after joining — never on first open', /if \(!wasAsked\(\) && pushSupport\(\) !== 'no'\) setAskPush\(true\)/.test(read('src/screens/TogetherScreen.js')), true);

console.log(bad ? '\n' + bad + ' wrong.' : '\nPush: only what matters, nothing private on a lock screen, no key anyone has seen.');
process.exit(bad ? 1 : 0);
