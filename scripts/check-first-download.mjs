/* ─── THE FIRST DOWNLOAD HAS A CEILING ───────────────────────────────
   The app was cut into pieces that arrive when they are opened. Two
   things quietly put it back together again, and neither shows up in
   review:

   1. A BARREL IMPORT. `src/components/index.js` used to re-export all
      82 components, so `import { Glass } from '../components'` pulled
      in the camera, five games and a 3-D city — including one nobody
      rendered at all. Deleting the file is not enough; somebody will
      write another. So: no module in src/ may import a directory.

   2. A NEW EAGER IMPORT of something big. Splitting only works if
      EVERY screen defers a shared piece — Metro puts anything two
      chunks need back in the main file — so one ordinary-looking
      `import { CaptureModal } from …` undoes the camera's split for
      everybody, silently, with the chunk still there at 0 bytes.

   Neither is caught by anything else, and both cost about a second of
   staring at nothing on a phone. So the number is checked.

       node scripts/check-first-download.mjs [dist]

   The size half only runs when a build is there to measure, which is
   why the build step in CI comes first. */
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const CEILING = 2_100_000;   // bytes, the main bundle only

let bad = 0;
const fail = (m) => { console.log('  ' + m); bad++; };

// ── 1 · nobody imports a directory ──────────────────────────────────
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})('src');

const BARREL = /from\s+'(\.{1,2}(?:\/\.\.)*\/(?:components|screens|services|hooks|lib|constants))'/;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const [i, line] of src.split('\n').entries()) {
    const m = line.match(BARREL);
    if (m) fail(f + ':' + (i + 1) + '  imports the whole of ' + m[1] + ' — name the file instead');
  }
}
if (existsSync('src/components/index.js')) {
  fail('src/components/index.js is back. One import of it puts every component in the first download.');
}

// ── 2 · the main bundle stays under the ceiling ─────────────────────
const dist = process.argv[2] || 'dist';
const web = join(dist, '_expo', 'static', 'js', 'web');
let measured = null;
if (existsSync(web)) {
  const entry = readdirSync(web).find((n) => /^AppEntry-.*\.js$/.test(n));
  if (!entry) fail('no AppEntry bundle in ' + web + ' — did the export run?');
  else {
    measured = statSync(join(web, entry)).size;
    if (measured > CEILING) {
      fail('the first download is ' + Math.round(measured / 1024) + ' KB, over the '
           + Math.round(CEILING / 1024) + ' KB ceiling by ' + Math.round((measured - CEILING) / 1024) + ' KB.');
      fail('Something big went back into it. `ls -l ' + web + '` — a chunk at 0 bytes is the tell:');
      fail('it means two screens still import that piece the eager way, so Metro moved it back.');
    }
  }
}

if (bad) {
  console.log('\nThe first download is what somebody waits for before anything appears.');
  process.exit(1);
}
console.log('Checked ' + files.length + ' files: nothing imports a whole directory'
  + (measured === null ? ' (no build here to measure)'
     : ', and the first download is ' + Math.round(measured / 1024) + ' KB of the '
       + Math.round(CEILING / 1024) + ' KB allowed') + '.');
