export const R = 20;

export const DARK_COLORS = {
  isDark: true,
  bg: '#121212', bg2: '#17171B',
  glass: 'rgba(255,255,255,0.055)', glassHi: 'rgba(255,255,255,0.10)', line: 'rgba(255,255,255,0.10)',
  text: '#F5F5F7', dim: 'rgba(245,245,247,0.55)', faint: 'rgba(245,245,247,0.32)', ink: '#06130D',
  purple: '#7C3AED', purpleSoft: 'rgba(124,58,237,0.16)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.14)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.14)',
  coral: '#F43F5E', coralSoft: 'rgba(244,63,94,0.14)'
};

export const LIGHT_COLORS = {
  isDark: false,
  bg: '#F9F9FB', bg2: '#FFFFFF',
  glass: 'rgba(0,0,0,0.04)', glassHi: 'rgba(0,0,0,0.08)', line: 'rgba(0,0,0,0.08)',
  text: '#111827', dim: 'rgba(17,24,39,0.6)', faint: 'rgba(17,24,39,0.4)', ink: '#FFFFFF',
  purple: '#7C3AED', purpleSoft: 'rgba(124,58,237,0.12)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.12)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.12)',
  coral: '#F43F5E', coralSoft: 'rgba(244,63,94,0.12)'
};

export const DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#141416' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#70707a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1420' }] },
];
