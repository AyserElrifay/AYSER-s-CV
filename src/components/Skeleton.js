import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { C, R } from '../constants/theme';

/* ─── THE SHAPE OF WHAT IS COMING ────────────────────────────────────
   A spinner says "wait". A skeleton says "here is your feed, the words
   are a second behind" — and because the layout is already in place,
   nothing jumps when the real thing lands. That absence of jump is
   most of what people mean when they say an app feels fast.

   Deliberately quiet: a slow pulse between two very close greys, no
   sweeping highlight. A shimmer racing across the screen is the
   fashionable version and it is also the one that makes an older
   reader think something is wrong. */
const Pulse = ({ style }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      style={[
        { backgroundColor: C.glassHi, borderRadius: 10 },
        style,
        { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
      ]}
    />
  );
};

export const SkeletonLine = ({ w = '100%', h = 12, style }) => (
  <Pulse style={[{ width: w, height: h, borderRadius: h / 2 }, style]} />
);

/* One post, in outline. The proportions match PostCard so the real
   card lands exactly where the grey one was. */
export const SkeletonPost = () => (
  <View style={{
    backgroundColor: C.glass, borderRadius: R, borderWidth: 1, borderColor: C.line,
    padding: 14, marginBottom: 14,
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pulse style={{ width: 40, height: 40, borderRadius: 20 }} />
      <View style={{ marginLeft: 11, flex: 1 }}>
        <SkeletonLine w={130} h={12} />
        <SkeletonLine w={78} h={10} style={{ marginTop: 7 }} />
      </View>
    </View>
    <Pulse style={{ height: 168, borderRadius: 16, marginTop: 13 }} />
    <View style={{ flexDirection: 'row', marginTop: 13 }}>
      <SkeletonLine w={54} h={12} />
      <SkeletonLine w={54} h={12} style={{ marginLeft: 16 }} />
      <SkeletonLine w={54} h={12} style={{ marginLeft: 16 }} />
    </View>
  </View>
);

export const SkeletonFeed = ({ count = 2 }) => (
  <View>{Array.from({ length: count }, (_, i) => <SkeletonPost key={i} />)}</View>
);
