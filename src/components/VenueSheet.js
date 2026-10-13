import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { myVenue, venueSave } from '../services/partners';
import { uploadPlanPhoto } from '../lib/storage';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── YOUR PLACE ON MOMENTS (accepted partners) ───────────────────────
   Ayser: "صفحة الفندق ويقدر يضيف صور ويعدل في السعر، بس … بيقولوا إن
   الأبلكيشن بياخد منه cut". A partner edits what people see — a few
   lines, photos, a starting price — and sees, plainly, the share of
   every booking that goes to Moments. Only the Moments team changes
   that share (owner_venue_commission). */
const pick = () => new Promise((resolve) => {
  if (typeof document === 'undefined') return resolve(null);
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
  document.body.appendChild(input); input.click();
  return undefined;
});

export const VenueSheet = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [v, setV] = useState(null);
  const [about, setAbout] = useState('');
  const [photos, setPhotos] = useState([]);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    myVenue().then((r) => {
      setV(r && r.id ? r : false);
      if (r && r.id) { setAbout(r.about || ''); setPhotos(r.photos || []); setPrice(r.price_from != null ? String(r.price_from) : ''); }
    }).catch(() => setV(false));
  }, []);
  const add = async () => {
    if (!user || photos.length >= 12) return;
    tapLight();
    const f = await pick(); if (!f) return;
    setBusy(true);
    try { const url = await uploadPlanPhoto(user.id, f); setPhotos((p) => p.concat(url)); } catch (e) { setMsg(t('gc_failed')); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await venueSave(about, photos, price.trim() ? Number(price) : null, v && v.currency);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setMsg(t('vn_saved')); } else setMsg(t('gc_failed'));
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          {v == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 40 }} /> : !v ? (
            <Text style={{ color: C.dim, fontSize: 14, marginTop: 30, textAlign: 'center' }}>{t('vn_none')}</Text>
          ) : (
            <>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginTop: 8 }}>{'🏨 ' + v.name}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{t('vn_sub')}</Text>
              <View style={{ marginTop: 16, borderRadius: 16, backgroundColor: C.purpleSoft, padding: 14 }}>
                <Text style={{ color: C.purple, fontSize: 14.5, fontWeight: '900' }}>{t('vn_cut').replace('{n}', String(Number(v.commission_pct)))}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>{t('vn_cut_sub')}</Text>
              </View>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>{t('vn_photos').toUpperCase()}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {photos.map((u) => (
                  <View key={u} style={{ marginEnd: 8 }}>
                    <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: C.glassHi }} />
                    <Pressable onPress={() => { tapLight(); setPhotos((p) => p.filter((x) => x !== u)); }} accessibilityRole="button" accessibilityLabel={t('gc_photo_remove')}
                      style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
                {photos.length < 12 ? (
                  <Pressable onPress={add} accessibilityRole="button" style={{ width: 96, height: 96, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                    {busy ? <ActivityIndicator color={C.dim} /> : <Ionicons name="add" size={28} color={C.dim} />}
                  </Pressable>
                ) : null}
              </ScrollView>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 6 }}>{t('vn_about').toUpperCase()}</Text>
              <TextInput value={about} onChangeText={setAbout} multiline maxLength={1200} placeholder={t('vn_about_ph')} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, minHeight: 90, textAlignVertical: 'top', outlineStyle: 'none' }} />
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 6 }}>{t('vn_price').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput value={price} onChangeText={(x) => setPrice(x.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint}
                  style={{ flex: 1, color: C.text, fontSize: 17, fontWeight: '800', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, outlineStyle: 'none' }} />
                <Text style={{ color: C.dim, fontSize: 15, fontWeight: '800', marginStart: 10 }}>{v.currency}</Text>
              </View>
              <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={{ marginTop: 22 }}>
                <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{t('gc_save')}</Text>
                </View>
              </Pressable>
              {msg ? <Text style={{ color: C.green, fontSize: 13.5, textAlign: 'center', marginTop: 10 }}>{msg}</Text> : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
