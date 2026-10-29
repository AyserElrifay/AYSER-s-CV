import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { flagOf, tableNo } from '../constants/tableCore';

/* the Moments Flag of a table: its pillar's colour and its number —
   on the Drop ticket, in the table chat, and full-screen on the host's
   phone (TableBeacon in StampKit.js) */
export const FlagBadge = ({ cat, no, lang, style }) => {
  const f = flagOf(cat);
  return (
    <View style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 6, backgroundColor: f.bg, paddingHorizontal: 9, paddingVertical: 5 }, style]}>
      <Ionicons name="flag" size={12} color={f.ink} />
      <Text style={{ color: f.ink, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1, marginHorizontal: 6 }}>{f.name + '  #' + tableNo(no)}</Text>
    </View>
  );
};
