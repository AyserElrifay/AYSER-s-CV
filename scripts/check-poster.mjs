/* ─── NO VIDEO IS A BLACK RECTANGLE ──────────────────────────────────
   Ayser, twice: "ليه الفديوز من بره لونها اسود" and then "الفديوهات ...
   ما ينفعش يبقي اسود — خد صوره من الفديو. خلي في اوبشن الي نزل الفديو
   يقدر يعدل".

   Three things have to be true, and this checks all three:

     1. a clip with no cover gets one taken from itself, once, and
        kept — so the second viewing costs nothing;
     2. until that arrives, and if it never does, the card is a colour
        rather than black, because black reads as a video that failed
        and nobody taps those;
     3. the person who posted it can change the cover — and from their
        own profile, not only from the feed, which is the one place
        they are least likely to be looking at their own old clip.

       node scripts/check-poster.mjs
*/
import fs from 'node:fs';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got)
    + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const ok = (what, cond) => is(what, !!cond, true);

/* a localStorage, in six lines, so the cache can be tested without a
   browser */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { cachedPoster, derivePoster, forgetPoster, posterTint } = await import('../src/lib/poster.js');

console.log('the colour a coverless clip wears instead of black');
const a = posterTint('post-aaa');
const b = posterTint('post-bbb');
ok('it is a real colour', /^hsl\(\d+, 32%, 24%\)$/.test(a));
is('the same post is the same colour every time', posterTint('post-aaa'), a);
ok('a different post is a different colour', a !== b);
/* 24% lightness: dark enough for white text, nowhere near black. The
   whole complaint was that these tiles were black. */
const light = Number(a.match(/(\d+)%\)$/)[1]);
ok('and it is not black — ' + light + '% lightness', light >= 18 && light <= 32);

console.log('\nnothing is decoded where there is no browser');
is('deriving without a document is harmless', await derivePoster('x', 'http://e/v.mp4'), null);
is('and asks for nothing it has not got', cachedPoster('x'), null);

console.log('\nthe cache');
is('an unknown clip has nothing', cachedPoster('nope'), null);
store['mm.poster.v1'] = JSON.stringify({ 'post-1': 'data:image/jpeg;base64,AAAA' });
/* the module has already read the store once, so this proves the disk
   copy is consulted rather than only memory */
const fresh = await import('../src/lib/poster.js?reload=1');
is('one saved earlier comes back', fresh.cachedPoster('post-1'), 'data:image/jpeg;base64,AAAA');
fresh.forgetPoster('post-1');
is('and a new cover wipes the guess', fresh.cachedPoster('post-1'), null);

console.log('\none decode at a time, never ten at once');
const src = fs.readFileSync('src/lib/poster.js', 'utf8');
ok('there is a queue', /let chain = Promise\.resolve\(\)/.test(src));
ok('and every derive goes through it', /return queued\(async \(\) => \{/.test(src));
ok('a clip that cannot be read is not retried forever', /dead\.add\(id\)/.test(src));
ok('the cache is capped so it cannot grow without end', /while \(keys\.length > MAX\)/.test(src));

console.log('\nthe feed card');
const card = fs.readFileSync('src/components/PostCard.js', 'utf8');
ok('it asks for a still when the post has none', /derivePoster\(post\.id, post\.media\)/.test(card));
ok('it starts from whatever was already cached', /useState\(\(\) => cachedPoster\(post\.id\)\)/.test(card));
ok('the backdrop is a tint, not black', /backgroundColor: posterTint\(post\.id\)/.test(card));
ok('and nothing is left painted #15151B', !/#15151B/.test(card));
ok('the derived still is used as the poster', /poster=\{poster \|\| undefined\}/.test(card));
/* the saver decision has to count the derived one too, or a clip that
   now HAS a picture is still treated as if it has none */
ok('data saver counts it as a poster', /hasPoster: !!poster/.test(card));
ok('choosing a new cover drops the guess', /forgetPoster\(post\.id\); onSetCover/.test(card));

console.log('\nthe grid on your profile');
const prof = fs.readFileSync('src/screens/ProfileScreen.js', 'utf8');
ok('tiles derive a still as well', /derivePoster\(item\.id, item\.media\)/.test(prof));
ok('an empty tile is tinted, not near-black', /backgroundColor: posterTint\(item\.id\)/.test(prof));
ok('and #1B1B21 is gone from it', !/#1B1B21/.test(prof));

console.log('\nand the person who posted it can change the cover');
ok('from the feed', /onSetCover=\{onSetCover\}/.test(fs.readFileSync('src/screens/HomeScreen.js', 'utf8')));
ok('and from their own profile', /onSetCover=\{onSetCover\}/.test(prof));
ok('which really writes thumb_url', /updatePost\(post\.id, user\.id, \{ thumb_url: url \}\)/.test(prof));
/* the option is only ever offered on your own, and only on a video */
ok('the menu item is gated to your own videos',
   /onSetCover && isVideoPost\(post\) && post\.media/.test(card));

console.log('\nthe Chill tab, which drew its own video list');
const chill = fs.readFileSync('src/screens/ChillScreen.js', 'utf8');
ok('its videos use the same still-or-colour as the feed', /<VideoStill v=\{v\} \/>/.test(chill) && /derivePoster\(v\.id, v\.media\)/.test(chill));
/* the full-screen player stays black — that is a cinema, not a card */
ok('and no card in the list is painted #000 any more', !/aspectRatio: 16 \/ 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000'/.test(chill));
ok('tracks wear a drawn record, not the same emoji ten times', /<RecordCover seed=\{t\.title\}/.test(chill) && !/\{t\.emoji\}/.test(chill));
ok('a public-domain record does not claim a © it does not have', /public domain/i.test(chill) && !/' · © '/.test(chill));
ok('the mood survives to the sampler that picks across moods', /mood: t\.mood \|\| null/.test(chill));

if (bad) {
  console.log('\n' + bad + ' wrong. A video is still showing up as a black square.');
  process.exit(1);
}
console.log('\nEvery video card has a picture, or a colour. None of them is black.');
