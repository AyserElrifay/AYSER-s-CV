import React, { useContext } from 'react';
import { View, Text, Platform } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { DARK_MAP } from '../constants/theme';

let MapView = null, Marker = null, Polyline = null;
try {
  if (Platform.OS !== 'web') {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default; Marker = RNMaps.Marker; Polyline = RNMaps.Polyline;
  }
} catch (e) { MapView = null; }
const MAPS_READY = !!MapView;

export const MapScreen = () => {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {MAPS_READY ? (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: 30.048, longitude: 31.2315, latitudeDelta: 0.042, longitudeDelta: 0.03 }}
          customMapStyle={theme.isDark ? DARK_MAP : []}
          userInterfaceStyle={theme.isDark ? "dark" : "light"}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.text }}>Map View (Web Fallback)</Text></View>
      )}
    </View>
  );
};
