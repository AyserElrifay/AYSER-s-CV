import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';
import { Micro } from './Micro';

export const ScreenHeader = ({ kicker, title, right }) => (
  <View style={{ marginBottom: 18 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View>
        {kicker ? <Micro style={{ marginBottom: 6 }}>{kicker}</Micro> : null}
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: 0.4 }}>{title}</Text>
      </View>
      {right || null}
    </View>
  </View>
);
