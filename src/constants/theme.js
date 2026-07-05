/* ────────────────────────── DESIGN TOKENS ─────────────────────────
   Neon-Glassmorphism on deep charcoal.
   BG #121212 · Purple #7C3AED · Neon Green #10B981
   Yala Blue #3B82F6 · Coral #F43F5E                                  */

export const C = {
  bg: '#121212',
  bg2: '#17171B',
  glass: 'rgba(255,255,255,0.055)',
  glassHi: 'rgba(255,255,255,0.10)',
  line: 'rgba(255,255,255,0.10)',
  purple: '#7C3AED',
  purpleSoft: 'rgba(124,58,237,0.16)',
  green: '#10B981',
  greenSoft: 'rgba(16,185,129,0.14)',
  blue: '#3B82F6',
  blueSoft: 'rgba(59,130,246,0.14)',
  coral: '#F43F5E',
  coralSoft: 'rgba(244,63,94,0.14)',
  text: '#F5F5F7',
  dim: 'rgba(245,245,247,0.55)',
  faint: 'rgba(245,245,247,0.32)',
  ink: '#06130D',
};

export const R = 20; // house border-radius

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
