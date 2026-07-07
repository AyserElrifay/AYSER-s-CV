import React, { useRef } from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';
import { ME } from '../constants/mockData';
import { MapView, Marker, Polyline, MAPS_READY } from '../utils/maps';
import { regionFor } from '../utils/geo';
import { Chip } from './Chip';
import { FauxMap } from './FauxMap';

export const RouteMap = ({ post }) => {
  const mapRef = useRef(null);
  const region = regionFor(ME.coords, post.coords);
  if (MAPS_READY) {
    return (
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        userInterfaceStyle="light"
        pitchEnabled
        onMapReady={() => {
          if (region.latitudeDelta < 0.25 && mapRef.current && mapRef.current.animateCamera) {
            mapRef.current.animateCamera(
              { center: { latitude: region.latitude, longitude: region.longitude }, pitch: 48, heading: 15, zoom: 12.5 },
              { duration: 900 }
            );
          }
        }}
      >
        <Marker coordinate={ME.coords}>
          <View style={{ alignItems: 'center' }}>
            <Chip label="You" tint="rgba(124,58,237,0.85)" color="#fff" style={{ borderColor: 'transparent', marginBottom: 3 }} />
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.purple, borderWidth: 3, borderColor: '#fff' }} />
          </View>
        </Marker>
        <Marker coordinate={post.coords}>
          <View style={{ alignItems: 'center' }}>
            <Chip label={post.place} tint="rgba(16,185,129,0.9)" color={C.ink} style={{ borderColor: 'transparent', marginBottom: 3 }} />
            <Text style={{ fontSize: 26 }}>📍</Text>
          </View>
        </Marker>
        <Polyline
          coordinates={[ME.coords, post.coords]}
          strokeColor={C.green}
          strokeWidth={3.5}
          lineDashPattern={[10, 8]}
          geodesic
        />
      </MapView>
    );
  }
  /* Web / fallback: stylised route */
  return (
    <FauxMap>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
        const t = i / 10;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (16 + t * 62) + '%',
              top: (72 - t * 52) + '%',
              width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, opacity: 0.9,
            }}
          />
        );
      })}
      <View style={{ position: 'absolute', left: '12%', top: '74%', alignItems: 'center' }}>
        <Chip label="You" tint="rgba(124,58,237,0.85)" color="#fff" style={{ borderColor: 'transparent', marginBottom: 4 }} />
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.purple, borderWidth: 3, borderColor: '#fff' }} />
      </View>
      <View style={{ position: 'absolute', left: '64%', top: '10%', alignItems: 'center' }}>
        <Chip label={post.place} tint="rgba(16,185,129,0.9)" color={C.ink} style={{ borderColor: 'transparent', marginBottom: 4 }} />
        <Text style={{ fontSize: 28 }}>📍</Text>
      </View>
    </FauxMap>
  );
};
