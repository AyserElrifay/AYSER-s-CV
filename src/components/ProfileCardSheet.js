import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { cw } from '../constants/cardWords';
import { myCard, saveCard, uploadCardPhoto } from '../services/card';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE 3-PHOTO CARD ────────────────────────────────────────────────
   Ayser, November 2026: before an offline seat, a card — your face, two
   photos of your life, and two short answers. Each photo is made light
   here (WebP 1080) and a 24-pixel copy is made for the blur; the server
   takes only addresses from your own folder (RUN_ME.sql
   profile_card_save) and gives +30 XP the first time. */
const Slot = ({ i, url, busy, lang, onPick }) => (
  <Pressable testID={'card-slot-' + i} onPress={onPick} accessibilityRole="button" accessibilityLabel={cw(lang, 'p' + Math.min(i, 3))} style={{ flex: 1, marginHorizontal: 4 }}>
    <View style={{ aspectRatio: 3 / 4, borderRadius: 14, overflow: 'hidden', borderWidth: url ? 0 : 1.5, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' }}>
      {url ? <Image source={{ uri: url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : null}
      {busy ? <ActivityIndicator color={C.text} /> : !url ? <Ionicons name="add" size={26} color={C.text} /> : null}
      <View style={{ position: 'absolute', left: 6, bottom: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{i + ' · ' + cw(lang, i === 1 ? 'p1' : i === 2 ? 'p2' : 'p3')}</Text>
      </View>
    </View>
  </Pressable>
);

export const ProfileCardSheet = ({ onClose, onSaved }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const { user } = useAuth() || {};
  const qs = cw(lang, 'q');
  const [photos, setPhotos] = useState([null, null, null]);
  const [blurs, setBlurs] = useState([null, null, null]);
  const [busy, setBusy] = useState(-1);
  const [prompts, setPrompts] = useState([{ q: qs[0], a: '' }, { q: qs[1], a: '' }]);
  const [choosing, setChoosing] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    myCard().then((r) => {
      const c = r && r.card;
      if (!c) return;
      if (Array.isArray(c.photos) && c.photos.length === 3) setPhotos(c.photos);
      if (Array.isArray(c.blurs) && c.blurs.length === 3) setBlurs(c.blurs);
      if (Array.isArray(c.prompts) && c.prompts.length === 2) setPrompts(c.prompts);
    });
  }, []);

  const pick = async (k) => {
    if (busy >= 0 || !user) return;
    tapLight(); setNote(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 1 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      setBusy(k);
      const up = await uploadCardPhoto(user.id, res.assets[0].uri);
      setPhotos((p) => p.map((x, i) => (i === k ? up.photo : x)));
      setBlurs((p) => p.map((x, i) => (i === k ? up.blur : x)));
    } catch (e) { setNote(cw(lang, 'err')); }
    setBusy(-1);
  };

  const ready = photos.every(Boolean) && blurs.every(Boolean) && prompts.every((p) => p.q && p.a.trim());
  const save = async () => {
    if (!ready) { setNote(cw(lang, 'missing')); return; }
    tapLight(); setSaving(true); setNote(null);
    const r = await saveCard(photos, blurs, prompts.map((p) => ({ q: p.q, a: p.a.trim() })));
    setSaving(false);
    if (r && r.ok) {
      tapSuccess();
      setNote(r.xp ? cw(lang, 'saved', { n: r.xp }) : cw(lang, 'savedNoXp'));
      if (onSaved) onSaved(r);
      setTimeout(onClose, 900);
    } else setNote(cw(lang, r && r.reason === 'three' ? 'missing' : 'err'));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View testID="card-sheet" style={{ maxHeight: '94%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
            <Text style={{ flex: 1, color: C.text, fontSize: 21, fontWeight: '800' }}>{cw(lang, 'title')}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={cw(lang, 'close')}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 6, marginHorizontal: 4 }}>{cw(lang, 'sub')}</Text>
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              {[0, 1, 2].map((k) => <Slot key={k} i={k + 1} url={photos[k]} busy={busy === k} lang={lang} onPick={() => pick(k)} />)}
            </View>
            <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 8, marginHorizontal: 4 }}>{cw(lang, 'p1Sub') + '  ' + cw(lang, 'p23Sub')}</Text>
            <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 16, marginTop: 6, marginHorizontal: 4 }}>{cw(lang, 'faceNote')}</Text>

            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 18, marginHorizontal: 4 }}>{cw(lang, 'prompts')}</Text>
            {prompts.map((p, k) => (
              <View key={k} style={{ marginTop: 10, marginHorizontal: 4, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 }}>
                <Pressable testID={'card-q-' + k} onPress={() => { tapLight(); setChoosing(choosing === k ? -1 : k); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: '700' }}>{p.q}</Text>
                  <Ionicons name={choosing === k ? 'chevron-up' : 'chevron-down'} size={16} color={C.dim} />
                </Pressable>
                {choosing === k ? qs.filter((q) => !prompts.some((x, j) => j !== k && x.q === q)).map((q) => (
                  <Pressable key={q} onPress={() => { tapLight(); setPrompts(prompts.map((x, j) => (j === k ? { ...x, q } : x))); setChoosing(-1); }} style={{ paddingVertical: 8 }}>
                    <Text style={{ color: q === p.q ? C.text : C.dim, fontSize: 13.5, fontWeight: q === p.q ? '800' : '500' }}>{q}</Text>
                  </Pressable>
                )) : null}
                <TextInput testID={'card-a-' + k} value={p.a} maxLength={140} placeholder={cw(lang, 'answer')} placeholderTextColor={C.faint}
                  onChangeText={(a) => setPrompts(prompts.map((x, j) => (j === k ? { ...x, a } : x)))}
                  style={{ color: C.text, fontSize: 15, marginTop: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line, textAlign: lang === 'ar' ? 'right' : 'left' }} />
              </View>
            ))}
            {note ? <Text style={{ color: C.text, fontSize: 13.5, marginTop: 12, marginHorizontal: 4 }}>{note}</Text> : null}
            <Pressable testID="card-save" onPress={save} disabled={saving} accessibilityRole="button" style={{ marginTop: 16, marginHorizontal: 4 }}>
              <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: ready ? C.purple : C.line }}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: ready ? '#FFF' : C.dim, fontSize: 15, fontWeight: '800' }}>{cw(lang, 'save')}</Text>}
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* the line on Space: make the card, or it is ready */
export const ProfileCardEntry = ({ line } = {}) => {
  const { lang } = useLang();
  const [card, setCard] = useState(undefined);
  const [open, setOpen] = useState(false);
  const load = () => myCard().then((r) => setCard(r && r.ok ? r : null));
  useEffect(() => { load(); }, []);
  if (card === undefined || card === null) return null;
  const ready = !!card.ready;
  const ph = card.card && Array.isArray(card.card.photos) ? card.card.photos : [];
  if (line) {
    /* one line inside the Local Pass (Ayser, November 2026) */
    return (
      <>
        <Pressable testID="card-entry" onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={ready ? 'checkmark-circle' : 'images-outline'} size={15} color={ready ? C.green : C.text} />
          <Text style={{ flex: 1, color: ready ? C.dim : C.text, fontSize: 13, fontWeight: ready ? '600' : '800', marginStart: 6 }} numberOfLines={1}>
            {ready ? cw(lang, 'ready') + ' · ' + cw(lang, 'edit') : cw(lang, 'need') + (lang === 'ar' ? ' · +٣٠ نقطة' : ' · +30 points')}
          </Text>
          <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={14} color={C.faint} />
        </Pressable>
        {open ? <ProfileCardSheet onClose={() => { setOpen(false); load(); }} /> : null}
      </>
    );
  }
  return (
    <>
      <Pressable testID="card-entry" onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ marginHorizontal: 16, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: ready ? C.line : C.text, backgroundColor: C.glass, padding: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ width: 30, height: 40, borderRadius: 7, overflow: 'hidden', marginEnd: 4, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                {ph[k] ? <Image source={{ uri: ph[k] }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="add" size={14} color={C.dim} />}
              </View>
            ))}
          </View>
          <View style={{ flex: 1, marginStart: 8 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{ready ? cw(lang, 'ready') : cw(lang, 'need')}</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{ready ? cw(lang, 'edit') : cw(lang, 'needSub')}</Text>
          </View>
          <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={C.dim} />
        </View>
      </Pressable>
      {open ? <ProfileCardSheet onClose={() => { setOpen(false); load(); }} /> : null}
    </>
  );
};
