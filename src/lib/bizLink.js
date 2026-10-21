/* ─── THE BUSINESS PORTAL, FROM A LINK ────────────────────────────────
   …/?business=1 opens BizHub — where a café, restaurant, host or
   organisation runs its place on Moments — straight after sign-in. The
   link survives the sign-in (kept for this tab in sessionStorage, so a
   login that reloads the page still lands there). Read once; the
   address bar is cleaned. */
const KEY = 'moments.openBiz';
let pending = false;

(function readOnce() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('business') != null) {
      pending = true;
      try { window.sessionStorage.setItem(KEY, '1'); } catch (e) {}
      q.delete('business');
      const rest = q.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
    } else {
      try { pending = window.sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    }
  } catch (e) { /* the link simply does nothing */ }
}());

export function pendingBiz() { return pending; }
export function takeBiz() { pending = false; try { window.sessionStorage.removeItem(KEY); } catch (e) {} }
