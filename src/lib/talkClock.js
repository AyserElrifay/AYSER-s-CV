/* ─── THE TALK ROOM'S CLOCK ───────────────────────────────────────────
   One end time, set by the server when the room starts and never moved
   (talk_rooms.ends_at). Every phone counts down to the same moment by
   correcting its own clock with the server's "now" from the same reply,
   so a phone that is three minutes fast does not cut people off early.

     live   → talking
     bridge → the last three minutes: Bardi offers to take it offline
     over   → the audio is cut. No extensions, for anyone.

       node scripts/check-talk-rooms.mjs
*/
export const BRIDGE_MS = 3 * 60 * 1000;
export const ALLOWED_MINUTES = [15, 30];

/* how far this phone's clock is behind the server's (ms to add) */
export function offsetFrom(serverNowIso, localNow = Date.now()) {
  const s = Date.parse(serverNowIso);
  return Number.isFinite(s) ? s - localNow : 0;
}

export function remaining(endsAtIso, offset = 0, localNow = Date.now()) {
  const e = Date.parse(endsAtIso);
  if (!Number.isFinite(e)) return 0;
  return Math.max(0, e - (localNow + offset));
}

export function phase(endsAtIso, offset = 0, localNow = Date.now()) {
  const r = remaining(endsAtIso, offset, localNow);
  if (r <= 0) return 'over';
  if (r <= BRIDGE_MS) return 'bridge';
  return 'live';
}

export function fmt(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* the peer with the smaller id makes the offer — so two phones never
   both offer to each other at once (WebRTC "glare") */
export const shouldOffer = (meId, peerId) => String(meId) < String(peerId);
