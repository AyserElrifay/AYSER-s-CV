/* ─── A VIDEO IN THE FEED ─────────────────────────────────────────────
   Two faults lived on the same card, both of them on every video ever
   posted, and neither had anything to catch it.

   The first said so out loud: the chip read "▶ WATCH · undefined",
   because it was built as `'▶ WATCH · ' + post.duration` and nothing —
   not the table, not the query, not toCard — ever carried a duration.
   Adding a word to a missing thing is legal JavaScript, so it printed
   the name of the absence onto the photo.

   The second said nothing at all, which is worse: the card handed the
   .mp4 URL to an <Image>. An Image given a video draws NOTHING. Every
   video in the feed was a dark empty box, and Ayser asked why — "ليه
   الفديوز من بره لونها اسود". The profile grid had already learned this
   lesson and left a comment about it; the feed never got the message.

   Both are checkable without a browser, a phone or a video file:

       node scripts/check-video-card.mjs
*/
import fs from 'node:fs';
import { clockLabel, watchLabel } from '../src/lib/clock.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const src = (f) => fs.readFileSync(f, 'utf8');
/* Comments explain the fault, so they quote it — this one quotes the
   exact line it exists to forbid. Read the code without them. */
const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('the length, written the way a person reads a clock');
is('under a minute', clockLabel(41), '0:41');
is('two forty-one', clockLabel(161), '2:41');
is('ten past the ten-minute mark', clockLabel(605), '10:05');
is('over an hour, and the hour shows', clockLabel(3725), '1:02:05');
is('rounds rather than truncates the half second', clockLabel(59.6), '1:00');

console.log('\nand when there is no length — the whole reason this exists');
is('missing', clockLabel(undefined), null);
is('null', clockLabel(null), null);
is('zero is not a length', clockLabel(0), null);
is('nor is a negative one', clockLabel(-5), null);
is('nor a word', clockLabel('later'), null);
is('nor infinity, which a streaming file really does report', clockLabel(Infinity), null);

console.log('\nthe chip itself');
is('with a length', watchLabel(161), '▶ WATCH · 2:41');
is('WITHOUT one it says WATCH, not the word undefined', watchLabel(null), '▶ WATCH');
is('and never contains it', /undefined/.test(watchLabel(undefined)), false);

console.log('\nthe card must not go back to gluing a missing field on');
const card = code('src/components/PostCard.js');
is('no string-plus-duration anywhere in it', /['"`]\s*\+\s*post\.duration\b|post\.duration\s*\+/.test(card), false);
is('it asks clock.js for the label instead', /watchLabel\(/.test(card), true);

console.log('\nand it must not hand a video to an <Image>');
/* The one ImageBackground left takes `still`, and `still` is only ever
   a picture: the uploaded thumbnail, or the media of a post that is not
   a video. That is the whole fix, so it is what gets asserted. */
is('only one ImageBackground draws the media', (card.match(/<ImageBackground/g) || []).length, 1);
is('and it is given the still, never post.media', /<ImageBackground source={{ uri: still }}/.test(card), true);
is('a video with no still is painted by a real <video>', /<video/.test(card), true);
is('seeked past zero so a frame actually gets painted', /#t=0\.1/.test(card), true);
is("and it doesn't swallow the tap that opens the player", /pointerEvents: 'none'/.test(card), true);

console.log('\nthe still and the length have to REACH the card');
const feed = code('src/hooks/useFeed.js');
is('toCard maps thumb_url', /thumb: row\.thumb_url/.test(feed), true);
is('toCard maps duration_sec', /durationSec: .*row\.duration_sec/.test(feed), true);

console.log('\nand something has to put them there in the first place');
const posts = code('src/services/posts.js');
const capture = code('src/components/CaptureModal.js');
is('createPost takes a durationSec', /createPost\({[^}]*durationSec/.test(posts), true);
is('and writes it to duration_sec', /duration_sec: /.test(posts), true);
is('the capture screen measures the clip', /noteLength\(el\)/.test(capture), true);
is('a posted video carries its length', (capture.match(/thumbUrl, durationSec|thumbUrl,\s*durationSec/g) || []).length >= 1, true);
is('the reel does too', /type: 'reel'[^}]*durationSec/.test(capture), true);

console.log('\nand the database has somewhere to keep it');
const sql = src('supabase/RUN_ME.sql');
is('posts.duration_sec exists', /alter table public\.posts add column if not exists duration_sec/.test(sql), true);

if (bad) {
  console.log('\n' + bad + " wrong. A video in the feed is a black box, or it is telling somebody its length is 'undefined'.");
  process.exit(1);
}
console.log('\nA video shows a frame, and says how long it is — or says nothing.');
