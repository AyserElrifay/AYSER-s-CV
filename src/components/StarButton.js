import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../constants/theme';

/* Moments' signature reaction: a gold four-pointed star.
   A quick pop-spin on activation makes "starring" feel alive. */
/* Ayser, November 2026: the star answers right where you tapped it — a
   quick spring to 1.25 and a tiny gold burst (300 ms), on the button
   only, so the feed keeps scrolling; nothing dims or covers the screen */
const SPARKS = [[0, -1], [0.95, -0.3], [0.6, 0.8], [-0.6, 0.8], [-0.95, -0.3]];
export const StarButton = ({ starred, size = 22, onPress, style, hitSlop = 8 }) => {
  const v = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const [sparking, setSparking] = React.useState(false);

  const press = () => {
    v.setValue(1);
    Animated.sequence([
      Animated.timing(v, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(v, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
    if (!starred) {
      setSparking(true); burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => setSparking(false));
    }
    onPress && onPress();
  };

  return (
    <Pressable onPress={press} hitSlop={hitSlop} style={style}>
      <Animated.View style={{ transform: [{ scale: v }] }}>
        <MaterialCommunityIcons
          name={starred ? 'star-four-points' : 'star-four-points-outline'}
          size={size}
          color={starred ? C.gold : C.faint}
        />
      </Animated.View>
      {sparking ? SPARKS.map(([x, y], i) => (
        <Animated.View key={i} pointerEvents="none" style={{
          position: 'absolute', left: size / 2 - 2, top: size / 2 - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.gold,
          opacity: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, x * size * 0.9] }) },
            { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, y * size * 0.9] }) },
          ],
        }} />
      )) : null}
    </Pressable>
  );
};
