import React from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { C } from '../constants/theme';
import { usePulse } from '../hooks/usePulse';

export const PersonPin = ({ p, onPress }) => (
  <Pressable onPress={onPress} style={{ alignItems: 'center' }}>
    <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: C.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 }}>
      <Text style={{ color: C.text, fontSize: 10.5, fontWeight: '800' }}>{p.intent}</Text>
    </View>
    <View
      style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: 'rgba(124,58,237,0.28)',
        borderWidth: 1.5, borderColor: C.purple,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
      {/* the activity they chose to show — what they're up to right now */}
      {p.doing ? (
        <View style={{ position: 'absolute', bottom: -5, right: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11 }}>{p.doing}</Text>
        </View>
      ) : null}
    </View>
  </Pressable>
);

export const CampfirePin = ({ c }) => {
  const pulse = usePulse(1300);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: C.coral,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.3] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
          }}
        />
        <View
          style={{
            width: 42, height: 42, borderRadius: 21,
            backgroundColor: 'rgba(244,63,94,0.2)',
            borderWidth: 1.5, borderColor: C.coral,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 19 }}>🔥</Text>
        </View>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'rgba(244,63,94,0.5)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 }}>
        <Text style={{ color: C.coral, fontSize: 10, fontWeight: '800' }}>
          {c.listeners != null ? '🎧 ' + c.listeners : 'LIVE 🔥'}
        </Text>
      </View>
    </View>
  );
};

export const MePin = ({ doing }) => {
  const pulse = usePulse(1600);
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: C.purple,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.35] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
        }}
      />
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.purple, borderWidth: 3, borderColor: '#fff' }} />
      {doing ? (
        <View style={{ position: 'absolute', top: -12, right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12 }}>{doing}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const SOSButton = ({ onPress }) => {
  const pulse = usePulse(1100);
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', justifyContent: 'center', width: 72, height: 72 }}>
      <Animated.View
        style={{
          position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: C.coral,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.4] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.18] }) }],
        }}
      />
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>SOS</Text>
      </View>
    </Pressable>
  );
};
