import React from 'react';
import { View, Text, Image } from 'react-native';
import { C } from '../constants/theme';

/* a person's face, or their initial on the brand's soft ground when there is no photo */
export const Face = ({ uri, name, size = 36 }) => (
  uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.glassHi }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.purple, fontSize: size * 0.42, fontWeight: '700' }}>{String(name || '?').trim().charAt(0).toUpperCase()}</Text>
      </View>
    )
);
