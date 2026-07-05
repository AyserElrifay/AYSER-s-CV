import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '../constants/theme';
import { Micro } from './Micro';

export const SectionHeader = ({ title, action, onAction, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, style]}>
    <Micro>{title}</Micro>
    {action ? (
      <Pressable onPress={onAction}>
        <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}>{action}</Text>
      </Pressable>
    ) : null}
  </View>
);
