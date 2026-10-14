import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { orderItems, orderPlace } from '../services/partners';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';

/* ─── SEND FLOWERS ────────────────────────────────────────────────────
   Ayser: "في supplier … الناس تطلب من خلالنا، وهو مكانه في مصر الجديدة
   وبيبعته بـ scooter". The bouquets are the florist's own (a Moments
   partner); Moments takes the order, the florist delivers by scooter in
   Cairo, and for now it is paid on delivery. */
const money = (n, cur, lang) => { try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang || 'en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); } catch (e) { return n + ' ' + cur; } };
const iso = (d) => d.toISOString().slice(0, 10);

export const FlowersSheet = ({ onClose, toName = '' }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(null);
  const [f, setF] = useState({ to_name: toName, to_phone: '', address: '', area: '', card: '', from_phone: '', day: 0 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { orderItems('flowers').then(setItems).catch(() => setItems([])); }, []);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const field = { color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 8, outlineStyle: 'none' };
  const ready = pick && f.to_name.trim() && f.to_phone.trim().length >= 6 && f.address.trim().length >= 5;
  const send = async () => {
    if (!ready || busy) return;
    tapLight(); setBusy(true); setErr(null);
    const d = new Date(); d.setDate(d.getDate() + f.day);
    const r = await orderPlace({ item: pick.id, to_name: f.to_name, to_phone: f.to_phone, address: f.address, area: f.area, card: f.card, from_phone: f.from_phone, deliver_on: iso(d) });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setDone(r); } else setErr(t(r && r.reason === 'details' ? 'fl_err_details' : r && r.reason === 'signed_out' ? 'bk_err_signed_out' : 'bk_err'));
  };
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginTop: 8 }}>{'🌹 ' + t('fl_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{t('fl_sub')}</Text>
          {done ? (
            <View style={{ marginTop: 24, borderRadius: 20, backgroundColor: C.purpleSoft, padding: 18, alignItems: 'center' }}>
              <Text style={{ fontSize: 44 }}>💐</Text>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{t('fl_done')}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{t('bk_done_code') + ' ' + done.code}</Text>
              <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 4, textAlign: 'center' }}>{t('fl_pay_on_delivery').replace('{total}', money(done.total, done.currency, lang))}</Text>
            </View>
          ) : items == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} /> : !items.length ? (
            <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 28, textAlign: 'center', lineHeight: 21 }}>{t('fl_soon')}</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 16 }}>
                {items.map((it) => {
                  const on = pick && pick.id === it.id;
                  return (
                    <Pressable key={it.id} onPress={() => { tapSelection(); setPick(it); }} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ marginEnd: 10 }}>
                      <View style={{ width: 150, borderRadius: 18, borderWidth: 2, borderColor: on ? C.purple : C.line, overflow: 'hidden', backgroundColor: C.glass }}>
                        {it.photo ? <Image source={{ uri: it.photo }} style={{ width: 150, height: 150 }} /> : <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 54 }}>💐</Text></View>}
                        <View style={{ padding: 10 }}>
                          <Text style={{ color: C.text, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>{it.name}</Text>
                          <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900', marginTop: 2 }}>{money(it.price, it.currency, lang)}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>{t('fl_by').replace('{name}', items[0].by || '').replace('{area}', items[0].area || '')}</Text>

              <TextInput value={f.to_name} onChangeText={set('to_name')} maxLength={60} placeholder={t('fl_to_name')} placeholderTextColor={C.faint} style={[field, { marginTop: 18 }]} />
              <TextInput value={f.to_phone} onChangeText={(v) => set('to_phone')(v.replace(/[^+0-9 ()-]/g, ''))} keyboardType="phone-pad" maxLength={24} placeholder={t('fl_to_phone')} placeholderTextColor={C.faint} style={field} />
              <TextInput value={f.address} onChangeText={set('address')} maxLength={300} multiline placeholder={t('fl_address')} placeholderTextColor={C.faint} style={[field, { minHeight: 64, textAlignVertical: 'top' }]} />
              <TextInput value={f.area} onChangeText={set('area')} maxLength={60} placeholder={t('fl_area')} placeholderTextColor={C.faint} style={field} />
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                {[0, 1, 2].map((d) => (
                  <Pressable key={d} onPress={() => { tapSelection(); setF((x) => ({ ...x, day: d })); }} style={{ marginEnd: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: f.day === d ? C.purple : C.line, backgroundColor: f.day === d ? C.purple : 'transparent', paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: f.day === d ? '#FFF' : C.text, fontSize: 13.5, fontWeight: '800' }}>{t(d === 0 ? 'green_today' : d === 1 ? 'green_tomorrow' : 'fl_after')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <TextInput value={f.card} onChangeText={set('card')} maxLength={240} multiline placeholder={t('fl_card')} placeholderTextColor={C.faint} style={[field, { minHeight: 64, textAlignVertical: 'top' }]} />
              <TextInput value={f.from_phone} onChangeText={(v) => set('from_phone')(v.replace(/[^+0-9 ()-]/g, ''))} keyboardType="phone-pad" maxLength={24} placeholder={t('fl_from_phone')} placeholderTextColor={C.faint} style={field} />

              <Pressable onPress={send} disabled={!ready || busy} accessibilityRole="button" style={{ marginTop: 18 }}>
                <View style={{ borderRadius: 999, backgroundColor: ready ? C.purple : C.glassHi, paddingVertical: 16, alignItems: 'center' }}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: ready ? '#FFF' : C.faint, fontSize: 16, fontWeight: '900' }}>{pick ? t('fl_send').replace('{total}', money(pick.price, pick.currency, lang)) : t('fl_pick')}</Text>}
                </View>
              </Pressable>
              <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>{t('fl_note')}</Text>
              {err ? <Text style={{ color: C.coral, fontSize: 13, textAlign: 'center', marginTop: 8 }}>{err}</Text> : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
