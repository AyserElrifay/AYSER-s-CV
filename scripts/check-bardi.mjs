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
is('both spoke, eight minutes of silence → offer a game', shouldNudge({ msgs: talk, meId: 'me', now }), true);
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
is('nonsense is nothing', readMatch('hello'), null);
const sql = read('supabase/RUN_ME.sql');
const bm = sql.slice(sql.lastIndexOf('BARDI · THE SILENT MATCHMAKER'));
is('within 2 km, live in the last hour, at most once a day', /<= 2\b/.test(bm) && /interval '60 minutes'/.test(bm) && /interval '24 hours'/.test(bm), true);
is('only a hobby you both wrote yourselves', /p2\.id = u/.test(bm), true);

console.log('\nthe concierge: two questions, not four');
is('two questions on the screen', (read('src/components/VibeCheckSheet.js').match(/\{ q: 'vc_q/g) || []).length, 2);

console.log('\nquiet, not flashy');
const thread = read('src/screens/ChatThread.js');
const nudge = thread.slice(thread.indexOf('shouldNudge({'), thread.indexOf('shouldNudge({') + 2500);
is('the nudge has no animation', !/Animated|useNativeDriver|LinearGradient/.test(nudge), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nBardi stays out of the way and only steps in to get people together.');
