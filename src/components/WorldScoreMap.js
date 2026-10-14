import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { WORLD } from '../constants/worldGeo';
import { COUNTRY_LIST } from '../constants/countries';
import { useSheetBack } from '../hooks/useSheetBack';
import { worldBoard } from '../services/games';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { tapLight } from '../utils/feedback';

/* ─── CATCH YOUR MATE · THE WORLD MAP ─────────────────────────────────
   The best run of every player, from RUN_ME.sql catch_world(). Each
   country's champion stands on the map where that country is; the top
   three in the world stand on the podium underneath. Nobody is placed
   anywhere they did not say they are from — a player with no country
   is on the podium and the list, never guessed onto the map. */

const ALIAS = {
  'czechia': 'Czech Republic', 'türkiye': 'Turkey', 'turkiye': 'Turkey', 'usa': 'United States',
  'uk': 'United Kingdom', 'uae': 'United Arab Emirates', 'korea': 'South Korea',
  'bosnia': 'Bosnia and Herzegovina', 'north macedonia': 'Macedonia', 'eswatini': 'Swaziland',
};

const codeOfFlag = (flag) => {
  const cps = Array.from(String(flag || '')).map((c) => c.codePointAt(0) - 127397);
  return cps.length === 2 && cps.every((n) => n >= 65 && n <= 90) ? String.fromCharCode(...cps) : null;
};

const pointFor = (row) => {
  const names = [];
  if (row.country) names.push(String(row.country));
  const code = /^[A-Za-z]{2}$/.test(String(row.country || '')) ? String(row.country).toUpperCase() : codeOfFlag(row.flag);
  const listed = code && COUNTRY_LIST.find((c) => c.code === code);
  if (listed) names.push(listed.name);
  for (const n of names) {
    const want = (ALIAS[n.toLowerCase()] || n).toLowerCase();
    const hit = WORLD.find((w) => w.n.toLowerCase() === want);
    if (hit) return { lng: hit.p[0], lat: hit.p[1], country: hit.n, ar: hit.ar };
  }
  return null;
};

const MEDAL = ['🥇', '🥈', '🥉'];

/* The map is drawn from the same country points the app already
   carries — one faint dot per country is enough for the eye to see the
   continents — so it costs no tiles, works offline and on every phone,
   and puts nothing in the first download. Latitudes run 80°N to 56°S:
   the ice nobody plays from is left off. */
const TOP = 80, BOTTOM = -56;

/* The window onto the world: wide enough to hold every champion with
   room around them, never narrower than 70° of longitude, and the
   whole planet once players are spread across it. When everybody is
   in Egypt, Europe and Morocco, that is what the map shows. */
const frame = (champs) => {
  if (!champs.length) return { w0: -180, w1: 180, n: TOP, s: BOTTOM };
  let w0 = Math.min(...champs.map((c) => c.lng)) - 18, w1 = Math.max(...champs.map((c) => c.lng)) + 18;
  if (w1 - w0 < 70) { const m = (w0 + w1) / 2; w0 = m - 35; w1 = m + 35; }
  w0 = Math.max(-180, w0); w1 = Math.min(180, w1);
  const span = (w1 - w0) * 0.62; // a little taller than true, so the faces have room
  const mid = (Math.min(...champs.map((c) => c.lat)) + Math.max(...champs.map((c) => c.lat))) / 2;
  let n = mid + span / 2, so = mid - span / 2;
  if (n > TOP) { so -= n - TOP; n = TOP; }
  if (so < BOTTOM) { n += BOTTOM - so; so = BOTTOM; }
  return { w0, w1, n: Math.min(TOP, n), s: Math.max(BOTTOM, so) };
};
const at = (lng, lat, w, h, f) => ({ x: ((lng - f.w0) / (f.w1 - f.w0)) * w, y: ((f.n - lat) / (f.n - f.s)) * h });

