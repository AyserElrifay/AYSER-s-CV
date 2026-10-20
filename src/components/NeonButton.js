import React from 'react';
import { Text, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R } from '../constants/theme';

/* The signature control — refined for the light theme.
   A soft gradient fill with a gentle top sheen and a tasteful colored
   shadow (a quiet glow, not a loud halo). The label breathes slightly. */
export const NeonButton = ({ label, onPress, color = C.purple, style, small, icon }) => {
  const sheen = 0.12;   // still, not breathing: a button that pulses forever tires the eye

  return (
    <Pressable onPress={onPress} style={[{ alignSelf: 'stretch' }, style]}>
      {({ pressed }) => (
        <Animated.View
          style={{
            borderRadius: R - 4,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: color,
            shadowOpacity: pressed ? 0.18 : 0.32,
            shadowRadius: pressed ? 8 : 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 5,
          }}
        >
          <LinearGradient
            colors={[color, color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              borderRadius: R - 4,
              paddingVertical: small ? 11 : 16,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              overflow: 'hidden',
            }}
          >
            {/* top sheen for a soft, premium highlight */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
                backgroundColor: '#FFFFFF', opacity: sheen,
              }}
            />
            {icon ? <Text style={{ fontSize: small ? 13 : 16, marginRight: 8 }}>{icon}</Text> : null}
            <Text style={{ color: C.ink, fontSize: small ? 12 : 15, fontWeight: '800', letterSpacing: 0.2 }}>
              {label}
            </Text>
          </LinearGradient>
        </Animated.View>
      )}
    </Pressable>
  );
};
