import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../../constants/theme';
import { AV_NEUTRAL } from '../../constants/mockData';
import { twinState, twinAsk, twinCancel, twinPost, twinRemove, uploadPhoto } from '../../services/squadGames';
import { gw, fill, TWIN_WEEKS } from './words';
import { tapLight, tapSuccess } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';

/* ─── TWIN GROUP ──────────────────────────────────────────────────────
   Your group and a group in another country, for four weeks: the same
   small thing each week, on one board both groups see. Group to group
   — first names, no profiles to open, no private messages
   (supabase/RUN_ME.sql, "TWIN GROUPS"). */

const flagOf = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0))) : '🌍');

export const TwinSheet = ({ squadId, userId, lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const T = (k) => gw(lang, k);
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);

  const load = () => twinState(squadId).then((r) => { if (r && r.ok) setS(r); else setErr(T(r && r.reason === 'setup' ? 'setup' : 'err')); });
  useEffect(() => { load(); }, [squadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try {
      const r = await fn();
      if (r && r.ok === false) setErr(T({ small: 'twin_small', admins: 'twin_admins', no_country: 'twin_country', slow_down: 'slow_down', setup: 'setup', offline: 'offline' }[r.reason] || 'err'));
      else { tapSuccess(); await load(); }
      return r;
    } finally { setBusy(false); }
  };

  const pick = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      setPhoto({ local: res.assets[0].uri, url: null });
      setBusy(true);
      setPhoto({ local: res.assets[0].uri, url: await uploadPhoto(userId, res.assets[0].uri) });
    } catch (e) { setErr(T('photo_err')); setPhoto(null); } finally { setBusy(false); }
  };

  const week = s && s.week ? s.week : 1;
  const task = TWIN_WEEKS[week - 1] || TWIN_WEEKS[0];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={T('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🌍 ' + T('twin')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{T('twin_s')}</Text>

          {!s ? (err ? null : <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />) : s.state !== 'twinned' ? (
            <View style={{ marginTop: 18 }}>
              {s.state === 'waiting' ? (
                <View style={{ borderRadius: 20, padding: 18, backgroundColor: C.purpleSoft }}>
                  <ActivityIndicator color={C.purple} />
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', textAlign: 'center', marginTop: 10, lineHeight: 21 }}>{T('twin_wait')}</Text>
                </View>
              ) : null}
              {s.admin ? (
                <Pressable onPress={() => run(() => (s.state === 'waiting' ? twinCancel(squadId) : twinAsk(squadId)))} disabled={busy} accessibilityRole="button" style={{ marginTop: 14 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: s.state === 'waiting' ? C.glassHi : C.purple }}>
                    {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: s.state === 'waiting' ? C.text : '#FFF', fontSize: 15, fontWeight: '900' }}>{T(s.state === 'waiting' ? 'twin_cancel' : 'twin_ask')}</Text>}
                  </View>
                </Pressable>
              ) : <Text style={{ color: C.faint, fontSize: 13, marginTop: 14 }}>{T('twin_admins')}</Text>}
            </View>
          ) : (
            <>
              <View style={{ borderRadius: 22, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 18, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 40, marginEnd: 12 }}>{flagOf(s.twin && s.twin.country)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{((s.twin && s.twin.emoji) || '') + ' ' + ((s.twin && s.twin.name) || '')}</Text>
                  <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{fill(T('twin_week'), { n: week }) + ' · ' + ((s.twin && s.twin.people) || 0) + ' 👤'}</Text>
                </View>
              </View>
              <View style={{ borderRadius: 18, padding: 14, backgroundColor: C.purpleSoft, marginTop: 12 }}>
                <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>{fill(T('twin_week'), { n: week }).toUpperCase()}</Text>
                <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800', marginTop: 4, lineHeight: 22 }}>{lang === 'ar' ? task[1] : task[0]}</Text>
              </View>

              <TextInput value={text} onChangeText={setText} maxLength={300} multiline placeholder={T('twin_ph')} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: C.glass, marginTop: 12, minHeight: 70, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <Pressable onPress={pick} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {photo ? <Image source={{ uri: photo.local }} style={{ width: 40, height: 40, borderRadius: 10, marginEnd: 8 }} /> : <Ionicons name="image-outline" size={22} color={C.purple} style={{ marginEnd: 6 }} />}
                  <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{T('photo')}</Text>
                </Pressable>
                <Pressable disabled={busy || (!text.trim() && !(photo && photo.url))} accessibilityRole="button"
                  onPress={async () => { const r = await run(() => twinPost(squadId, text.trim(), photo && photo.url)); if (r && r.ok) { setText(''); setPhoto(null); } }}>
                  <View style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22, backgroundColor: C.purple, opacity: busy || (!text.trim() && !(photo && photo.url)) ? 0.5 : 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{T('send')}</Text>
                  </View>
                </Pressable>
              </View>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 8, lineHeight: 17 }}>{T('twin_safe') + ' ' + T('no_faces')}</Text>

              {(s.posts || []).length ? (s.posts || []).map((p) => (
                <View key={p.id} style={{ borderRadius: 18, padding: 12, marginTop: 12, backgroundColor: p.ours ? C.glass : C.purpleSoft, borderWidth: 1, borderColor: C.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={{ uri: p.avatar || AV_NEUTRAL }} style={{ width: 26, height: 26, borderRadius: 13, marginEnd: 8 }} />
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', flex: 1 }} numberOfLines={1}>{(p.flag ? p.flag + ' ' : '') + (p.name || '')}</Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>{fill(T('twin_week'), { n: p.week })}</Text>
                  </View>
                  {p.body ? <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 20, marginTop: 8 }}>{p.body}</Text> : null}
                  {p.photo ? <Image source={{ uri: p.photo }} style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 8 }} resizeMode="cover" /> : null}
                  {p.mine || s.admin ? (
                    <Pressable onPress={() => { tapLight(); run(() => twinRemove(p.id)); }} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
                      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{T('remove')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              )) : <Text style={{ color: C.dim, fontSize: 14, marginTop: 16 }}>{T('twin_none')}</Text>}

              {s.admin ? (
                <Pressable onPress={() => run(() => twinCancel(squadId))} accessibilityRole="button" style={{ marginTop: 26, alignSelf: 'center' }}>
                  <Text style={{ color: C.faint, fontSize: 13, fontWeight: '800' }}>{T('twin_end')}</Text>
                </Pressable>
              ) : null}
            </>
          )}
          {err ? <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 14 }}>{err}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
