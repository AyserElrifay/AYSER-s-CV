import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { reflectWithPapyrus } from '../services/bardi';
import { readCompass, compassLine } from './Compass';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE DIARY: HOW YOU FEEL, AND HOW IT CHANGES ─────────────────────
   Ayser: "تدوين مشاعرك وداياري مع بردي، ويحللها ويتابع تطورك ومشاعرك،
   وممكن يديك index بسيط … المهم يفضل بسيط". So: one tap for how today
   feels (five faces), a few words if you like (tapped), one line if you
   want to say more. The week shows as seven small faces, and one honest
   sentence: lighter, heavier or about the same as the week before —
   worked out from your own taps, nothing invented. When you want, you
   talk it over with Papyrus: only then do the last days leave the
   phone, and Papyrus answers with what it notices, one kind question
   and one small step. It is a friend who listens, not a doctor. */

const KEY = 'mm.diary.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(-400))); } catch (e) {} };
const FACES = ['😞', '😕', '😐', '🙂', '😄'];
const WORDS = ['tired', 'anxious', 'calm', 'grateful', 'proud', 'lonely', 'excited', 'sad', 'angry', 'loved'];
const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* the last n days, each with its average mood (or null) */
function days(list, n, fromDaysAgo = 0) {
  const out = [];
  for (let i = n - 1 + fromDaysAgo; i >= fromDaysAgo; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const ms = list.filter((e) => dayKey(new Date(e.at)) === k).map((e) => e.mood);
    out.push({ d, mood: avg(ms) });
  }
  return out;
}

export const Diary = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [list, setList] = useState(read);
  const [mood, setMood] = useState(null);
  const [words, setWords] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState(null);
  const [err, setErr] = useState(null);

  const write = () => {
    if (mood == null) return;
    tapSuccess();
    const n = list.concat({ at: new Date().toISOString(), mood: mood + 1, words, text: text.trim().slice(0, 500) });
    setList(n); save(n); setMood(null); setWords([]); setText('');
  };
  const week = days(list, 7);
  const thisW = avg(week.map((x) => x.mood).filter((x) => x != null));
  const lastW = avg(days(list, 7, 7).map((x) => x.mood).filter((x) => x != null));
  const trend = thisW == null ? null : lastW == null ? 'first' : thisW - lastW > 0.3 ? 'lighter' : lastW - thisW > 0.3 ? 'heavier' : 'same';
  const index = thisW == null ? null : Math.round(((thisW - 1) / 4) * 100);

  const talk = async () => {
    const recent = list.slice(-10);
    if (!recent.length || busy) return;
    tapLight(); setBusy(true); setErr(null);
    try {
      const lines = recent.map((e) => {
        const d = new Date(e.at);
        return '- ' + d.toLocaleDateString('en', { weekday: 'short' }) + ': ' + FACES[e.mood - 1]
          + (e.words && e.words.length ? ' ' + e.words.join(', ') : '') + (e.text ? ' — "' + e.text + '"' : '');
      }).join('\n');
      const r = await reflectWithPapyrus(lines, lang, compassLine(readCompass(), t));
      setReply(r);
    } catch (e) {
      setErr(t(e && e.code === 'signed_out' ? 'dy_err_signin' : 'dy_err_busy'));
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
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'📓 ' + t('dy_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, marginBottom: 16 }}>{t('dy_sub')}</Text>

          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 10 }}>{t('dy_q')}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {FACES.map((f, i) => (
              <Pressable key={f} onPress={() => { tapSelection(); setMood(i); }} accessibilityRole="radio" accessibilityState={{ selected: mood === i }} style={{ flex: 1, marginHorizontal: 3 }}>
                <View style={{ borderRadius: 18, borderWidth: 1.5, borderColor: mood === i ? C.purple : C.line, backgroundColor: mood === i ? C.purpleSoft : C.glass, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{f}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {mood != null ? (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                {WORDS.map((w) => { const on = words.indexOf(w) >= 0; return (
                  <Pressable key={w} onPress={() => { tapSelection(); setWords((x) => (on ? x.filter((y) => y !== w) : x.concat(w).slice(-3))); }} style={{ marginEnd: 6, marginBottom: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purple : C.glass, paddingHorizontal: 12, paddingVertical: 8 }}>
                      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13.5, fontWeight: '800' }}>{t('dy_w_' + w)}</Text>
                    </View>
                  </Pressable>
                ); })}
              </View>
              <TextInput value={text} onChangeText={setText} maxLength={500} multiline placeholder={t('dy_ph')} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 14.5, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingHorizontal: 14, paddingVertical: 12, minHeight: 70, textAlignVertical: 'top', outlineStyle: 'none' }} />
              <Pressable onPress={write} accessibilityRole="button" style={{ marginTop: 10 }}>
                <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{t('dy_save')}</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* the week, as seven faces, and one honest sentence about it */}
          <View style={{ marginTop: 22, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, flex: 1 }}>{t('dy_week').toUpperCase()}</Text>
              {index != null ? <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900' }}>{t('dy_index').replace('{n}', String(index))}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              {week.map((x) => (
                <View key={x.d.toISOString()} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 20, opacity: x.mood == null ? 0.25 : 1 }}>{x.mood == null ? '·' : FACES[Math.round(x.mood) - 1]}</Text>
                  <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>{x.d.toLocaleDateString(lang || 'en', { weekday: 'narrow' })}</Text>
                </View>
              ))}
            </View>
            {trend ? <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', marginTop: 10 }}>{t('dy_trend_' + trend)}</Text> : <Text style={{ color: C.faint, fontSize: 13, marginTop: 10 }}>{t('dy_empty')}</Text>}
          </View>

          {/* talk it over with Papyrus — the only time the diary leaves the phone */}
          {list.length ? (
            <View style={{ marginTop: 14 }}>
              <Pressable onPress={talk} disabled={busy} accessibilityRole="button">
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: C.purple, paddingVertical: 13 }}>
                  {busy ? <ActivityIndicator color={C.purple} /> : <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{'🌾 ' + t('dy_talk')}</Text>}
                </View>
              </Pressable>
              <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 6 }}>{t('dy_talk_note')}</Text>
              {reply ? (
                <View style={{ marginTop: 12, borderRadius: 18, backgroundColor: C.purpleSoft, padding: 14 }}>
                  <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{t('bd_name').toUpperCase()}</Text>
                  <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21, marginTop: 4 }}>{reply}</Text>
                </View>
              ) : null}
              {err ? <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 8 }}>{err}</Text> : null}
            </View>
          ) : null}

          {list.slice(-5).reverse().filter((e) => e.text).map((e) => (
            <View key={e.at} style={{ marginTop: 10, borderRadius: 14, backgroundColor: '#FFF6D6', padding: 12 }}>
              <Text style={{ color: '#8A7535', fontSize: 11.5, fontWeight: '800' }}>{FACES[e.mood - 1] + '  ' + new Date(e.at).toLocaleDateString(lang || 'en', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
              <Text style={{ color: '#4A3B12', fontSize: 14, lineHeight: 20, marginTop: 3 }}>{e.text}</Text>
            </View>
          ))}
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 14 }}>{t('dy_private')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};
