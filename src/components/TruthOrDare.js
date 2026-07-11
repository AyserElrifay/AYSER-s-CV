import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { TOD } from '../constants/mockData';
import { tapLight, tapMedium } from '../utils/feedback';
import { sfxPop, sfxStar } from '../utils/sfx';

/* Truth or Dare, played right inside a chat — one-on-one or the whole
   gang. Spin to land on someone, pick their poison, tap the ✕ to pack
   it away when you're done. */

export const TruthOrDare = ({ players, onRemove }) => {
  const [turn, setTurn] = useState(null);
  const [pick, setPick] = useState(null); // 'truth' | 'dare'
  const [prompt, setPrompt] = useState(null);
  const spin = useRef(new Animated.Value(0)).current;

  const doSpin = () => {
    tapMedium(); sfxPop();
    setPick(null); setPrompt(null);
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setTurn(players[Math.floor(Math.random() * players.length)]);
  };

  const choose = (kind) => {
    tapLight(); sfxStar();
    setPick(kind);
    const pool = kind === 'truth' ? TOD.truths : TOD.dares;
    setPrompt(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <LinearGradient
      colors={[C.purpleSoft, '#EEF0FF']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(124,58,237,0.28)', padding: 16, marginVertical: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18 }}>🎲</Text>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginLeft: 8, flex: 1 }}>Truth or Dare</Text>
        <Pressable onPress={() => { tapLight(); onRemove(); }} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={C.faint} />
        </Pressable>
      </View>

      {turn ? (
        <Animated.View
          style={{
            alignItems: 'center', marginBottom: 14,
            opacity: spin.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 1, 1] }),
            transform: [{ scale: spin.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          }}
        >
          <Image source={{ uri: turn.avatar }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: C.purple }} />
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 7 }}>{turn.name}’s turn</Text>
        </Animated.View>
      ) : (
        <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 19 }}>
          Spin to land on someone in the chat 🎡
        </Text>
      )}

      {turn && !pick ? (
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Pressable onPress={() => choose('truth')} style={{ flex: 1, marginRight: 7 }}>
            <View style={{ backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>Truth</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => choose('dare')} style={{ flex: 1, marginLeft: 7 }}>
            <View style={{ backgroundColor: C.coral, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>Dare</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {prompt ? (
        <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: pick === 'truth' ? C.blue : C.coral, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 5 }}>
            {pick === 'truth' ? 'TRUTH' : 'DARE'}
          </Text>
          <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21, fontWeight: '600' }}>{prompt}</Text>
        </View>
      ) : null}

      <Pressable onPress={doSpin}>
        <View style={{ backgroundColor: C.purple, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
          <Ionicons name="sync" size={16} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 }}>{turn ? 'Spin again' : 'Spin'}</Text>
        </View>
      </Pressable>
    </LinearGradient>
  );
};
