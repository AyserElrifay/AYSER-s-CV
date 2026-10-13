import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { partnerApply } from '../services/partners';
import { appLink, shareLink, shareNote } from '../utils/share';
import { tapLight, tapMedium, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── PARTNER WITH MOMENTS ─────────────────────────────────────────────
   Ayser sent Hype's partner page: "خد من خبرتهم". What it gets right
   is that venues come to you — one page, two kinds of partner, a short
   form, an answer within two days — instead of somebody chasing cafés
   one at a time. So: the same shape, in our words.

   What it does NOT copy are the numbers. "+20% bookings", "2x repeat
   visits", "100+ partner venues" are Hype's claims about Hype; we have
   none of our own yet, and a page that invents them is the first thing
   a café owner would catch us on. Every line below is something the
   app actually does today. */

const KINDS = {
  place: { icon: 'location-outline', list: ['pt_place_1', 'pt_place_2', 'pt_place_3', 'pt_place_4', 'pt_place_5'] },
  experience: { icon: 'compass-outline', list: ['pt_exp_1', 'pt_exp_2', 'pt_exp_3', 'pt_exp_4', 'pt_exp_5'] },
};
const WHY = [
  ['map-outline', 'pt_why_pin'],
  ['people-outline', 'pt_why_groups'],
  ['calendar-outline', 'pt_why_book'],
  ['chatbubbles-outline', 'pt_why_voice'],
  ['cash-outline', 'pt_why_money'],
];

const Field = ({ label, value, onChange, ph, kb, multi, max }) => (
  <View style={{ marginTop: 14 }}>
    <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} placeholder={ph} placeholderTextColor={C.faint}
      keyboardType={kb || 'default'} autoCapitalize={kb === 'email-address' ? 'none' : 'sentences'} maxLength={max || 100}
      multiline={!!multi} textAlignVertical={multi ? 'top' : 'center'}
      style={{ color: C.text, fontSize: 15, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, minHeight: multi ? 96 : undefined }} />
  </View>
);

