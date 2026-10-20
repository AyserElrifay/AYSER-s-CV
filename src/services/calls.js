import { supabase } from '../lib/supabase';

/* REAL calls — WebRTC media with Supabase Realtime as the signaling
   wire. Nothing is simulated:

   · Ringing: every signed-in user listens on their own 'ring_<id>'
     broadcast channel. Calling someone actually rings their device.
   · Media: a real RTCPeerConnection (mic + optional camera) between the
     two browsers, negotiated over a per-call channel 'call_<callId>'.
   · Missed calls: a genuine notification row via the notify_call RPC.

   STUN plus a TURN relay (getRtcConfig) — when nothing can connect,
   the call honestly fails instead of faking. */

/* STUN alone is the fallback: it works on most home networks and on
   nothing else (mobile data, company wifi). The relay that makes calls
   work everywhere is our own Cloudflare TURN, below. */
export const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }], iceCandidatePoolSize: 4 };

/* The relay that works: a short-lived Cloudflare TURN address from our
   own server (supabase/functions/turn). Fetched once, kept for a few
   hours; without it the call falls back to the list above. */
let iceCache = null;
export async function getRtcConfig() {
  if (iceCache && iceCache.until > Date.now()) return iceCache.config;
  try {
    const { data, error } = await supabase.functions.invoke('turn', { body: {} });
    if (!error && data && Array.isArray(data.iceServers) && data.iceServers.length) {
      const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }].concat(data.iceServers), iceCandidatePoolSize: 4 };
      iceCache = { config, until: Date.now() + 6 * 3600 * 1000 };
      return config;
    }
  } catch (e) {}
  return RTC_CONFIG;
}

/* ── incoming-ring listener (mounted once, app-wide) ── */
export function subscribeIncomingCalls(myId, onEvent) {
  const ch = supabase.channel('ring_' + myId, { config: { broadcast: { self: false } } });
  /* a ring counts only if the server saw this call: the name and photo
     are the caller's real ones, never what the broadcast claimed */
  const seen = {};
  ch.on('broadcast', { event: 'ring' }, async ({ payload }) => {
    const p = payload || {}, id = p.callId;
    if (!id || seen[id]) return;
    seen[id] = 1;
    const { data: who } = await supabase.rpc('call_check', { p_from: (p.from || {}).id, p_call: id }).then((r) => r, () => ({}));
    if (who) onEvent({ type: 'ring', callId: id, video: !!p.video, from: who }); else delete seen[id];
  });
  ch.on('broadcast', { event: 'cancel' }, ({ payload }) => onEvent({ type: 'cancel', ...payload }));
  ch.subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (e) {} };
}

/* ── ring someone's device for real ── */
export async function ringUser(peerId, payload) {
  const ch = supabase.channel('ring_' + peerId, { config: { broadcast: { self: false } } });
  await new Promise((resolve) => {
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); });
    setTimeout(resolve, 4000); // never hang forever on a bad network
  });
  /* the server first: it writes the call down (that is the push, "…
     is calling you", which rings a phone with Moments closed) and it is
     what the other phone checks before it rings at all — call_check */
  const { data: ok } = await supabase.rpc('call_ring', { p_to: peerId, p_call: payload.callId });
  if (!ok || !ok.ok) { supabase.removeChannel(ch); throw new Error('ring'); }
  await ch.send({ type: 'broadcast', event: 'ring', payload });
  /* again every few seconds, so a phone that opens Moments from the
     push still catches the call */
  const again = setInterval(() => { ch.send({ type: 'broadcast', event: 'ring', payload }).catch(() => {}); }, 3000);
  return {
    cancel: async () => {
      clearInterval(again);
      try { await ch.send({ type: 'broadcast', event: 'cancel', payload: { callId: payload.callId } }); } catch (e) {}
      try { supabase.removeChannel(ch); } catch (e) {}
    },
    dispose: () => { clearInterval(again); try { supabase.removeChannel(ch); } catch (e) {} },
  };
}

/* ── the per-call signaling + game channel ──
   Events: 'accept' | 'decline' | 'signal' ({sdp}|{ice}) | 'bye' | 'game' */
export function joinCall(callId, handlers) {
  const ch = supabase.channel('call_' + callId, { config: { broadcast: { self: false } } });
  ['accept', 'decline', 'signal', 'bye', 'game'].forEach((ev) => {
    ch.on('broadcast', { event: ev }, ({ payload }) => {
      const h = handlers[ev];
      if (h) h(payload || {});
    });
  });

  /* Anything sent before the channel finishes subscribing is dropped
     on the floor, silently. Subscribing takes a moment, and the very
     first things a call sends are ICE candidates — the network routes
     the two browsers need to find each other. Lose those and the call
     shows "connecting" forever with no sound, which is exactly what
     was happening.

     So: queue until we're really connected, then flush in order. */
  let ready = false;
  const queue = [];
  const push = (event, payload) =>
    ch.send({ type: 'broadcast', event, payload: payload || {} }).catch(() => {});

  ch.subscribe((status) => {
    if (status !== 'SUBSCRIBED' || ready) return;
    ready = true;
    while (queue.length) { const m = queue.shift(); push(m.event, m.payload); }
  });

  return {
    send: (event, payload) => {
      if (ready) return push(event, payload);
      queue.push({ event, payload });
      return Promise.resolve();
    },
    leave: () => { try { supabase.removeChannel(ch); } catch (e) {} },
  };
}

/* ── a missed call leaves a real notification ── */
export async function logMissedCall(recipientId, actorId) {
  try { await supabase.rpc('notify_call', { recipient: recipientId, actor: actorId }); } catch (e) {}
}
