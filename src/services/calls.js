import { supabase } from '../lib/supabase';

/* REAL calls — WebRTC media with Supabase Realtime as the signaling
   wire. Nothing is simulated:

   · Ringing: every signed-in user listens on their own 'ring_<id>'
     broadcast channel. Calling someone actually rings their device.
   · Media: a real RTCPeerConnection (mic + optional camera) between the
     two browsers, negotiated over a per-call channel 'call_<callId>'.
   · Missed calls: a genuine notification row via the notify_call RPC.

   STUN only (Google's public server) — most networks connect fine; when
   a strict NAT blocks it, the call honestly fails instead of faking. */

/* STUN tells each side what its public address is. That is enough on
   most home networks and on nothing else: behind a strict NAT — mobile
   data, a company wifi, most of Egypt's carriers — the two browsers
   never find a route and the call sits "connecting" with no audio.

   A TURN relay is what fixes that, and it is the difference between a
   call that works for some people and one that works. openrelay is a
   free public TURN service; set EXPO_PUBLIC_TURN_URL/USER/PASS to
   point at your own when the traffic justifies paying for one. */
const TURN_URL = process.env.EXPO_PUBLIC_TURN_URL || 'turn:openrelay.metered.ca:80';
const TURN_USER = process.env.EXPO_PUBLIC_TURN_USER || 'openrelayproject';
const TURN_PASS = process.env.EXPO_PUBLIC_TURN_PASS || 'openrelayproject';

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: TURN_URL, username: TURN_USER, credential: TURN_PASS },
    { urls: TURN_URL.replace(':80', ':443'), username: TURN_USER, credential: TURN_PASS },
  ],
  iceCandidatePoolSize: 4,
};

/* ── incoming-ring listener (mounted once, app-wide) ── */
export function subscribeIncomingCalls(myId, onEvent) {
  const ch = supabase.channel('ring_' + myId, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'ring' }, ({ payload }) => onEvent({ type: 'ring', ...payload }));
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
  await ch.send({ type: 'broadcast', event: 'ring', payload });
  return {
    cancel: async () => {
      try { await ch.send({ type: 'broadcast', event: 'cancel', payload: { callId: payload.callId } }); } catch (e) {}
      try { supabase.removeChannel(ch); } catch (e) {}
    },
    dispose: () => { try { supabase.removeChannel(ch); } catch (e) {} },
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
