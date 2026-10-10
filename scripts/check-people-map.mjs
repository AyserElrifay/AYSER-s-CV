/* ─── THE PEOPLE LENS IS NEVER EMPTY, AND NEVER TOO EXACT ─────────────
   Ayser: "ليه people فاضيه … واحنا عندنا ٧٠ user حقيقي". It listed only
   somebody who had shared a live spot in the last half hour. Now it is
   the real people on Moments, each at the precision they agreed to:
   here now → their pin; this week → a spot rounded to ~1 km; everyone
   else → their city, and no spot at all.

       node scripts/check-people-map.mjs
*/
import fs from 'node:fs';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const fn = sql.slice(sql.indexOf('create or replace function public.people_on_map'));
const part = sql.slice(sql.indexOf("PEOPLE · EVERYONE REAL, NOBODY'S EXACT SPOT"));
const svc = read('src/services/locations.js');
const map = read('src/screens/MapScreen.js');
const panel = read('src/components/MapPanel.js');

console.log('the database');
is('everyone with a name, not only who is live', /from public\.profiles p\s+left join public\.live_locations l/.test(fn), true);
is('here now keeps the exact pin', /interval '30 minutes' then l\.lat/.test(fn), true);
is('this week is rounded to ~1 km', /interval '7 days'\s+then round\(l\.lat::numeric, 2\)/.test(fn) && /round\(l\.lng::numeric, 2\)/.test(fn), true);
is('older than a week: no spot at all', !/else l\.lat/.test(fn), true);
is('what somebody was doing is only shown while they are there', /then l\.doing end as doing/.test(fn), true);
is('only for people signed in', /where auth\.uid\(\) is not null/.test(fn) && /revoke execute on function public\.people_on_map\(double precision, double precision\) from public, anon/.test(sql), true);
is('you are not in your own list', /p\.id <> auth\.uid\(\)/.test(fn), true);
is('old exact positions are no longer readable by others', /for select to authenticated\s+using \(user_id = auth\.uid\(\) or updated_at > now\(\) - interval '30 minutes'\)/.test(part), true);

console.log('\nthe app');
is('the map asks for everyone', /rpc\('people_on_map'/.test(svc), true);
is('and before the database is updated, still everyone — from the profiles', /from\('profiles'\)/.test(svc.slice(svc.indexOf('people_on_map'))) && /from\('live_locations'\)/.test(svc.slice(svc.indexOf('people_on_map'))), true);
is('no "0 people" before the answer has come back', /loading \? t\('pp_people_title'\)/.test(panel) && /setPeopleLoaded\(true\)/.test(map), true);
is('and no "0 people on Moments" at all — an empty list says so in words', /!n \? t\('pp_people_none'\)/.test(panel), true);
is('a person without a spot has no pin', /coords: row\.lat != null && row\.lng != null \?/.test(map), true);
is('a this-week pin is drawn quieter', /away: p\.seen !== 'now'/.test(map) && /\.mm-away \{/.test(read('src/components/LeafletMap.js')), true);
is('no distance from the stand-in location', /km: p\.coords && located \? kmBetween/.test(map), true);
is('no route to a rounded spot', /if \(!p\.coords \|\| p\.seen !== 'now'\)/.test(map), true);
is('the People lens has its own panel', /lens === 'people' \? \(\s*<PeoplePanel/.test(map), true);
is('its count is the people it lists', /t\('pp_people_n'\)\.replace\('\{n\}', String\(n\)\)/.test(panel) && /const n = people\.length/.test(panel), true);
is('the empty campfire card is gone', /No live campfires/.test(map), false);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nEveryone real is on the People lens, and nobody is shown more exactly than they agreed to.');
