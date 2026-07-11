import { Platform } from 'react-native';

/* Real device location — the actual GPS pin, not a fixed mock coord.
   Native uses expo-location; web uses the browser's Geolocation API.
   Every function resolves to `null` on denial/error instead of
   throwing, so a screen can always fall back to a sensible default
   (ME.coords) rather than crash. */

let Location = null;
if (Platform.OS !== 'web') {
  try { Location = require('expo-location'); } catch (e) { Location = null; }
}

export async function requestLocationPermission() {
  if (Platform.OS === 'web') {
    return !!(typeof navigator !== 'undefined' && navigator.geolocation);
  }
  if (!Location) return false;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) { return false; }
}

export function getCurrentCoords() {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
      return;
    }
    if (!Location) return resolve(null);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
      .catch(() => resolve(null));
  });
}
