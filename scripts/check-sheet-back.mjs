/* ─── A SHEET HAS TO BE CLOSEABLE ─────────────────────────────────────
   Ayser, on a sheet he could not get rid of: "مهما بعمل swip ما
   بتنقفلس ولا بتعمل back".

   Two separate faults, both worth stating precisely:

   1. The phone's back gesture did nothing. This app runs installed, so
      back is the BROWSER's back, and the browser knows nothing about a
      sheet opened by setting a state variable to true. Back therefore
      either did nothing or left the app entirely.

   2. Every sheet drew a small grey bar at the top — which in every
      other app on that phone means "drag me down to close me" — and it
      was four pixels of decoration. A control that looks like a control
      and does nothing teaches somebody the app is broken.

       node scripts/check-sheet-back.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { pushSheet, sheetDepth, resetSheets } from '../src/lib/sheetBack.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};

/* A browser's history, in thirty lines, so the stack can be tested
   without one. pushState adds an entry; back pops it and fires
   popstate, exactly as the real thing does. */
const listeners = [];
let depth = 0;
globalThis.window = {
  history: {
    pushState() { depth++; },
    back() { if (depth > 0) { depth--; listeners.forEach((f) => f()); } },
  },
  addEventListener(name, fn) { if (name === 'popstate') listeners.push(fn); },
};

console.log('one sheet');
resetSheets();
let closed = 0;
let release = pushSheet(() => { closed++; });
is('opening it leaves a mark in the history', depth, 1);
window.history.back();                       // the phone's back gesture
is('back closes it', closed, 1);
is('and the stack is empty again', sheetDepth(), 0);

console.log('\nand when it is closed by its own button instead');
resetSheets(); depth = 0; closed = 0;
release = pushSheet(() => { closed++; });
release();
is('the close handler is not called twice', closed, 0);
is('the history mark is taken back off', depth, 0);
is('so a later back does not close a sheet that is already gone',
   (() => { window.history.back(); return closed; })(), 0);

console.log('\ntwo sheets, one on top of the other');
resetSheets(); depth = 0;
const log = [];
const r1 = pushSheet(() => log.push('under'));
const r2 = pushSheet(() => log.push('over'));
is('both left a mark', depth, 2);
window.history.back();
is('back closes the top one only', log, ['over']);
window.history.back();
is('and again closes the one underneath', log, ['over', 'under']);
is('leaving nothing', sheetDepth(), 0);

console.log('\nand it never throws where there is no browser at all');
resetSheets();
const saved = globalThis.window;
delete globalThis.window;
is('pushing without a window is harmless', typeof pushSheet(() => {}), 'function');
globalThis.window = saved;

console.log('\nevery sheet in the app has to use it');
/* The first version of this only read the top of src/components, so
   everything in green/ and lamma/ was never checked — and that is
   exactly where the sheets with no back gesture were hiding. It walks
   the whole tree now. */
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})('src/components');

const sheets = files.filter((f) => {
  const s = fs.readFileSync(f, 'utf8');
  /* a sheet: something takes onClose, and it covers the screen rather
     than sitting inside one */
  return /const \w+ = \(\{[^}]*onClose/.test(s)
      && /<Modal|position: 'absolute', top: 0/.test(s);
});
const without = sheets.filter((f) => !/useSheetBack/.test(fs.readFileSync(f, 'utf8')));
console.log('   ' + sheets.length + ' sheets found');
is('all of them answer the back gesture', without, []);

console.log('\nand the little bar at the top has to be real');
/* The screens were never looked at, and that is where 22 of these were
   hiding — including the profile's own edit sheet, which is the one he
   could not swipe away. A sheet written inline inside a screen is still
   a sheet. */
const everywhere = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) everywhere.push(p);
  }
})('src');

const fake = everywhere.filter((f) => {
  if (f.endsWith('SheetHandle.js')) return false;
  const s = fs.readFileSync(f, 'utf8');
  /* the decorative bar, drawn by hand, with nothing listening to it */
  return /width: (?:36|40|44), height: (?:4|5), borderRadius: [23]/.test(s);
});
is('no sheet draws a drag handle that does not drag', fake, []);
const handle = fs.readFileSync('src/components/SheetHandle.js', 'utf8');
is('the real one is a pan responder', /PanResponder\.create/.test(handle), true);
is('it only takes a downward drag', /g\.dy > 3 && Math\.abs\(g\.dy\) > Math\.abs\(g\.dx\)/.test(handle), true);
is('a flick counts as well as a long pull', /flick/.test(handle), true);
is('and it springs back when you do not mean it', /Animated\.spring/.test(handle), true);

if (bad) {
  console.log('\n' + bad + ' wrong. A sheet somebody opened cannot be closed the way their phone says it should.');
  process.exit(1);
}
console.log('\nBack closes the top sheet, and the handle really drags.');
