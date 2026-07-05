import React from 'react';
import { View, Image } from 'react-native';
import { C } from '../constants/theme';

export const AvatarStack = ({ uris, size = 26 }) => (
  <View style={{ flexDirection: 'row' }}>
    {uris.map((u, i) => (
      <Image
        key={i}
        source={{ uri: u }}
        style={{
          width: size, height: size, borderRadius: size / 2,
          marginLeft: i === 0 ? 0 : -9,
          borderWidth: 2, borderColor: C.bg,
        }}
      />
    ))}
  </View>
);
