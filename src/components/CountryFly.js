import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';

/* ─── THE COUNTRY, FOUND ON THE MAP ───────────────────────────────────
   Ayser: "نبتدي بأنيميشن بمكانه على الخريطة". The room opens on the
   whole world and flies in to where the country is, a pin landing on
   it — a second and a half, and you know where you are before you read
   a word. Two layers of the same free OpenStreetMap tiles the live map
   uses: the world (zoom 2) growing and fading out, the country (zoom 5)
   arriving under it. Nothing to download beyond a handful of tiles,
   and with Reduce Motion on it simply starts where it ends. */

const TILE = 256;
const OSM = (z, x, y) => 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
const fx = (lng, z) => ((lng + 180) / 360) * Math.pow(2, z);
const fy = (lat, z) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

/* the tiles of one zoom, laid out so [lng, lat] sits at the centre of a W×H box */
const tilesAt = (lng, lat, z, W, H) => {
  const x = fx(lng, z), y = fy(lat, z);
  const cx = Math.floor(x), cy = Math.floor(y);
  const ox = W / 2 - (x - cx) * TILE, oy = H / 2 - (y - cy) * TILE;
  const max = Math.pow(2, z);
  const nx = Math.ceil(W / TILE / 2) + 1, ny = Math.ceil(H / TILE / 2) + 1;
  const out = [];
  for (let r = -ny; r <= ny; r++) {
    for (let c = -nx; c <= nx; c++) {
      const ty = cy + r;
      if (ty < 0 || ty >= max) continue;
      const tx = ((cx + c) % max + max) % max;
      const left = ox + c * TILE, top = oy + r * TILE;
      if (left > W || top > H || left + TILE < 0 || top + TILE < 0) continue;
      out.push({ key: z + '/' + (cx + c) + '/' + ty, url: OSM(z, tx, ty), left, top });
    }
  }
  return out;
};

export const CountryFly = ({ lng, lat, title, sub, height = 190 }) => {
  const W = 400, H = height;
  const t = useRef(new Animated.Value(0)).current;
  const pin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let off = false;
    t.setValue(0); pin.setValue(0);
    const run = (still) => {
      if (off) return;
      if (still) { t.setValue(1); pin.setValue(1); return; }
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(t, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.spring(pin, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      ]).start();
    };
    // Reduce Motion, asked of the browser itself (AccessibilityInfo would
    // pull its whole module into the app's first download)
    let still = false;
    try { still = !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* move */ }
    run(still);
    return () => { off = true; };
  }, [lng, lat]); // eslint-disable-line react-hooks/exhaustive-deps

  if (lng == null || lat == null) return null;
  const world = tilesAt(lng, lat, 2, W, H);
  const near = tilesAt(lng, lat, 5, W, H);
  // zoom 2 → 5 is ×8: the world layer grows to meet the country layer
  const wScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 8] });
  const wFade = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
  const nScale = t.interpolate({ inputRange: [0, 1], outputRange: [0.125, 1] });
  const nFade = t.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.2, 1] });
  const pinY = pin.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });

  return (
    <View style={{ height: H, borderRadius: 22, overflow: 'hidden', backgroundColor: '#AAD3DF', alignItems: 'center' }}>
      <View style={{ width: W, height: H }}>
        <Animated.View style={{ position: 'absolute', width: W, height: H, opacity: nFade, transform: [{ scale: nScale }] }}>
          {near.map((x) => <Image key={x.key} source={{ uri: x.url }} style={{ position: 'absolute', left: x.left, top: x.top, width: TILE, height: TILE }} />)}
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: W, height: H, opacity: wFade, transform: [{ scale: wScale }] }}>
          {world.map((x) => <Image key={x.key} source={{ uri: x.url }} style={{ position: 'absolute', left: x.left, top: x.top, width: TILE, height: TILE }} />)}
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: W / 2 - 17, top: H / 2 - 32, opacity: pin, transform: [{ translateY: pinY }] }}>
          <Ionicons name="location" size={34} color={C.coral || '#F43F5E'} />
        </Animated.View>
      </View>
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']} locations={[0.45, 1]} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
        <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text style={{ position: 'absolute', right: 8, top: 6, color: 'rgba(0,0,0,0.45)', fontSize: 9 }}>© OpenStreetMap</Text>
    </View>
  );
};
