/* ─── THE BACK GESTURE HAS TO CLOSE THINGS ───────────────────────────
   Ayser, on a sheet that would not go away: "مهما بعمل swip ما بتنقفلس
   ولا بتعمل back".

   He is right, and the reason is specific. This app runs as an
   installed web app, so the phone's own way of saying "back" — the
   edge swipe on iOS, the back button on Android — is the BROWSER's
   back, and the browser knows nothing about a sheet that was opened by
   setting a React state variable to true. Pressing back therefore did
   one of two things, both wrong: nothing at all, or it left the app.

   So a sheet now puts a mark in the browser's own history when it
   opens. The phone's back gesture pops that mark, the sheet hears it,
   and closes. Nothing else changes: the address bar stays as it was,
   because the mark is pushed and popped on the same URL.

   The stack matters. Open a sheet, open another on top of it, and back
   must close the top one and leave the one underneath — so this keeps
   the order and only ever closes the newest.

       node scripts/check-sheet-back.mjs
*/

const stack = [];
let wired = false;
let ignoring = 0;      // pops WE caused, which must not close anything

function onPop() {
  if (ignoring > 0) { ignoring--; return; }
  const top = stack.pop();
  if (!top) return;
  top.popped = true;   // its mark is already gone; do not pop it again
  try { top.close(); } catch (e) {}
}

function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('popstate', onPop);
}

/* Called when a sheet opens. Returns the function to call when it
   closes by any other route — a button, a backdrop tap, a swipe. */
export function pushSheet(close) {
  if (typeof window === 'undefined' || !window.history) return () => {};
  wire();
  const entry = { close, popped: false };
  stack.push(entry);
  try { window.history.pushState({ mmSheet: stack.length }, ''); } catch (e) {}

  return function release() {
    const at = stack.indexOf(entry);
    if (at === -1) return;                 // already gone: back closed it
    stack.splice(at, 1);
    /* It closed on its own, so its history mark is still there and has
       to come off — and the pop that causes must not be mistaken for
       somebody pressing back. */
    if (!entry.popped) {
      ignoring++;
      try { window.history.back(); } catch (e) { ignoring--; }
    }
  };
}

/* For the checks, and for anything that needs to know whether a back
   press is currently spoken for. */
export const sheetDepth = () => stack.length;
export function resetSheets() { stack.length = 0; ignoring = 0; }
