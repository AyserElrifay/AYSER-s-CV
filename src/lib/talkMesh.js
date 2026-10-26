import { supabase } from './supabase';
import { getRtcConfig } from '../services/calls';
import { shouldOffer } from './talkClock';

/* ─── A TALK ROOM'S AUDIO ─────────────────────────────────────────────
   Audio only, phone to phone: every pair of people in the room has one
   RTCPeerConnection (a "mesh"). With at most eight people that is at
   most seven connections per phone — fine for voice, and it costs
   nothing to run. The same STUN/TURN servers as 1:1 calls.

   The connections are set up over a PRIVATE Realtime channel,
   talk:<room id>. The database only lets current members of a room that
   has not ended read or write it (RUN_ME.sql, "WHO MAY BE ON THE
   ROOM'S WIRE"): the geo-fence, the capacity and the clock apply to the
   connection itself.

   close() is the hard stop: every connection closed, the microphone
   released, the channel left. The room screen calls it when the clock
   reaches zero. */

export async function joinMesh({ roomId, topic, me, onPeople, onError }) {
  let local;
  try {
    local = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
    });
  } catch (e) { onError && onError('mic'); return null; }

  /* ── WHO IS SPEAKING ── each voice's loudness, read here on the phone
     from the sound already playing (Web Audio). Nothing is recorded or
     sent; it only moves the small bars beside a name. */
  let actx = null;
  const ears = new Map();          // id → { an, buf, src }
  const listen = (id, stream) => {
    if (ears.has(id) || !stream) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const src = actx.createMediaStreamSource(stream);
      const an = actx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.6;
      src.connect(an);
      ears.set(id, { an, buf: new Uint8Array(an.fftSize), src });
    } catch (e) { /* no levels on this phone: the room works the same */ }
  };
  const unlisten = (id) => { const e = ears.get(id); if (e) { try { e.src.disconnect(); } catch (x) {} ears.delete(id); } };
  listen(me.id, local);

  const rtc = await getRtcConfig();
  const pcs = new Map();          // peerId → { pc, audio, pending: [] }
  let muted = false;
  let closed = false;

  // a talk room is talk:<id>; an online workshop's room is class:<offer id> (same rules, its own policy)
  const ch = supabase.channel(topic || 'talk:' + roomId, {
    config: { private: true, broadcast: { self: false }, presence: { key: me.id } },
  });
  const signal = (to, data) => ch.send({ type: 'broadcast', event: 'signal', payload: { to, from: me.id, ...data } }).catch(() => {});

  const drop = (peerId) => {
    const p = pcs.get(peerId);
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    try { p.audio.srcObject = null; p.audio.remove(); } catch (e) {}
    unlisten(peerId);
    pcs.delete(peerId);
  };

  const make = (peerId) => {
    if (pcs.has(peerId)) return pcs.get(peerId);
    const pc = new RTCPeerConnection(rtc);
    const audio = document.createElement('audio');
    audio.autoplay = true; audio.setAttribute('playsinline', '');
    audio.style.display = 'none';
    document.body.appendChild(audio);
    const p = { pc, audio, pending: [] };
    pcs.set(peerId, p);
    local.getTracks().forEach((tr) => pc.addTrack(tr, local));
    pc.onicecandidate = (e) => { if (e.candidate) signal(peerId, { ice: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = (e) => { audio.srcObject = e.streams[0]; audio.play().catch(() => {}); listen(peerId, e.streams[0]); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') drop(peerId); };
    return p;
  };

  const offerTo = async (peerId) => {
    const { pc } = make(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signal(peerId, { sdp: pc.localDescription });
  };

  ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
    if (closed || !payload || payload.to !== me.id || !payload.from) return;
    const from = payload.from;
    try {
      if (payload.sdp) {
        const p = make(from);
        await p.pc.setRemoteDescription(payload.sdp);
        while (p.pending.length) await p.pc.addIceCandidate(p.pending.shift()).catch(() => {});
        if (payload.sdp.type === 'offer') {
          const answer = await p.pc.createAnswer();
          await p.pc.setLocalDescription(answer);
          signal(from, { sdp: p.pc.localDescription });
        }
      } else if (payload.ice) {
        const p = make(from);
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(payload.ice).catch(() => {});
        else p.pending.push(payload.ice);
      }
    } catch (e) { /* one bad pair does not take the room down */ }
  });

  const people = () => {
    const state = ch.presenceState();
    return Object.keys(state).map((id) => ({ id, ...(state[id][0] || {}) }));
  };
  ch.on('presence', { event: 'sync' }, () => {
    if (closed) return;
    const list = people();
    const ids = new Set(list.map((x) => x.id));
    list.forEach((x) => { if (x.id !== me.id && !pcs.has(x.id) && shouldOffer(me.id, x.id)) offerTo(x.id).catch(() => {}); });
    [...pcs.keys()].forEach((id) => { if (!ids.has(id)) drop(id); });
    onPeople && onPeople(list);
  });

  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await ch.track({ name: me.name || '', muted }).catch(() => {});
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError && onError('wire');
  });

  return {
    /* 0 … 1: how loud this person is right now */
    level: (id) => {
      if (id === me.id && muted) return 0;
      const e = ears.get(id);
      if (!e) return 0;
      e.an.getByteTimeDomainData(e.buf);
      let sum = 0;
      for (let i = 0; i < e.buf.length; i++) { const v = (e.buf[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / e.buf.length) * 5);
    },
    setMuted: (m) => {
      muted = !!m;
      local.getAudioTracks().forEach((tr) => { tr.enabled = !muted; });
      ch.track({ name: me.name || '', muted }).catch(() => {});
    },
    close: () => {
      if (closed) return;
      closed = true;
      [...pcs.keys()].forEach(drop);
      local.getTracks().forEach((tr) => tr.stop());
      [...ears.keys()].forEach(unlisten);
      if (actx) actx.close().catch(() => {});
      try { ch.untrack(); } catch (e) {}
      try { supabase.removeChannel(ch); } catch (e) {}
    },
  };
}
