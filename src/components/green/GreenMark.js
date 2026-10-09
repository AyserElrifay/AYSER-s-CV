import React from 'react';
import { Platform, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/* ─── THE GREEN MARK ──────────────────────────────────────────────────
   Ayser sent EcoQuest's logo — "عجبني اللوجو ده اوي ... ممكن نعمل منه
   ايكون؟". Not that one: it is somebody else's brand, and taking it is
   precisely the legal trouble he has asked this app never to get into.

   What he liked in it can be had honestly, though: one simple, friendly
   shape in two greens that reads at any size. So this is our own, and
   it says what this part of the app is for — a map pin whose body is a
   leaf. The point is where it touches the map, the curled tip and the
   two-tone midrib make it a leaf, and the hole is "you are here". A
   green place you go to.

   The hole is cut out of the shape (even-odd fill), not painted on, so
   whatever is behind the mark shows through it — a gradient, a photo,
   either theme.

   Drawn as SVG on the web (no library — the browser draws it); on a
   phone build without a DOM it falls back to the leaf emoji the button
   wore before. `onDark` swaps to the lighter pair for a dark ground. */
export const GreenMark = ({ size = 24, onDark }) => {
  /* Left unsaid, it follows the theme: the deep pair on a dark tab was
     dark green on near-black, and barely there. */
  const { isDark } = useTheme();
  const dark = onDark === undefined ? isDark : onDark;
  if (Platform.OS !== 'web') return <Text style={{ fontSize: size * 0.9 }}>🌿</Text>;
  const deep = dark ? '#4CC38A' : '#1F7A5A';
  const light = dark ? '#9BE7BF' : '#37B07F';
  const r = size < 28 ? 7.5 : 6.5;
  /* a circle as two arcs, inside the deep half (the midrib is at x≈44
     at this height, the circle reaches 35) */
  const hole = `M${27.5 - r} 27 a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ display: 'block' }}>
      <path d={'M32 61 C12 44,8 24,20 13 C29 5,43 4,55 4 Q42 30,32 61 Z ' + hole} fill={deep} fillRule="evenodd" />
      <path d="M32 61 Q42 30,55 4 C57 22,51 41,32 61 Z" fill={light} />
    </svg>
  );
};
