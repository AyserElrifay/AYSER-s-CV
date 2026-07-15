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
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
      return;
    }
    if (!Location) return resolve(null);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then((pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
      .catch(() => resolve(null));
  });
}

/* Follow the REAL GPS as it moves — the map keeps knowing where you
   are, not just where you were when the screen opened. Returns an
   unsubscribe function; safe to call anywhere (no-ops without GPS). */
export function watchCoords(onCoords) {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.geolocation.watchPosition) {
      return () => {};
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => onCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }
  if (!Location) return () => {};
  let sub = null;
  let stopped = false;
  Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 25 },
    (pos) => onCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
  ).then((s) => { if (stopped) s.remove(); else sub = s; }).catch(() => {});
  return () => { stopped = true; if (sub) sub.remove(); };
}
