import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { seatState, seatPillText } from '../constants/joinWords';

/* ─── THE SEAT PILL ───────────────────────────────────────────────────
   Ayser, November 2026: "1 booked of 10" on a card kills momentum. A
   table says what it is until it is half full, then the real seats left,
   then sold out (seatState in joinWords.js — each one true). The host
   still sees the exact count, in "Who is coming". Icons, not emoji. */
export const SeatPill = ({ g, lang, waitlist = false, style }) => {
  const { level } = seatState(g);
  const fast = level === 'fast';
  const full = level === 'full';
  const fg = fast ? C.bg : full ? C.dim : C.text;
  return (
    <View testID={'seat-pill-' + level} style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
      paddingHorizontal: 11, paddingVertical: 5, backgroundColor: fast ? C.text : 'transparent', borderWidth: fast ? 0 : 1, borderColor: C.line }, style]}>
      <Ionicons name={full ? 'lock-closed' : fast ? 'flame' : 'sparkles-outline'} size={13} color={fast ? C.bg : full ? C.dim : C.purple} />
      <Text style={{ color: fg, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1}>{seatPillText(lang, g, waitlist)}</Text>
    </View>
  );
};
