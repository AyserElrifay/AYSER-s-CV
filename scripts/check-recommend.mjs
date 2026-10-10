/* ─── LOCATION IS THE GATE; FRIENDS AND INTERESTS RANK INSIDE IT ──────
   See src/lib/recommend.js for the why.

       node scripts/check-recommend.mjs
*/
import fs from 'node:fs';
import { rankPeople, rankPlans, sharedHobbies, placeTier, lovesKind, whyText } from '../src/lib/recommend.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const t = (k) => ({ why_mutual: '{n} mutual friends', why_mutual_one: '1 mutual friend', why_shared: 'You both like {what}', why_mates: '{n} of your friends are going', why_mates_one: 'A friend of yours is going', why_loves: 'Your kind of thing', why_new: 'Something new for you' }[k] || k);
const me = { hobbies: '🥾 Hiking, ☕ Coffee, 📚 Reading', city: 'Cairo', country: 'EG' };

console.log('shared interests');
is('the same hobby, written with an emoji', sharedHobbies(me.hobbies, '☕ Coffee, 🎮 Gaming'), ['Coffee']);
is('nothing shared, nothing claimed', sharedHobbies(me.hobbies, '🎮 Gaming'), []);

console.log('\nthe gate: where they are');
is('here now nearby comes first', placeTier({ seen: 'now', km: 2 }, me), 0);
is('here now but 300 km away is not "near"', placeTier({ seen: 'now', km: 300, city: 'Aswan', country: 'EG' }, me), 2);
is('same city', placeTier({ city: 'cairo ', country: 'EG' }, me), 1);
is('same country', placeTier({ city: 'Giza', country: 'EG' }, me), 2);
is('elsewhere', placeTier({ city: 'Paris', country: 'FR' }, me), 3);

console.log('\npeople, inside the gate');
const people = rankPeople([
  { id: 'paris-3-mutuals', city: 'Paris', country: 'FR', mutuals: 3 },
  { id: 'cairo-hobby', city: 'Cairo', country: 'EG', hobbies: '🥾 Hiking' },
  { id: 'cairo-2-mutuals', city: 'Cairo', country: 'EG', mutuals: 2 },
  { id: 'cairo-nothing', city: 'Cairo', country: 'EG' },
  { id: 'near-now', seen: 'now', km: 1, city: 'Cairo', country: 'EG' },
], me);
is('nearby first, then mutuals beat a shared hobby, then the rest — and far away last however many mutuals',
  people.map((p) => p.id), ['near-now', 'cairo-2-mutuals', 'cairo-hobby', 'cairo-nothing', 'paris-3-mutuals']);
is('the why: mutual friends', whyText(people[1].why, t), '2 mutual friends');
is('the why: a shared hobby', whyText(people[2].why, t), 'You both like Hiking');
is('no why is invented', people[3].why, null);

console.log('\nplans, inside the map\'s edges');
const now = Date.parse('2026-10-10T12:00:00Z');
const at = (h) => new Date(now + h * 3600000).toISOString();
const plans = rankPlans([
  { id: 'football-soon', kind: 'sport', starts_at: at(3) },
  { id: 'walk-in-3-days', kind: 'walk', starts_at: at(70) },
  { id: 'opera-2-friends', kind: 'culture', starts_at: at(100), mates_going: 2 },
  { id: 'coffee-tomorrow', kind: 'coffee', starts_at: at(20) },
], me, now);
is('friends going first, then what you love, then the soonest', plans.map((g) => g.id), ['opera-2-friends', 'coffee-tomorrow', 'walk-in-3-days', 'football-soon']);
is('the why: friends going', whyText(plans[0].why, t), '2 of your friends are going');
is('the why: your kind of thing', whyText(plans[1].why, t), 'Your kind of thing');
is('a hobby maps to a kind', lovesKind('🥾 Hiking', 'walk') && lovesKind('🎬 Filmmaking', 'movie') && !lovesKind('🎮 Gaming', 'walk'), true);

const all = rankPlans([
  { id: 'w1', kind: 'walk', starts_at: at(5) }, { id: 'w2', kind: 'walk', starts_at: at(6) },
  { id: 'c1', kind: 'coffee', starts_at: at(7) }, { id: 'c2', kind: 'coffee', starts_at: at(8) },
  { id: 'c3', kind: 'coffee', starts_at: at(9) }, { id: 'art', kind: 'art', starts_at: at(10) },
], me, now);
is('one of the first four is something different', all.slice(0, 4).map((g) => g.id).includes('art'), true);
is('and it says so', whyText(all[3].why, t), 'Something new for you');

console.log('\nthe database and the screens');
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const part = sql.slice(sql.indexOf("PEOPLE · EVERYONE REAL, NOBODY'S EXACT SPOT"));
const map = fs.readFileSync('src/screens/MapScreen.js', 'utf8');
const panel = fs.readFileSync('src/components/MapPanel.js', 'utf8');
is('people come with mutual friends and hobbies', /as mutuals,/.test(part) && /p\.hobbies,/.test(part), true);
is('plans come with how many of your friends are going', /as mates_going,/.test(part), true);
is('people_you_may_know: only for yourself, never for anon', /uid = auth\.uid\(\)/.test(part) && /revoke execute on function public\.people_you_may_know\(uuid, int\) from public, anon;/.test(part), true);
is('the map ranks people and plans this way', /rankPeople\(withKm, meProfile\)/.test(map) && /rankPlans\(gatherings\.filter\(ok\), meProfile\)/.test(map), true);
is('every card can say why', (panel.match(/whyText\(/g) || []).length >= 3, true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nNear you first; inside that, friends and the things you love — and each card says why.');