const DotMap = ({ champs, face, w }) => {
  const h = w * 0.52;
  const f = frame(champs);
  return (
    <View style={{ width: w, height: h, borderRadius: 18, backgroundColor: '#0A1D3F', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)' }}>
      {WORLD.map((c) => {
        if (c.p[1] < f.s || c.p[1] > f.n || c.p[0] < f.w0 || c.p[0] > f.w1) return null;
        const { x, y } = at(c.p[0], c.p[1], w, h, f);
        return (
          <View key={c.n} style={{ position: 'absolute', left: x - 2.5, top: y - 2.5 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(126,184,255,0.35)' }} />
          </View>
        );
      })}
      {champs.map((r) => {
        const { x, y } = at(r.lng, r.lat, w, h, f);
        const big = r.rank <= 3;
        const s = big ? 30 : 22;
        return (
          <View key={r.id} style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, alignItems: 'center' }}>
            <Image source={{ uri: face(r) }} style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 2, borderColor: big ? C.gold : '#FFF' }} />
            <Text style={{ position: 'absolute', top: -9, right: -9, fontSize: 12 }}>{big ? MEDAL[r.rank - 1] : ''}</Text>
            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900', marginTop: 1, textShadowColor: '#000', textShadowRadius: 3 }}>{r.score}</Text>
          </View>
        );
      })}
    </View>
  );
};

export const WorldScoreMap = ({ ar, onClose }) => {
  useSheetBack(onClose);
  const [rows, setRows] = useState(null);
  const [w, setW] = useState(0);
  useEffect(() => { worldBoard('runner').then(setRows).catch(() => setRows([])); }, []);

  const face = (r) => r.avatar || buildAvatarUrl(r.id);
  const champs = [];
  const seen = new Set();
  (rows || []).forEach((r, i) => {
    const pt = pointFor(r);
    if (!pt || seen.has(pt.country)) return;
    seen.add(pt.country);
    champs.push({ ...r, ...pt, rank: i + 1 });
  });

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#081226' }}>
      <View style={{ paddingTop: 52, paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={ar ? 'رجوع' : 'Back'}>
          <Ionicons name="chevron-down" size={28} color="#FFF" />
        </Pressable>
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginStart: 10, flex: 1 }}>{ar ? '🌍 أبطال كل بلد' : '🌍 Champions of every country'}</Text>
      </View>
      {rows == null ? <ActivityIndicator color="#FFF" style={{ marginTop: 40 }} /> : (
        <>
          <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginHorizontal: 12 }}>
            {w > 0 ? <DotMap champs={champs} face={face} w={w} /> : null}
          </View>
          {champs.length ? (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, textAlign: 'center', marginTop: 6 }}>
              {ar ? 'على الخريطة: أعلى واحد في كل بلد' : 'On the map: the best runner in each country'}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {!rows.length ? (
              <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 30 }}>{ar ? 'مفيش نتايج لسه — كن أول واحد!' : 'No scores yet — be the first!'}</Text>
            ) : (
              <>
                {/* the podium: second, first, third — the way a podium stands */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 18 }}>
                  {[1, 0, 2].map((i) => rows[i] ? (
                    <View key={rows[i].id} style={{ alignItems: 'center', width: 100 }}>
                      <Image source={{ uri: face(rows[i]) }} style={{ width: i === 0 ? 62 : 50, height: i === 0 ? 62 : 50, borderRadius: 31, borderWidth: 2.5, borderColor: i === 0 ? C.gold : '#FFF' }} />
                      <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginTop: 5 }} numberOfLines={1}>{(rows[i].flag ? rows[i].flag + ' ' : '') + (rows[i].name || '')}</Text>
                      <View style={{ marginTop: 6, width: 84, height: i === 0 ? 70 : i === 1 ? 52 : 40, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: i === 0 ? 'rgba(245,179,1,0.9)' : 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20 }}>{MEDAL[i]}</Text>
                        <Text style={{ color: i === 0 ? '#081226' : '#FFF', fontSize: 13, fontWeight: '900' }}>{rows[i].score}</Text>
                      </View>
                    </View>
                  ) : null)}
                </View>
                {rows.slice(3, 50).map((r, i) => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '900', width: 38 }}>{'#' + (i + 4)}</Text>
                    <Image source={{ uri: face(r) }} style={{ width: 28, height: 28, borderRadius: 14, marginEnd: 9 }} />
                    <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>{(r.flag ? r.flag + ' ' : '') + (r.name || '')}</Text>
                    <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900' }}>{r.score}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};
