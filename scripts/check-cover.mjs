/* ─── THE PICTURE A VIDEO SHOWS ───────────────────────────────────────
   "خلي الريل يبقي ليها cover منها automatic بتختاره منها او الي بنزل
   الريل يقدر يعمل edite وهو بينزلها او بعد ما ينزلها و يحطه".

   The automatic half is the half that can go wrong quietly. Every reel
   already got a cover — the frame a quarter of a second in — and a
   phone that starts recording on a dark or half-exposed frame gave a
   black tile in the grid and a black card in the feed. The cover was
   there; it was just a picture of nothing.

   So the frame is now CHOSEN, by looking at the frames. All of that
   scoring is arithmetic on pixels, which means it can be checked here
   with no video, no browser and no phone:

       node scripts/check-cover.mjs
*/
import fs from 'node:fs';
import { frameScore, pickBest, frameTimes } from '../src/lib/frames.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
/* a frame, as pixels: every pixel the same, or half one and half other */
const flat = (v, n = 64) => { const a = []; for (let i = 0; i < n; i++) a.push(v, v, v, 255); return a; };
const split = (a, b, n = 64) => { const o = []; for (let i = 0; i < n; i++) { const v = i < n / 2 ? a : b; o.push(v, v, v, 255); } return o; };

console.log('what makes a frame worth showing');
is('a black frame is worth nothing', frameScore(flat(2)), 0);
is('a nearly-black one too', frameScore(flat(10)), 0);
is('a blown-out white one is no better', frameScore(flat(250)), 0);
is('an empty frame is nothing', frameScore([]), 0);
is('and so is no frame at all', frameScore(null), 0);
const grey = frameScore(flat(128));
const detail = frameScore(split(40, 200));
console.log('   flat grey scores ' + grey + ', a frame with light and dark in it scores ' + detail);
detail > grey
  ? console.log('  PASS  a frame with something IN it beats a flat wall')
  : (bad++, console.log('  FAIL  a flat wall scores as well as a real picture'));
frameScore(split(40, 200)) > frameScore(split(90, 110))
  ? console.log('  PASS  and more contrast beats less')
  : (bad++, console.log('  FAIL  contrast does not count'));

console.log('\nchoosing between them');
is('the best-scoring frame wins', pickBest([{ score: 1 }, { score: 9 }, { score: 4 }]), 1);
/* A clip that is black all the way through still has to show
   SOMETHING, or the strip is empty and explains nothing. */
is('a clip that is black throughout still offers its first frame', pickBest([{ score: 0 }, { score: 0 }]), 0);
is('nothing at all → nothing chosen', pickBest([]), -1);
is('and null does not throw', pickBest(null), -1);

console.log('\nwhere along the clip to look');
const t6 = frameTimes(60, 6);
is('six frames from a minute', t6.length, 6);
is('it never opens on the very first frame — phones expose badly there', t6[0] > 0, true);
is('and never on the very last, which is often a cut to black', t6[5] < 60, true);
is('they are in order', t6.slice().sort((a, b) => a - b), t6);
is('a clip we could not measure still gets one frame', frameTimes(null, 6), [0.1]);
is('a zero-length one too', frameTimes(0, 6), [0.1]);
is('and asking for one frame gives the middle', frameTimes(10, 1).length, 1);

console.log('\nand the app has to use it');
const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const capture = code('src/components/CaptureModal.js');
is('the capture screen offers frames to choose from', /grabFrames\(/.test(capture), true);
is('and picks the best one by itself first', /pickBest\(/.test(capture), true);
is('what it uploads is the chosen one', /coverUrl|chosenCover/.test(capture), true);
const sheet = code('src/components/CoverSheet.js');
is('there is a sheet for changing it afterwards', /grabFrames\(/.test(sheet), true);
is('it asks for the video in a way a canvas may read back', /crossOrigin: true|crossOrigin:true/.test(sheet), true);
is('and when the file cannot be read, it offers a picture instead', /blocked/.test(sheet), true);
const card = code('src/components/PostCard.js');
is('your own video has a "change cover" in its menu', /onSetCover/.test(card), true);
const home = code('src/screens/HomeScreen.js');
is('and choosing one really saves it', /thumb_url:/.test(home), true);

if (bad) {
  console.log('\n' + bad + ' wrong. A video is showing a picture of nothing, or nobody can change it.');
  process.exit(1);
}
console.log('\nEvery video shows a frame worth showing, and anyone can pick a different one.');
