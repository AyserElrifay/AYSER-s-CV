import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { lookOf } from '../../lib/activityPins';
import { tapLight } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';
import { SheetHandle } from '../SheetHandle';

/* ─── STARTING A PLAN ─────────────────────────────────────────────────
   Ayser, on the old form: "زحمة دوشة ومعقدة… ما فيش حياة". Ten chips,
   seven flags, six boxes and a typed date before anybody had said what
   they wanted to do.

   Now it is three things, in the order people think them: what, when,
   where. Each kind wears its own colour, so the screen is alive while
   the one button that matters stays the one accent. A name, the city,
   the country, how long and how many are all still there, folded under
   one line — the plan gets a sensible name from its kind if nobody
   types one. */

const TIMES = [9, 13, 17, 20];

/* a photo of the real place or the real plan — optional, one tap. The
   file is kept here and sent after the plan exists (GreenSheet.js). */
const pickPhoto = () => new Promise((resolve) => {
  if (typeof document === 'undefined') return resolve(null);
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
  document.body.appendChild(input);
  input.click();
  return undefined;
});

const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

export const StartForm = ({ form, setForm, kinds, places, busy, onSubmit, onClose, t, lang }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(!!(form.title || form.about));
  const [care, setCare] = useState(false);

  /* the next seven days, named the way the reader names them */
  const days = useMemo(() => {
    const out = [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      let label;
      if (i === 0) label = t('green_today');
      else if (i === 1) label = t('green_tomorrow');
      else {
        try { label = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short' }); } catch (e) { label = String(d.getDate()); }
      }
      out.push({ d, key: dayKey(d), label, num: d.getDate() });
    }
    return out;
  }, [lang]);

  const at = new Date(form.startsAt);
  const pickedDay = dayKey(at);
  const pickedHour = at.getHours();
  const setWhen = (d, h) => {
    const n = new Date(d); n.setHours(h, 0, 0, 0);
    setForm((f) => ({ ...f, startsAt: n.toISOString(), err: null }));
  };
  const past = (d, h) => { const n = new Date(d); n.setHours(h, 0, 0, 0); return n.getTime() < Date.now() + 10 * 60000; };
  const hourLabel = (h) => {
    try { const n = new Date(); n.setHours(h, 0, 0, 0); return n.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang, { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return h + ':00'; }
  };

  const kindLabel = t((kinds.find((k) => k.id === form.kind) || kinds[0]).key);
  const field = { borderBottomWidth: 1, borderBottomColor: C.line, color: C.text, paddingVertical: 12, fontSize: 16 };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 24 }}>
            <SheetHandle onClose={onClose} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>{t('sf_heading')}</Text>
                <Text style={{ color: C.dim, fontSize: 15, marginTop: 6 }}>{t('sf_sub')}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ paddingTop: 6, paddingStart: 12 }}>
                <Ionicons name="close" size={24} color={C.faint} />
              </Pressable>
            </View>

            {/* what — every kind in its own colour */}
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 26, marginBottom: 10 }}>{t('sf_what')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {kinds.map((k) => {
                const on = form.kind === k.id; const l = lookOf(k.id);
                return (
                  <Pressable key={k.id} onPress={() => { tapLight(); setForm((f) => ({ ...f, kind: k.id, err: null })); }}
                    accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t(k.key)}
                    style={{ width: 66, marginEnd: 10, alignItems: 'center' }}>
                    <View style={{ width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: on ? l.from : C.glassHi, transform: [{ scale: on ? 1.04 : 1 }] }}>
                      <Text style={{ fontSize: 28 }}>{l.emoji}</Text>
                    </View>
                    <Text style={{ color: on ? C.text : C.faint, fontSize: 11.5, fontWeight: on ? '800' : '600', marginTop: 7, textAlign: 'center' }} numberOfLines={1}>{t(k.key)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* when — a day, then a time */}
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 24, marginBottom: 10 }}>{t('green_when')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {days.map((d) => {
                const on = d.key === pickedDay;
                return (
                  <Pressable key={d.key} onPress={() => { tapLight(); setWhen(d.d, past(d.d, pickedHour) ? Math.min(23, new Date().getHours() + 1) : pickedHour); }}
                    accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={{ minWidth: 58, marginEnd: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center',
                      backgroundColor: on ? C.text : 'transparent', borderWidth: 1, borderColor: on ? C.text : C.line }}>
                    <Text style={{ color: on ? C.bg : C.dim, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{d.label}</Text>
                    <Text style={{ color: on ? C.bg : C.text, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{d.num}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', backgroundColor: C.glassHi, borderRadius: 14, padding: 4, marginTop: 10 }}>
              {TIMES.map((h) => {
                const on = pickedHour === h; const gone = past(at, h);
                return (
                  <Pressable key={h} disabled={gone} onPress={() => { tapLight(); setWhen(at, h); }} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: gone }}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11, backgroundColor: on ? C.bg : 'transparent', opacity: gone ? 0.35 : 1 }}>
                    <Text style={{ color: on ? C.text : C.dim, fontSize: 14, fontWeight: on ? '800' : '600' }}>{hourLabel(h)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* where — one line */}
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 24 }}>{t('sf_where')}</Text>
            <TextInput value={form.place} onChangeText={(v) => setForm((f) => ({ ...f, place: v }))}
              placeholder={t('sf_where_ph')} placeholderTextColor={C.faint} style={field} />

            {/* a real photo, if they have one — never required */}
            {form.photoPreview ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                <Image source={{ uri: form.photoPreview }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.glassHi }} />
                <Text style={{ flex: 1, color: C.dim, fontSize: 13, marginStart: 12 }}>{t('sf_photo_added')}</Text>
                <Pressable onPress={() => { tapLight(); setForm((f) => ({ ...f, photoFile: null, photoPreview: null })); }} accessibilityRole="button" accessibilityLabel={t('sf_photo_remove')}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={20} color={C.dim} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={async () => { tapLight(); const file = await pickPhoto(); if (file) setForm((f) => ({ ...f, photoFile: file, photoPreview: URL.createObjectURL(file) })); }}
                accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                <View style={{ width: 64, height: 64, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera-outline" size={22} color={C.dim} />
                </View>
                <View style={{ flex: 1, marginStart: 12 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t('sf_photo')}</Text>
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>{t('sf_photo_sub')}</Text>
                </View>
              </Pressable>
            )}

            {/* everything else, folded */}
            {more ? (
              <View style={{ marginTop: 6 }}>
                <TextInput value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v, err: null }))}
                  placeholder={kindLabel + ' — ' + t('sf_name_ph')} placeholderTextColor={C.faint} style={field} />
                <TextInput value={form.about} onChangeText={(v) => setForm((f) => ({ ...f, about: v }))}
                  placeholder={t('green_ph_about')} placeholderTextColor={C.faint} multiline style={[field, { minHeight: 64, textAlignVertical: 'top' }]} />
                <TextInput value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                  placeholder={t('green_ph_city')} placeholderTextColor={C.faint} style={field} />
                <View style={{ flexDirection: 'row' }}>
                  <TextInput value={form.minutes} onChangeText={(v) => setForm((f) => ({ ...f, minutes: v.replace(/[^0-9]/g, '') }))}
                    placeholder={t('green_minutes')} placeholderTextColor={C.faint} keyboardType="number-pad" style={[field, { flex: 1, minWidth: 0, marginEnd: 16 }]} />
                  <TextInput value={form.capacity} onChangeText={(v) => setForm((f) => ({ ...f, capacity: v.replace(/[^0-9]/g, '') }))}
                    placeholder={t('green_cap')} placeholderTextColor={C.faint} keyboardType="number-pad" style={[field, { flex: 1, minWidth: 0 }]} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 14 }}>
                  {places.map((p) => {
                    const on = form.country === p.code;
                    return (
                      <Pressable key={p.code} onPress={() => { tapLight(); setForm((f) => ({ ...f, country: p.code })); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                        style={{ marginEnd: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: on ? C.text : C.line }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: on ? '800' : '600' }}>{p.flag + ' ' + p.code}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <Pressable onPress={() => { tapLight(); setMore(true); }} accessibilityRole="button" style={{ marginTop: 16, alignSelf: 'flex-start' }}>
                <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>+ {t('sf_more')}</Text>
              </Pressable>
            )}

            {form.err ? (
              <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 14 }}>
                {form.err === 'no_title' ? t('green_err_title')
                  : form.err === 'in_the_past' ? t('green_err_past')
                  : form.err === 'need_unlock' ? t('vc_why_big')
                  : t('lamma_offline')}
              </Text>
            ) : null}

            <Pressable onPress={onSubmit} disabled={busy} accessibilityRole="button"
              style={{ marginTop: 24, backgroundColor: C.purple, borderRadius: 18, paddingVertical: 18, alignItems: 'center', opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color="#FFF" /> : (
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
                  {t('sf_go').replace('{what}', (form.title || '').trim() || kindLabel)}
                </Text>
              )}
            </Pressable>

            {/* the care code: one quiet line, four when asked */}
            <Pressable onPress={() => { tapLight(); setCare((c) => !c); }} accessibilityRole="button" style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center' }}>
                {t('sf_care_line')} <Text style={{ textDecorationLine: 'underline' }}>{t('sf_care_link')}</Text>
              </Text>
            </Pressable>
            {care ? (
              <View style={{ marginTop: 10 }}>
                {['green_care_1', 'green_care_2', 'green_care_3', 'green_care_4'].map((k) => (
                  <Text key={k} style={{ color: C.dim, fontSize: 12.5, lineHeight: 19, textAlign: 'center' }}>{t(k)}</Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
