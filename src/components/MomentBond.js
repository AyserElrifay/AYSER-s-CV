import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, SUPABASE_READY } from '../lib/supabase';
import { tapLight } from '../utils/feedback';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../services/profiles';

/* ─── THE MOMENT BOND ─────────────────────────────────────────────────
   Ayser, November 2026: on top of every 1-on-1 Connection, a glass card
   that counts how long you two have been connected — from the first table
   you both scanned into (or the day you became buddies or a Mutual Spark)
   — where you met, your two initials with a sign between them you choose
   (✦ · plane · coffee · heart), and how far apart your two cities are.
   Cities only, never a location; either of you can hide yours
   (RUN_ME.sql bond_info / bond_hide). */
const CITY = {
  cairo: [30.0444, 31.2357], giza: [30.0131, 31.2089], 'new cairo': [30.0300, 31.4700], '6th of october': [29.9285, 30.9188],
  alexandria: [31.2001, 29.9187], dahab: [28.5091, 34.5136], 'sharm el sheikh': [27.9158, 34.3299], hurghada: [27.2579, 33.8116],
  'el gouna': [27.3949, 33.6782], 'marsa alam': [25.0676, 34.8790], luxor: [25.6872, 32.6396], aswan: [24.0889, 32.8998],
  mansoura: [31.0409, 31.3785], tanta: [30.7865, 31.0004], ismailia: [30.5965, 32.2715], 'port said': [31.2653, 32.3019],
  suez: [29.9668, 32.5498], fayoum: [29.3084, 30.8428], siwa: [29.2032, 25.5195], 'saint catherine': [28.5559, 33.9761],
  'soma bay': [26.8500, 33.9900], tallinn: [59.4370, 24.7536], lisbon: [38.7223, -9.1393], prague: [50.0755, 14.4378],
  dubai: [25.2048, 55.2708], london: [51.5072, -0.1276], paris: [48.8566, 2.3522], berlin: [52.5200, 13.4050],
  'القاهرة': [30.0444, 31.2357], 'الجيزة': [30.0131, 31.2089], 'الإسكندرية': [31.2001, 29.9187], 'اسكندرية': [31.2001, 29.9187], 'دهب': [28.5091, 34.5136],
};
const cityOf = (s) => CITY[String(s || '').trim().toLowerCase()] || null;
const km = (a, b) => {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const pad = (n) => String(n).padStart(2, '0');
const SIGNS = ['sparkles', 'airplane', 'cafe', 'heart'];
const W = {
  en: { title: 'connected for', met: 'Met at {m}', apart: '{n} km apart', same: 'Same city • {c}', hidden: 'Cities hidden', hide: 'Hide my city', show: 'Show my city', d: 'd', h: 'h', m: 'm', s: 's' },
  ar: { title: 'متوصّلين من', met: 'اتقابلتوا في {m}', apart: '{n} كم بينكم', same: 'نفس المدينة • {c}', hidden: 'المدن مخفية', hide: 'اخفي مدينتي', show: 'اظهر مدينتي', d: 'ي', h: 'س', m: 'د', s: 'ث' },
};
const t = (lang, k, v) => { let s = W[lang === 'ar' ? 'ar' : 'en'][k]; Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', v[x]); }); return s; };
const initial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();

export const MomentBond = ({ other, meName, lang }) => {
  const [b, setB] = useState(null);
  const { user } = useAuth() || {};
  const [mine, setMine] = useState(meName || '');
  useEffect(() => { if (!mine && user) getProfile(user.id).then((p) => p && p.name && setMine(p.name)).catch(() => {}); }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(Date.now());
  const key = 'mm.bond.sign.' + (other && other.id);
  const [sign, setSign] = useState(() => { try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; } });
  useEffect(() => {
    if (!SUPABASE_READY || !other || !other.id) return undefined;
    let alive = true;
    supabase.rpc('bond_info', { p_other: other.id }).then(({ data }) => { if (alive && data && data.ok && data.since) setB(data); }, () => {});
    return () => { alive = false; };
  }, [other && other.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!b) return undefined; const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, [b]);
  if (!b) return null;
  const ms = Math.max(0, now - new Date(b.since).getTime());
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  const num = (x) => (lang === 'ar' ? AR(x) : String(x));
  const counter = num(d) + t(lang, 'd') + ' : ' + num(pad(h)) + t(lang, 'h') + ' : ' + num(pad(m)) + t(lang, 'm') + ' : ' + num(pad(s)) + t(lang, 's');
  const a1 = cityOf(b.my_city), a2 = cityOf(b.their_city);
  const dist = !b.my_city || !b.their_city ? t(lang, 'hidden')
    : String(b.my_city).trim().toLowerCase() === String(b.their_city).trim().toLowerCase() ? t(lang, 'same', { c: b.their_city })
    : a1 && a2 ? t(lang, 'apart', { n: num(km(a1, a2)) }) : b.my_city + ' · ' + b.their_city;
  const next = () => { tapLight(); const n = (sign + 1) % SIGNS.length; setSign(n); try { localStorage.setItem(key, String(n)); } catch (e) {} };
  const toggleHide = async () => {
    tapLight();
    const { data } = await supabase.rpc('bond_hide', { p_hide: !b.i_hide });
    if (data && data.ok) supabase.rpc('bond_info', { p_other: other.id }).then(({ data: x }) => { if (x && x.ok) setB(x); }, () => {});
  };
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } : null;
  return (
    <View testID="moment-bond" style={[{ marginHorizontal: 12, marginTop: 10, borderRadius: 20, padding: 14, backgroundColor: 'rgba(23,19,31,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, glass]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#D9C08C', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{initial(mine)}</Text>
          </View>
          <Pressable testID="bond-sign" onPress={next} hitSlop={8} accessibilityRole="button" accessibilityLabel={lang === 'ar' ? 'غيّر العلامة' : 'Change the sign'} style={{ marginHorizontal: 6 }}>
            <Ionicons name={SIGNS[sign]} size={16} color="#D9C08C" />
          </Pressable>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#D9C08C', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{initial(other && other.name)}</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginStart: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1 }}>{t(lang, 'title') + ' ✦'}</Text>
          <Text testID="bond-counter" style={{ color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] }}>{counter}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Text style={{ flex: 1, color: 'rgba(255,255,255,0.78)', fontSize: 12.5 }} numberOfLines={1}>
          {(b.met_at ? t(lang, 'met', { m: b.met_at }) + '  ·  ' : '') + dist}
        </Text>
        <Pressable onPress={toggleHide} hitSlop={8} style={{ marginStart: 10 }} accessibilityRole="switch" accessibilityState={{ checked: !!b.i_hide }}>
          <Text style={{ color: '#D9C08C', fontSize: 12, fontWeight: '700' }}>{b.i_hide ? t(lang, 'show') : t(lang, 'hide')}</Text>
        </Pressable>
      </View>
    </View>
  );
};
