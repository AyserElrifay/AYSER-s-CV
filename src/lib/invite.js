/* ─── WHO SENT YOU ────────────────────────────────────────────────────
   A link like …/?invite=<their id> is read once, as the app starts,
   kept until you are signed in, then handed to the server
   (claim_invite), which decides whether it counts. The address bar is
   cleaned straight away so the code is not passed on by accident. */
const KEY = 'mm.invite.from';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

(function readOnce() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const from = q.get('invite');
    if (!from) return;
    if (UUID.test(from)) localStorage.setItem(KEY, from);
    q.delete('invite');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  } catch (e) { /* no storage, no invite — nothing else depends on it */ }
}());

export function pendingInvite() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}
export function clearInvite() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
