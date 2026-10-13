import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE DATES THAT MATTER ───────────────────────────────────────────
   Ayser: "الـ dates والرحلات وعيد الميلاد والهدية". A birthday, an
   anniversary, a trip: a name (the one thing typed), what kind, and the
   day — month and day by tapping. Three days before a birthday or an
   anniversary, My day says "time to think of a gift"; the day before a
   trip, "pack". They go into the calendar too (yearly, for the ones that
   come back every year). On this phone only. */

export const DKEY = 'mm.dates.v1';
export const readDates = () => { try { return JSON.parse(localStorage.getItem(DKEY) || '[]'); } catch (e) { return []; } };
const save = (v) => { try { localStorage.setItem(DKEY, JSON.stringify(v)); } catch (e) {} };
export const KINDS = [['birthday', '🎂'], ['anniversary', '💍'], ['trip', '🧳'], ['other', '⭐']];
export const yearly = (k) => k === 'birthday' || k === 'anniversary';

/* the next time this date comes round, from today (midnight) */
export function nextOf(x, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  let d = new Date(x.y && !yearly(x.kind) ? x.y : today.getFullYear(), x.m - 1, x.d);
  if (yearly(x.kind) && d < today) d = new Date(today.getFullYear() + 1, x.m - 1, x.d);
  return d;
}
export const daysUntil = (x, now = new Date()) => { const t0 = new Date(now); t0.setHours(0, 0, 0, 0); return Math.round((nextOf(x, now) - t0) / 86400000); };

/* what My day should say today about them: a gift three days ahead, packing the day before, the day itself */
export function dateNudges(list, t, now = new Date()) {
  const out = [];
  (list || []).forEach((x) => {
    const n = daysUntil(x, now);
    if (n < 0) return;
    const e = (KINDS.find((k) => k[0] === x.kind) || KINDS[3])[1];
    if (n === 0) out.push({ id: 'date:' + x.id + ':day', emoji: e, label: t('dt_today_' + x.kind).replace('{name}', x.name) });
    else if (yearly(x.kind) && n <= 3) out.push({ id: 'date:' + x.id + ':gift', emoji: '🎁', label: t('dt_gift').replace('{name}', x.name).replace('{n}', String(n)) });
    else if (x.kind === 'trip' && n === 1) out.push({ id: 'date:' + x.id + ':pack', emoji: '🎒', label: t('dt_pack').replace('{name}', x.name) });
  });
  return out;
}

const monthName = (m, lang) => { try { return new Date(2024, m - 1, 1).toLocaleDateString(lang || 'en', { month: 'short' }); } catch (e) { return String(m); } };

export const Dates = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [list, setList] = useState(readDates);
  const [adding, setAdding] = useState(false);
  const now0 = new Date();
  const [f, setF] = useState({ name: '', kind: 'birthday', m: now0.getMonth() + 1, d: now0.getDate() });
  const maxDay = new Date(2024, f.m, 0).getDate();
  const add = () => {
    const name = f.name.trim(); if (!name) return;
    tapSuccess();
    const y = f.kind === 'trip' || f.kind === 'other' ? (new Date(now0.getFullYear(), f.m - 1, f.d) < new Date(now0.getFullYear(), now0.getMonth(), now0.getDate()) ? now0.getFullYear() + 1 : now0.getFullYear()) : null;
    const n = list.concat({ id: Date.now().toString(36), name: name.slice(0, 40), kind: f.kind, m: f.m, d: Math.min(f.d, maxDay), y });
    setList(n); save(n); setAdding(false); setF({ ...f, name: '' });
  };
  const drop = (id) => { tapLight(); const n = list.filter((x) => x.id !== id); setList(n); save(n); };
  const sorted = list.slice().filter((x) => daysUntil(x) >= 0).sort((a, b) => daysUntil(a) - daysUntil(b));

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🎂 ' + t('dt_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, marginBottom: 16 }}>{t('dt_sub')}</Text>

          {sorted.map((x) => {
            const n = daysUntil(x); const e = (KINDS.find((k) => k[0] === x.kind) || KINDS[3])[1];
            return (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: n <= 3 ? C.purple : C.line, backgroundColor: n <= 3 ? C.purpleSoft : C.glass, padding: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 24, marginEnd: 12 }}>{e}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{x.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{x.d + ' ' + monthName(x.m, lang) + ' · ' + (n === 0 ? t('dt_is_today') : t('dt_in').replace('{n}', String(n)))}</Text>
                </View>
                <Pressable onPress={() => drop(x.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('md_note_clear')}><Ionicons name="close" size={18} color={C.faint} /></Pressable>
              </View>
            );
          })}
          {!sorted.length && !adding ? <Text style={{ color: C.faint, fontSize: 13.5, marginBottom: 12 }}>{t('dt_empty')}</Text> : null}

          {adding ? (
            <View style={{ borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 14, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {KINDS.map(([k, e]) => (
                  <Pressable key={k} onPress={() => { tapSelection(); setF({ ...f, kind: k }); }} style={{ marginEnd: 6, marginBottom: 6 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: f.kind === k ? C.purple : C.line, backgroundColor: f.kind === k ? C.purple : C.bg, paddingHorizontal: 12, paddingVertical: 8 }}>
                      <Text style={{ color: f.kind === k ? '#FFF' : C.text, fontSize: 13.5, fontWeight: '800' }}>{e + ' ' + t('dt_k_' + k)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <TextInput value={f.name} onChangeText={(v) => setF({ ...f, name: v })} maxLength={40} placeholder={t(f.kind === 'trip' ? 'dt_ph_trip' : 'dt_ph_name')} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 15, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 11, outlineStyle: 'none' }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <Pressable key={m} onPress={() => { tapSelection(); setF({ ...f, m }); }} style={{ width: '16.66%', padding: 2 }}>
                    <View style={{ borderRadius: 10, backgroundColor: f.m === m ? C.purple : C.bg, borderWidth: 1, borderColor: f.m === m ? C.purple : C.line, paddingVertical: 7, alignItems: 'center' }}>
                      <Text style={{ color: f.m === m ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800' }}>{monthName(m, lang)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                <Pressable onPress={() => { tapLight(); setF({ ...f, d: f.d > 1 ? f.d - 1 : maxDay }); }} accessibilityRole="button" accessibilityLabel="−" hitSlop={6}><View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="remove" size={20} color={C.text} /></View></Pressable>
                <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', width: 120, textAlign: 'center' }}>{Math.min(f.d, maxDay) + ' ' + monthName(f.m, lang)}</Text>
                <Pressable onPress={() => { tapLight(); setF({ ...f, d: f.d < maxDay ? f.d + 1 : 1 }); }} accessibilityRole="button" accessibilityLabel="+" hitSlop={6}><View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={20} color={C.text} /></View></Pressable>
              </View>
              <Pressable disabled={!f.name.trim()} onPress={add} accessibilityRole="button" style={{ marginTop: 14 }}>
                <View style={{ borderRadius: 999, backgroundColor: f.name.trim() ? C.purple : C.glassHi, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: f.name.trim() ? '#FFF' : C.faint, fontSize: 15.5, fontWeight: '900' }}>{t('dt_save')}</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => { tapLight(); setAdding(true); }} accessibilityRole="button" style={{ marginTop: 6 }}>
              <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: C.purple, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{'＋ ' + t('dt_add')}</Text>
              </View>
            </Pressable>
          )}
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('dt_private')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};
