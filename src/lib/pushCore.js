/* The parts of src/lib/push.js that need no browser, so
   scripts/check-push.mjs can check them. */

export function isIos(ua) {
  const u = ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  return /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
}
export function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
/* where a tapped notification should land (public/sw.js builds the url) */
export function readOpenTarget(href) {
  try {
    const q = new URL(href).searchParams;
    if (q.get('notifications') === '1') return { notifications: true };
    const tab = q.get('tab');
    if (tab && /^[A-Z]{3,10}$/.test(tab)) return { tab };
  } catch (e) {}
  return null;
}
