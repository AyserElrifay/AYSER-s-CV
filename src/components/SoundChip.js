import React from 'react';
import { View, Text } from 'react-native';

/* The spinning-disc sound tag seen on stories & reels. */
export const SoundChip = ({ sound, light }) => {
  if (!sound) return null;
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: light ? 'rgba(255,255,255,0.92)' : 'rgba(17,24,39,0.62)',
        borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 12 }}>🎵</Text>
      <Text
        numberOfLines={1}
        style={{
          color: light ? '#111827' : '#FFF', fontSize: 12, fontWeight: '700',
          marginLeft: 6, maxWidth: 190,
        }}
      >
        {sound.title} · {sound.artist}
      </Text>
    </View>
  );
};
