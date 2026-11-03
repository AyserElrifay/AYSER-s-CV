import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { lazyOverlay } from '../lib/lazyScreen';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight } from '../utils/feedback';
import { radarOn, setRadarOn, onRadarChange, metersBetween, pulseEvery, chime, ping, arrivalChord, unlockAudio, routeTo, notify } from '../lib/radar';

const EventRoom = lazyOverlay(() => import('./LiveKit').then((m) => ({ default: m.EventRoom })));

/* ─── SMART ARRIVAL RADAR ─────────────────────────────────────────────
   Ayser, November 2026. From an hour before your table until it ends
   (RUN_ME.sql radar_targets), while Moments is open:
     · within 300 m of the venue: a warm chime, a buzz, and "You are 300 m
       away from your table" (a phone notification too, if you allowed
       them) — tap to open the radar;
     · on the radar, a heartbeat of sound and touch that quickens from
       300 m to 30 m (towards the organizer's pin once they pressed
       "I'm here", otherwise the venue), drive and walk times, the route;
     · within 50 m, or "I'm here": a chord, and the table's room opens in
       Arrival Mode (ticket on top, the table chat under it).
   All of it can be switched off here and in Space → Settings. A phone
   only knows where it is while the app is open — a browser cannot watch
   your location in the background, so nothing pretends to. */
const W = {
  en: { near: 'You are 300 m away from your table!', nearSub: 'Tap to open the Arrival Radar.', here: "You're here — open your ticket", radar: 'Arrival Radar', on: 'Sound & touch on', off: 'Radar off', to: 'to your table', host: 'to your host', drive: 'Drive', walk: 'Walk', noRoute: 'Routes need your location.', imHere: "I'm here", noPoint: 'This table has no exact pin yet — follow the map link in the room.', locate: 'Allow your location to use the radar.', min: 'min' },
  ar: { near: 'إنت على بعد ٣٠٠ متر من ترابيزتك!', nearSub: 'دوس عشان تفتح رادار الوصول.', here: 'وصلت — افتح تذكرتك', radar: 'رادار الوصول', on: 'الصوت والاهتزاز شغالين', off: 'الرادار مقفول', to: 'لترابيزتك', host: 'للمنظّم', drive: 'عربية', walk: 'مشي', noRoute: 'الطرق محتاجة مكانك.', imHere: 'أنا وصلت', noPoint: 'الترابيزة دي لسه مالهاش مكان بالظبط — استخدم لينك الخريطة في الأوضة.', locate: 'اسمح بمكانك عشان الرادار يشتغل.', min: 'د' },
};
const rw = (lang, k) => W[lang === 'ar' ? 'ar' : 'en'][k];
const fmt = (m, lang) => (m == null ? '—' : m >= 1000 ? (m / 1000).toFixed(1) + (lang === 'ar' ? ' كم' : ' km') : m + (lang === 'ar' ? ' م' : ' m'));
const pt = (o) => (Array.isArray(o) && o.length === 2 ? o : o && o.lat != null ? [o.lat, o.lng] : null);
const SEEN = 'mm.radar.near.';

