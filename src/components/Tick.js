import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';

export const Tick = ({ size = 15 }) => (
  <View
    style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginLeft: 5,
    }}
  >
    <Ionicons name="checkmark" size={size - 5} color="#fff" />
  </View>
);
