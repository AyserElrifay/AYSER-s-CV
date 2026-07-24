import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, Image, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { RTC_CONFIG, ringUser, joinCall, logMissedCall } from '../services/calls';
import { CallGames } from './CallGames';
import { tapMedium, tapLight, tapSuccess } from '../utils/feedback';
import { startRingback } from '../utils/sfx';

/* ─── REAL calls ───
   The other person's device actually RINGS (Supabase Realtime broadcast
   to their ring channel), and on answer a genuine WebRTC connection
   carries mic + camera between the two browsers. A missed call writes a
   real notification. Games (XO · Tap Race · Air Hockey) ride the same
   call channel — really played against the other person.

   Caller:   <CallScreen peer video onClose />
   Callee:   <CallScreen peer video incoming callId onClose />        */

const RING_MS = 30000;
// once they've picked up, a connection that hasn't come together in this
// long is never going to — say so instead of spinning on "Connecting…"
const CONNECT_MS = 20000;
const isWeb = Platform.OS === 'web';
const REAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CallScreen = ({ peer, video, incoming = false, callId: incomingCallId, onClose }) => {
  const { user } = useAuth();
  const canReallyCall = SUPABASE_READY && isWeb && !!user && !!(peer && REAL_ID.test(peer.id || ''));
  const [state, setState] = useState(incoming ? 'connecting' : 'ringing'); // ringing | connecting | live | noanswer | failed | ended
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(video);
  const [speaker, setSpeaker] = useState(true); // loud (1.0) vs quiet (0.35)
  const [gamesOpen, setGamesOpen] = useState(false);
  const [secs, setSecs] = useState(0);

  const callIdRef = useRef(incomingCallId || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)));
  const pcRef = useRef(null);
  const chRef = useRef(null);
  const ringRef = useRef(null);
  const localRef = useRef(null);     // <video> self preview
  const remoteVidRef = useRef(null); // <video> remote
  const remoteAudRef = useRef(null); // <audio> remote
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const gameEventRef = useRef(null);
  const endedRef = useRef(false);
  const speakerRef = useRef(true);
  const offeredRef = useRef(false);   // caller: the offer has gone out
  const acceptIvRef = useRef(null);   // callee: the "I picked up" retries

  const attachRemote = (stream) => {
    if (remoteVidRef.current) { remoteVidRef.current.srcObject = stream; remoteVidRef.current.play().catch(() => {}); }
    if (remoteAudRef.current) { remoteAudRef.current.srcObject = stream; remoteAudRef.current.volume = speakerRef.current ? 1 : 0.35; remoteAudRef.current.play().catch(() => {}); }
  };

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(connectTimer.current);
    clearInterval(acceptIvRef.current);
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch (e) {} pcRef.current = null; }
    if (ringRef.current) { ringRef.current.dispose(); ringRef.current = null; }
    if (chRef.current) { chRef.current.leave(); chRef.current = null; }
  }, []);

  const connectTimer = useRef(null);

  const goLive = useCallback(() => {
    setState('live');
    tapSuccess();
    clearTimeout(connectTimer.current);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
  }, []);

  /* They answered — from here the media has a deadline. */
  const beginConnecting = useCallback(() => {
    setState('connecting');
    clearTimeout(connectTimer.current);
    connectTimer.current = setTimeout(() => {
      if (endedRef.current) return;
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== 'connected') setState('failed');
    }, CONNECT_MS);
  }, []);

  /* ── the whole real-call lifecycle ── */
  useEffect(() => {
    if (!canReallyCall) {
      // honest fallback (demo peer / native build): ring, then admit it
      const t = setTimeout(() => setState('noanswer'), 14000);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const callId = callIdRef.current;

    (async () => {
      // 1 — mic (+camera) for real
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cam ? { facingMode: 'user' } : false });
      } catch (e) { if (!cancelled) setState('failed'); return; }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      localStreamRef.current = stream;
      if (localRef.current && cam) { localRef.current.srcObject = stream; localRef.current.play().catch(() => {}); }

      // 2 — peer connection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const remote = new MediaStream();
      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) attachRemote(e.streams[0]);
        else { remote.addTrack(e.track); attachRemote(remote); }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') goLive();
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && !endedRef.current) {
          setState((s) => (s === 'live' ? 'ended' : s));
        }
      };

      // 3 — signaling channel for this call
      const ch = joinCall(callId, {
        accept: async () => {
          // callee picked up → caller makes the offer (guard against the
          // repeated accepts the callee sends until we answer)
          if (incoming || offeredRef.current) return;
          offeredRef.current = true;
          if (ringRef.current) { ringRef.current.dispose(); ringRef.current = null; }
          beginConnecting();
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ch.send('signal', { sdp: pc.localDescription });
          } catch (e) { setState('failed'); }
        },
        decline: () => { endedRef.current = true; setState('noanswer'); cleanup(); },
        signal: async (p) => {
          try {
            if (p.sdp) {
              await pc.setRemoteDescription(p.sdp);
              if (p.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ch.send('signal', { sdp: pc.localDescription });
              }
            } else if (p.ice) {
              await pc.addIceCandidate(p.ice).catch(() => {});
            }
          } catch (e) {}
        },
        bye: () => { endedRef.current = true; setState('ended'); cleanup(); },
        game: (p) => { gameEventRef.current && gameEventRef.current(p); },
      });
      chRef.current = ch;
      pc.onicecandidate = (e) => { if (e.candidate) ch.send('signal', { ice: e.candidate }); };

      if (incoming) {
        /* We were rung — tell the caller we picked up. The channel may
           not be subscribed yet, and a single lost 'accept' used to
           strand the caller on "Ringing…" forever, so keep saying it
           until their offer actually arrives. */
        const sayAccept = () => ch.send('accept', { by: user.id });
        sayAccept();
        const acceptIv = setInterval(() => {
          if (cancelled || endedRef.current || pc.remoteDescription) { clearInterval(acceptIv); return; }
          sayAccept();
        }, 1200);
        acceptIvRef.current = acceptIv;
        setTimeout(() => clearInterval(acceptIv), 12000);
        beginConnecting();
      } else {
        // 4 — actually ring their device
        ringRef.current = await ringUser(peer.id, {
          callId,
          video: !!cam,
          from: { id: user.id, name: user.name || 'Someone', avatar: user.avatar_url || null },
        });
        /* Nobody picked up in 30s → stop ringing them and leave a REAL
           missed-call notification. If they DID pick up (offer sent),
           this is not a missed call — connecting has its own deadline. */
        setTimeout(() => {
          if (cancelled || endedRef.current || offeredRef.current) return;
          if (pcRef.current && pcRef.current.connectionState === 'connected') return;
          setState('noanswer');
          if (ringRef.current) ringRef.current.cancel();
          logMissedCall(peer.id, user.id);
        }, RING_MS);
      }
    })();

    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* You should HEAR that it's ringing on their side, the way a phone
     does — the purr stops the second they pick up (or don't). */
  useEffect(() => {
    if (incoming || state !== 'ringing') return undefined;
    const stop = startRingback();
    return stop;
  }, [incoming, state]);

  /* speaker: real volume on the remote audio element */
  useEffect(() => {
    speakerRef.current = speaker;
    if (remoteAudRef.current) remoteAudRef.current.volume = speaker ? 1 : 0.35;
  }, [speaker]);

  /* mic mute: really disables the outgoing audio track */
  useEffect(() => {
    if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, [muted]);

  /* camera toggle: really disables the outgoing video track */
  useEffect(() => {
    if (localStreamRef.current) localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !!cam; });
  }, [cam]);

  const hangUp = () => {
    tapMedium();
    endedRef.current = true;
    if (chRef.current) chRef.current.send('bye', {});
    if (ringRef.current && state === 'ringing') { ringRef.current.cancel(); logMissedCall(peer.id, user && user.id); }
    cleanup();
    onClose();
  };

  const fmt = (s) => Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  const statusLine =
    state === 'ringing' ? 'Ringing…'
    : state === 'connecting' ? 'Connecting…'
    : state === 'live' ? fmt(secs)
    : state === 'noanswer' ? (canReallyCall ? 'No answer — they got a missed-call ping 💬' : 'No answer — send them a message 💬')
    : state === 'failed' ? 'Could not connect — check mic permission & network'
    : 'Call ended';

  const Ctrl = ({ icon, label, on, danger, onPress }) => (
    <Pressable onPress={() => { tapLight(); onPress && onPress(); }} style={{ alignItems: 'center', marginHorizontal: 10 }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? C.coral : on ? '#FFF' : 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
        <Ionicons name={icon} size={23} color={danger ? '#FFF' : on ? C.text : '#FFF'} />
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10.5, marginTop: 6 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={hangUp}>
      <LinearGradient colors={['#241146', '#12071f', '#08040f']} style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 70 }}>
        {/* remote media — fills the screen on a live video call */}
        {isWeb ? (
          <>
            <video ref={remoteVidRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: state === 'live' && video ? 1 : 0 }} />
            <audio ref={remoteAudRef} autoPlay />
          </>
        ) : null}

        {/* self preview (small, top-right) */}
        {isWeb && cam ? (
          <video ref={localRef} autoPlay muted playsInline style={{ position: 'absolute', top: 60, right: 16, width: 96, height: 128, objectFit: 'cover', borderRadius: 14, border: '2px solid rgba(255,255,255,0.5)', transform: 'scaleX(-1)', zIndex: 5 }} />
        ) : null}

        <View style={{ alignItems: 'center', zIndex: 2 }}>
          <View>
            <Image source={{ uri: peer.avatar }} style={{ width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', opacity: state === 'live' && video ? 0 : 1 }} />
            {state === 'ringing' ? (
              <View style={{ position: 'absolute', top: -12, left: -12, right: -12, bottom: -12, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' }} />
            ) : null}
          </View>
          <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 16 }}>{peer.name}</Text>
          <Text style={{ color: state === 'live' ? '#7EE0D2' : 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>{statusLine}</Text>
        </View>

        {/* in-call games — really played over the call channel */}
        {gamesOpen && chRef.current ? (
          <CallGames
            role={incoming ? 'guest' : 'host'}
            send={(payload) => chRef.current && chRef.current.send('game', payload)}
            eventRef={gameEventRef}
            onClose={() => setGamesOpen(false)}
          />
        ) : null}

        <View style={{ zIndex: 2, alignItems: 'center' }}>
          {(state === 'noanswer' || state === 'failed' || state === 'ended') ? (
            <Pressable onPress={hangUp}>
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '900' }}>Back to chat 💬</Text>
              </View>
            </Pressable>
          ) : (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <Ctrl icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} on={muted} onPress={() => setMuted((m) => !m)} />
                <Ctrl icon={speaker ? 'volume-high' : 'volume-low'} label="Speaker" on={!speaker} onPress={() => setSpeaker((s) => !s)} />
                {video ? <Ctrl icon={cam ? 'videocam' : 'videocam-off'} label="Camera" on={!cam} onPress={() => setCam((c) => !c)} /> : null}
                {state === 'live' ? <Ctrl icon="game-controller" label="Games" on={gamesOpen} onPress={() => setGamesOpen((g) => !g)} /> : null}
              </View>
              <Ctrl icon="call" label="End" danger onPress={hangUp} />
            </>
          )}
        </View>
      </LinearGradient>
    </Modal>
  );
};
