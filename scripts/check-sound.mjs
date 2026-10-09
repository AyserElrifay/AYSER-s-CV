/* ─── WHOSE SOUND IT IS, AND WHO MAY USE IT ───────────────────────────
   "خلي الفديوز ليها سوندرز و الناس ممكن تسمح او تلغي ده ان الناس تreuse
   sound و تعمل بيه فديو تاني".

   Two things get called "the sound of a video" and the rules are not
   the same: a track from the hub is licensed and free to anybody, and
   the original recording belongs to whoever filmed it. Getting that
   backwards means either handing somebody's voice to strangers, or
   locking a royalty-free song nobody needs locking.

   The whole decision is pure functions, so it is checked here rather
   than by posting a reel and hoping:

       node scripts/check-sound.mjs
*/
import fs from 'node:fs';
import { soundOfPost, canReuse, reuseSound, soundCredit } from '../src/lib/sound.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};

const reel = (extra) => ({ id: 'p1', type: 'reel', media_url: 'https://cdn/x.mp4',
  user: { name: 'Ayser' }, ...extra });

console.log('which of the two sounds a video has');
is('a track somebody chose is a track', soundOfPost(reel({ sound_title: 'Desert Line', sound_artist: 'Nadia' })).kind, 'track');
is('and it is credited to the artist', soundOfPost(reel({ sound_title: 'Desert Line', sound_artist: 'Nadia' })).artist, 'Nadia');
is('a video with no track has its own sound', soundOfPost(reel()).kind, 'original');
is('credited to the person who filmed it', soundOfPost(reel()).artist, 'Ayser');
is('and the video file is the audio — no second copy stored',
   soundOfPost(reel()).url, 'https://cdn/x.mp4');
is('a photo has no sound at all', soundOfPost({ id: 'p2', type: 'post', media_url: 'x.jpg' }), null);
is('nor does nothing', soundOfPost(null), null);

console.log('\nand who may build on it');
/* A real track row carries its file. One without a file cannot be
   filmed against whatever its licence says, and that is the next
   line. */
is('a hub track is free to anybody — that is what the hub is for',
   canReuse(soundOfPost(reel({ sound_title: 'Desert Line', sound_url: 'https://cdn/song.mp3' }))), true);
is('but a track with no file to play is not reusable, licence or not',
   canReuse(soundOfPost(reel({ sound_title: 'Desert Line' }))), false);
is('an original sound is open unless they said otherwise',
   canReuse(soundOfPost(reel())), true);
is('and closed the moment they say so',
   canReuse(soundOfPost(reel({ sound_reuse: false }))), false);
/* The switch is on the POST, so it is honoured everywhere the sound
   turns up — not only on the screen that shows the switch. */
is('the closed sound offers nothing to reuse', reuseSound(soundOfPost(reel({ sound_reuse: false }))), null);
is('a sound with no file is not reusable either', canReuse({ kind: 'original', url: null }), false);

console.log('\nwhat gets attached to the video somebody makes with it');
const taken = reuseSound(soundOfPost(reel()));
is('the file to film against', taken.audio_url, 'https://cdn/x.mp4');
is('the credit travels with it', taken.artist, 'Ayser');
/* This is the column that makes "made with this sound" a real list
   rather than a guess based on two titles matching. */
is('and which video it came from', taken.soundPostId, 'p1');
is('a hub track points at no post',
   reuseSound(soundOfPost(reel({ sound_title: 'Desert Line', sound_url: 'https://cdn/song.mp3' }))).soundPostId, null);

console.log('\nthe credit line');
is('an original names the person', soundCredit(soundOfPost(reel())), 'Original sound · Ayser');
is('a track names the song and the artist',
   soundCredit(soundOfPost(reel({ sound_title: 'Desert Line', sound_artist: 'Nadia' }))), 'Desert Line · Nadia');
is('and nothing does not throw', soundCredit(null), '');

console.log('\nand the app has to carry it');
const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const posts = code('src/services/posts.js');
is('a post records whether its sound is open', /sound_reuse:/.test(posts), true);
is('and which sound it was made with', /sound_post_id:/.test(posts), true);
const capture = code('src/components/CaptureModal.js');
is('the camera can open with a sound already attached', /initialSound/.test(capture), true);
is('and asks whether the recording may be reused', /setSoundReuse/.test(capture), true);
/* the Reels tab was removed (no endless video feed); a single clip
   still opens in ReelsViewer, which is checked for data saving */
const sheet = code('src/components/SoundSheet.js');
is('the sheet lists what was made with it', /fetchSound\(/.test(sheet), true);
is('the switch is only for the person who recorded it', /mine && sound\.kind === 'original'/.test(sheet), true);
is('and a closed sound says so instead of hiding the button', /sound_closed/.test(sheet), true);
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
is('the database has the switch', /add column if not exists sound_reuse boolean not null default true/.test(sql), true);
is('and the link back to the original', /add column if not exists sound_post_id uuid/.test(sql), true);

if (bad) {
  console.log('\n' + bad + " wrong. Somebody's own recording is being handed out, or a free track is locked.");
  process.exit(1);
}
console.log('\nA track is everybody\'s. A recording is theirs, and the switch is honoured.');
