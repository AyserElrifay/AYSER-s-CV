import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';

export const RatingBar = ({ icon, label, value, color }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
    <Text style={{ width: 24, fontSize: 12 }}>{icon}</Text>
    <Text style={{ color: C.dim, fontSize: 11, width: 58, fontWeight: '600' }}>{label}</Text>
    <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <View style={{ width: ((value / 5) * 100) + '%', height: 5, borderRadius: 3, backgroundColor: color }} />
    </View>
    <Text style={{ color: C.text, fontSize: 11, fontWeight: '800', marginLeft: 10, width: 26, textAlign: 'right' }}>
      {value.toFixed(1)}
    </Text>
  </View>
);
