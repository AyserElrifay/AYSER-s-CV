/* ─── BARDI IS NOT A CHATBOT ──────────────────────────────────────────
   "Remove the dedicated chat interface … convert Bardi to an invisible
   facilitator … no flashy AI animations." And: simple, fast, few
   questions.

       node scripts/check-bardi.mjs
*/
import fs from 'node:fs';
import { shouldNudge, nudgeGame, readMatch, QUIET_MIN } from '../src/lib/bardi.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q); } })('src');

console.log('no chat with Bardi anywhere');
is('the chat sheet is gone', fs.existsSync('src/components/BardiSheet.js'), false);
is('nothing opens it', files.filter((f) => /BardiSheet|setBardiOpen|talk_to_bardi\)/.test(read(f))).length, 0);

console.log('\nthe game master: only when a conversation has gone quiet');
const now = Date.parse('2026-10-09T12:00:00Z');
const at = (mins) => new Date(now - mins * 60000).toISOString();
const talk = [{ from: 'me', createdAt: at(10) }, { from: { name: 'Mona' }, userId: 'x', createdAt: at(8) }];
is('both spoke, eight minutes of silence → offer a game', shouldNudge({ msgs: talk, meId: 'me', now }), 'quiet');
is('a brand-new conversation gets the ice-breaker', shouldNudge({ msgs: [], meId: 'me', now, loaded: true }), 'new');
is('but not while the messages are still loading', shouldNudge({ msgs: [], meId: 'me', now, loaded: false }), false);
is('and not on a new chat dismissed today', shouldNudge({ msgs: [], meId: 'me', now, loaded: true, dismissedAt: now - 60000 }), false);
is('a minute of silence is not silence', shouldNudge({ msgs: [{ from: 'me', createdAt: at(3) }, { from: {}, userId: 'x', createdAt: at(1) }], meId: 'me', now }), false);
is('one person talking to themselves is not a conversation', shouldNudge({ msgs: [{ from: 'me', createdAt: at(30) }, { from: 'me', createdAt: at(20) }], meId: 'me', now }), false);
is('a chat from last week is over, not quiet', shouldNudge({ msgs: [{ from: 'me', createdAt: at(9000) }, { from: {}, userId: 'x', createdAt: at(8000) }], meId: 'me', now }), false);
is('dismissed today stays dismissed', shouldNudge({ msgs: talk, meId: 'me', now, dismissedAt: now - 3600000 }), false);
is('not while a game is already open', shouldNudge({ msgs: talk, meId: 'me', now, gameOpen: true }), false);
is('the same chat is always offered the same game', nudgeGame('abc') === nudgeGame('abc'), true);
is('it waits a few minutes, not seconds', QUIET_MIN >= 3, true);

console.log('\nthe matchmaker: a count and a hobby, written by the phone');
is('reads the count and the hobby', readMatch('2|specialty coffee'), { count: 2, what: 'specialty coffee', kind: 'coffee' });
is('running becomes a run', readMatch('3|running').kind, 'run');
is('fewer than two others is nothing', readMatch('1|coffee'), null);
is('body doubling: studying near a real venue', readMatch('3|studying|Diwan Bookstore'), { count: 3, what: 'studying', kind: 'focus', focus: true, venue: 'Diwan Bookstore' });
is('body doubling without a venue still offers a session', readMatch('2|deep_work').venue, null);
const threadSrc = read('src/screens/ChatThread.js');
is('tapping the game master sends the invitation, not just a local game', /send\(t\('bardi_invite_' \+ game\)\)/.test(threadSrc), true);
is('no Bardi chat service is left', fs.existsSync('src/services/bardiChat.js') || fs.existsSync('src/services/bardiLocal.js'), false);
is('the old Bardi chat table takes nothing new', /drop policy if exists "bardi_chat_own_insert" on public\.bardi_chats;\s*drop policy if exists "bardi_chat_own_update"/.test(read('supabase/RUN_ME.sql')), true);
is('nonsense is nothing', readMatch('hello'), null);
const sql = read('supabase/RUN_ME.sql');
const bm = sql.slice(sql.lastIndexOf('BARDI · THE SILENT MATCHMAKER'));
is('within 2 km, live in the last hour, at most once a day', /<= 2\b/.test(bm) && /interval '60 minutes'/.test(bm) && /interval '24 hours'/.test(bm), true);
is('only a hobby you both wrote yourselves', /p2\.id = u/.test(bm), true);

console.log('\nthe concierge: two questions, not four');
is('two questions on the screen', (read('src/components/VibeCheckSheet.js').match(/\{ q: 'vc_q/g) || []).length, 2);

console.log('\nquiet, not flashy');
const thread = threadSrc;
const nudge = thread.slice(thread.indexOf('{nudgeWhy ? ('), thread.indexOf('{nudgeWhy ? (') + 2500);
is('the nudge has no animation', !/Animated|useNativeDriver|LinearGradient/.test(nudge), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nBardi stays out of the way and only steps in to get people together.');
