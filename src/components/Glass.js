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
        // soft lift so white cards breathe on the light canvas
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      },
      style,
    ]}
  >
    {children}
  </View>
);
