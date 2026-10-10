/* ─── WHAT PEOPLE SHARED AT A PLACE, AND WHERE A POST BELONGS ─────────
       node scripts/check-place-voices.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const voices = read('src/components/PlaceVoices.js');
const compose = read('src/components/ComposeModal.js');
const map = read('src/screens/MapScreen.js');
const stories = read('src/services/stories.js');
is('a place shows live stories, photos and what people say', /fetchStoriesNearby/.test(voices) && /pv_live/.test(voices) && /moments_here/.test(voices) && /pv_say/.test(voices), true);
is('a heads-up is marked as one', /p\.intent === 'warning'/.test(voices) && /pv_heads_up/.test(voices), true);
is('only stories still live', /\.gt\('expires_at', new Date\(\)\.toISOString\(\)\)/.test(stories.slice(stories.indexOf('fetchStoriesNearby'))), true);
is('both the real places and the curated ones have it', /<PlaceVoices place=\{placeOpen\}/.test(map) && /<PlaceVoices place=\{destOpen\}/.test(map), true);
is('"share it here" opens the composer on that place', /setComposeAt\(\{ name: pl\.name, lat: pl\.lat, lng: pl\.lng \}\)/.test(map) && /initialPlace=\{composeAt\}/.test(map), true);
is('the post carries the place\'s real spot', /lat: spot \? spot\.lat : null/.test(compose), true);
is('a renamed place drops the spot — a typed name is not a spot', /place\.trim\(\) === String\(initialPlace\.name \|\| ''\)\.trim\(\)/.test(compose), true);
is('your own location only when you ask', /const \[here, setHere\] = useState\(null\)/.test(compose) && /onPress=\{pinHere\}/.test(compose), true);
is('a tall place sheet scrolls', /a place with stories, photos and words is taller than a phone: it scrolls/.test(map), true);
const whatson = read('src/services/whatson.js');
const sheet = read('src/components/WhatsOnSheet.js');
is('"What you can join" asks for the plans the map shows', /settle\(listGatherings\(null\)\)/.test(whatson) && /c\.kind === 'plan' \? renderPlan\(c\)/.test(sheet) && /p\.kind === 'plan' \? renderPlan\(p\)/.test(sheet), true);
is('a heads-up is never offered as something to join', /p\.intent !== 'warning'/.test(whatson), true);
is('and joins them for real', /joinGathering\(x\.id, true\)/.test(sheet), true);
if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nA place shows what people really shared there, and a post can belong to the place.');
