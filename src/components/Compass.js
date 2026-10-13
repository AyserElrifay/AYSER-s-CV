import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE COMPASS: WHAT YOU CARE ABOUT, AND WHERE YOU WANT TO GROW ────
   Ayser: "خلي الناس تختار values وgoals وأحلام وهوايات — حتى لو نفسها
   تعمل عيلة أو تخلف ولدين وبنت … ويسألك: إنت حاسس إنك مقصّر في إيه أو
   عايز تبقى أحسن في إيه؟ … نفسي أبقى أقرب من ربنا ← قراية قرآن".

   All by tapping; one line of your own if you want it. Each place you
   want to grow becomes one small, daily slot in My day (placed in a
   real gap, like the rest of life): closer to God is Quran for a Muslim,
   the Bible for a Christian, quiet reflection for anyone else. The
   compass stays on this phone; Papyrus only sees it when you talk to
   it from your diary. */

export const KEY = 'mm.compass.v1';
export const readCompass = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

/* where to grow → the small daily thing it becomes (minutes) */
export const GROW = [
  { id: 'faith', emoji: '🤲', min: 15 },
  { id: 'learn', emoji: '📚', min: 20 },
  { id: 'body', emoji: '💪', min: 30 },
  { id: 'love', emoji: '📞', min: 10 },
  { id: 'friends', emoji: '💬', min: 5 },
  { id: 'career', emoji: '🚀', min: 30 },
  { id: 'calm', emoji: '🌬️', min: 5 },
  { id: 'create', emoji: '🎨', min: 20 },
];
/* the daily thing for "closer to God" depends on the faith somebody chose */
export const growLabel = (g, faith, t) => (g.id === 'faith'
  ? t(faith === 'muslim' ? 'cp_do_faith_m' : faith === 'christian' ? 'cp_do_faith_c' : 'cp_do_faith_n')
  : t('cp_do_' + g.id));
export const growEmoji = (g, faith) => (g.id === 'faith' ? (faith === 'muslim' ? '📖' : faith === 'christian' ? '✝️' : '🕯️') : g.emoji);

const VALUES = [['family', '👨‍👩‍👧'], ['faith', '🤲'], ['health', '🌿'], ['kindness', '🤝'], ['honesty', '🪞'], ['freedom', '🕊️'], ['growth', '🌱'], ['adventure', '🧭'], ['love', '❤️'], ['peace', '☮️']];
const DREAMS = [['family', '👨‍👩‍👧‍👦'], ['travel', '✈️'], ['home', '🏡'], ['business', '🚀'], ['degree', '🎓'], ['fit', '💪'], ['language', '🗣️'], ['give', '🤲']];
const HOBBIES = [['reading', '📖'], ['football', '⚽'], ['gym', '🏋️'], ['music', '🎵'], ['art', '🎨'], ['cooking', '🍳'], ['gaming', '🎮'], ['hiking', '🥾'], ['photo', '📷'], ['coffee', '☕']];

const Chip = ({ emoji, label, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }} style={{ marginEnd: 6, marginBottom: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass, paddingHorizontal: 12, paddingVertical: 9 }}>
      <Text style={{ fontSize: 15, marginEnd: 6 }}>{emoji}</Text>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: on ? '900' : '700' }}>{label}</Text>
    </View>
  </Pressable>
);
const Section = ({ title, sub, children }) => (
  <View style={{ marginTop: 20 }}>
    <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{title}</Text>
    {sub ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 2, marginBottom: 10 }}>{sub}</Text> : <View style={{ height: 10 }} />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>
  </View>
);

export const Compass = ({ onClose, faith }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [c, setC] = useState(readCompass);
  const flip = (field, id, max) => {
    tapSelection();
    setC((x) => {
      const cur = x[field] || [];
      let n = cur.indexOf(id) >= 0 ? cur.filter((y) => y !== id) : cur.concat(id);
      if (max && n.length > max) n = n.slice(n.length - max);
      const out = { ...x, [field]: n }; save(out); return out;
    });
  };
  const setText = (v) => setC((x) => { const out = { ...x, dream: v.slice(0, 120) }; save(out); return out; });
  const on = (field, id) => (c[field] || []).indexOf(id) >= 0;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🧭 ' + t('cp_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{t('cp_sub')}</Text>

          <Section title={t('cp_grow_q')} sub={t('cp_grow_sub')}>
            {GROW.map((g) => <Chip key={g.id} emoji={g.emoji} label={t('cp_grow_' + g.id)} on={on('grow', g.id)} onPress={() => flip('grow', g.id, 3)} />)}
          </Section>
          {(c.grow || []).length ? (
            <View style={{ marginTop: 2, borderRadius: 16, backgroundColor: C.purpleSoft, padding: 12 }}>
              {(c.grow || []).map((id) => { const g = GROW.find((x) => x.id === id); return g ? (
                <Text key={id} style={{ color: C.text, fontSize: 13.5, fontWeight: '700', marginBottom: 2 }}>{growEmoji(g, faith) + '  ' + growLabel(g, faith, t) + ' · ' + t('md_min').replace('{n}', String(g.min))}</Text>
              ) : null; })}
              <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{t('cp_grow_note')}</Text>
            </View>
          ) : null}

          <Section title={t('cp_values_q')} sub={t('cp_values_sub')}>
            {VALUES.map(([id, e]) => <Chip key={id} emoji={e} label={t('cp_v_' + id)} on={on('values', id)} onPress={() => flip('values', id, 3)} />)}
          </Section>

          <Section title={t('cp_dreams_q')}>
            {DREAMS.map(([id, e]) => <Chip key={id} emoji={e} label={t('cp_d_' + id)} on={on('dreams', id)} onPress={() => flip('dreams', id)} />)}
          </Section>
          <TextInput value={c.dream || ''} onChangeText={setText} maxLength={120} placeholder={t('cp_dream_ph')} placeholderTextColor={C.faint}
            style={{ color: C.text, fontSize: 14.5, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingHorizontal: 14, paddingVertical: 12, outlineStyle: 'none' }} />

          <Section title={t('cp_hobbies_q')}>
            {HOBBIES.map(([id, e]) => <Chip key={id} emoji={e} label={t('cp_h_' + id)} on={on('hobbies', id)} onPress={() => flip('hobbies', id)} />)}
          </Section>

          <Pressable onPress={() => { tapSuccess(); onClose(); }} accessibilityRole="button" style={{ marginTop: 22 }}>
            <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{t('md_continue')}</Text>
            </View>
          </Pressable>
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 10 }}>{t('cp_private')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

/* a sentence about somebody's compass, for Papyrus — their own words only */
export function compassLine(c, t) {
  if (!c) return '';
  const parts = [];
  if ((c.values || []).length) parts.push('values: ' + c.values.map((v) => t('cp_v_' + v)).join(', '));
  if ((c.grow || []).length) parts.push('wants to grow in: ' + c.grow.map((v) => t('cp_grow_' + v)).join(', '));
  if ((c.dreams || []).length || c.dream) parts.push('dreams: ' + (c.dreams || []).map((v) => t('cp_d_' + v)).concat(c.dream ? [c.dream] : []).join(', '));
  return parts.join('; ');
}
