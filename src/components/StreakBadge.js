import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';

/* The Snapchat-style streak chip: 🔥 + the number, a milestone badge
   once you hit 30 / 100 / 365 / 1000 days, and an ⏳ hours-left warning
   when the streak is about to break (you both still need to send a
   Moment today). Real — the numbers come from moments actually
   exchanged. Pass `info` from streakInfo(), or just `n` for the header. */
export const StreakBadge = ({ info, n, size = 'sm' }) => {
  const count = info ? info.n : (n || 0);
  if (!count) return null;
  const expiring = !!(info && info.expiring);
  const badge = (info && info.badge) || '';
  const small = size === 'sm';
  const fs = small ? 11.5 : 13;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: expiring ? 'rgba(245,158,11,0.16)' : C.coralSoft,
      borderRadius: 999, paddingHorizontal: small ? 7 : 9, paddingVertical: small ? 2 : 3,
    }}>
      <Text style={{ fontSize: fs }}>{expiring ? '⏳' : '🔥'}</Text>
      <Text style={{ color: expiring ? '#B45309' : C.coral, fontSize: fs, fontWeight: '900', marginLeft: 2 }}>
        {count}{badge ? ' ' + badge : ''}
      </Text>
      {expiring && info && info.hoursLeft > 0 ? (
        <Text style={{ color: '#B45309', fontSize: fs - 2, fontWeight: '800', marginLeft: 4 }}>
          {info.hoursLeft}h
        </Text>
      ) : null}
    </View>
  );
};
