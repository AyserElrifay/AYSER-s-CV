import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { myJourney, myPromptAccess, submitPrompt, monthSummary, MOODS } from '../services/reflection';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

/* ─── MY JOURNEY ──────────────────────────────────────────────────────
   Every answer you gave to the question of the day, kept for you only,
   with this month in a few honest numbers counted from those answers —
   nothing guessed. And, once you know the place, a way to suggest a
   question for everybody (the Studio approves it first). */

export const JourneySheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [rows, setRows] = useState(null);
  const [access, setAccess] = useState(null);
  const [q, setQ] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  useSheetBack(onClose);
  useEffect(() => { myJourney().then(setRows); myPromptAccess().then(setAccess); }, []);

  const sum = rows ? monthSummary(rows) : null;
  const month = (iso) => { try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  const day = (iso) => { try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return iso; } };
  const groups = [];
  (rows || []).forEach((r) => {
    const k = month(r.day);
    const g = groups[groups.length - 1];
    if (g && g.k === k) g.items.push(r); else groups.push({ k, items: [r] });
  });

  const suggest = async () => {
    const body = q.trim(); if (body.length < 10) { setErr(t('sg_short')); return; }
    tapMedium(); setErr(null);
    const r = await submitPrompt(body);
    if (r && r.ok) { tapSuccess(); setSent(true); return; }
    setErr(t('sg_err_' + ((r && r.reason) === 'one_a_week' ? 'week' : (r && r.reason) === 'light_mood' ? 'mood' : (r && r.reason) === 'not_yet' ? 'not_yet' : 'other')));
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 50 }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.6, marginTop: 12 }}>{t('jr_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 21, marginTop: 4 }}>{t('jr_private')}</Text>

          {rows == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} /> : (
            <>
              {/* this month, counted from your own answers */}
              <View style={{ flexDirection: 'row', marginTop: 20, borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, paddingVertical: 16 }}>
                {[[String(sum.count), t('jr_this_month')], [String(sum.streak), t('jr_streak')], [sum.mood || '—', t('jr_mood')]].map(([v, l]) => (
                  <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 26, fontWeight: '900' }}>{v}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700', marginTop: 2, textAlign: 'center' }}>{l}</Text>
                  </View>
                ))}
              </View>
              {sum.words.length ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 10 }}>{t('jr_words') + ' ' + sum.words.join(' · ')}</Text> : null}

              {!rows.length ? <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 24, lineHeight: 21 }}>{t('jr_empty')}</Text> : groups.map((g) => (
                <View key={g.k} style={{ marginTop: 26 }}>
                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>{g.k.toUpperCase()}</Text>
                  {g.items.map((r) => (
                    <View key={r.day} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700' }}>{day(r.day) + (r.mood ? '  ' + MOODS[r.mood - 1] : '')}</Text>
                      <Text style={{ color: C.dim, fontSize: 13, marginTop: 3, fontStyle: 'italic' }}>{r.prompt}</Text>
                      <Text style={{ color: C.text, fontSize: 15.5, lineHeight: 22, marginTop: 4 }}>{r.body}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {/* suggest tomorrow's question */}
          <View style={{ marginTop: 30, borderRadius: 20, padding: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{'💡 ' + t('sg_title')}</Text>
            {!access ? <ActivityIndicator color={C.dim} style={{ marginTop: 12 }} /> : !access.eligible ? (
              <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>
                {t('sg_locked').replace('{days}', String(access.days)).replace('{need_days}', String(access.need_days)).replace('{checkins}', String(access.checkins)).replace('{need_checkins}', String(access.need_checkins))}
              </Text>
            ) : sent || Number(access.pending) > 0 ? (
              <Text style={{ color: C.green, fontSize: 13.5, fontWeight: '700', marginTop: 6 }}>{'✓ ' + t('sg_sent')}</Text>
            ) : (
              <>
                <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{t('sg_sub')}</Text>
                <TextInput value={q} onChangeText={setQ} maxLength={200} placeholder={t('sg_ph')} placeholderTextColor={C.faint}
                  style={{ color: C.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8, marginTop: 8, outlineStyle: 'none' }} />
                <Pressable onPress={suggest} accessibilityRole="button" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                  <View style={{ borderRadius: 999, backgroundColor: C.text, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <Text style={{ color: C.bg, fontSize: 13.5, fontWeight: '800' }}>{t('sg_send')}</Text>
                  </View>
                </Pressable>
              </>
            )}
            {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
