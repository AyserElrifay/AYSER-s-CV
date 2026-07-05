import React from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';

export const AvatarRing = ({ uri, size = 62, live }) => (
  <View style={{ alignItems: 'center' }}>
    <LinearGradient
      colors={live ? [C.coral, C.purple] : [C.purple, C.green]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ backgroundColor: C.bg, borderRadius: size / 2, padding: 2.5 }}>
        <Image source={{ uri }} style={{ width: size - 11, height: size - 11, borderRadius: (size - 11) / 2 }} />
      </View>
    </LinearGradient>
    {live ? (
      <View style={{ position: 'absolute', bottom: -4, backgroundColor: C.coral, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1.5, borderColor: C.bg }}>
        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>LIVE</Text>
      </View>
    ) : null}
  </View>
);
