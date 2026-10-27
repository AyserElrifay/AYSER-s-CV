import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from '../ui/Gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { partnerApply } from '../services/partners';
import { appLink, shareLink, shareNote } from '../utils/share';
import { tapLight, tapMedium, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { MailLine } from './MailLine';
import { MAIL } from '../constants/contacts';
import { lazyOverlay } from '../lib/lazyScreen';
import { COUNTRY_LIST } from '../constants/countries';
/* the nine kinds of business, and the host check, load with the business screens */
const BizTypes = lazyOverlay(() => import('./biz').then((m) => ({ default: m.BizTypes })));
const HostApplySheet = lazyOverlay(() => import('./HostApplySheet').then((m) => ({ default: m.HostApplySheet })));

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

const WHY = [
  ['map-outline', 'pt_why_pin'],
  ['people-outline', 'pt_why_groups'],
  ['calendar-outline', 'pt_why_book'],
  ['chatbubbles-outline', 'pt_why_voice'],
  ['cash-outline', 'pt_why_money'],
];

/* the country this phone is probably in: its language region (ar-EG),
   then its time zone; nothing found → nothing picked, and the server
   reads it from the phone number instead */
const TZ = { 'Africa/Cairo': 'EG', 'Europe/Lisbon': 'PT', 'Europe/Madrid': 'ES', 'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Berlin': 'DE', 'Europe/Bucharest': 'RO', 'Europe/Chisinau': 'MD', 'Europe/Tallinn': 'EE', 'Europe/Budapest': 'HU', 'Europe/Prague': 'CZ', 'Europe/London': 'GB', 'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Africa/Casablanca': 'MA', 'America/Sao_Paulo': 'BR', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA', 'Europe/Athens': 'GR', 'Europe/Amsterdam': 'NL', 'Europe/Warsaw': 'PL', 'Europe/Vienna': 'AT' };
const has = (c) => COUNTRY_LIST.some((x) => x.code === c);
export function guessCountry() {
  try {
    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const l of langs) { const m = /-([A-Za-z]{2})$/.exec(String(l || '')); if (m && has(m[1].toUpperCase())) return m[1].toUpperCase(); }
    const z = TZ[Intl.DateTimeFormat().resolvedOptions().timeZone];
    if (z && has(z)) return z;
  } catch (e) {}
  return '';
}

/* country: the guess, shown with its flag; tap to change it from the list */
const CountryField = ({ label, value, onChange, ph }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cur = COUNTRY_LIST.find((x) => x.code === value);
  const list = COUNTRY_LIST.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', marginBottom: 6 }}>{label}</Text>
      <Pressable onPress={() => { tapSelection(); setOpen((v) => !v); }} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: C.glass }}>
        <Text style={{ flex: 1, color: cur ? C.text : C.faint, fontSize: 15 }}>{cur ? cur.flag + '  ' + cur.name : ph}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.dim} />
      </Pressable>
      {open ? (
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, marginTop: 6, backgroundColor: C.glass, overflow: 'hidden' }}>
          <TextInput value={q} onChangeText={setQ} placeholder={ph} placeholderTextColor={C.faint} autoFocus
            style={{ color: C.text, fontSize: 15, paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }} />
          {list.map((x) => (
            <Pressable key={x.code} onPress={() => { tapSelection(); onChange(x.code); setOpen(false); setQ(''); }} style={{ paddingHorizontal: 13, paddingVertical: 10 }}>
              <Text style={{ color: C.text, fontSize: 14.5 }}>{x.flag + '  ' + x.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

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
  const { t, lang } = useLang();
  const [biz, setBiz] = useState(first === 'experience' ? 'activity' : 'cafe');
  const kind = ['activity', 'org', 'host'].includes(biz) ? 'experience' : 'place';
  const [hostOpen, setHostOpen] = useState(false);
  const [f, setF] = useState(() => ({ name: '', brand: '', email: '', phone: '', city: '', about: '', country: guessCountry() }));
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
    const r = await partnerApply({ kind, biz_type: biz, ...f });
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

            {/* nine kinds — each sees what it gets */}
            <BizTypes lang={lang} value={biz} onPick={setBiz} onHost={() => { tapLight(); setHostOpen(true); }} />

            {/* the form */}
            {biz === 'host' ? null : <View style={{ marginTop: 24, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2 || C.glass, padding: 16 }}>
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
                  <CountryField label={t('pt_f_country')} value={f.country} onChange={set('country')} ph={t('pt_f_country_ph')} />
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
            </View>}
          </View>
          <MailLine to={MAIL.partners} subject="Moments partners" />
        </ScrollView>
      </View>
      {hostOpen ? <HostApplySheet onClose={() => setHostOpen(false)} /> : null}
    </Modal>
  );
};
