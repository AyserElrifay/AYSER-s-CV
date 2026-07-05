import React from 'react';
import { Text } from 'react-native';
import { C } from '../constants/theme';

export const Micro = ({ children, color, style }) => (
  <Text
    style={[
      { color: color || C.dim, fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
      style,
    ]}
  >
    {children}
  </Text>
);
