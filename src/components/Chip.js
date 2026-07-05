import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';

export const Chip = ({ label, color, tint, style }) => (
  <View
    style={[
      {
        backgroundColor: tint || 'rgba(18,18,20,0.72)',
        borderColor: C.line,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      },
      style,
    ]}
  >
    <Text style={{ color: color || C.text, fontSize: 11, fontWeight: '700' }}>{label}</Text>
  </View>
);
