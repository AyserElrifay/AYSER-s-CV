/* ─── NOTIFICATIONS: ONE LINE PER THING THAT HAPPENED ─────────────────
       node scripts/check-notif-groups.mjs
*/
import fs from 'node:fs';
import { groupNotifs, namesLine } from '../src/lib/notifGroups.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const A = (id, name) => ({ actor_id: id, actor: { name } });
const list = [
  { id: 1, kind: 'mate_accept', ...A('m', 'Mohamed Awad') },
  { id: 2, kind: 'mate_accept', ...A('s', 'Sohaila Salam'), read: true },
  { id: 3, kind: 'vibe', post_id: 'p1', ...A('m', 'Mohamed Awad') },
  { id: 4, kind: 'vibe', post_id: 'p1', ...A('y', 'Yasmin') },
  { id: 5, kind: 'vibe', post_id: 'p2', ...A('y', 'Yasmin') },
  { id: 6, kind: 'message', ...A('m', 'Mohamed Awad') },
  { id: 7, kind: 'message', ...A('m', 'Mohamed Awad') },
  { id: 8, kind: 'comment', post_id: 'p1', body: 'love it', ...A('y', 'Yasmin') },
  { id: 9, kind: 'comment', post_id: 'p1', body: 'again', ...A('y', 'Yasmin') },
];
const g = groupNotifs(list);
is('two mates accepting is one line, with both names', [g[0].kind, g[0].actors.map((a) => a.id)], ['mate_accept', ['m', 's']]);
is('stars on the same moment merge; another moment is its own line', g.filter((x) => x.kind === 'vibe').map((x) => x.items.length), [2, 1]);
is('five messages from one person: one line', g.filter((x) => x.kind === 'message').length, 1);
is('every comment keeps its own words', g.filter((x) => x.kind === 'comment').length, 2);
is('the newest is the one shown', g[0].n.id, 1);
is('unread if anything in it is unread', g[0].read, false);
const W = { someone: 'Someone', and: '{a} and {b}', others: '{a} and {n} others' };
is('names read naturally', [namesLine([{ name: 'Mona' }], W), namesLine([{ name: 'Mona' }, { name: 'Ali' }], W), namesLine([{ name: 'Mona' }, { name: 'Ali' }, { name: 'Sara' }, { name: 'Omar' }], W)], ['Mona', 'Mona and Ali', 'Mona and 3 others']);
const ui = fs.readFileSync('src/components/NotificationsSheet.js', 'utf8');
is('no emoji or flag on every row', !/country_flag \? ' ' \+ n\.actor\.country_flag/.test(ui) && !/const LINE = \{/.test(ui), true);
is('every kind has words, in English at least', ['vibe', 'laugh', 'comment', 'mate_request', 'mate_accept', 'call', 'tag', 'repost', 'green_invite', 'message'].every((k) => fs.readFileSync('src/constants/i18n.js', 'utf8').includes('    nt_v_' + k + ':')), true);
console.log(bad ? '\n' + bad + ' wrong.' : '\nNotifications: one line per thing that happened.');
process.exit(bad ? 1 : 0);
