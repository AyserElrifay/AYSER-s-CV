/* ─── OFFLINE FIRST ───────────────────────────────────────────────────
   No signal must not mean no app: it opens, it shows what you saw last,
   and "I'm coming" waits and then goes. See src/lib/offline.js.

       node scripts/check-offline.mjs
*/
import fs from 'node:fs';
import {
  setOfflineStore, remember, recall, enqueue, pending, flush, withPendingJoins, MAX_AGE_MS,
} from '../src/lib/offline.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const mem = {};
setOfflineStore({ getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } });

console.log('what you saw last');
const now = Date.parse('2026-10-09T12:00:00Z');
remember('green_list.all', [{ id: 'g1', going: 2, im_going: false }], now);
is('comes back as it was', recall('green_list.all', now + 1000), [{ id: 'g1', going: 2, im_going: false }]);
is('a week later it is too old to show as this week', recall('green_list.all', now + MAX_AGE_MS + 1), null);
is('nothing kept is nothing, not an error', recall('never', now), null);

console.log('\nthe outbox');
enqueue({ kind: 'join', id: 'g1', going: true }, now);
enqueue({ kind: 'join', id: 'g1', going: false }, now + 1);
enqueue({ kind: 'join', id: 'g1', going: true }, now + 2);
is('join, leave, join again offline leaves one entry: the last word', pending('join').map((a) => a.going), [true]);
is('a joined plan reads Going from memory too', withPendingJoins([{ id: 'g1', going: 2, im_going: false }]), [{ id: 'g1', going: 3, im_going: true }]);
is('a plan already marked going is not counted twice', withPendingJoins([{ id: 'g1', going: 3, im_going: true }])[0].going, 3);

enqueue({ kind: 'join', id: 'g2', going: true }, now + 3);
let r = await flush(async (a) => (a.id === 'g1' ? 'network' : 'sent'));
is('still no network: nothing is lost, order is kept', [r.sent, pending().map((a) => a.id)], [0, ['g1', 'g2']]);
r = await flush(async (a) => (a.id === 'g1' ? 'refused' : 'sent'));
is('a server "no" is dropped, not retried forever; the rest goes', [r.sent, r.left, pending().length], [1, 0, 0]);

console.log('\nthe app itself opens without a signal');
const sw = fs.readFileSync('public/sw.js', 'utf8');
is('the service worker keeps the whole build, not just visited tabs', /precache\.json/.test(sw) && /async function precache/.test(sw), true);
is('and the language files', /i18n/.test(sw), true);
is('a link with ?invite= still opens offline', /request\.mode === 'navigate'[\s\S]{0,200}registration\.scope/.test(sw), true);
is('the build writes the list', /precache\.json/.test(fs.readFileSync('scripts/inject-html.mjs', 'utf8')), true);
const green = fs.readFileSync('src/services/green.js', 'utf8');
is('the week is remembered and recalled', /remember\(key, rows\)/.test(green) && /recall\(key\)/.test(green), true);
is('joining offline waits in the outbox', /enqueue\(\{ kind: 'join'/.test(green), true);
is('a failed fetch counts as the network, not a server no', /fetch\|network\|load failed/.test(green), true);
is('the bar is on screen everywhere', /<OfflineBar \/>/.test(fs.readFileSync('src/navigation/TabNavigator.js', 'utf8')), true);
if (fs.existsSync('dist/precache.json')) {
  const list = JSON.parse(fs.readFileSync('dist/precache.json', 'utf8'));
  is('the built list has the page and the code', list.includes('./') && list.some((p) => /\.js$/.test(p)), true);
}

console.log(bad ? '\n' + bad + ' wrong.' : '\nOffline: it opens, it remembers, and what you tapped goes when you are back.');
process.exit(bad ? 1 : 0);
