import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { tapLight, tapSelection } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* Would You Rather — the second (and last) chat game. Pick a side,
   see how the chat split, pull the ✕ when you're done. */

const PAIRS = [
  ['Sunrise hike every weekend 🌄', 'Rooftop nights every weekend 🌃'],
  ['Never wait in traffic again 🚗', 'Never wait in line again ☕'],
  ['Live one year abroad 🌍', 'Road-trip all of Egypt 🇪🇬'],
  ['Always know the best food spot 🍽️', 'Always find parking 🅿️'],
  ['Front row at every concert 🎤', 'Backstage at every shoot 🎬'],
  ['Speak every language 🗣️', 'Play every instrument 🎸'],
];

export const WouldYouRather = ({ onRemove }) => {
  const [round, setRound] = useState(0);
  const [pick, setPick] = useState(null);
  const pair = PAIRS[round % PAIRS.length];
  const split = 34 + ((round * 17) % 33); // playful fake crowd split

  const next = () => { tapLight(); sfxPop(); setPick(null); setRound((r) => r + 1); };

  return (
    <LinearGradient
      colors={[C.blueSoft, '#EAF3FF']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', padding: 16, marginVertical: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18 }}>🤔</Text>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginLeft: 8, flex: 1 }}>Would You Rather</Text>
        <Pressable onPress={() => { tapLight(); onRemove(); }} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={C.faint} />
        </Pressable>
      </View>

      {pair.map((opt, i) => {
        const chosen = pick === i;
        const pct = i === 0 ? split : 100 - split;
        return (
          <Pressable key={i} onPress={() => { if (pick === null) { tapSelection(); sfxSuccess(); setPick(i); } }} style={{ marginBottom: 9 }}>
            <View style={{ backgroundColor: '#FFF', borderWidth: 1.5, borderColor: chosen ? C.blue : C.line, borderRadius: 14, padding: 13, overflow: 'hidden' }}>
              {pick !== null ? (
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct + '%', backgroundColor: chosen ? C.blueSoft : 'rgba(17,24,39,0.04)' }} />
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: chosen ? '900' : '600', flex: 1 }}>{opt}</Text>
                {pick !== null ? <Text style={{ color: chosen ? C.blue : C.faint, fontSize: 13, fontWeight: '900' }}>{pct}%</Text> : null}
              </View>
            </View>
          </Pressable>
        );
      })}

      {pick !== null ? (
        <Pressable onPress={next}>
          <View style={{ backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 3 }}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>Next round →</Text>
          </View>
        </Pressable>
      ) : (
        <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 2 }}>Tap a side — no take-backs 😌</Text>
      )}
    </LinearGradient>
  );
};
