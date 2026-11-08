import { supabase } from './supabase';
import { getRtcConfig } from '../services/calls';
import { liveHost, liveViewer } from './liveCore';

/* ─── THE CIRCLE, LIVE ─────────────────────────────────────────────────
   The real wire for src/lib/liveCore.js: a PRIVATE Supabase channel,
   circlelive:<room>, that only the people in that Circle may read or
   write (RUN_ME.sql, "THE CIRCLE, LIVE"). Presence says who is in the
   room; broadcast carries the offers, answers and network candidates.
   The same STUN/TURN servers as calls. close() leaves the channel. */
const openWire = (room, meId) => {
  const signalFns = [];
  const peopleFns = [];
  const ch = supabase.channel('circlelive:' + room, { config: { private: true, broadcast: { self: false }, presence: { key: meId } } });
  ch.on('broadcast', { event: 'signal' }, ({ payload }) => signalFns.forEach((f) => f(payload)));
  ch.on('presence', { event: 'sync' }, () => { const ids = Object.keys(ch.presenceState()); peopleFns.forEach((f) => f(ids)); });
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ at: Date.now() }).catch(() => {}); });
  return {
    send: (payload) => { ch.send({ type: 'broadcast', event: 'signal', payload }).catch(() => {}); },
    onSignal: (f) => signalFns.push(f),
    onPeople: (f) => peopleFns.push(f),
    close: () => { try { ch.untrack(); } catch (e) {} try { supabase.removeChannel(ch); } catch (e) {} },
  };
};

/* the team member going live: their camera (front by default), small enough for phones on data */
export async function goLive({ room, meId, facing = 'user' }) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 20 } },
      audio: false,   // the voice already goes through the room's microphones
    });
  } catch (e) { return { error: 'camera' }; }
  const rtc = await getRtcConfig();
  const wire = openWire(room, meId);
  const host = liveHost({ wire, meId, stream, rtc });
  return {
    stream,
    viewers: host.viewers,
    stop: () => { host.close(); wire.close(); stream.getTracks().forEach((t) => t.stop()); },
  };
}

/* everybody else: the picture from the one person the server says is live */
export async function watchLive({ room, meId, hostId, onStream }) {
  const rtc = await getRtcConfig();
  const wire = openWire(room, meId);
  const v = liveViewer({ wire, meId, hostId, rtc, onStream });
  return { stop: () => { v.close(); wire.close(); } };
}
