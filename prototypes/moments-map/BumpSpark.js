import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import { PALETTE } from './mapStyle';

/* ─────────────────────────────────────────────────────────────────────
   BumpSpark — the visual "bump" between two nearby avatars. Rendered
   inside a <Marker> anchored at the pair's midpoint. A pulsing energy
   ring + a travelling spark + a "⚡ Bump" tag. The `strength` (0..1 from
   useBump) drives how hot/fast it feels — closer people spark harder.
   ───────────────────────────────────────────────────────────────────── */

export function BumpSpark({ strength = 0.5 }) {
  const t = useSharedValue(0);

  useEffect(() => {
    const dur = 1400 - strength * 700; // stronger = faster
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1, false,
    );
  }, [strength]);

  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.6, 1], [0.7, 0.2, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.4, 1.6 + strength]) }],
  }));

  const spark = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-16, 16]) },
      { scale: 0.8 + strength * 0.6 },
    ],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.ring, ring, { borderColor: hot(strength) }]} />
      <Animated.View style={[styles.spark, spark]}>
        <Text style={{ fontSize: 16 }}>⚡</Text>
      </Animated.View>
      <View style={[styles.tag, { backgroundColor: hot(strength) }]}>
        <Text style={styles.tagText}>Bump</Text>
      </View>
    </View>
  );
}

const hot = (s) => (s > 0.66 ? PALETTE.coral : s > 0.33 ? PALETTE.gold : PALETTE.purple);

const styles = StyleSheet.create({
  wrap: { width: 80, height: 60, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 46, height: 46, borderRadius: 23, borderWidth: 2.5 },
  spark: { position: 'absolute' },
  tag: { position: 'absolute', bottom: 2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1.5, flexDirection: 'row', alignItems: 'center' },
  tagText: { color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.3 },
});
