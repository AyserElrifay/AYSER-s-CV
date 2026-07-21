import React from 'react';
import { Image } from 'react-native';

/* ─── The Moments brand mark ───────────────────────────────────────
   The one true logo, rendered from the approved artwork: the lowercase
   "moments" wordmark with the gold spark floating above the o. Bundled
   as a transparent PNG so it looks pixel-identical everywhere — header,
   auth, splash — instead of faking it with a system font.

   The artwork box is 1036×420; the word itself sits in the lower ~42%
   with the spark hovering above, so a little headroom above the text is
   by design. Pass `height` (the full art box) — width tracks the ratio. */

const WORDMARK = require('../assets/brand/wordmark.png');
const WORDMARK_WHITE = require('../assets/brand/wordmark-white.png');
const MARK = require('../assets/brand/mark.png');

const RATIO = 1036 / 420; // ≈ 2.467

export function Wordmark({ height = 54, white = false, style }) {
  return (
    <Image
      source={white ? WORDMARK_WHITE : WORDMARK}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Moments"
      style={[{ height, width: height * RATIO }, style]}
    />
  );
}

/* The square app mark (purple tile · white m · gold spark) — for compact
   spots where the full wordmark won't fit. */
export function LogoMark({ size = 40, style }) {
  return (
    <Image
      source={MARK}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Moments"
      style={[{ width: size, height: size }, style]}
    />
  );
}
