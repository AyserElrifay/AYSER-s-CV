import React from 'react';
import { View, Text, Image } from 'react-native';
import { C } from '../../constants/theme';

/* ─── لمّة · A PLAYER, AT A GLANCE ───────────────────────────────────
   One component for the lobby, the standings and the podium, so a
   player looks like the same person in all three. Their photo if they
   took one, the first letter of their name if they did not — and the
   letter is not a lesser option, it is just what a name looks like.

   The photo is a small JPEG data URL that came from PharaohCam and was
   checked by the server. It is never a link to anywhere, so there is
   nothing here that can fetch from another site. */

export const Face = ({ player, size = 34, ring }) => {
  const src = player && typeof player.avatar_key === 'string'
    && player.avatar_key.indexOf('data:image/jpeg;base64,') === 0
    ? player.avatar_key : null;
  const letter = ((player && player.nickname) || '؟').trim().charAt(0) || '؟';

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
      backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center',
      borderWidth: ring ? 2 : 0, borderColor: ring || 'transparent',
    }}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ color: C.purple, fontWeight: '900', fontSize: Math.round(size * 0.44) }}>{letter}</Text>
      )}
    </View>
  );
};
