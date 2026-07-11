export const regionFor = (a, b) => ({
  latitude: (a.latitude + b.latitude) / 2,
  longitude: (a.longitude + b.longitude) / 2,
  latitudeDelta: Math.max(Math.abs(a.latitude - b.latitude) * 2.4, 0.02),
  longitudeDelta: Math.max(Math.abs(a.longitude - b.longitude) * 2.4, 0.02),
});

export const kmBetween = (a, b) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
};

/* Projects a real coordinate onto the fallback web map (FauxMap),
   which is centered on `center` with a fixed degree span. Used so
   real people/venues/campfires land at their true relative position
   instead of a hand-placed fx/fy percentage. */
export const projectToMap = (center, point, deltaDeg = 0.03) => {
  const x = ((point.longitude - center.longitude) / (deltaDeg * 2)) * 100 + 50;
  const y = ((center.latitude - point.latitude) / (deltaDeg * 2)) * 100 + 50; // north is up
  return {
    left: Math.min(94, Math.max(6, x)) + '%',
    top: Math.min(94, Math.max(6, y)) + '%',
  };
};
