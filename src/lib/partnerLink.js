/* ─── THE PARTNER PAGE, FROM A LINK ───────────────────────────────────
   …/?partner=1 (or =place / =experience) opens the partner page
   straight away, signed in or not — it is the link Ayser sends a café
   on WhatsApp. Read once; the address bar is cleaned. Anything in the
   app opens the same page with openPartner(). */
let pending = null;
const listeners = new Set();

(function readOnce() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const v = q.get('partner');
    if (v == null) return;
    pending = v === 'experience' ? 'experience' : 'place';
    q.delete('partner');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  } catch (e) { /* the link simply does nothing */ }
}());

export function pendingPartner() { return pending; }
export function takePartner() { const v = pending; pending = null; return v; }
export function openPartner(kind) {
  pending = kind === 'experience' ? 'experience' : 'place';
  listeners.forEach((fn) => { try { fn(pending); } catch (e) {} });
}
export function onPartner(fn) { listeners.add(fn); return () => listeners.delete(fn); }
