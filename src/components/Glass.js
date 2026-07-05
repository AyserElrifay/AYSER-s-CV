import React, { useContext } from 'react';
import { View } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { R } from '../constants/theme';

export const Glass = ({ children, style, tint, border }) => {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={[{ backgroundColor: tint || theme.glass, borderColor: border || theme.line, borderWidth: 1, borderRadius: R }, style]}>
      {children}
    </View>
  );
};
