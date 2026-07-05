import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { C, R } from '../constants/theme';

export const GhostButton = ({ label, onPress, color = C.text, style, small }) => (
  <Pressable onPress={onPress} style={style}>
    {({ pressed }) => (
      <View
        style={{
          borderRadius: R - 4, borderWidth: 1, borderColor: C.glassHi,
          backgroundColor: pressed ? 'rgba(255,255,255,0.09)' : C.glass,
          paddingVertical: small ? 10 : 15, paddingHorizontal: 18,
          alignItems: 'center',
        }}
      >
        <Text style={{ color, fontSize: small ? 12 : 14, fontWeight: '800', letterSpacing: 0.8 }}>{label}</Text>
      </View>
    )}
  </Pressable>
);
