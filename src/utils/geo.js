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
