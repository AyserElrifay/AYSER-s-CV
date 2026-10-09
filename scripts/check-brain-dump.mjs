/* ─── THE BRAIN DUMP: ONE THING AT A TIME ─────────────────────────────
   A messy line (or a voice note) in, one next action out. No to-do
   list, no checklist, nothing to maintain. See src/lib/brainDump.js.

       node scripts/check-brain-dump.mjs
*/
import fs from 'node:fs';
import { parseDump, newDay, current, markDone, notNow, left, FOCUS, MAX_ITEMS } from '../src/lib/brainDump.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const pick = (s) => parseDump(s).map((x) => [x.text, x.kind]);

console.log('a messy line becomes a few clear things');
is('English, with the throat-clearing taken out', pick('ok so I need to study for the stats exam, then gym and call mom. also buy groceries'),
  [['Study for the stats exam', 'studying'], ['Gym', 'workout'], ['Call mom', 'social'], ['Buy groceries', 'errands']]);
is('Egyptian Arabic, joined with و and بعدين and ثم', pick('لازم اذاكر للامتحان وبعدين اروح الجيم و اكلم ماما ثم اشتري خضار واروح البنك'),
  [['اذاكر للامتحان', 'studying'], ['اروح الجيم', 'workout'], ['اكلم ماما', 'social'], ['اشتري خضار', 'errands'], ['اروح البنك', 'errands']]);
is('one per line', pick('finish the pitch deck\nreply to emails\nlaundry'), [['Finish the pitch deck', 'deep_work'], ['Reply to emails', 'deep_work'], ['Laundry', 'errands']]);
is('a word that only starts with و is not cut in two', pick('ورق الشغل'), [['ورق الشغل', 'deep_work']]);
is('the same thing twice is one thing', parseDump('gym, gym, GYM').length, 1);
is('never a wall of items', parseDump('a1 x, b2 x, c3 x, d4 x, e5 x, f6 x, g7 x, h8 x, i9 x').length, MAX_ITEMS);
is('nothing in, nothing out', parseDump('   '), []);

console.log('\nthe rule of one');
let d = newDay(parseDump('study for the exam, gym, call mom'));
is('the first thing is the one shown', current(d).text, 'Study for the exam');
d = notNow(d);
is('not now moves on without losing it', [current(d).text, left(d)], ['Gym', 3]);
d = markDone(d);
is('done moves on and counts down', [current(d).text, left(d)], ['Call mom', 2]);
d = markDone(d);
is('the skipped one comes back round', current(d).text, 'Study for the exam');
d = markDone(d);
is('and when everything is done there is nothing to show', [current(d), left(d)], [null, 0]);

console.log('\nonly a word leaves the phone');
is('only studying and deep work are shared, for body doubling', [...FOCUS].sort(), ['deep_work', 'studying']);
const ui = fs.readFileSync('src/components/BrainDump.js', 'utf8');
is('the server is told the kind, never the text', /setFocus\(want\)/.test(ui) && !/setFocus\([^)]*text/.test(ui), true);
is('the dumped words do not become a public title', !/GoNowSheet[^>]*initialTitle=\{now\.text\}/.test(ui), true);
is('the day lives on the phone', /localStorage\.setItem\(KEY/.test(ui), true);
is('there is no checklist: one Done, one Not now', (ui.match(/t\('bd_done'\)/g) || []).length === 1 && !/items\.map\(/.test(ui), true);
const fn = fs.readFileSync('supabase/functions/bardi-listen/index.ts', 'utf8');
is('a voice note is turned into words by Whisper and kept nowhere', /whisper/.test(fn) && !/\.insert\(|\.upload\(|console\.log/.test(fn), true);
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
is('the server accepts only the two focus words', /v not in \('studying', 'deep_work'\)/.test(sql), true);

console.log(bad ? '\n' + bad + ' wrong.' : '\nBrain dump: a messy line in, one thing out, and only a word ever leaves the phone.');
process.exit(bad ? 1 : 0);
