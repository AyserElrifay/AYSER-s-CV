import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { PALETTE } from './mapStyle';

/* ─────────────────────────────────────────────────────────────────────
   VisibilityToggle — the Snap "Ghost Mode" switch.

   Two modes:
     • 👻 Ghost      — hide my location & Moments (invisible to everyone)
     • 🌍 Community  — visible to all, sparks & bumps enabled
   A sliding pill with a springy thumb. Controlled component: parent owns
   the `mode` state so the map can react (dim/hide the user's own marker).
   ───────────────────────────────────────────────────────────────────── */

export function VisibilityToggle({ mode, onChange }) {
  const isGhost = mode === 'ghost';

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(isGhost ? 0 : 96, { damping: 14, stiffness: 160 }) }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.thumb, thumb, { backgroundColor: isGhost ? '#334155' : PALETTE.purple }]} />
      <Pressable style={styles.half} onPress={() => onChange('ghost')}>
        <Text style={[styles.label, { color: isGhost ? '#fff' : '#64748b' }]}>👻 Ghost</Text>
      </Pressable>
      <Pressable style={styles.half} onPress={() => onChange('community')}>
        <Text style={[styles.label, { color: !isGhost ? '#fff' : '#64748b' }]}>🌍 Community</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', width: 200, height: 40, borderRadius: 20, backgroundColor: '#fff',
    padding: 4, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  thumb: { position: 'absolute', left: 4, width: 96, height: 32, borderRadius: 16 },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  label: { fontSize: 12.5, fontWeight: '900' },
});
