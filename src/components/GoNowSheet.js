import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { goNow } from '../services/green';
import { getProfile } from '../services/profiles';
import { getCurrentCoords } from '../utils/location';
import { flagToIso } from '../lib/together';
import { lookOf } from '../lib/activityPins';
import { showOnMap } from '../lib/mapBus';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

/* ─── GO OUT NOW ──────────────────────────────────────────────────────
   Ayser: "أنا النهارده الصبح عايز انزل اتمشي الفجر واظهر على الخريطة
   وأي حد حواليا يقدر join — واعمل إظهار للمهتم بالجري".

   Three taps: what, when, go. It asks for your location here, because
   this is the one moment putting you on the map is the whole point.
   The server makes it a small gathering (up to 8) on the map and in
   Together, and tells the people within 5 km who said they are into
   it. The screen then says how many were told — the real number,
   including zero. */

const KINDS = [
  { id: 'walk', key: 'gn_walk' },
  { id: 'run', key: 'gn_run' },
  { id: 'coffee', key: 'gn_coffee' },
  { id: 'focus', key: 'gn_focus' },
  { id: 'sport', key: 'gn_sport' },
];
const WHEN = [0, 30, 60, 120];

export const GoNowSheet = ({ onClose, initialKind, initialTitle }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [kind, setKind] = useState(initialKind || 'walk');
  const [inMin, setInMin] = useState(0);
  const [title, setTitle] = useState(initialTitle || '');
  const [place, setPlace] = useState('');
  const [country, setCountry] = useState(null);
  const [state, setState] = useState(null);     // null | 'busy' | { told, id, lat, lng } | { err }

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((p) => setCountry(flagToIso(p && p.country_flag))).catch(() => {});
  }, [user && user.id]);

  const go = async () => {
    if (state === 'busy') return;
    tapMedium();
    setState('busy');
    const at = await getCurrentCoords();
    if (!at) { setState({ err: 'no_location' }); return; }
    const r = await goNow({
      kind, title: title.trim() || t('gn_title_' + kind), lat: at.latitude, lng: at.longitude,
      inMinutes: inMin, minutes: 60, country: country || 'EG', place: place.trim() || null,
    });
    if (r && r.ok) { tapSuccess(); setState({ told: Number(r.told) || 0, id: r.id, lat: at.latitude, lng: at.longitude }); }
    else setState({ err: (r && r.reason) || 'server' });
  };

  const done = state && state.id;
  const look = lookOf(kind);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: insets.bottom + 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', flex: 1 }}>{t('gn_title')}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={18} color={C.text} />
            </Pressable>
          </View>

          {done ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <LinearGradient colors={[look.from, look.to]} style={{ width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }}>
                <Text style={{ fontSize: 38 }}>{look.emoji}</Text>
              </LinearGradient>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', marginTop: 14, textAlign: 'center' }}>{t('gn_live')}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                {state.told > 0 ? t('gn_told').replace('{n}', String(state.told)) : t('gn_told_none')}
              </Text>
              <Pressable onPress={() => { tapLight(); onClose(); showOnMap({ lat: state.lat, lng: state.lng }); }} style={{ marginTop: 18, alignSelf: 'stretch' }}>
                <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 15, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{t('show_on_map')}</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 }}>{t('gn_what')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {KINDS.map((k) => {
                  const on = kind === k.id; const l = lookOf(k.id);
                  return (
                    <Pressable key={k.id} onPress={() => { tapLight(); setKind(k.id); }} style={{ marginEnd: 8, marginBottom: 8 }} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1.5, borderColor: on ? l.from : C.line, backgroundColor: on ? C.glassHi : C.glass }}>
                        <Text style={{ fontSize: 16 }}>{l.emoji}</Text>
                        <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', marginStart: 6 }}>{t(k.key)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8, marginTop: 4 }}>{t('gn_when')}</Text>
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                {WHEN.map((m) => {
                  const on = inMin === m;
                  return (
                    <Pressable key={m} onPress={() => { tapLight(); setInMin(m); }} style={{ flex: 1, marginEnd: m === 120 ? 0 : 8 }} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                      <View style={{ alignItems: 'center', borderRadius: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '900' }}>{m === 0 ? t('gn_now') : t('gn_in').replace('{n}', String(m))}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput value={title} onChangeText={setTitle} placeholder={t('gn_title_' + kind)} placeholderTextColor={C.faint}
                style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, marginBottom: 9 }} />
              <TextInput value={place} onChangeText={setPlace} placeholder={t('gn_place')} placeholderTextColor={C.faint}
                style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5 }} />

              <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 10 }}>{t('gn_note')}</Text>
              {state && state.err ? (
                <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginTop: 8 }}>
                  {state.err === 'no_location' ? t('gn_err_loc') : t('lamma_offline')}
                </Text>
              ) : null}

              <Pressable onPress={go} disabled={state === 'busy'} style={{ marginTop: 14 }} accessibilityRole="button">
                <LinearGradient colors={[look.from, look.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                  {state === 'busy' ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '900' }}>{look.emoji + '  ' + t('gn_go')}</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
