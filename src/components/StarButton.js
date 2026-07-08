import React, { useRef } from 'react';
import { Pressable, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';

/* Moments' signature reaction: a gold four-pointed star.
   A quick pop-spin on activation makes "starring" feel alive. */
export const StarButton = ({ starred, size = 22, onPress, style, hitSlop = 8 }) => {
  const v = useRef(new Animated.Value(1)).current;

  const press = () => {
    v.setValue(0.6);
    Animated.spring(v, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
    onPress && onPress();
  };

  return (
    <Pressable onPress={press} hitSlop={hitSlop} style={style}>
      <Animated.View
        style={{
          transform: [
            { scale: v },
            { rotate: v.interpolate({ inputRange: [0.6, 1], outputRange: ['-25deg', '0deg'] }) },
          ],
        }}
      >
        <MaterialCommunityIcons
          name={starred ? 'star-four-points' : 'star-four-points-outline'}
          size={size}
          color={starred ? C.gold : C.faint}
        />
      </Animated.View>
    </Pressable>
  );
};