export const PartnerSheet = ({ onClose, first }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [kind, setKind] = useState(first === 'experience' ? 'experience' : 'place');
  const [f, setF] = useState({ name: '', brand: '', email: '', phone: '', city: '', about: '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState(null);
  const ready = f.name.trim().length >= 2 && f.brand.trim().length >= 2 && (f.email.trim() || f.phone.trim());

  const send = async () => {
    if (busy) return;
    if (!ready) { setErr(t('pt_err_fill')); return; }
    tapMedium(); setBusy(true); setErr(null);
    const r = await partnerApply({ kind, ...f });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setDone(true); return; }
    const why = r && r.reason;
    setErr(t(why === 'email' ? 'pt_err_email' : why === 'phone' ? 'pt_err_phone' : why === 'contact' ? 'pt_err_fill' : why === 'offline' ? 'lamma_conn_hint' : 'bk_err'));
  };
  /* the page itself, to send to a place */
  const share = async () => {
    tapLight();
    const res = await shareLink({ url: appLink({ partner: kind }), title: 'Moments', text: t('pt_share_text') });
    const n = shareNote(res); if (n) { setNote(n === 'Link copied ✓' ? t('bk_copied') : n); setTimeout(() => setNote(null), 2400); }
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <LinearGradient colors={['#4C1D95', '#7C3AED', '#C026D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 26 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
                <Ionicons name="chevron-down" size={26} color="#FFF" />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={t('bk_share')}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Ionicons name="share-outline" size={16} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', marginStart: 6 }}>{t('pt_send_page')}</Text>
              </Pressable>
            </View>
            {note ? <Text style={{ color: '#FDE68A', fontSize: 12.5, fontWeight: '700', marginTop: 8, textAlign: 'right' }}>{note}</Text> : null}
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(253,230,138,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 18 }}>
              <Text style={{ color: '#FDE68A', fontSize: 12.5, fontWeight: '900' }}>{t('pt_badge')}</Text>
            </View>
            <Text style={{ color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginTop: 10, lineHeight: 36 }}>{t('pt_title')}</Text>
            <Text style={{ color: '#FDE68A', fontSize: 30, fontWeight: '900', letterSpacing: -0.5, lineHeight: 36 }}>{t('pt_title2')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 22, marginTop: 10 }}>{t('pt_sub')}</Text>
          </LinearGradient>

          <View style={{ paddingHorizontal: 16 }}>
            {/* what you get — only what the app really does */}
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 22 }}>{t('pt_why_head').toUpperCase()}</Text>
            {WHY.map(([icon, k]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center', marginEnd: 12 }}>
                  <Ionicons name={icon} size={19} color={C.purple} />
                </View>
                <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21, flex: 1, marginTop: 2 }}>{t(k)}</Text>
              </View>
            ))}

            {/* two ways to partner */}
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 26 }}>{t('pt_two_ways').toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {['place', 'experience'].map((k, i) => (
                <Pressable key={k} onPress={() => { tapSelection(); setKind(k); }} accessibilityRole="radio" accessibilityState={{ selected: kind === k }}
                  style={{ flex: 1, marginEnd: i === 0 ? 10 : 0 }}>
                  <View style={{ borderRadius: 18, borderWidth: 1.5, borderColor: kind === k ? C.purple : C.line, backgroundColor: kind === k ? 'rgba(124,58,237,0.08)' : C.glass, padding: 14, minHeight: 92 }}>
                    <Ionicons name={KINDS[k].icon} size={22} color={kind === k ? C.purple : C.dim} />
                    <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', marginTop: 8 }}>{t('pt_kind_' + k)}</Text>
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{t('pt_kind_' + k + '_sub')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              {KINDS[kind].list.map((k) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, marginEnd: 10 }} />
                  <Text style={{ color: C.text, fontSize: 14 }}>{t(k)}</Text>
                </View>
              ))}
            </View>

            {/* the form */}
            <View style={{ marginTop: 24, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2 || C.glass, padding: 16 }}>
              {done ? (
                <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                  <Text style={{ fontSize: 40 }}>🎉</Text>
                  <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>{t('pt_done')}</Text>
                  <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' }}>{t('pt_done_sub')}</Text>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="sparkles-outline" size={19} color={C.gold} />
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 8 }}>{t('pt_form_title')}</Text>
                  </View>
                  <Field label={t('pt_f_name')} value={f.name} onChange={set('name')} max={80} />
                  <Field label={t(kind === 'place' ? 'pt_f_brand_place' : 'pt_f_brand_exp')} value={f.brand} onChange={set('brand')} />
                  <Field label={t('pt_f_phone')} value={f.phone} onChange={set('phone')} kb="phone-pad" ph="+20 …" max={24} />
                  <Field label={t('pt_f_email')} value={f.email} onChange={set('email')} kb="email-address" ph="you@example.com" />
                  <Field label={t('pt_f_city')} value={f.city} onChange={set('city')} max={60} />
                  <Field label={t('pt_f_about')} value={f.about} onChange={set('about')} ph={t(kind === 'place' ? 'pt_f_about_ph_place' : 'pt_f_about_ph_exp')} multi max={1000} />
                  {err ? <Text style={{ color: '#E11D48', fontSize: 13.5, marginTop: 12 }}>{err}</Text> : null}
                  <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={{ marginTop: 16 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: ready ? C.purple : C.glassHi }}>
                      {busy ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Ionicons name="paper-plane-outline" size={18} color={ready ? '#FFF' : C.faint} />
                          <Text style={{ color: ready ? '#FFF' : C.faint, fontSize: 16, fontWeight: '900', marginStart: 8 }}>{t('pt_send')}</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                  <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: 'center' }}>{t('pt_privacy')}</Text>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
