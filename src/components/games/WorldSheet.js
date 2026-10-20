import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../../constants/theme';
import { AV_NEUTRAL } from '../../constants/mockData';
import { worldBoard, worldEnter, worldLeave, walkTotal, walkAdd, uploadPhoto, skyKey, dishKey } from '../../services/squadGames';
import { gw, fill, say, DISHES, WALK_STOPS } from './words';
import { tapLight, tapSelection, tapSuccess } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';

/* ─── ONE WORLD ───────────────────────────────────────────────────────
   The same thing, everywhere, on the same day (supabase/RUN_ME.sql,
   "ONE WORLD"): tonight's sky from wherever people are, the dish of
   the month, and the kilometres everybody walked added up on the road
   from Cairo. Real entries only — an empty strip says nobody yet. */

const TABS = ['sky', 'dish', 'walk'];

const Board = ({ ch, userId, lang, T, city, intro }) => {
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [cap, setCap] = useState('');
  const [where, setWhere] = useState(city || '');
  const load = () => worldBoard(ch, 80).then((r) => { if (r && r.ok) setB(r); else setErr(T(r && r.reason === 'setup' ? 'setup' : 'err')); });
  useEffect(() => { load(); }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.7 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      setBusy(true); setErr(null);
      const url = await uploadPhoto(userId, res.assets[0].uri);
      const r = await worldEnter(ch, url, cap.trim(), where.trim());
      if (r && r.ok) { tapSuccess(); setCap(''); load(); } else setErr(T('err'));
    } catch (e) { setErr(T('photo_err')); } finally { setBusy(false); }
  };

  return (
    <>
      {intro}
      <TextInput value={where} onChangeText={setWhere} maxLength={60} placeholder={T('city_ph')} placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.glass, marginTop: 12 }} />
      <TextInput value={cap} onChangeText={setCap} maxLength={140} placeholder={T('caption_ph')} placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.glass, marginTop: 8 }} />
      <Pressable onPress={add} disabled={busy} accessibilityRole="button" style={{ marginTop: 12 }}>
        <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple, flexDirection: 'row', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="camera" size={17} color="#FFF" style={{ marginEnd: 8 }} /><Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{T(b && b.mine ? 'again' : 'photo')}</Text></>}
        </View>
      </Pressable>
      <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>{T('no_faces')}</Text>
      {err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '700', marginTop: 8 }}>{err}</Text> : null}

      {!b ? (err ? null : <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} />) : (
        <>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 20 }}>{b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : T('none_yet')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 6 }}>
            {(b.entries || []).map((e) => (
              <View key={e.id} style={{ width: '50%', padding: 4 }}>
                <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                  <Image source={{ uri: e.photo }} style={{ width: '100%', aspectRatio: 4 / 5 }} resizeMode="cover" />
                  <View style={{ padding: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Image source={{ uri: e.avatar || AV_NEUTRAL }} style={{ width: 18, height: 18, borderRadius: 9, marginEnd: 6 }} />
                      <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', flex: 1 }} numberOfLines={1}>{(e.flag ? e.flag + ' ' : '') + (e.city || e.name || '')}</Text>
                    </View>
                    {e.body ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>{e.body}</Text> : null}
                    {e.mine ? (
                      <Pressable onPress={() => { tapLight(); worldLeave(e.id).then(load); }} hitSlop={6} style={{ marginTop: 4 }}>
                        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800' }}>{T('yours') + ' · ' + T('remove')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
};

const Walk = ({ lang, T }) => {
  const [w, setW] = useState(null);
  const [km, setKm] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { walkTotal().then((r) => { if (r && r.ok) { setW(r); if (r.today) setKm(String(r.today)); } else setErr(T(r && r.reason === 'setup' ? 'setup' : 'err')); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = w ? Number(w.km) || 0 : 0;
  const end = WALK_STOPS[WALK_STOPS.length - 1].km;
  // after Lisbon the road starts again from Cairo, and says how many times round
  const lap = Math.floor(total / end);
  const pos = total - lap * end;
  let at = WALK_STOPS[0]; let next = WALK_STOPS[1];
  WALK_STOPS.forEach((s, i) => { if (pos >= s.km) { at = s; next = WALK_STOPS[i + 1] || WALK_STOPS[0]; } });
  const save = async () => {
    const n = Math.min(30, Math.max(0, parseFloat(String(km).replace(',', '.')) || 0));
    tapSelection();
    const r = await walkAdd(n);
    if (r && r.ok) { tapSuccess(); setW(r); setErr(null); } else setErr(T('err'));
  };
  return (
    <>
      <Text style={{ color: C.dim, fontSize: 14, marginTop: 14, lineHeight: 20 }}>{T('walk_s')}</Text>
      {!w ? (err ? <Text style={{ color: C.coral, marginTop: 14 }}>{err}</Text> : <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} />) : (
        <>
          <View style={{ borderRadius: 22, padding: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 16 }}>
            <Text style={{ color: C.text, fontSize: 30, fontWeight: '900' }}>{Math.round(total).toLocaleString() + ' km'}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{fill(T('walk_km'), { km: Math.round(total).toLocaleString(), p: w.people || 0, c: w.countries || 0 })}</Text>
            {/* the road, Cairo to Lisbon, with where everybody has got to */}
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.glassHi, marginTop: 18, overflow: 'hidden' }}>
              <View style={{ width: Math.min(100, (pos / end) * 100) + '%', height: 8, backgroundColor: C.green }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: C.faint, fontSize: 11 }}>{say(lang, WALK_STOPS[0])}</Text>
              <Text style={{ color: C.faint, fontSize: 11 }}>{say(lang, WALK_STOPS[WALK_STOPS.length - 1])}</Text>
            </View>
            <Text style={{ color: C.green, fontSize: 15, fontWeight: '900', marginTop: 12 }}>{'📍 ' + fill(T('walk_at'), { place: say(lang, at) }) + (lap ? ' · ×' + (lap + 1) : '')}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{fill(T('walk_next'), { km: Math.max(0, Math.round((next.km || end) - pos)), place: say(lang, next) })}</Text>
          </View>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20 }}>{T('walk_today').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput value={km} onChangeText={setKm} keyboardType="decimal-pad" maxLength={4} placeholder="0" placeholderTextColor={C.faint}
              style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '800', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.glass }} />
            <Pressable onPress={save} accessibilityRole="button" style={{ marginStart: 10 }}>
              <View style={{ borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: C.purple }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{T('done')}</Text>
              </View>
            </Pressable>
          </View>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{fill(T('walk_mine'), { km: Number(w.mine || 0).toLocaleString() })}</Text>
          {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
        </>
      )}
    </>
  );
};

export const WorldSheet = ({ userId, lang, city, start, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const T = (k) => gw(lang, k);
  const [tab, setTab] = useState(start && TABS.includes(start) ? start : 'sky');
  const now = new Date();
  const dish = DISHES[now.getUTCMonth()];
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={T('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🌍 ' + T('world')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{T('world_s')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 16, backgroundColor: C.glassHi, borderRadius: 999, padding: 4 }}>
            {TABS.map((k) => (
              <Pressable key={k} onPress={() => { tapSelection(); setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1 }}>
                <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: tab === k ? C.glass : 'transparent' }}>
                  <Text style={{ color: tab === k ? C.text : C.dim, fontSize: 13, fontWeight: '900' }} numberOfLines={1}>{({ sky: '🌅 ', dish: '🍲 ', walk: '🚶 ' })[k] + T(k + '_t')}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {tab === 'sky' ? <Board key="sky" ch={skyKey()} userId={userId} lang={lang} T={T} city={city} intro={<Text style={{ color: C.dim, fontSize: 14, marginTop: 14, lineHeight: 20 }}>{T('sky_s')}</Text>} /> : null}
          {tab === 'dish' ? (
            <Board key="dish" ch={dishKey()} userId={userId} lang={lang} T={T} city={city} intro={(
              <View style={{ borderRadius: 18, padding: 14, backgroundColor: C.goldSoft, marginTop: 14 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{'🍲 ' + (lang === 'ar' ? dish[1] : dish[0])}</Text>
                <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>{T('dish_s')}</Text>
              </View>
            )} />
          ) : null}
          {tab === 'walk' ? <Walk lang={lang} T={T} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
