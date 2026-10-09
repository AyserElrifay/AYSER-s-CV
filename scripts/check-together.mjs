/* ─── TOGETHER: THE WEEK, NEAR YOU ────────────────────────────────────
   Ayser: "all the people, not just new people — make community".

   Holds in place what the tab promises:
     · five tabs, with Together in the middle — a sixth is one more than
       a phone's tab bar is meant to carry;
     · Reels and Chill still exist and each has a visible way back;
     · "near me" is the country on your own profile, read from your
       flag, never guessed;
     · the week is grouped by the day it really falls on;
     · every count on a card is the count the database sent.

       node scripts/check-together.mjs
*/
import fs from 'node:fs';
import { flagToIso, groupByDay } from '../src/lib/together.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got) + ' (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');

console.log('near me is the flag you set');
is('🇪🇪 is EE', flagToIso('🇪🇪'), 'EE');
is('🇪🇬 is EG', flagToIso('🇪🇬'), 'EG');
is('no flag is no country', flagToIso(null), null);
is('a non-flag emoji is not a country', flagToIso('🌍'), null);
is('three letters is not a flag', flagToIso('🇪🇪🇪'), null);

console.log('\nthe week, by the day it falls on');
const now = new Date(2026, 9, 9, 12, 0);
const at = (d, h) => new Date(2026, 9, 9 + d, h, 0).toISOString();
const days = groupByDay([
  { id: 'b', starts_at: at(1, 9) }, { id: 'a', starts_at: at(0, 18) },
  { id: 'c', starts_at: at(1, 20) }, { id: 'x', starts_at: 'not a date' }, { id: 'd', starts_at: at(5, 19) },
], now);
is('three days with something on, in order', days.map((d) => d.offset), [0, 1, 5]);
is('today first', days[0].items.map((g) => g.id), ['a']);
is('tomorrow holds both, earliest first', days[1].items.map((g) => g.id), ['b', 'c']);
is('a broken date is left out, not placed somewhere', days.flatMap((d) => d.items).some((g) => g.id === 'x'), false);
is('nothing on is no days, not empty days', groupByDay([], now), []);

console.log('\nfive tabs, Together in the middle');
const nav = read('src/navigation/TabNavigator.js');
const bar = [...nav.matchAll(/<Tab\.Screen\s+name="(\w+)"(?![^>]*options=\{HIDDEN\})/g)].map((m) => m[1]);
is('the bar', bar, ['HOME', 'MAP', 'TOGETHER', 'CHATS', 'SPACE']);
is('Chill is kept, off the bar', /name="CHILL"[^>]*options=\{HIDDEN\}/.test(nav), true);
is('Reels are gone: no endless video feed', !/name="REELS"/.test(nav) && !fs.existsSync('src/screens/ReelsScreen.js'), true);
is('the swipe follows the bar', /TAB_ORDER = \['HOME', 'MAP', 'TOGETHER', 'CHATS', 'SPACE'\]/.test(read('src/navigation/SwipeTabs.js')), true);
is('Chill has a way back', /onBack=\{\(\) => \{ tapLight\(\); nav\.navigate\('TOGETHER'\)/.test(read('src/screens/ChillScreen.js')), true);

console.log('\nthe counts are the database\'s');
const scr = read('src/screens/TogetherScreen.js');
is('going is what the row says', /\(Number\(g\.going\) \|\| 0\) \+ ' ' \+ t\('green_going'\)/.test(scr), true);
is('a failed join puts the card back', /if \(!\(r && r\.ok\)\) load\(\);/.test(scr), true);
is('a quiet week says so and offers to start one', /tg_empty_t/.test(scr) && /setSheet\('start'\)/.test(scr), true);
is('near me comes from your profile flag', /flagToIso\(p && p\.country_flag\)/.test(scr), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nTogether shows the real week, near you, with a way into everything else.');
