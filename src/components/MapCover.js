import React from 'react';
import { View, Text, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';

/* ─── MAP COVER · where you are, as your header ──────────────────────
   A real map, built from the same free CARTO raster tiles the live map
   uses — no API key, no third-party static-map service, and it works
   the same in light and dark. We work out which tiles cover the point,
   lay them out, and shift them so YOUR spot sits dead centre under the
   pin. Nothing here is a stock picture of a city: it's the actual map
   at the actual coordinates. */

const TILE = 256;
const LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const DARK = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png';

const lngToX = (lng, z) => ((lng + 180) / 360) * Math.pow(2, z);
const latToY = (lat, z) => {
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

export const MapCover = ({ lat, lng, place, height = 130, zoom = 11, dark = false, radius = 18 }) => {
  if (lat == null || lng == null) return null;

  // Rendered at a fixed 360-wide box and stretched — plenty for a header,
  // and it keeps the tile count (and the requests) small.
  const W = 360, H = height;
  const fx = lngToX(lng, zoom), fy = latToY(lat, zoom);
  const cx = Math.floor(fx), cy = Math.floor(fy);
  // where the exact point sits inside its own tile
  const inX = (fx - cx) * TILE, inY = (fy - cy) * TILE;
  // top-left of the centre tile so the point lands in the middle
  const originX = W / 2 - inX, originY = H / 2 - inY;

  const cols = Math.ceil(W / TILE) + 2;
  const rows = Math.ceil(H / TILE) + 2;
  const startCol = -Math.ceil(cols / 2), startRow = -Math.ceil(rows / 2);
  const max = Math.pow(2, zoom);
  const tiles = [];
  for (let r = startRow; r < startRow + rows + 1; r++) {
    for (let c = startCol; c < startCol + cols + 1; c++) {
      const tx = ((cx + c) % max + max) % max;   // wrap around the globe
      const ty = cy + r;
      if (ty < 0 || ty >= max) continue;
      const url = (dark ? DARK : LIGHT)
        .replace('{s}', 'abc'[Math.abs(tx + ty) % 3])
        .replace('{z}', zoom).replace('{x}', tx).replace('{y}', ty);
      tiles.push({ key: tx + '_' + ty, url, left: originX + c * TILE, top: originY + r * TILE });
    }
  }

  return (
    <View style={{ width: '100%', height: H, borderRadius: radius, overflow: 'hidden', backgroundColor: dark ? '#12121A' : '#E8ECF0' }}>
      {tiles.map((t) => (
        <Image key={t.key} source={{ uri: t.url }} style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }} />
      ))}

      {/* the pin, right on the spot */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="location" size={34} color={C.coral} style={{ marginTop: -10 }} />
      </View>

      {place ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="navigate" size={11} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800', marginLeft: 5 }} numberOfLines={1}>{place}</Text>
        </View>
      ) : null}
    </View>
  );
};
