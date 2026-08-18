import React from 'react';
import { View, Text, Image } from 'react-native';
import { C } from '../../constants/theme';
import { pharaohFor } from './pharaohArt';

/* ─── لمّة · A PLAYER, AT A GLANCE ───────────────────────────────────
   One component for the lobby, the standings and the podium, so a
   player looks like the same person in all three.

   ── THREE ANSWERS, IN ORDER ──────────────────────────────────────
   1. The pharaoh they built or photographed, if they did.
   2. A pharaoh drawn from their own id, if they did not — the same
      one on every phone, every time, because it is hashed from the id
      rather than picked at random. See pharaohArt.pharaohFor.
   3. The first letter of their name, only if there is no canvas to
      draw on at all.

   Step two is the one Ayser asked for, and it is not decoration. A
   board of eleven pharaohs and four grey letters reads as four people
   who did something wrong, when all they did was join quickly.

   The photo is a small JPEG data URL that came from PharaohCam or the
   character sheet and was checked by the server. It is never a link to
   anywhere, so there is nothing here that can fetch from another
   site — and the drawn fallback is made on this phone, so it is not a
   request either. Seventy faces cost seventy nothings. */

export const Face = ({ player, size = 34, ring }) => {
  const own = player && typeof player.avatar_key === 'string'
    && player.avatar_key.indexOf('data:image/jpeg;base64,') === 0
    ? player.avatar_key : null;

  /* Baked once per person and cached in pharaohArt, so this is a map
     lookup on every render after the first — including the render
     where seventy of them arrive at once. */
  const drawn = own ? null : pharaohFor(player && player.user_id);
  const src = own || drawn;
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