/* the route as a clean line, drawn to fit its box (no map tiles needed) */
const RouteLine = ({ line, from, to }) => {
  if (Platform.OS !== 'web' || !line || line.length < 2) return null;
  const all = line.concat(from ? [from] : [], to ? [to] : []);
  const lats = all.map((p) => p[0]), lngs = all.map((p) => p[1]);
  const minA = Math.min(...lats), maxA = Math.max(...lats), minO = Math.min(...lngs), maxO = Math.max(...lngs);
  const W2 = 300, H2 = 150, pad = 14;
  const sx = (W2 - 2 * pad) / Math.max(1e-6, maxO - minO), sy = (H2 - 2 * pad) / Math.max(1e-6, maxA - minA), s = Math.min(sx, sy);
  const X = (p) => pad + (p[1] - minO) * s + ((W2 - 2 * pad) - (maxO - minO) * s) / 2;
  const Y = (p) => H2 - pad - (p[0] - minA) * s - ((H2 - 2 * pad) - (maxA - minA) * s) / 2;
  const d = line.map((p, i) => (i ? 'L' : 'M') + X(p).toFixed(1) + ' ' + Y(p).toFixed(1)).join(' ');
  return React.createElement('svg', { viewBox: '0 0 ' + W2 + ' ' + H2, width: '100%', height: 150, 'data-testid': 'radar-route' },
    React.createElement('path', { d, fill: 'none', stroke: '#FFC233', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    from ? React.createElement('circle', { cx: X(from), cy: Y(from), r: 6, fill: '#FFFFFF' }) : null,
    to ? React.createElement('circle', { cx: X(to), cy: Y(to), r: 8, fill: '#7C3AED', stroke: '#FFC233', strokeWidth: 3 }) : null);
};

export const RadarScreen = ({ target, me, onClose, onArrive }) => {
  const { lang } = useLang();
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [on, setOn] = useState(radarOn());
  const [routes, setRoutes] = useState(null);
  const ring = useRef(new Animated.Value(0)).current;
  const venue = pt(target.point);
  const host = pt(target.host);
  const goal = host || venue;
  const d = metersBetween(me, goal);
  const arrived = useRef(false);
  useEffect(() => onRadarChange(setOn), []);
  // drive and walk, once, from where you are now
  useEffect(() => {
    if (!me || !goal) return;
    let alive = true;
    Promise.all([routeTo(me, goal, 'drive'), routeTo(me, goal, 'walk')]).then(([dr, wk]) => {
      if (!alive) return;
      // the router did not answer: an honest estimate from the straight line, marked ≈
      const m = metersBetween(me, goal) || 0;
      const guess = (perMin, k) => ({ minutes: Math.max(1, Math.round((m * k) / perMin)), line: [me, goal], approx: true });
      setRoutes({ drive: dr || guess(400, 1.4), walk: wk || guess(80, 1.3) });
    });
    return () => { alive = false; };
  }, [!!me, goal && goal[0], goal && goal[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  // the heartbeat: faster as you get closer; a chord and Arrival Mode within 50 m
  useEffect(() => {
    if (d == null) return undefined;
    if (d <= 50 && !arrived.current) { arrived.current = true; if (on) arrivalChord(); setTimeout(() => onArrive(), 900); return undefined; }
    const every = pulseEvery(d);
    if (!on || every == null || every === 0) return undefined;
    const beat = () => {
      ping();
      ring.setValue(0);
      Animated.timing(ring, { toValue: 1, duration: Math.min(1200, every), easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
    };
    beat();
    const h = setInterval(beat, every);
    return () => clearInterval(h);
  }, [d == null ? -1 : Math.round(d / 10), on]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const fade = ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const toggle = () => { tapLight(); unlockAudio(); setRadarOn(!on); };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View testID="arrival-radar" style={[{ flex: 1, backgroundColor: '#1E0F45', paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }, Platform.OS === 'web' ? { backgroundImage: 'radial-gradient(90% 60% at 50% 30%, rgba(124,58,237,0.6) 0%, rgba(30,15,69,1) 70%)' } : null]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close"><Ionicons name="chevron-down" size={26} color="#FFF" /></Pressable>
          <Text style={{ flex: 1, color: '#FFF', fontSize: 18, fontWeight: '800', marginStart: 10 }} numberOfLines={1}>{rw(lang, 'radar')}</Text>
          <Pressable testID="radar-toggle" onPress={toggle} accessibilityRole="switch" accessibilityState={{ checked: on }} hitSlop={6}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: on ? '#FFC233' : 'rgba(255,255,255,0.12)' }}>
              <Ionicons name={on ? 'volume-high' : 'volume-mute'} size={14} color={on ? '#2A1660' : '#FFF'} />
              <Text style={{ color: on ? '#2A1660' : '#FFF', fontSize: 12.5, fontWeight: '800', marginStart: 6 }}>{rw(lang, on ? 'on' : 'off')}</Text>
            </View>
          </Pressable>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 14 }} numberOfLines={1}>{(lang === 'ar' && target.title_ar) || target.title}</Text>

        <View style={{ alignItems: 'center', justifyContent: 'center', height: 260, marginTop: 10 }}>
          <Animated.View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 3, borderColor: '#FFC233', opacity: fade, transform: [{ scale }] }} />
          <View style={{ width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text testID="radar-distance" style={{ color: '#FFF', fontSize: 38, fontWeight: '900' }}>{goal ? fmt(d, lang) : '—'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{rw(lang, host ? 'host' : 'to')}</Text>
          </View>
        </View>
        {!goal ? <Text style={{ color: '#FFF', fontSize: 13.5, textAlign: 'center', lineHeight: 19 }}>{rw(lang, 'noPoint')}</Text> : !me ? <Text style={{ color: '#FFF', fontSize: 13.5, textAlign: 'center' }}>{rw(lang, 'locate')}</Text> : null}

        {goal && me ? (
          <View style={{ borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, marginTop: 6 }}>
            <View style={{ flexDirection: 'row' }}>
              {[['drive', 'car-outline'], ['walk', 'walk-outline']].map(([k, icon]) => (
                <View key={k} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={icon} size={18} color="#FFC233" />
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '800', marginStart: 6 }}>{routes && routes[k] ? (routes[k].approx ? '≈ ' : '') + routes[k].minutes + ' ' + rw(lang, 'min') : '…'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginStart: 6 }}>{rw(lang, k)}</Text>
                </View>
              ))}
            </View>
            <RouteLine line={routes && (routes.walk || routes.drive) ? (routes.walk || routes.drive).line : null} from={me} to={goal} />
          </View>
        ) : null}

        <View style={{ flex: 1 }} />
        <Pressable testID="radar-here" onPress={() => { tapLight(); unlockAudio(); if (on) arrivalChord(); onArrive(); }} accessibilityRole="button">
          <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: '#FFC233' }}>
            <Text style={{ color: '#2A1660', fontSize: 16.5, fontWeight: '900' }}>{rw(lang, 'imHere')}</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

/* mounted once in the app: watches for your table's window, then for 300 m */
export const RadarWatcher = () => {
  const { user } = useAuth() || {};
  const { lang } = useLang();
  const [targets, setTargets] = useState([]);
  const [me, setMe] = useState(null);
  const [banner, setBanner] = useState(null);       // { target, here }
  const [open, setOpen] = useState(null);           // target on the radar screen
  const [room, setRoom] = useState(null);           // target in Arrival Mode
  const [on, setOn] = useState(radarOn());
  useEffect(() => onRadarChange(setOn), []);
  // which of my tables are in their window (every 3 minutes, and when the app comes back)
  useEffect(() => {
    if (!SUPABASE_READY || !user) return undefined;
    let alive = true;
    const load = () => supabase.rpc('radar_targets').then(({ data }) => { if (alive && data && data.ok) setTargets((data.targets || []).filter((t) => pt(t.point) || pt(t.host))); }, () => {});
    load();
    const h = setInterval(load, 180000);
    const vis = () => { if (document.visibilityState === 'visible') load(); };
    try { document.addEventListener('visibilitychange', vis); } catch (e) {}
    return () => { alive = false; clearInterval(h); try { document.removeEventListener('visibilitychange', vis); } catch (e) {} };
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // where you are — only while there is a table to walk to, and the radar is on
  useEffect(() => {
    if (!on || !targets.length || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    let id = null;
    try { id = navigator.geolocation.watchPosition((p) => setMe([p.coords.latitude, p.coords.longitude]), () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }); } catch (e) {}
    return () => { try { if (id != null) navigator.geolocation.clearWatch(id); } catch (e) {} };
  }, [on, targets.length]);
  // 300 m: once per table
  useEffect(() => {
    if (!on || !me) return;
    targets.forEach((t) => {
      const d = metersBetween(me, pt(t.point) || pt(t.host));
      if (d == null || d > 300) return;
      let seen = false; try { seen = sessionStorage.getItem(SEEN + t.id) === '1'; } catch (e) {}
      if (seen) { if (d <= 50 && !open && !room) setBanner({ target: t, here: true }); return; }
      try { sessionStorage.setItem(SEEN + t.id, '1'); } catch (e) {}
      chime();
      notify('✦ ' + rw(lang, 'near'), rw(lang, 'nearSub'));
      setBanner({ target: t, here: d <= 50 });
    });
  }, [me && me[0], me && me[1], on, targets.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const go = () => { const t = (banner && banner.target) || targets[0]; if (t) { setBanner(null); setOpen(t); } };
    try { window.addEventListener('mm-open-radar', go); } catch (e) {}
    return () => { try { window.removeEventListener('mm-open-radar', go); } catch (e) {} };
  }, [banner, targets]);
  if (!user) return null;
  return (
    <>
      {banner && on ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, alignItems: 'center', paddingTop: 12, paddingHorizontal: 12 }}>
          <Pressable testID="radar-banner" onPress={() => { tapLight(); unlockAudio(); const t = banner.target; setBanner(null); if (banner.here) setRoom(t); else setOpen(t); }} accessibilityRole="button" style={{ width: '100%', maxWidth: 480 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: '#1E0F45', borderWidth: 1.5, borderColor: '#FFC233', padding: 14 }}>
              <Text style={{ color: '#FFC233', fontSize: 20, marginEnd: 10 }}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>{banner.here ? rw(lang, 'here') : rw(lang, 'near')}</Text>
                {!banner.here ? <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 2 }}>{rw(lang, 'nearSub')}</Text> : null}
              </View>
              <Pressable onPress={() => setBanner(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="close"><Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" /></Pressable>
            </View>
          </Pressable>
        </View>
      ) : null}
      {open ? <RadarScreen target={open} me={me} onClose={() => setOpen(null)} onArrive={() => { const t = open; setOpen(null); setRoom(t); }} /> : null}
      {room ? <EventRoom kind={room.kind || 'offer'} id={room.id} lang={lang} arrival onClose={() => setRoom(null)} /> : null}
    </>
  );
};
