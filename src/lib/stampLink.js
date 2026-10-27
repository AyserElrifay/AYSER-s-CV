/* ─── A STAMP, FROM THE TABLE'S QR ── …/?stamp=<code>. Scanned with the
   phone's own camera, the link opens Moments and the stamp is claimed.
   Kept for this tab through a sign-in, and the address bar is cleaned
   at once — the code dies in 90 seconds anyway. Read once, at import. */
const KEY = 'moments.stamp';
let pending = null;
(function read() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const c = q.get('stamp');
    if (c) {
      pending = c.slice(0, 80);
      try { window.sessionStorage.setItem(KEY, pending); } catch (e) {}
      q.delete('stamp');
      const rest = q.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
    } else {
      try { pending = window.sessionStorage.getItem(KEY); } catch (e) {}
    }
  } catch (e) {}
}());
export function pendingStamp() { return pending; }
export function takeStamp() { const c = pending; pending = null; try { window.sessionStorage.removeItem(KEY); } catch (e) {} return c; }
