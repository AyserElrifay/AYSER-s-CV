/* ─── A LONG VIDEO HAS TO BE ALLOWED TO BE LONG ──────────────────────
   Ayser: "انا رفعت فيديو طويل مش باينلي ولا راضي يترفع".
   He was right, and nothing in this repository could have caught it:
   the three-minute reel cap was being applied to the long-form Video
   tab as well, so anything longer went to the compressor — which
   re-records by playing the file back in REAL TIME and stops at the
   cap. Posting a ten-minute video meant waiting ten minutes to get
   three minutes of it, or being told "a reel goes up to 3" about a
   video posted to the tab whose entire point is that it is long.

   Catching that used to need a real twenty-minute file in a real
   browser, which is why it survived. The decision is now one pure
   function and this is five lines that ask it the questions.

       node scripts/check-video-plan.mjs
*/
import fs from 'node:fs';
import { videoPlan, VIDEO_LIMITS } from '../src/lib/videoCompress.js';
const { SHRINK_MAX_SECONDS } = VIDEO_LIMITS;
/* Read as text on purpose: the one thing that cannot be asserted from
   videoPlan alone is that the CALLER tells compressVideo the real
   length. Get that wrong and a long film is silently cut to three
   minutes and uploads perfectly. */
const capture = fs.readFileSync('src/components/CaptureModal.js', 'utf8');

const MB = 1024 * 1024;
const MAX = 200 * MB;                      // the bucket's real ceiling
const { REEL_MAX_SECONDS, TARGET_BYTES } = VIDEO_LIMITS;

let bad = 0;
const is = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + got + (ok ? '' : '  (wanted ' + want + ')'));
  if (!ok) bad++;
};

console.log('long-form — the tab whose whole point is length');
is('a 12-minute, 80MB video goes up as it is',
   videoPlan({ bytes: 80 * MB, seconds: 12 * 60, longForm: true, maxBytes: MAX }).action, 'send');
is('a 2-hour, 150MB video goes up as it is',
   videoPlan({ bytes: 150 * MB, seconds: 7200, longForm: true, maxBytes: MAX }).action, 'send');
is('and is never re-encoded, whatever its length',
   videoPlan({ bytes: 199 * MB, seconds: 5400, longForm: true, maxBytes: MAX }).action, 'send');
/* Over the ceiling it is now SHRUNK rather than refused — but the
   thing this line was really guarding still holds and still matters:
   it must never be silently CUT. That is asserted below, on the caller,
   because the cutting would happen there and not here. */
is('over the real ceiling a ten-minute clip is shrunk, not refused',
   videoPlan({ bytes: 260 * MB, seconds: 600, longForm: true, maxBytes: MAX }).action, 'shrink');
is('and one too long to re-encode is still refused rather than started',
   videoPlan({ bytes: 260 * MB, seconds: 3600, longForm: true, maxBytes: MAX }).action, 'refuse');

console.log('\nreels — three minutes, and that stays true');
is('a 12-minute reel is shrunk',
   videoPlan({ bytes: 80 * MB, seconds: 12 * 60, longForm: false, maxBytes: MAX }).action, 'shrink');
is('a short but heavy reel is shrunk',
   videoPlan({ bytes: (TARGET_BYTES / MB + 10) * MB, seconds: 30, longForm: false, maxBytes: MAX }).action, 'shrink');
is('a short, light reel goes as it is',
   videoPlan({ bytes: 8 * MB, seconds: 20, longForm: false, maxBytes: MAX }).action, 'send');
is('exactly at the cap is still a reel',
   videoPlan({ bytes: 8 * MB, seconds: REEL_MAX_SECONDS, longForm: false, maxBytes: MAX }).action, 'send');
is('one second over it is not',
   videoPlan({ bytes: 8 * MB, seconds: REEL_MAX_SECONDS + 1, longForm: false, maxBytes: MAX }).action, 'shrink');

console.log('\nthe library, which is reachable from the long-form tab');
/* it treats a clip as long-form exactly when it IS long, so a heavy
   short clip is still shrunk and a long one is never cut */
const library = (bytes, seconds) => videoPlan({
  bytes, seconds, longForm: seconds != null && seconds > REEL_MAX_SECONDS, maxBytes: MAX,
}).action;
is('a 12-minute clip is kept whole', library(80 * MB, 12 * 60), 'send');
is('a heavy 30-second clip is still shrunk', library(90 * MB, 30), 'shrink');
is('a light 30-second clip is left alone', library(6 * MB, 30), 'send');
/* ── OVER THE CEILING: SHRINK, DO NOT REFUSE ──────────────────────────
   This used to assert 'refuse', and refusing was the wrong answer. A
   157MB clip came back "Could not start the upload (HTTP 413)" and the
   person was simply stuck. Now anything over the ceiling is re-encoded
   first, and the only thing still refused is a clip so long that
   re-encoding it in a browser — which runs at about real time — would
   take longer than anybody would sit through. */
is('one over the ceiling is SHRUNK, not refused', library(260 * MB, 900), 'shrink');
is('a 157MB two-minute clip is shrunk', library(157 * MB, 120), 'shrink');
is('and only a clip too long to re-encode is refused',
   library(260 * MB, SHRINK_MAX_SECONDS + 60), 'refuse');
is('a long clip UNDER the ceiling is still kept whole',
   library(80 * MB, SHRINK_MAX_SECONDS + 60), 'send');

/* The reason this matters more than it looks: compressVideo defaults
   its maxSeconds to the three-minute reel cap, so routing a long video
   through it without passing the real duration would CUT the film and
   hand back something that uploads perfectly and is wrong. */
is('shrinking a long clip must be told the real length',
   /maxSeconds: longForm && seconds/.test(capture) ? 'passes' : 'missing', 'passes');

console.log('\nand a file we could not measure');
is('unknown length, small enough → send',
   videoPlan({ bytes: 5 * MB, seconds: null, longForm: false, maxBytes: MAX }).action, 'send');

if (bad) {
  console.log('\n' + bad + ' wrong. Somebody\'s video is being cut, refused, or made to wait for a re-encode it does not need.');
  process.exit(1);
}
console.log('\nA long video stays long, and a reel stays three minutes.');
