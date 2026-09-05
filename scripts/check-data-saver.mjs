/* ─── NOBODY'S BUNDLE GETS SPENT WITHOUT THEM ─────────────────────────
   Ayser: "خلي يبقي في اوبشن data saver عشان متخلص نت الناس بhigh
   quality".

   A feed that autoplays everything it scrolls past can spend a monthly
   bundle in an afternoon, and the person it happens to never sees the
   moment it happened — they just notice the money is gone and the app
   was open. That is the kind of fault nobody reports as a bug and
   everybody punishes by deleting the app.

   The decision is one pure function, so the answers can be checked
   here rather than on somebody's data plan:

       node scripts/check-data-saver.mjs
*/
import fs from 'node:fs';
import { videoPolicy, isSaving, networkHint, DATA_MODES, DEFAULT_DATA_MODE } from '../src/lib/dataSaver.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
/* Browsers that answer the question, and the one that does not. */
const wifi     = { connection: { effectiveType: '4g', saveData: false, type: 'wifi' } };
const cellular = { connection: { effectiveType: '4g', saveData: false, type: 'cellular' } };
const slow     = { connection: { effectiveType: '2g', saveData: false } };
const asked    = { connection: { effectiveType: '4g', saveData: true } };
const silent   = {};   // Safari on iOS tells us nothing at all

console.log('what the browser says about the connection');
is('a bundle is a bundle', isSaving('auto', cellular), true);
is('a slow connection counts too', isSaving('auto', slow), true);
is('and a person who switched on their own data saver is obeyed', isSaving('auto', asked), true);
is('Wi-Fi plays', isSaving('auto', wifi), false);
is('a browser that says nothing is not treated as 2G', isSaving('auto', silent), false);
is('nor is one with no connection API at all', networkHint(silent).known, false);

console.log('\nand what the person chose beats all of it');
is('"saver" saves on Wi-Fi', isSaving('saver', wifi), true);
is('"high" plays on a bundle — their data, their call', isSaving('high', cellular), false);
is('"high" plays even with the browser asking to save', isSaving('high', asked), false);

console.log('\nwhat a video on a card is then allowed to do');
is('on Wi-Fi it may start when you stop on it', videoPolicy('auto', { nav: wifi }).autoplay, true);
is('on a bundle it does not', videoPolicy('auto', { nav: cellular }).autoplay, false);
is('and in saver mode it never does', videoPolicy('saver', { nav: wifi }).autoplay, false);
/* Reduce motion is an accessibility setting, not a preference about
   data — and it outranks both, because for some people a feed that
   moves by itself is unusable rather than expensive. */
is('"reduce motion" stops it whatever the connection',
   videoPolicy('high', { nav: wifi, reducedMotion: true }).autoplay, false);

console.log('\nhow much gets downloaded before you ask');
is('saving, with a still to show → nothing at all',
   videoPolicy('saver', { hasPoster: true }).preload, 'none');
/* This is the line that stops the fix from undoing the previous one:
   a clip with no still and preload="none" is a black rectangle, which
   is precisely what "ليه الفديوز من بره لونها اسود" was about. */
is('saving, with NO still → the header and one frame, not the film',
   videoPolicy('saver', { hasPoster: false }).preload, 'metadata');
is('not saving → metadata, never the whole file',
   videoPolicy('high', { hasPoster: true }).preload, 'metadata');

console.log('\nthe settings themselves');
is('three of them', DATA_MODES, ['auto', 'high', 'saver']);
is('and the default follows the connection', DEFAULT_DATA_MODE, 'auto');
is('an unknown setting behaves as auto rather than as nothing',
   isSaving('bananas', cellular), true);

console.log('\nand the app has to actually ask');
const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const card = code('src/components/PostCard.js');
is('the feed card asks for a policy', /videoPolicy\(/.test(card), true);
is('and uses it for preload', /preload=\{policy\.preload\}/.test(card), true);
is('and for whether it may play at all', /if \(!policy\.autoplay/.test(card), true);
is('a card only plays after you have stopped on it', /setTimeout\([\s\S]{0,400}?\}, 700\)/.test(card), true);
is('and it is always muted', /v\.muted = true/.test(card), true);
is('and stops when it leaves the screen', /v\.pause\(\)/.test(card), true);
for (const f of ['src/screens/ReelsScreen.js', 'src/components/ReelsViewer.js']) {
  const s = code(f);
  is(f.split('/').pop() + ' no longer pulls whole files down regardless', /preload="auto"/.test(s), false);
  is('  and decides from the setting instead', /isSaving\(/.test(s), true);
}
const prefs = code('src/services/prefs.js');
is('the choice is remembered', /dataSaver: 'auto'/.test(prefs), true);
const settings = code('src/screens/SettingsScreen.js');
is('and there is somewhere to make it', /setPref\('dataSaver'/.test(settings), true);
is('in every language, not just English', /t\('ds_title'\)/.test(settings), true);

if (bad) {
  console.log('\n' + bad + " wrong. Somebody's data bundle is being spent on videos they never asked to watch.");
  process.exit(1);
}
console.log('\nNothing plays, and nothing downloads, that somebody did not ask for.');
