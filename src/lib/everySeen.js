/* ─── POLL ONLY WHILE SOMEBODY IS LOOKING ────────────────────────────
   Ayser, November 2026 (the Supabase egress alert): a screen that asks
   the server every few seconds kept asking with the phone locked or the
   app in the background. everySeen is setInterval that skips its turn
   while the page is hidden; clearInterval stops it as before. */
export function everySeen(fn, ms) {
  return setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    fn();
  }, ms);
}
