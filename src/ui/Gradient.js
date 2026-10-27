import React from 'react';
import { LinearGradient as Base } from 'expo-linear-gradient';
import { C } from '../constants/theme';

/* ─── ONE COLOUR, NOT A RAINBOW ───────────────────────────────────────
   The design system (theme.js): a warm canvas and one brand colour, no
   multi-colour neon gradients. Every LinearGradient in the app comes
   through here. A colour with real hue is turned to Moments violet at
   the same lightness and (at most) the same saturation — a dark
   backdrop stays dark, so white text on it stays readable, and a
   pink-to-cyan sweep becomes a calm violet one. Greys, blacks and
   whites (the scrim over a photo) pass through untouched. */

const parse = (c) => {
  const s = String(c || '').trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;   // 'transparent' and names pass through
};

const BRAND_HUE = 262;   // #7C3AED

export const toBrand = (c) => {
  const v = parse(c);
  if (!v) return c;
  const [r, g, b, a] = v.map((x, i) => (i < 3 ? x / 255 : x));
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.12) return c;                        // a grey, a black, a white: as it was
  // Moments Black (its C.purple is #FFFFFE): no hue at all, the same lightness in grey
  if (C.purple === '#FFFFFE') { const g = Math.round(255 * l); return 'rgba(' + g + ',' + g + ',' + g + ',' + a + ')'; }
  const sat = Math.min(s, 0.75);
  // HSL back to RGB at the brand's hue
  const k = (n) => (n + BRAND_HUE / 30) % 12;
  const q = sat * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - q * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return 'rgba(' + f(0) + ',' + f(8) + ',' + f(4) + ',' + a + ')';
};

export const LinearGradient = ({ colors, ...rest }) => <Base colors={(colors || []).map(toBrand)} {...rest} />;
