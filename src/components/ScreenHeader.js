import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { Micro } from './Micro';

export const ScreenHeader = ({ kicker, title, right, onBack, backLabel }) => (
  <View style={{ marginBottom: 18 }}>
    {onBack ? (
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={backLabel || 'Back'}
        style={{ alignSelf: 'flex-start', width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
      </Pressable>
    ) : null}
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View>
        {kicker ? <Micro style={{ marginBottom: 6 }}>{kicker}</Micro> : null}
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: 0.4 }}>{title}</Text>
      </View>
      {right || null}
    </View>
  </View>
);
