/* ────────────────────────── DESIGN TOKENS ─────────────────────────
   Bright & airy by default: white cards on a soft cloud-gray canvas,
   generous whitespace, and the neon accents kept for moments of
   delight. A real dark mode (deep charcoal canvas, brightened accents
   for contrast) is available too — see ThemeContext.
   Purple #7C3AED · Green #10B981 · Blue #3B82F6 · Coral #F43F5E     */

const LIGHT = {
  bg: '#F4F5F7',                       // cloud-gray canvas
  bg2: '#FFFFFF',                      // sheets & bars
  glass: '#FFFFFF',                    // cards are clean white
  glassHi: 'rgba(17,24,39,0.06)',      // subtle pressed / track fill
  line: 'rgba(17,24,39,0.08)',         // hairline borders
  purple: '#7C3AED',
  purpleSoft: 'rgba(124,58,237,0.09)',
  green: '#10B981',
  greenSoft: 'rgba(16,185,129,0.10)',
  blue: '#3B82F6',
  blueSoft: 'rgba(59,130,246,0.09)',
  coral: '#F43F5E',
  coralSoft: 'rgba(244,63,94,0.09)',
  gold: '#F5B301',                     // the signature Star reaction
  goldSoft: 'rgba(245,179,1,0.12)',
  text: '#111827',                     // near-black ink
  dim: 'rgba(17,24,39,0.60)',
  faint: 'rgba(17,24,39,0.38)',
  ink: '#FFFFFF',                      // label color on neon buttons
};

const DARK = {
  bg: '#0A0A0D',                       // deep charcoal canvas
  bg2: '#151519',                      // sheets & bars
  glass: '#1B1B21',                    // elevated cards
  glassHi: 'rgba(255,255,255,0.07)',   // subtle pressed / track fill
  line: 'rgba(255,255,255,0.10)',      // hairline borders
  purple: '#9370F7',                   // brightened for contrast on dark
  purpleSoft: 'rgba(147,112,247,0.18)',
  green: '#34D399',
  greenSoft: 'rgba(52,211,153,0.16)',
  blue: '#60A5FA',
  blueSoft: 'rgba(96,165,250,0.16)',
  coral: '#FB7185',
  coralSoft: 'rgba(251,113,133,0.16)',
  gold: '#F5B301',
  goldSoft: 'rgba(245,179,1,0.18)',
  text: '#F3F4F6',                     // near-white ink
  dim: 'rgba(243,244,246,0.64)',
  faint: 'rgba(243,244,246,0.40)',
  ink: '#FFFFFF',
};

/* `C` is a SINGLE shared object — every screen imports this same
   reference and reads `C.bg` etc. straight in its render, with no
   StyleSheet.create anywhere in the app. That means we can flip the
   whole app's palette by mutating these properties in place (never
   reassigning the export) and then forcing one full re-render.
   ThemeContext (src/context/ThemeContext.js) is what actually does
   the mutating + persists the choice + forces that re-render. */
export const C = Object.assign({}, LIGHT);

export function applyThemeMode(mode) {
  Object.assign(C, mode === 'dark' ? DARK : LIGHT);
}

export const R = 20; // house border-radius

/* Gentle gradient canvases for text-only posts (à la Facebook's
   colored status backgrounds) — soft pastels, easy on the eyes.
   These are content the user picks, not app chrome, so they stay
   the same regardless of light/dark mode. */
export const TEXT_BGS = {
  plain:    { colors: ['#FFFFFF', '#FFFFFF'], text: '#111827' },
  lavender: { colors: ['#EDE9FE', '#FCE7F3'], text: '#4C1D95' },
  mint:     { colors: ['#D1FAE5', '#ECFDF5'], text: '#065F46' },
  sky:      { colors: ['#DBEAFE', '#E0F2FE'], text: '#1E3A8A' },
  night:    { colors: ['#4C1D95', '#7C3AED'], text: '#FFFFFF' },
};

/* Google Maps dark styling — used automatically when dark mode is on. */
export const DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#141416' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#70707a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121212' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1e23' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#232329' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5c5c66' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1420' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#141416' }] },
];
