/* ─── THE ORGANIZER HUB, FROM A LINK ──────────────────────────────────
   …/?hub=1 opens the Organizer Hub (on Space) right after sign-in — the
   link the team sends to an organizer. Kept for this tab through a
   sign-in; read once; the address bar is cleaned. */
const KEY = 'mm.openHub';
(function readOnce() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('hub') == null) return;
    window.sessionStorage.setItem(KEY, '1');
    q.delete('hub');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  } catch (e) { /* the link simply does nothing */ }
}());
export const hubRequested = () => { try { return window.sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
export const hubTaken = () => { try { window.sessionStorage.removeItem(KEY); } catch (e) {} };
