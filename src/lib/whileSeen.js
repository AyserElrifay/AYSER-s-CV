/* ─── A LIVE CHANNEL ONLY WHILE THE APP IS ON SCREEN ─────────────────
   Ayser, November 2026 (zero-cost): a Supabase Realtime channel is open
   only while somebody is looking. In the background it is removed; back
   on screen it is opened again. open() opens one and returns its closer.
   Returns the closer for the whole thing (unmount). */
export function whileSeen(open) {
  if (typeof document === 'undefined') return open();
  let close = null, times = 0;
  const sync = () => {
    if (document.visibilityState === 'hidden') { if (close) { close(); close = null; } }
    else if (!close) close = open(times++ > 0);   // true when it comes back after the background
  };
  sync();
  document.addEventListener('visibilitychange', sync);
  return () => { document.removeEventListener('visibilitychange', sync); if (close) close(); close = null; };
}
