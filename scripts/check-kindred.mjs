/* ─── "YOU'RE LIKE N PEOPLE" MUST BE A COUNT ──────────────────────────
   Ayser: "خليه لما اختار preferences يقلي أنا شبه كام user حول العالم".
   The competitor he showed told a forty-second-old account that 102,192
   people had things in common with it. This app's rule is "nothing
   fake", so this screen may only ever say what the database counted.

       node scripts/check-kindred.mjs
*/
import fs from 'node:fs';
import { summarizeKindred, kindredNumber } from '../src/lib/kindred.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};

console.log('the number is the count, and nothing else');
is('three people is three', summarizeKindred({ total: 3, flags: ['🇪🇬', '🇪🇬', '🇩🇪'], myFlag: '🇪🇬', sameHere: 2 }).total, 3);
is('one person is one', summarizeKindred({ total: 1, flags: ['🇫🇷'] }).total, 1);
is('nobody is zero, and says so', summarizeKindred({ total: 0, flags: [] }), { total: 0, first: true, countries: 0, flags: [], moreFlags: 0, sameHere: 0, myFlag: null });
is('a broken count is zero, never a guess', summarizeKindred({ total: NaN, flags: [] }).total, 0);
is('a negative is zero', summarizeKindred({ total: -4 }).total, 0);
is('a fraction is not rounded up', summarizeKindred({ total: 2.9 }).total, 2);
is('a big real number is shown whole, grouped — not "+"', kindredNumber(43230, 'en'), '43,230');

console.log('\nthe flags are the ones those people set');
const k = summarizeKindred({ total: 12, flags: ['🇩🇪', '🇪🇬', '🇪🇬', '🇫🇷', '🇪🇬', '🇩🇪', null, ''], myFlag: '🇪🇬', sameHere: 3 });
is('most common first', k.flags, ['🇪🇬', '🇩🇪', '🇫🇷']);
is('empty flags are not countries', k.countries, 3);
is('your country, counted', k.sameHere, 3);
const many = summarizeKindred({ total: 40, flags: ['🇦🇷','🇧🇷','🇨🇦','🇩🇪','🇪🇬','🇫🇷','🇬🇧','🇮🇹','🇯🇵','🇰🇷'] });
is('eight flags at most', many.flags.length, 8);
is('and the rest as a number', many.moreFlags, 2);
is('"in your country" needs a country', summarizeKindred({ total: 5, flags: ['🇪🇬'], sameHere: 4, myFlag: null }).sameHere, 0);

console.log('\nand the screen and the query say the same');
const svc = fs.readFileSync('src/services/kindred.js', 'utf8');
const scr = fs.readFileSync('src/screens/AuthScreen.js', 'utf8');
const lib = fs.readFileSync('src/lib/kindred.js', 'utf8');
is('it counts real rows with an exact count', /count: 'exact'/.test(svc) && /\.eq\('intent', intent\)/.test(svc), true);
is('it does not count you as one of your own people', /\.neq\('id', meId\)/.test(svc), true);
is('it gives up after four seconds', /withDeadline\(q, 4000\)/.test(svc), true);
is('and when it gives up, the app opens anyway', /catch \(e\) \{\s*finishOnboarding\(\);/.test(scr), true);
is('the big number on screen is the counted total', /kindredNumber\(kin\.total, lang\)/.test(scr), true);
is('zero has its own honest screen', /kin\.first \?/.test(scr) && /kin_first_title/.test(scr), true);
is('there is no floor, multiplier or "+" anywhere near it',
   !/Math\.max\(\s*\d{2,}/.test(lib + svc) && !/\*\s*\d+(\.\d+)?\s*\)/.test(svc) && !/total\s*\+\s*'\+'/.test(scr), true);
is('demo mode shows no number at all — there is nothing real to count', /if \(isDemo\) \{ enterDemo\(\); return; \}/.test(scr), true);

if (bad) {
  console.log('\n' + bad + ' wrong. The "people like you" number is not a count any more.');
  process.exit(1);
}
console.log('\nThe number on that screen is the number in the database.');
