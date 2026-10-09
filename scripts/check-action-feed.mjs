/* ─── THE FEED ENDS IN SOMETHING TO DO ────────────────────────────────
   "Action-oriented feed: only posts tied to a place or an event, every
   post with a primary button. No endless feeds, no reels."

       node scripts/check-action-feed.mjs
*/
import fs from 'node:fs';
import { isActionPost, actionOf, actionFeed, FEED_MAX } from '../src/lib/actionFeed.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');

console.log('what belongs in the feed');
is('a post with a place', isActionPost({ place: 'Cairo Opera House' }), true);
is('a post pinned on the map', isActionPost({ coords: { latitude: 1, longitude: 2 } }), true);
is('a plan with a time', isActionPost({ joinable: true }), true);
is('a travel plan', isActionPost({ plan: { to: 'Tallinn' } }), true);
is('a photo of nowhere in particular is not', isActionPost({ caption: 'mood', place: '  ' }), false);
is('an advert is not', isActionPost({ sponsored: true, place: 'Mall' }), false);
is('something to join says join', actionOf({ joinable: true, place: 'x' }), 'join');
is('a place says make a plan here', actionOf({ place: 'x' }), 'hangout');
is('the feed stops at thirty', actionFeed(Array.from({ length: 50 }, (_, i) => ({ id: i, place: 'p' }))).length, FEED_MAX);

console.log('\nand the app keeps to it');
const feed = read('src/hooks/useFeed.js');
is('the feed is filtered on the way in', /all: actionFeed\(/.test(feed) && /return actionFeed\(c\.posts\)/.test(feed), true);
is('no adverts are mixed in', !/injectAds|fetchFeedAds/.test(feed), true);
is('a new moment needs a place', /feed_need_place/.test(read('src/components/ComposeModal.js')), true);
is('every card that is not an event offers to make it one', /onHangoutHere\(post\)/.test(read('src/components/PostCard.js')), true);
is('the feed has an end, and it points out of the feed', /ListFooterComponent=/.test(read('src/screens/HomeScreen.js')) && /goToTab\('TOGETHER'\)/.test(read('src/screens/HomeScreen.js')), true);
is('a clip opens alone, never swiping into the next', /reels=\{\[reels\[reelStart\]\]\}/.test(read('src/screens/HomeScreen.js')), true);
is('no reel or long-video mode in the camera', /\['story'\]\.map\(\(m\)/.test(read('src/components/CaptureModal.js')), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nEvery moment in the feed is somewhere you could go, and the feed ends.');
