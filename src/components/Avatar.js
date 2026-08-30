import React, { useState } from 'react';
import { View, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';

/* ─── A FACE, OR SOMETHING BETTER THAN A HOLE ────────────────────────
   There is a neutral avatar in the constants — the Moments star on
   violet, as an SVG data URI — and on the web it does not draw. The
   image layer stays empty, so anybody who has not uploaded a photo
   yet, which is everybody on their first day, saw a ring with nothing
   inside it. Two of them at the top of the very first screen.

   The fix is not to argue with the image loader: the fallback is
   drawn rather than fetched, out of ordinary elements that cannot
   fail to paint. A real photo still wins the moment there is one, and
   if that photo 404s this is what is underneath.

   It is a person, not the Moments star. The star was the first
   version and it sat directly beside the violet ✦ button that starts
   a post — two identical circles doing entirely different jobs, which
   is worse than the hole it replaced. A silhouette says "somebody,
   with no photo yet", which is exactly what it means. */
export const Avatar = ({ uri, size = 42, ring, style }) => {
  const [broken, setBroken] = useState(false);
  const show = uri && !broken;
  const border = ring ? { borderWidth: 2, borderColor: C.purple } : null;
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (show) {
    return (
      <Image
        source={{ uri }}
        onError={() => setBroken(true)}
        style={[box, border, { backgroundColor: C.glassHi }, style]}
      />
    );
  }
  return (
    <View style={[
      box, border, style,
      { backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' },
    ]}>
      <Ionicons name="person" size={size * 0.5} color={C.purple} />
    </View>
  );
};
