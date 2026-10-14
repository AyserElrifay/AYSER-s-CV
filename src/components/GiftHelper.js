import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { giftIdeas } from '../services/bardi';
import { SPOTS, directionsUrl } from '../constants/spots';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapSelection } from '../utils/feedback';
import { lazyOverlay } from '../lib/lazyScreen';

/* ─── A GIFT, WITH PAPYRUS ────────────────────────────────────────────
   Who they are to you, how old, what they love, the budget — then
   Papyrus suggests a few ideas, and below, real places to find gifts
   (Out in Cairo, by name and area, with directions). Nothing leaves the
   phone until "Ask Papyrus". */
const PlusSheet = lazyOverlay(() => import('./PlusSheet').then((m) => ({ default: m.PlusSheet })));
const WHO = ['mom', 'dad', 'partner', 'friend', 'sibling', 'child', 'colleague'];
const WHEN = ['birthday', 'anniversary', 'thanks', 'justbecause'];
const BUDGET = ['low', 'mid', 'high'];

const Chip = ({ on, label, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ marginEnd: 7, marginBottom: 7 }}>
    <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purple : C.glass, paddingHorizontal: 13, paddingVertical: 8 }}>
      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13.5, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

export const GiftHelper = ({ onClose, name }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [who, setWho] = useState('friend');
  const [when, setWhen] = useState('birthday');
  const [budget, setBudget] = useState('mid');
  const [age, setAge] = useState('');
  const [loves, setLoves] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState(null);
  const [err, setErr] = useState(null);
  const [plus, setPlus] = useState(false);
  const head = { color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 };
  const shops = SPOTS.filter((s) => s.kind === 'gifts');

  const askIt = async () => {
    if (busy || !loves.trim()) return;
    tapLight(); setBusy(true); setErr(null); setReply(null);
    try {
      const r = await giftIdeas({ who: (name ? name + ', ' : '') + t('gh_who_' + who), age, loves, budget: t('gh_b_' + budget), occasion: t('gh_w_' + when) }, lang);
      setReply(r);
    } catch (e) {
      if (e && e.code === 'plus') setPlus(true);
      else setErr(t(e && e.code === 'signed_out' ? 'dy_err_signin' : 'dy_err_busy'));
    }
    setBusy(false);
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginTop: 8 }}>{'🎁 ' + t('gh_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{t('gh_sub')}</Text>

          <Text style={head}>{t('gh_q_who').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{WHO.map((k) => <Chip key={k} on={who === k} label={t('gh_who_' + k)} onPress={() => { tapSelection(); setWho(k); }} />)}</View>
          <Text style={head}>{t('gh_q_when').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{WHEN.map((k) => <Chip key={k} on={when === k} label={t('gh_w_' + k)} onPress={() => { tapSelection(); setWhen(k); }} />)}</View>
          <Text style={head}>{t('gh_q_about').toUpperCase()}</Text>
          <TextInput value={age} onChangeText={(v) => setAge(v.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" placeholder={t('gh_age_ph')} placeholderTextColor={C.faint}
            style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, outlineStyle: 'none' }} />
          <TextInput value={loves} onChangeText={setLoves} multiline maxLength={600} placeholder={t('gh_loves_ph')} placeholderTextColor={C.faint}
            style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, minHeight: 90, marginTop: 8, textAlignVertical: 'top', outlineStyle: 'none' }} />
          <Text style={head}>{t('gh_q_budget').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{BUDGET.map((k) => <Chip key={k} on={budget === k} label={t('gh_b_' + k)} onPress={() => { tapSelection(); setBudget(k); }} />)}</View>

          <Pressable onPress={askIt} disabled={busy || !loves.trim()} accessibilityRole="button" style={{ marginTop: 18 }}>
            <View style={{ borderRadius: 999, backgroundColor: loves.trim() ? C.purple : C.glassHi, paddingVertical: 15, alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: loves.trim() ? '#FFF' : C.faint, fontSize: 16, fontWeight: '900' }}>{'🌾 ' + t('gh_ask')}</Text>}
            </View>
          </Pressable>
          <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 6 }}>{t('gh_note')}</Text>
          {err ? <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 8 }}>{err}</Text> : null}
          {reply ? (
            <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: C.purpleSoft, padding: 14 }}>
              <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{t('bd_name').toUpperCase()}</Text>
              <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21, marginTop: 4 }}>{reply}</Text>
            </View>
          ) : null}

          <Text style={head}>{t('gh_where').toUpperCase()}</Text>
          {shops.map((s) => (
            <Pressable key={s.id} onPress={() => { tapLight(); try { Linking.openURL(directionsUrl(s)); } catch (e) {} }} accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text style={{ fontSize: 20, marginEnd: 12 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{s.name}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{t('sp_w_' + s.what) + ' · ' + s.area}</Text>
              </View>
              <Ionicons name="navigate-outline" size={18} color={C.purple} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {plus ? <PlusSheet why="papyrus" onClose={() => setPlus(false)} /> : null}
    </Modal>
  );
};
