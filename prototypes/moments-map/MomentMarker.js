import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withRepeat, withSequence, Easing, interpolate,
} from 'react-native-reanimated';
import { PALETTE } from './mapStyle';

/* ─────────────────────────────────────────────────────────────────────
   MomentMarker — the heart of the Moments Map.

   It is NOT a pin. It's the user's AVATAR (Bitmoji-style) sitting inside
   a gradient "Story Ring", with their latest Moment shown as a little
   POLAROID thumbnail tucked at the shoulder. Tapping it plays a bouncy
   scale-up (reanimated spring) to tee up the full media view.

   Snap vibe = avatar-centric + playful motion.
   ───────────────────────────────────────────────────────────────────── */

const RING = 62;      // outer story-ring diameter
const AVATAR = 50;    // avatar diameter
const POLA = 34;      // polaroid thumbnail size

export function MomentMarker({ moment, isActive, hasFreshMoment, onPress }) {
  // idle float so the whole canvas feels alive (Snap energy)
  const float = useSharedValue(0);
  // press feedback + "selected" emphasis
  const press = useSharedValue(0);
  // story-ring shimmer when there's an unseen Moment
  const shimmer = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1, true,
    );
    if (hasFreshMoment) {
      shimmer.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false,
      );
    }
  }, [hasFreshMoment]);

  // bouncy scale-up when this marker becomes the active/tapped one
  useEffect(() => {
    press.value = withSpring(isActive ? 1 : 0, { damping: 9, stiffness: 170, mass: 0.6 });
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => {
    const y = interpolate(float.value, [0, 1], [0, -6]);
    const scale = 1 + press.value * 0.28;           // grows ~28% on tap
    const lift = interpolate(press.value, [0, 1], [0, -10]);
    return { transform: [{ translateY: y + lift }, { scale }] };
  });

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shimmer.value * 360}deg` }],
    opacity: hasFreshMoment ? 1 : 0.55,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + press.value * 0.45,
    transform: [{ scale: 1 + press.value * 0.5 }],
  }));

  const handlePress = () => {
    // little squash-and-stretch before handing off to the media view
    press.value = withSequence(
      withSpring(1.15, { damping: 6, stiffness: 220 }),
      withSpring(1, { damping: 10, stiffness: 180 }),
    );
    onPress && onPress(moment);
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10}>
      <Animated.View style={[styles.wrap, containerStyle]}>
        {/* purple activity glow underneath */}
        <Animated.View style={[styles.glow, glowStyle]} />

        {/* gradient story ring (rotating shimmer when fresh) */}
        <Animated.View style={[styles.ring, ringStyle]}>
          <View style={styles.ringInner} />
        </Animated.View>

        {/* the avatar itself */}
        <Image source={{ uri: moment.avatar }} style={styles.avatar} />

        {/* activity emoji badge (what they're up to) */}
        {moment.doing ? (
          <View style={styles.doing}><Text style={{ fontSize: 13 }}>{moment.doing}</Text></View>
        ) : null}

        {/* the latest Moment as a tiny polaroid at the shoulder */}
        {moment.thumb ? (
          <View style={styles.polaroid}>
            <Image source={{ uri: moment.thumb }} style={styles.polaroidImg} />
          </View>
        ) : null}

        {/* name pill */}
        <View style={styles.pill}>
          <Text numberOfLines={1} style={styles.pillText}>{moment.name}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: RING + 24, height: RING + 34, alignItems: 'center', justifyContent: 'flex-start' },
  glow: {
    position: 'absolute', top: 2, width: RING + 18, height: RING + 18, borderRadius: (RING + 18) / 2,
    backgroundColor: PALETTE.purple,
  },
  ring: {
    width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center',
    // fake conic gradient with a thick tri-colour border
    borderWidth: 3, borderColor: PALETTE.ring1,
    borderTopColor: PALETTE.ring3, borderRightColor: PALETTE.ring2, borderBottomColor: PALETTE.ring1, borderLeftColor: PALETTE.ring3,
    backgroundColor: 'transparent',
  },
  ringInner: {
    width: RING - 8, height: RING - 8, borderRadius: (RING - 8) / 2,
    borderWidth: 2, borderColor: PALETTE.white,
  },
  avatar: {
    position: 'absolute', top: (RING - AVATAR) / 2, width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    borderWidth: 2, borderColor: PALETTE.white, backgroundColor: '#ddd',
  },
  doing: {
    position: 'absolute', top: 0, left: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  polaroid: {
    position: 'absolute', top: -2, right: 0, width: POLA, height: POLA + 6, backgroundColor: PALETTE.white,
    borderRadius: 6, padding: 2, transform: [{ rotate: '8deg' }],
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  polaroidImg: { flex: 1, borderRadius: 3, backgroundColor: '#eee' },
  pill: {
    position: 'absolute', bottom: 0, maxWidth: RING + 20, backgroundColor: PALETTE.white,
    borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },
  pillText: { fontSize: 10.5, fontWeight: '800', color: PALETTE.ink },
});
