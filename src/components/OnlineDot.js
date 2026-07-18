import React from 'react';
import { View } from 'react-native';
import { C } from '../constants/theme';

/* A real green dot — only rendered while the person's own device has a
   live Realtime Presence connection (see PresenceContext). Sized/placed
   to sit on the bottom-right corner of an avatar. */
export const OnlineDot = ({ size = 13, ring = 2 }) => (
  <View
    style={{
      position: 'absolute', bottom: -1, right: -1,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.green, borderWidth: ring, borderColor: '#FFF',
    }}
  />
);
