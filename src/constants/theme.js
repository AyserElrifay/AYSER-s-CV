import { LIQUID } from '../lib/liquid';
/* ────────────────────────── DESIGN TOKENS ─────────────────────────
   Ayser, October 2026, in two steps. First: "eliminate the AI-generated
   template look" — Swiss grid, generous space, hairlines instead of
   shadows, typography doing the work, no rainbow gradients. Then: "do
   NOT make the app cold" — Moments is a youth, travel and social brand,
   so its violet stays at the heart of it. The 80/20 rule: 80% a warm,
   quiet canvas (a soft off-white by day, a deep plum-black at night),
   20% bold Moments violet — the main button, the level you are on, the
   progress bars, the game cards, the badges you earn. Emerald only for
   "confirmed / unlocked", amber only for "2 spots left", red only for
   an error. The token NAMES stay (every screen reads C.purple, C.glass…)
   so the whole app changes at once.
     canvas #FAF8F5 · surface #FFFFFF · subtle #F3F0EC · ink #17131F
     brand  #7C3AED (Moments violet) · line rgba(23,19,31,0.08)           */

const LIGHT = {
  bg: '#FAF8F5',                       // warm off-white canvas, like paper in the sun
  bg2: '#FFFFFF',                      // sheets & bars
  glass: '#FFFFFF',                    // cards: white, separated by a hairline, never a shadow
  glassHi: '#F3F0EC',                  // the subtle secondary surface, warm not grey
  line: 'rgba(23,19,31,0.08)',         // the only separator
  purple: '#7C3AED',                   // Moments violet: the main action, the active path
  purpleSoft: 'rgba(124,58,237,0.08)', // a chip, a selected row, a badge's ground
  green: '#047857',                    // emerald: unlocked, confirmed (5.5:1 with white)
  greenSoft: 'rgba(4,120,87,0.08)',
  blue: '#6D28D9',                     // links read as the brand, a shade deeper
  blueSoft: 'rgba(124,58,237,0.06)',
  coral: '#DC2626',                    // errors only
  coralSoft: 'rgba(220,38,38,0.07)',
  gold: '#B45309',                     // amber: urgency (2 spots left) — 5:1 on white
  goldSoft: 'rgba(217,119,6,0.10)',
  text: '#17131F',                     // ink with a little warmth in it
  dim: '#6F6A75',                      // metadata: dates, places, prices (5:1)
  faint: '#87818D',                    // hints (3.6:1)
  ink: '#FFFFFF',                      // the label on a violet button
  float: 'rgba(255,255,255,0.96)',
  floatSolid: '#FFFFFF',
};

const DARK = {
  bg: '#0F0D14',                       // a deep plum-black, warmer than pure black
  bg2: '#16131D',                      // sheets & bars
  glass: '#1A1722',                    // cards, one step off the canvas
  glassHi: 'rgba(255,255,255,0.06)',
  line: 'rgba(255,255,255,0.08)',
  purple: '#7C3AED',                   // the same Moments violet at night (white label 5.7:1)
  purpleSoft: 'rgba(139,92,246,0.16)',
  green: '#059669',
  greenSoft: 'rgba(5,150,105,0.14)',
  blue: '#C4B5FD',
  blueSoft: 'rgba(139,92,246,0.12)',
  coral: '#F87171',
  coralSoft: 'rgba(248,113,113,0.12)',
  gold: '#F59E0B',
  goldSoft: 'rgba(245,158,11,0.14)',
  text: '#F6F3FA',
  dim: '#A9A3B2',
  faint: '#8F889A',
  ink: '#FFFFFF',
  float: 'rgba(26,23,34,0.96)',
  floatSolid: '#1A1722',
};

/* numbers that change — prices, countdowns, seats — never shuffle sideways */
export const NUM = { fontVariant: ['tabular-nums'] };

/* `C` is a SINGLE shared object — every screen imports this same
   reference and reads `C.bg` etc. straight in its render, with no
   StyleSheet.create anywhere in the app. That means we can flip the
   whole app's palette by mutating these properties in place (never
   reassigning the export) and then forcing one full re-render.
   ThemeContext (src/context/ThemeContext.js) is what actually does
   the mutating + persists the choice + forces that re-render. */
export const C = Object.assign({}, LIGHT);

export function applyThemeMode(mode, liquid) {
  Object.assign(C, mode === 'dark' ? DARK : LIGHT);
  // Liquid Glass (src/lib/liquid.js), only for someone trying it
  if (liquid) Object.assign(C, LIQUID[mode === 'dark' ? 'dark' : 'light']);
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
