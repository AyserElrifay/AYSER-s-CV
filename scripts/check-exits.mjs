/* ─── EVERY SCREEN HAS A WAY OUT YOU CAN SEE ──────────────────────────
   Ayser: "ركز الأول على واجهة المستخدم … وأماكن الخروج".

   The phone's back gesture already closes every sheet (see
   check-sheet-back.mjs). That is not enough on its own: on an iPhone
   in the browser there is no back button, and somebody who does not
   know the gesture is stuck. So anything that covers the screen — a
   Modal, or a panel that hooks the back gesture — must also show a
   way out: a ✕, a back arrow, a drag handle, Done or Skip.

       node scripts/check-exits.mjs
*/
import fs from 'node:fs';

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q); } })('src');

/* the few that leave some other visible way: a call ends with the red
   button, the tour with Skip, a call gate with Decline */
const OWN_EXIT = {
  'src/components/CallScreen.js': /hangUp|hang_up|call-end|endCall|leave\(\)/,
  'src/components/GestureTour.js': /tour_skip/,
  'src/components/IncomingCallGate.js': /onPress=\{decline\}/,
  'src/components/WhatsNew.js': /onPress=\{close\}/,
};
const NOT_SCREENS = ['src/hooks/useSheetBack.js', 'src/components/SheetHandle.js', 'src/components/LeafletMap.js'];

const visibleExit = (s) =>
  /name=\{?["'](close|chevron-back|arrow-back|chevron-down|close-circle|close-outline)["']/.test(s) ||
  /rtl \? '(chevron|arrow)-forward' : '(chevron|arrow)-back'/.test(s) ||
  /✕|t\('close'\)|t\('back'\)|close_x|<SheetHandle|<ScreenHeader/.test(s);

let bad = 0;
for (const f of files) {
  if (NOT_SCREENS.includes(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const covers = /<Modal\b/.test(s) || /useSheetBack\(/.test(s);
  if (!covers) continue;
  const noBack = [...s.matchAll(/<Modal\b[^>]*>/gs)].filter((m) => !/onRequestClose/.test(m[0])).length;
  const ok = visibleExit(s) || (OWN_EXIT[f] && OWN_EXIT[f].test(s));
  if (!ok) { console.log('  FAIL  ' + f + ' — covers the screen with nothing to tap to leave'); bad++; }
  if (noBack) { console.log('  FAIL  ' + f + ' — a Modal the phone\'s back button cannot close'); bad++; }
}
if (bad) { console.log('\n' + bad + ' screen(s) without a way out.'); process.exit(1); }
console.log('Every screen that covers the app shows a way out, and the back button closes it.');
