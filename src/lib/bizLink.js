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

/* ─── A PLACE, FROM A QR ── …/?place=<id> opens that place's page;
   &c=<token> (the counter's QR) checks you in when you arrive there.
   Kept for this tab through a sign-in, like the portal link. */
const PKEY = 'moments.openPlace';
let place = null;
(function readPlace() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const id = q.get('place');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      place = { id, code: (q.get('c') || '').replace(/[^0-9a-f]/gi, '').slice(0, 8) || null };
      try { window.sessionStorage.setItem(PKEY, JSON.stringify(place)); } catch (e) {}
      q.delete('place'); q.delete('c');
      const rest = q.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
    } else {
      try { place = JSON.parse(window.sessionStorage.getItem(PKEY) || 'null'); } catch (e) {}
    }
  } catch (e) {}
}());
export function pendingPlace() { return place; }
export function takePlace() { place = null; try { window.sessionStorage.removeItem(PKEY); } catch (e) {} }
export function placeLink(id, code) {
  let base = 'https://therealmoments.com/';
  try { if (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin)) base = window.location.origin + window.location.pathname; } catch (e) {}
  return base + '?place=' + id + (code ? '&c=' + code : '');
}
export function takeBiz() { pending = false; try { window.sessionStorage.removeItem(KEY); } catch (e) {} }
