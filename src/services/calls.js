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

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
  ch.subscribe();
  return {
    send: (event, payload) => ch.send({ type: 'broadcast', event, payload: payload || {} }).catch(() => {}),
    leave: () => { try { supabase.removeChannel(ch); } catch (e) {} },
  };
}

/* ── a missed call leaves a real notification ── */
export async function logMissedCall(recipientId, actorId) {
  try { await supabase.rpc('notify_call', { recipient: recipientId, actor: actorId }); } catch (e) {}
}
