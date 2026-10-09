import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { SheetHandle } from './SheetHandle';
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

export const GoNowSheet = ({ onClose, initialKind, initialTitle, initialPlace }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [kind, setKind] = useState(initialKind || 'walk');
  const [inMin, setInMin] = useState(0);
  const [title, setTitle] = useState(initialTitle || '');
  const [place, setPlace] = useState(initialPlace || '');
  const [country, setCountry] = useState(null);
  const [state, setState] = useState(null);     // null | 'busy' | { told, id, lat, lng } | { err }
  const [more, setMore] = useState(!!initialTitle);   // note and place, folded away

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
  const whenLabel = (m) => (m === 0 ? t('gn_now') : m < 60 ? t('gn_m30') : m === 60 ? t('gn_h1') : t('gn_h2'));

  /* ── THE LOOK ── Swiss and quiet: one accent, big type, air. One tap
     for what, one for when, one to go. A note and a place exist but stay
     folded until asked for — most people never need them. */
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 24 }}>
          <SheetHandle onClose={onClose} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>{done ? t('gn_live') : t('gn_heading')}</Text>
              <Text style={{ color: C.dim, fontSize: 15, marginTop: 6 }}>
                {done ? (state.told > 0 ? t('gn_told').replace('{n}', String(state.told)) : t('gn_told_none')) : t('gn_sub')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ paddingTop: 6, paddingStart: 12 }}>
              <Ionicons name="close" size={24} color={C.faint} />
            </Pressable>
          </View>

          {done ? (
            <Pressable onPress={() => { tapLight(); onClose(); showOnMap({ lat: state.lat, lng: state.lng }); }} accessibilityRole="button"
              style={{ marginTop: 32, backgroundColor: C.purple, borderRadius: 18, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>{t('show_on_map')}</Text>
            </Pressable>
          ) : (
            <>
              {/* what — five big squares, one row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 }}>
                {KINDS.map((k) => {
                  const on = kind === k.id; const l = lookOf(k.id);
                  return (
                    <Pressable key={k.id} onPress={() => { tapLight(); setKind(k.id); }} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t(k.key)} style={{ alignItems: 'center', width: '19%' }}>
                      <View style={{ width: '100%', aspectRatio: 1, maxWidth: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: on ? C.purple : C.glassHi }}>
                        <Text style={{ fontSize: 26 }}>{l.emoji}</Text>
                      </View>
                      <Text style={{ color: on ? C.text : C.faint, fontSize: 11.5, fontWeight: on ? '800' : '600', marginTop: 7, textAlign: 'center' }} numberOfLines={2}>{t(k.key)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* when — one segmented control */}
              <View style={{ flexDirection: 'row', backgroundColor: C.glassHi, borderRadius: 14, padding: 4, marginTop: 26 }}>
                {WHEN.map((m) => {
                  const on = inMin === m;
                  return (
                    <Pressable key={m} onPress={() => { tapLight(); setInMin(m); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11, backgroundColor: on ? C.bg : 'transparent',
                        shadowColor: '#000', shadowOpacity: on ? 0.08 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
                      <Text style={{ color: on ? C.text : C.dim, fontSize: 14, fontWeight: on ? '800' : '600' }}>{whenLabel(m)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* details — folded */}
              {more ? (
                <View style={{ marginTop: 18 }}>
                  <TextInput value={title} onChangeText={setTitle} placeholder={t('gn_title_' + kind)} placeholderTextColor={C.faint}
                    style={{ borderBottomWidth: 1, borderBottomColor: C.line, color: C.text, paddingVertical: 12, fontSize: 16 }} />
                  <TextInput value={place} onChangeText={setPlace} placeholder={t('gn_place')} placeholderTextColor={C.faint}
                    style={{ borderBottomWidth: 1, borderBottomColor: C.line, color: C.text, paddingVertical: 12, fontSize: 16 }} />
                </View>
              ) : (
                <Pressable onPress={() => { tapLight(); setMore(true); }} accessibilityRole="button" style={{ marginTop: 18, alignSelf: 'flex-start' }}>
                  <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>+ {t('gn_add_note')}</Text>
                </Pressable>
              )}

              {state && state.err ? (
                <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 14 }}>
                  {state.err === 'no_location' ? t('gn_err_loc') : t('lamma_offline')}
                </Text>
              ) : null}

              <Pressable onPress={go} disabled={state === 'busy'} accessibilityRole="button"
                style={{ marginTop: 26, backgroundColor: C.purple, borderRadius: 18, paddingVertical: 18, alignItems: 'center', opacity: state === 'busy' ? 0.7 : 1 }}>
                {state === 'busy' ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>{t('gn_go_short').replace('{what}', (title.trim() || t(KINDS.find((k) => k.id === kind).key)))}</Text>
                )}
              </Pressable>
              <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('gn_fine')}</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
