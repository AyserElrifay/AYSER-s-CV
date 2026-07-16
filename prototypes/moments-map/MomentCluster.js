import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate,
} from 'react-native-reanimated';
import { PALETTE } from './mapStyle';

/* ─────────────────────────────────────────────────────────────────────
   MomentCluster — when several Moments stack at one spot, we don't show
   ten overlapping avatars. We show a stacked-avatar bundle with a
   "N Moments here" pill and a SUBTLE GLOWING PULSE that reads as "high
   community activity right here" (the heat cue).
   ───────────────────────────────────────────────────────────────────── */

export function MomentCluster({ count, avatars = [], onPress }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, false,
    );
  }, []);

  // expanding halo — stronger/faster feel for busier clusters
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.7, 1], [0.5, 0.12, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.85, 1.9]) }],
  }));

  const heat = Math.min(1, count / 8); // 0..1 activity intensity

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.halo, halo, { backgroundColor: mixHeat(heat) }]} />
      <View style={[styles.bundle, { borderColor: mixHeat(heat) }]}>
        {avatars.slice(0, 3).map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={[styles.stack, { left: 6 + i * 13, zIndex: 3 - i, borderColor: PALETTE.white }]}
          />
        ))}
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{count} Moments</Text>
      </View>
    </View>
  );
}

// gold → coral as activity rises (cool→hot)
function mixHeat(t) {
  return t > 0.6 ? PALETTE.coral : t > 0.3 ? PALETTE.gold : PALETTE.purple;
}

const styles = StyleSheet.create({
  wrap: { width: 84, height: 74, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 70, height: 70, borderRadius: 35 },
  bundle: {
    width: 58, height: 40, borderRadius: 20, backgroundColor: PALETTE.white, borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5,
  },
  stack: { position: 'absolute', top: 4, width: 30, height: 30, borderRadius: 15, borderWidth: 2, backgroundColor: '#ddd' },
  pill: {
    position: 'absolute', bottom: 0, backgroundColor: PALETTE.ink, borderRadius: 9,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pillText: { color: PALETTE.white, fontSize: 10.5, fontWeight: '900' },
});
