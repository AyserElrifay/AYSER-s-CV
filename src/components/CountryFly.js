import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';

/* ─── THE COUNTRY, FOUND ON THE EARTH, THEN ON THE MAP ────────────────
   Ayser: "أنيميشن بكوكب الأرض". It opens on the Earth — a plain globe
   in our own colours, drawn here from Natural Earth's coastlines
   (public domain, public/geo/land.json) — turning until the country
   faces you; then it dives in and the street map takes over.
   ── earlier note ──
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

/* ── THE GLOBE ── an orthographic projection by hand, on a canvas: no
   library, and nothing drawn that is not real coastline. A point behind
   the horizon is laid on the rim, which is all the clipping a small
   globe needs. */
let LAND = null;
let landAsk = null;
const loadLand = () => {
  if (LAND) return Promise.resolve(LAND);
  if (!landAsk) {
    let base = '/';
    try { if (typeof document !== 'undefined' && document.baseURI) base = document.baseURI; } catch (e) { /* root */ }
    landAsk = fetch(String(base).replace(/[^/]*$/, '') + 'geo/land.json').then((r) => r.json()).then((j) => { LAND = j; return j; }).catch(() => null);
  }
  return landAsk;
};
const RAD = Math.PI / 180;
const drawGlobe = (ctx, w, h, lng0, lat0, R, alpha, dark) => {
  ctx.clearRect(0, 0, w, h);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const cx = w / 2, cy = h / 2;
  const sp0 = Math.sin(lat0 * RAD), cp0 = Math.cos(lat0 * RAD);
  // the sea: a soft lit sphere
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  g.addColorStop(0, dark ? '#4B3A8C' : '#8E7CF0'); g.addColorStop(1, dark ? '#1A1240' : '#4C33C9');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // the land
  ctx.fillStyle = dark ? '#E9DDC2' : '#FBF3E2';
  (LAND || []).forEach((ring) => {
    let seen = false;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const l = (ring[i][0] - lng0) * RAD, f = ring[i][1] * RAD;
      const cf = Math.cos(f), sf = Math.sin(f), cl = Math.cos(l);
      let x = cf * Math.sin(l), y = cp0 * sf - sp0 * cf * cl;
      const front = sp0 * sf + cp0 * cf * cl;
      if (front > 0) seen = true;
      else { const m = Math.hypot(x, y) || 1; x /= m; y /= m; }
      const px = cx + x * R, py = cy - y * R;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    if (seen) { ctx.closePath(); ctx.fill(); }
  });
  // a thin rim of light
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
};
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/* Turns to the country, then waits for the street map: it dives in only
   once a tile of it has actually arrived. With no map (no signal, or the
   tile server down) it stays as it is — the Earth, the country facing
   you, the pin on it — rather than diving into an empty dark box. */
const Globe = ({ lng, lat, W, H, still, ready, kick, onDive }) => {
  const ref = useRef(null);
  const [gone, setGone] = useState(false);
  const st = useRef({ turned: false, diving: false });
  const draw = useRef(null);
  useEffect(() => {
    let raf = 0; let off = false;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const c = ref.current;
    if (!c || !c.getContext) return undefined;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = !!(typeof document !== 'undefined' && document.documentElement && /mm-dark/.test(document.documentElement.className));
    const r0 = H * 0.42;
    const TURN = 1500, DIVE = 650;
    st.current = { turned: false, diving: false };
    draw.current = () => {
      if (off || st.current.diving) return;
      st.current.diving = true; onDive();
      if (still) { setGone(true); return; }
      const t0 = performance.now();
      const frame = (now) => {
        if (off) return;
        const d = Math.min(1, (now - t0) / DIVE);
        drawGlobe(ctx, W, H, lng, lat, r0 * (1 + 9 * d * d), 1 - d, dark);
        if (d < 1) raf = requestAnimationFrame(frame); else setGone(true);
      };
      raf = requestAnimationFrame(frame);
    };
    loadLand().then(() => {
      if (off) return;
      const settle = () => { st.current.turned = true; drawGlobe(ctx, W, H, lng, lat, r0, 1, dark); if (ready.current) draw.current(); };
      if (still) { settle(); return; }
      const t0 = performance.now();
      const frame = (now) => {
        if (off) return;
        const a = ease(Math.min(1, (now - t0) / TURN));
        drawGlobe(ctx, W, H, lng - 110 * (1 - a), 12 + (lat - 12) * a, r0, 1, dark);
        if (a < 1) raf = requestAnimationFrame(frame); else settle();
      };
      raf = requestAnimationFrame(frame);
    });
    return () => { off = true; cancelAnimationFrame(raf); };
  }, [lng, lat]); // eslint-disable-line react-hooks/exhaustive-deps
  // the map arrived after the globe had already turned: dive now
  kick.current = () => { if (st.current.turned && draw.current) draw.current(); };
  if (gone) return null;
  return React.createElement('canvas', { ref, style: { position: 'absolute', left: 0, top: 0, width: W, height: H, pointerEvents: 'none' } });
};

export const CountryFly = ({ lng, lat, title, sub, height = 190 }) => {
  const W = 400, H = height;
  const t = useRef(new Animated.Value(0)).current;
  const pin = useRef(new Animated.Value(0)).current;
  // Reduce Motion, asked of the browser itself (AccessibilityInfo would
  // pull its whole module into the app's first download)
  let still = false;
  try { still = !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* move */ }
  const ready = useRef(false);
  const kick = useRef(null);
  useEffect(() => { t.setValue(0); pin.setValue(0); ready.current = false; }, [lng, lat]); // eslint-disable-line react-hooks/exhaustive-deps
  const tileIn = () => { if (ready.current) return; ready.current = true; if (kick.current) kick.current(); };
  // no map after the turn: the pin lands on the globe itself
  useEffect(() => {
    const id = setTimeout(() => { if (!ready.current) { Animated.spring(pin, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start(); } }, still ? 0 : 1900);
    return () => clearTimeout(id);
  }, [lng, lat]); // eslint-disable-line react-hooks/exhaustive-deps
  // the globe has turned and is diving in: the street map arrives under it
  const dive = () => {
    if (still) { t.setValue(1); pin.setValue(1); return; }
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(pin, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  };
  if (lng == null || lat == null) return null;
  const near = tilesAt(lng, lat, 5, W, H);
  const nScale = t.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const nFade = t;
  const pinY = pin.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });

  return (
    <View style={{ height: H, borderRadius: 22, overflow: 'hidden', backgroundColor: '#100C22', alignItems: 'center' }}>
      <View style={{ width: W, height: H }}>
        <Animated.View style={{ position: 'absolute', width: W, height: H, opacity: nFade, transform: [{ scale: nScale }] }}>
          {near.map((x) => <Image key={x.key} source={{ uri: x.url }} onLoad={tileIn} style={{ position: 'absolute', left: x.left, top: x.top, width: TILE, height: TILE }} />)}
        </Animated.View>
        <Globe lng={lng} lat={lat} W={W} H={H} still={still} ready={ready} kick={kick} onDive={dive} />
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
