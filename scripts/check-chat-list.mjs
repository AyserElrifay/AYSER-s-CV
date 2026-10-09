/* ─── THE CHATS LIST: COMING, GROUPS, PAST ────────────────────────────
   A weekly plan makes a new chat every week; the list must not read
   "Morning walk, Morning walk, Morning walk". See src/lib/chatList.js.

       node scripts/check-chat-list.mjs
*/
import fs from 'node:fs';
import { splitChats } from '../src/lib/chatList.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const now = Date.parse('2026-10-09T12:00:00Z');
const at = (h) => new Date(now + h * 3600000).toISOString();
const list = [
  { id: 'w-last', name: 'Morning walk', plan: { starts_at: at(-7 * 24), minutes: 60 } },
  { id: 'w-this', name: 'Morning walk', plan: { starts_at: at(20), minutes: 60 } },
  { id: 'opera', name: 'Opera night', plan: { starts_at: at(2), minutes: 120 } },
  { id: 'off', name: 'Football', plan: { starts_at: at(30), cancelled_at: at(-1) } },
  { id: 'now', name: 'Sunset walk', plan: { starts_at: at(-3), minutes: 60 } },
  { id: 'mine', name: 'Explorers' },
];
const r = splitChats(list, now);
is('coming plans, soonest first (one that ended a few hours ago still counts)', r.coming.map((x) => x.id), ['now', 'opera', 'w-this']);
is('your own groups on their own', r.groups.map((x) => x.id), ['mine']);
is("last week's walk and the called-off plan are folded away", r.past.map((x) => x.id), ['off', 'w-last']);
const ui = fs.readFileSync('src/screens/ChatsScreen.js', 'utf8');
is('no Invite / Leave buttons on the rows — hold a row instead', /onLongPress=\{\(\) => \{ tapSelection\(\); setRowMenu\(sq\); \}\}/.test(ui) && !/＋ \{t\('ch_invite'\)\}/.test(ui), true);
is('a bilingual title shows in the reader\'s language', /titleFor\(sq\.name, lang\)/.test(ui), true);
console.log(bad ? '\n' + bad + ' wrong.' : '\nChats: the plans coming up, your groups, and the past folded away.');
process.exit(bad ? 1 : 0);
