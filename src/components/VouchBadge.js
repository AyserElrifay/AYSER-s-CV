import React from 'react';
import { Text } from 'react-native';
import { C } from '../constants/theme';
import { Glass } from './Glass';

export const VouchBadge = ({ tag, count, style }) => (
  <Glass tint={C.blueSoft} border="rgba(59,130,246,0.4)" style={[{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center' }, style]}>
    <Text style={{ fontSize: 12 }}>🛡️</Text>
    <Text style={{ color: '#9EC5FF', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
      Vouched as a {tag} by {count} Roam Mates
    </Text>
  </Glass>
);
