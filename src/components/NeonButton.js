import React from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { C, R } from '../constants/theme';
import { usePulse } from '../hooks/usePulse';

/* The signature control. Breathing neon glow, dark ink label. */
export const NeonButton = ({ label, onPress, color = C.green, style, small, icon }) => {
  const p = usePulse(1700);
  const glowOpacity = p.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.55] });
  const glowScale = p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Pressable onPress={onPress} style={[{ alignSelf: 'stretch' }, style]}>
      {({ pressed }) => (
        <View>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: -4, bottom: -4, left: -4, right: -4,
              borderRadius: R, backgroundColor: color,
              opacity: glowOpacity, transform: [{ scale: glowScale }],
            }}
          />
          <View
            style={{
              borderRadius: R - 4,
              backgroundColor: color,
              paddingVertical: small ? 10 : 16,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }}
          >
            {icon ? <Text style={{ fontSize: small ? 13 : 16, marginRight: 8 }}>{icon}</Text> : null}
            <Text style={{ color: C.ink, fontSize: small ? 12 : 15, fontWeight: '900', letterSpacing: 1.6 }}>
              {label}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
};
