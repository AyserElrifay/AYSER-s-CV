import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { tapMedium, tapLight } from '../utils/feedback';

/* Voice / video call UI. Real WebRTC media rides on the backend later;
   this is the full call experience — ringing, timer, and controls. */

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const CallScreen = ({ peer, video, onClose }) => {
  const [state, setState] = useState('ringing'); // ringing | live
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(video);

  useEffect(() => {
    const t = setTimeout(() => setState('live'), 2200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (state !== 'live') return;
    const i = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [state]);

  const Ctrl = ({ icon, label, on, danger, onPress }) => (
    <Pressable onPress={() => { tapLight(); onPress && onPress(); }} style={{ alignItems: 'center', marginHorizontal: 12 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? C.coral : on ? '#FFF' : 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
        <Ionicons name={icon} size={24} color={danger ? '#FFF' : on ? C.text : '#FFF'} />
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 6 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={video ? ['#1E1B4B', '#0B1020'] : ['#4C1D95', '#1E1B4B', '#0B1020']} style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 80 }}>
        {/* video: peer fills, self PIP */}
        {cam ? (
          <Image source={{ uri: peer.avatar }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.4 }} blurRadius={2} />
        ) : null}
        {cam ? (
          <View style={{ position: 'absolute', top: 60, right: 18, width: 96, height: 132, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }}>
            <Image source={{ uri: 'https://i.pravatar.cc/150?img=5' }} style={{ width: '100%', height: '100%' }} />
          </View>
        ) : null}

        <View style={{ alignItems: 'center' }}>
          <Image source={{ uri: peer.avatar }} style={{ width: 116, height: 116, borderRadius: 58, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' }} />
          <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 18 }}>{peer.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 6 }}>
            {state === 'ringing' ? (video ? 'Video calling…' : 'Calling…') : fmt(secs)}
          </Text>
          {video ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700', marginTop: 8 }}>✦ Face Moment</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ctrl icon={muted ? 'mic-off' : 'mic'} label="Mute" on={muted} onPress={() => setMuted((m) => !m)} />
          <Ctrl icon={cam ? 'videocam' : 'videocam-off'} label="Camera" on={cam} onPress={() => setCam((c) => !c)} />
          <Ctrl icon="call" label="End" danger onPress={() => { tapMedium(); onClose(); }} />
        </View>
      </LinearGradient>
    </Modal>
  );
};
