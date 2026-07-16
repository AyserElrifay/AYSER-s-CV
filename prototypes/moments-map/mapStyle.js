/* Minimalist, playful base style for the Moments Map (Snap-vibe).
   Passed to <MapView customMapStyle={MOMENTS_MAP_STYLE}> on Google
   provider. Soft mint land, candy water, roads dialled right down and
   most POIs/labels hidden so the AVATARS are the stars of the canvas. */

export const MOMENTS_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#eaf6ef' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa7b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#cdefd6' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfdfd' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffe9b8' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a9dcf0' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e2f3e6' }] },
];

/* Brand palette shared across the marker components. */
export const PALETTE = {
  purple: '#7C3AED',
  purpleSoft: 'rgba(124,58,237,0.14)',
  gold: '#F5B301',
  coral: '#F43F5E',
  green: '#10B981',
  ink: '#111827',
  white: '#FFFFFF',
  ring1: '#F5B301',
  ring2: '#F43F5E',
  ring3: '#7C3AED',
};
