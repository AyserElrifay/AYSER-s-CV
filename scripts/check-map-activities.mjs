/* ─── THE MAP, THE FEED AND THE FIRST SCREEN TELL THE TRUTH ───────────
   Ayser: "الخريطه و الفيد يبقو مترابطين", "اكتفيتز و صورهم عليها و
   شكلها colourful playful", and a welcome page like the competitors'.

   What this holds in place:
     · an activity on the map is a real gathering at a real point, its
       count is the real number going, never padded;
     · a post with a place opens the map at that place, and the map
       takes the spot whenever it mounts;
     · a post without a place says nothing about where — the old
       "Somewhere out there" and the fake "your location" are gone;
     · the join sheet promises nothing it cannot do: no invented rides,
       prices or traffic;
     · the welcome page shows no member counts.

       node scripts/check-map-activities.mjs
*/
import fs from 'node:fs';
import { activityPin, titleFor, whenFor, lookOf } from '../src/lib/activityPins.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got) + ' (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

console.log('an activity pin is the gathering, and only the gathering');
const g = { id: 'g5', kind: 'culture', title: 'Opera night · ليلة أوبرا', lat: 30.0424, lng: 31.2243, starts_at: '2026-10-15T16:30:00Z', going: 3, im_going: true };
const pin = activityPin(g, 'en');
is('it stands where it meets', [pin.lat, pin.lng], [30.0424, 31.2243]);
is('the count is the count', pin.going, 3);
is('a missing count is zero, not a guess', activityPin({ ...g, going: null }, 'en').going, 0);
is('a broken count is zero', activityPin({ ...g, going: 'lots' }, 'en').going, 0);
is('English readers get the English half', titleFor(g.title, 'en'), 'Opera night');
is('Arabic readers get the Arabic half', titleFor(g.title, 'ar'), 'ليلة أوبرا');
is('a one-language title is left alone', titleFor('Ceramics at Kampa', 'cs'), 'Ceramics at Kampa');
is('the time is Cairo time, where the door is', whenFor('2026-10-15T16:30:00Z', 'en'), 'Thu 19:30');
is('every kind has a colour and a drawing', ['culture', 'walk', 'sport', 'art', 'circle', 'cleanup', 'project'].every((k) => lookOf(k).emoji && lookOf(k).from), true);
is('the tilt stays the same for the same gathering', activityPin(g, 'en').tilt, activityPin(g, 'ar').tilt);

console.log('\nonly a real point goes on the map');
const map = read('src/screens/MapScreen.js');
is('gatherings without a point are skipped', /gatherings\.forEach\(\(g\) => g\.lat != null && g\.lng != null && out\.push\(activityPin/.test(map), true);
const sql = read('supabase/RUN_ME.sql');
is('the weekly plans carry their place to the week', /\(kind, title, about, country, city, place_name, lat, lng, starts_at/.test(sql), true);
is('Madinaty has no guessed point', !/'Madinaty Central Park',\s*\d/.test(sql), true);

console.log('\nin this area means on the screen');
is('the count is the list on the screen', /t\('map_in_area'\)\.replace\('\{n\}', String\(inView\.length\)\)/.test(map), true);
is('and the list is what is inside the map\'s edges', /g\.lat <= view\.n && g\.lat >= view\.s && g\.lng <= view\.e && g\.lng >= view\.w/.test(map), true);
is('with your location known, the dive lands on your neighbourhood', /const near = locateRef\.current && c\.latitude != null \? 13 : 7;/.test(fs.readFileSync('src/components/LeafletMap.js', 'utf8')), true);

console.log('\nthe feed and the map are one place');
const card = read('src/components/PostCard.js');
const bus = read('src/lib/mapBus.js');
const tabs = read('src/navigation/SwipeTabs.js');
is('a post with a place has "show on the map"', /showOnMap\(\{ lat: post\.coords\.latitude, lng: post\.coords\.longitude, postId: post\.id \}\)/.test(card), true);
is('the tab in front moves to the map', /onMapTarget\(\(\) => \{ if \(nav\.isFocused\(\) && name !== 'MAP'\) nav\.navigate\('MAP'\)/.test(tabs), true);
is('the map takes a spot asked for before it existed', /go\(takeMapTarget\(\)\);/.test(map), true);
is('and opens that moment once its pin is there', /if \(p\) \{ setWantMoment\(null\); openMomentPin\(p\); \}/.test(map), true);
is('a spot is taken once', /pending = null;\s*return t;/.test(bus), true);

console.log('\nnothing invented about where a post is');
for (const f of ['src/hooks/useFeed.js', 'src/components/ComposeModal.js', 'src/components/ProfileModal.js', 'src/components/NotificationsSheet.js', 'src/screens/ProfileScreen.js', 'src/components/CaptureModal.js']) {
  const s = read(f);
  is(f + ': no made-up place', !/Somewhere out there|'Right here'/.test(s), true);
  is(f + ': no made-up coordinates', !/coords: ME\.coords|: ME\.coords,/.test(s), true);
}

console.log('\njoining promises only what it does');
const join = code('src/components/MagicFlowModal.js');
is('no rides, prices or traffic', !/RIDES|YalaGo|Yala Go|light traffic|E£|squad created/i.test(join), true);
is('no distance from a made-up spot', !/ME\.coords/.test(join), true);
is('no location prompt just to join', /st\.state === 'granted' \? await getCurrentCoords\(\) : null/.test(join), true);

console.log('\nthe welcome page claims nothing');
const wel = code('src/components/Welcome.js');
is('no member counts', !/\d[\d,.]*\s*(k|K|M|\+)?\s*(people|users|members|travellers)/.test(wel) && !/count|total/.test(wel), true);
is('our own drawing, no stock photos', !/https?:\/\/|require\(.*\.(png|jpe?g)/.test(wel), true);
is('the form has a way back to it', /setWelcome\(true\)/.test(read('src/screens/AuthScreen.js')), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nThe map shows what is on, where it is; the feed leads to it; nothing on the way is made up.');
