import { Platform } from 'react-native';

/* react-native-maps is native-only. On Snack's web preview we fall back
   to a hand-built "glass map" so the prototype never crashes. */
let MapView = null;
let Marker = null;
let Polyline = null;
try {
  if (Platform.OS !== 'web') {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
  }
} catch (e) {
  MapView = null;
}

export { MapView, Marker, Polyline };
export const MAPS_READY = !!MapView;
