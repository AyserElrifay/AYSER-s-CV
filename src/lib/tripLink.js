/* ─── A TRIP SOMEBODY SENT YOU ─────────────────────────────────────────
   …/?trip=<offer id> is read once as the app starts. The trip opens
   straight away — signed in or not, since looking needs no account —
   and the address bar is cleaned. Anything in the app can open a trip
   the same way (a notification, a card) with openTrip(id). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let pending = null;
const listeners = new Set();

(function readOnce() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const id = q.get('trip');
    if (!id) return;
    if (UUID.test(id)) pending = id;
    q.delete('trip');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  } catch (e) { /* the link simply does nothing */ }
}());

export function pendingTrip() { return pending; }
export function takeTrip() { const id = pending; pending = null; return id; }
export function openTrip(id) {
  if (!id || !UUID.test(id)) return;
  pending = id;
  listeners.forEach((fn) => { try { fn(id); } catch (e) {} });
}
export function onTrip(fn) { listeners.add(fn); return () => listeners.delete(fn); }
