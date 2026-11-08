/* ─── ONE CAMERA TO A ROOM (the core, no imports) ─────────────────────
   Ayser, November 2026 ("أنا قصدي stream"): one person in the room goes
   live; everybody else watches. Phone to phone (WebRTC), one way only:
   the person who is live sends their camera to each viewer; a viewer
   sends nothing — no camera, no microphone is asked for to watch.

   Only the live person ever makes an offer, and a viewer answers only an
   offer from the person the SERVER says is live (hostId) — anything from
   anybody else is ignored, so nobody can push a picture into the room.

   `wire` is the room's signalling channel (src/lib/circleLive.js gives
   the real one, over a private Supabase channel; a test gives a fake):
     wire.send(payload)        — to everybody in the room
     wire.onSignal(fn)         — fn(payload) for every message
     wire.onPeople(fn)         — fn([ids]) whenever the room changes
   Kept free of imports so it can be tried in a plain browser page. */

// a description as plain data (an RTCSessionDescription does not survive every wire)
const plain = (d) => ({ type: d.type, sdp: d.sdp });
const capBitrate = (sender, maxBitrate) => {
  if (!maxBitrate || !sender || !sender.getParameters) return;
  try {
    const prm = sender.getParameters();
    prm.encodings = (prm.encodings && prm.encodings.length ? prm.encodings : [{}]).map((e) => ({ ...e, maxBitrate }));
    sender.setParameters(prm).catch(() => {});
  } catch (e) { /* not every browser lets a sender be capped: it still works, just heavier */ }
};

/* the person who is live: sends `stream` to every viewer in the room */
export function liveHost({ wire, meId, stream, rtc, maxBitrate = 350000 }) {
  const pcs = new Map();      // viewerId → { pc, pending }
  let closed = false;
  const signal = (to, data) => wire.send({ to, from: meId, ...data });
  const drop = (id) => {
    const p = pcs.get(id);
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    pcs.delete(id);
  };
  const connect = async (id) => {
    if (closed || pcs.has(id)) return;
    const pc = new RTCPeerConnection(rtc);
    const p = { pc, pending: [] };
    pcs.set(id, p);
    stream.getTracks().forEach((tr) => capBitrate(pc.addTrack(tr, stream), tr.kind === 'video' ? maxBitrate : 0));
    pc.onicecandidate = (e) => { if (e.candidate) signal(id, { ice: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { drop(id); } };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal(id, { sdp: plain(pc.localDescription) });
    } catch (e) { drop(id); }
  };
  wire.onSignal(async (m) => {
    if (closed || !m || m.to !== meId || !m.from) return;
    const p = pcs.get(m.from);
    if (!p) { if (m.hello) connect(m.from); return; }
    try {
      if (m.sdp && m.sdp.type === 'answer') {
        await p.pc.setRemoteDescription(m.sdp);
        while (p.pending.length) await p.pc.addIceCandidate(p.pending.shift()).catch(() => {});
      } else if (m.ice) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(m.ice).catch(() => {});
        else p.pending.push(m.ice);
      } else if (m.hello) {
        // the viewer lost the picture (a reload, a dropped line): start again
        drop(m.from); connect(m.from);
      }
    } catch (e) { /* one viewer's trouble does not stop the others */ }
  });
  wire.onPeople((ids) => {
    if (closed) return;
    const here = new Set(ids);
    ids.forEach((id) => { if (id !== meId) connect(id); });
    [...pcs.keys()].forEach((id) => { if (!here.has(id)) drop(id); });
  });
  return {
    viewers: () => [...pcs.values()].filter((p) => p.pc.connectionState === 'connected').length,
    close: () => { if (closed) return; closed = true; [...pcs.keys()].forEach(drop); },
  };
}

/* a viewer: shows the picture from hostId only */
export function liveViewer({ wire, meId, hostId, rtc, onStream }) {
  let pc = null;
  let pending = [];
  let closed = false;
  const reset = () => { if (pc) { try { pc.close(); } catch (e) {} } pc = null; pending = []; onStream && onStream(null); };
  const hello = () => { if (!closed) wire.send({ to: hostId, from: meId, hello: true }); };
  wire.onSignal(async (m) => {
    if (closed || !m || m.to !== meId || m.from !== hostId) return;   // nobody but the person who is live
    try {
      if (m.sdp && m.sdp.type === 'offer') {
        reset();
        pc = new RTCPeerConnection(rtc);
        pc.ontrack = (e) => { onStream && onStream(e.streams[0] || new MediaStream([e.track])); };
        pc.onicecandidate = (e) => { if (e.candidate) wire.send({ to: hostId, from: meId, ice: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
        pc.onconnectionstatechange = () => { if (pc && pc.connectionState === 'failed') { reset(); setTimeout(hello, 1500); } };
        await pc.setRemoteDescription(m.sdp);
        while (pending.length) await pc.addIceCandidate(pending.shift()).catch(() => {});
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wire.send({ to: hostId, from: meId, sdp: plain(pc.localDescription) });
      } else if (m.ice) {
        if (pc && pc.remoteDescription) await pc.addIceCandidate(m.ice).catch(() => {});
        else pending.push(m.ice);
      }
    } catch (e) { reset(); }
  });
  // the host offers to everybody it sees; a hello covers a viewer it missed
  setTimeout(() => { if (!pc) hello(); }, 2500);
  return { close: () => { if (closed) return; closed = true; reset(); } };
}
