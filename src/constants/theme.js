/* ────────────────────────── DESIGN TOKENS ─────────────────────────
   Bright & airy: white cards on a soft cloud-gray canvas, generous
   whitespace, and the neon accents kept for moments of delight.
   Purple #7C3AED · Green #10B981 · Blue #3B82F6 · Coral #F43F5E     */

export const C = {
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
  text: '#111827',                     // near-black ink
  dim: 'rgba(17,24,39,0.60)',
  faint: 'rgba(17,24,39,0.38)',
  ink: '#FFFFFF',                      // label color on neon buttons
};

export const R = 20; // house border-radius

/* Gentle gradient canvases for text-only posts (à la Facebook's
   colored status backgrounds) — soft pastels, easy on the eyes. */
export const TEXT_BGS = {
  plain:    { colors: ['#FFFFFF', '#FFFFFF'], text: '#111827' },
  lavender: { colors: ['#EDE9FE', '#FCE7F3'], text: '#4C1D95' },
  mint:     { colors: ['#D1FAE5', '#ECFDF5'], text: '#065F46' },
  sky:      { colors: ['#DBEAFE', '#E0F2FE'], text: '#1E3A8A' },
  night:    { colors: ['#4C1D95', '#7C3AED'], text: '#FFFFFF' },
};

/* Kept for an optional future dark mode. */
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
