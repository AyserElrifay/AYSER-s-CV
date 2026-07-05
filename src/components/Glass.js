import React from 'react';
import { View } from 'react-native';
import { C, R } from '../constants/theme';

export const Glass = ({ children, style, tint, border }) => (
  <View
    style={[
      {
        backgroundColor: tint || C.glass,
        borderColor: border || C.line,
        borderWidth: 1,
        borderRadius: R,
      },
      style,
    ]}
  >
    {children}
  </View>
);
