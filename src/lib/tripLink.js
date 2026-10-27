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

/* ─── A TRIP INVITATION, FROM ANYWHERE ── the notification a confirmed
   booking sends (RUN_ME.sql, "THE INVITATION"), the booking screen and My
   bookings all open it with openInvite(bookingId); TripInviteGate, in
   components/TripLinkGate.js, draws it. Kept in this file because a tiny
   module of its own costs more in the first download than it holds. */
let invitePending = null;
const inviteListeners = new Set();
export function openInvite(id) {
  if (!id) return;
  invitePending = String(id);
  inviteListeners.forEach((fn) => { try { fn(invitePending); } catch (e) {} });
}
export function takeInvite() { const v = invitePending; invitePending = null; return v; }
export function onInvite(fn) { inviteListeners.add(fn); return () => inviteListeners.delete(fn); }

/* ─── AN OUTING SOMEBODY SENT YOU ── …/?plan=<id>, from the share button on
   a plan's card (TogetherScreen). Read once as the app starts; once signed
   in, Together opens with that plan first and marked. */
let planPending = null;
(function readPlan() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const id = q.get('plan');
    if (!id) return;
    if (UUID.test(id)) planPending = id;
    q.delete('plan');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  } catch (e) { /* the link simply does nothing */ }
}());
export function pendingPlan() { return planPending; }
export function takePlan() { const id = planPending; planPending = null; return id; }
