import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { tapMedium, tapLight } from '../utils/feedback';

/* Voice / video call UI — HONEST edition. Your own camera preview is
   REAL (getUserMedia on web). But peer-to-peer media (WebRTC signaling)
   isn't wired to the backend yet, so the call never pretends to
   connect: it rings, and if nobody can pick up it says so and points
   you back to messages. No fake timers, no fake "live". */

export const CallScreen = ({ peer, video, onClose }) => {
  const [state, setState] = useState('ringing'); // ringing | noanswer
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(video);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ring honestly, then admit nobody answered (live calls come later)
  useEffect(() => {
    const t = setTimeout(() => setState('noanswer'), 14000);
    return () => clearTimeout(t);
  }, []);

  // REAL self-preview on web — your actual camera, not a stock photo
  useEffect(() => {
    if (Platform.OS !== 'web' || !cam) return;
    let cancelled = false;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [cam]);

  const hangUp = () => {
    tapMedium();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    onClose();
  };

  const Ctrl = ({ icon, label, on, danger, onPress }) => (
    <Pressable onPress={() => { tapLight(); onPress && onPress(); }} style={{ alignItems: 'center', marginHorizontal: 12 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? C.coral : on ? '#FFF' : 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
        <Ionicons name={icon} size={24} color={danger ? '#FFF' : on ? C.text : '#FFF'} />
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 6 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={hangUp}>
      <LinearGradient colors={video ? ['#1E1B4B', '#0B1020'] : ['#4C1D95', '#1E1B4B', '#0B1020']} style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 80 }}>
        {/* your REAL camera, picture-in-picture (web) */}
        {cam && Platform.OS === 'web' ? (
          <View style={{ position: 'absolute', top: 60, right: 18, width: 96, height: 132, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: '#000' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </View>
        ) : null}

        <View style={{ alignItems: 'center', paddingHorizontal: 30 }}>
          <Image source={{ uri: peer.avatar }} style={{ width: 116, height: 116, borderRadius: 58, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' }} />
          <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 18 }}>{peer.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 6, textAlign: 'center' }}>
            {state === 'ringing' ? (video ? 'Video calling…' : 'Calling…') : 'No answer'}
          </Text>
          {state === 'noanswer' ? (
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 10, textAlign: 'center', lineHeight: 18 }}>
              Live voice & video are still being wired up — for now, drop them a message instead 💬
            </Text>
          ) : null}
          {video && state === 'ringing' ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700', marginTop: 8 }}>✦ Face Moment</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ctrl icon={muted ? 'mic-off' : 'mic'} label="Mute" on={muted} onPress={() => setMuted((m) => !m)} />
          <Ctrl icon={cam ? 'videocam' : 'videocam-off'} label="Camera" on={cam} onPress={() => setCam((c) => !c)} />
          <Ctrl icon="call" label="End" danger onPress={hangUp} />
        </View>
      </LinearGradient>
    </Modal>
  );
};
