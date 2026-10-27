/* ────────────────────────── DESIGN TOKENS ─────────────────────────
   Ayser, October 2026 — one design for everybody: "Pure Monochrome Swiss
   Minimalism". OLED black canvas, deep charcoal surfaces, crisp white
   type, silver-grey secondary text, razor-thin #1F1F1F hairlines, and
   the main action inverted: a solid white pill with a black label. No
   colour, no gradients, no light/dark switch. The token NAMES stay
   (every screen reads C.purple, C.glass…) so the whole app changed at
   once: C.purple is the action colour, now white — one step off pure
   (#FFFFFE) so the page stylesheet (scripts/inject-html.mjs, MONO) can
   find every button painted with it and turn its label black.
     canvas #000000 · surface #0A0A0A · raised #141414 · line #1F1F1F
     text #FFFFFF · secondary #A3A3A3 · hint #737373 · action #FFFFFE   */

const MONO = {
  bg: '#000000', bg2: '#0A0A0A', glass: '#0A0A0A', glassHi: '#141414', line: '#1F1F1F',
  purple: '#FFFFFE', purpleSoft: 'rgba(255,255,255,0.08)', green: '#FFFFFF', greenSoft: 'rgba(255,255,255,0.08)',
  blue: '#FFFFFF', blueSoft: 'rgba(255,255,255,0.06)', coral: '#E5E5E5', coralSoft: 'rgba(255,255,255,0.08)',
  gold: '#FFFFFF', sun: '#FFFFFF', goldSoft: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF', dim: '#A3A3A3', faint: '#737373', ink: '#000000', float: 'rgba(10,10,10,0.96)', floatSolid: '#0A0A0A',
};

/* numbers that change — prices, countdowns, seats — never shuffle sideways */
export const NUM = { fontVariant: ['tabular-nums'] };

/* `C` is a SINGLE shared object — every screen imports this same
   reference and reads `C.bg` etc. straight in its render, with no
   StyleSheet.create anywhere in the app. That means we can flip the
   whole app's palette by mutating these properties in place (never
   reassigning the export) and then forcing one full re-render.
   There is one palette now (MONO above), so nothing flips any more. */
export const C = Object.assign({}, MONO);

/* one palette now; kept so older callers still work */
export function applyThemeMode() { Object.assign(C, MONO); }

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
