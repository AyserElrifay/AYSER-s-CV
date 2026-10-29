import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { publicMedia } from '../lib/publicMedia';
import { smallImage, dataBlob } from '../lib/storage';
import { INSTAPAY, sendTransfer, myPayment } from '../services/pay';
import { tapLight, tapSuccess } from '../utils/feedback';
import { myMembership } from '../services/membership';
import { writePlan } from '../lib/feedGate';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── PAY BY INSTAPAY ─────────────────────────────────────────────────
   Ayser, October 2026: the web checkout in Egypt. Three steps on one
   black page: the amount, the handle (copy it, or scan the QR in the
   bank's app), then the transfer's screenshot. The owner approves it in
   the Studio and the screenshot is deleted then (src/services/pay.js). */

const W = {
  en: {
    t: 'Pay by InstaPay', plus: 'Moments+', vip: 'Moments Black', month: 'a month', year: 'a year',
    s1: '1 · Send {a} by InstaPay to', copy: 'Copy', copied: 'Copied', qr: 'Or scan this in your bank’s app',
    s2: '2 · Send us the transfer’s screenshot', pick: 'Choose the screenshot', again: 'Choose another', ref: 'Transfer reference (optional)',
    send: 'Upload Transfer Screenshot to Unlock Immediately',
    to: 'Paid to the founder, Ayser — the name your bank app shows you',
    toSub: 'While card payments are being set up, founding members pay by instant transfer to the founder’s own account. Every transfer is checked by hand.',
    pass: 'You are in for the next 24 hours. The team checks the transfer, usually within a few hours, and your plan starts the moment it is approved. The screenshot is deleted right after.',
    wait: 'We have your transfer. The team checks it, usually within a few hours, and your membership starts the moment it is approved. The screenshot is deleted right after.',
    already: 'Your last transfer is still being checked.', err: 'It did not go through. Try again.', close: 'Close',
  },
  ar: {
    t: 'ادفع بإنستاباي', plus: 'مومنتس+', vip: 'مومنتس بلاك', month: 'في الشهر', year: 'في السنة',
    s1: '١ · حوّل {a} بإنستاباي على', copy: 'انسخ', copied: 'اتنسخ', qr: 'أو امسح ده من أبلكيشن البنك',
    s2: '٢ · ابعتلنا سكرين شوت التحويل', pick: 'اختار السكرين شوت', again: 'اختار واحدة تانية', ref: 'رقم التحويل (اختياري)',
    send: 'ارفع سكرين التحويل وافتح على طول',
    to: 'الفلوس بتروح للمؤسس، أيسر — ده الاسم اللي هيظهرلك في أبلكيشن البنك',
    toSub: 'لحد ما الدفع بالكارت يشتغل، الأعضاء المؤسسين بيدفعوا بتحويل لحظي على حساب المؤسس نفسه. وكل تحويل بيتراجع بإيد.',
    pass: 'العضوية مفتوحة ليك الـ٢٤ ساعة الجاية. الفريق بيراجع التحويل، غالباً في كام ساعة، والاشتراك بيبدأ أول ما يتوافق عليه. والسكرين شوت بيتمسح بعدها على طول.',
    wait: 'وصلنا تحويلك. الفريق بيراجعه، غالباً في كام ساعة، والعضوية بتبدأ أول ما يتوافق عليه. والسكرين شوت بيتمسح بعدها على طول.',
    already: 'آخر تحويل ليك لسه بيتراجع.', err: 'ماتبعتش. جرّب تاني.', close: 'اقفل',
  },
};
const pickFile = () => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
  document.body.appendChild(input); input.click();
});

export const InstaPaySheet = ({ tier, period, amount, currency = 'EGP', onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const w = W[lang === 'ar' ? 'ar' : 'en'];
  const insets = useSafeAreaInsets();
  const [shot, setShot] = useState(null);     // { uri, type }
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { myPayment().then((p) => { if (p && p.status === 'pending') setNote(w.already); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const amt = Math.round(Number(amount) || 0).toLocaleString('en') + ' ' + (lang === 'ar' && currency === 'EGP' ? 'جنيه' : currency);

  const copy = async () => {
    tapLight();
    try { await navigator.clipboard.writeText(INSTAPAY.handle); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
  };
  const choose = async () => {
    if (Platform.OS !== 'web') return;
    tapLight(); setNote(null);
    const f = await pickFile(); if (!f) return;
    const s = await smallImage(URL.createObjectURL(f), 1280, 0.82);
    setShot({ uri: s.uri, type: s.type || f.type || 'image/jpeg' });
  };
  const send = async () => {
    if (!shot || busy) return;
    setBusy(true); setNote(null);
    const blob = /^data:/.test(shot.uri) ? dataBlob(shot.uri) : await (await fetch(shot.uri)).blob();
    const r = await sendTransfer({ tier, period, blob, type: shot.type, ref: ref.trim(), amount });
    setBusy(false);
    if (r && r.ok) {
      tapSuccess(); setDone(r.pass_until ? 'pass' : true);
      // a first transfer opens a 24-hour pass at once (RUN_ME.sql pay_submit): let the app know
      if (r.pass_until) myMembership().then((m) => { if (m && m.tier) writePlan({ tier: m.tier }); });
    }
    else setNote(r && r.reason === 'waiting' ? w.already : w.err);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 30, alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 460 }}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={w.close}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Text style={{ color: '#A3A3A3', fontSize: 12, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.6, marginTop: 18 }}>
              {(tier === 'vip' ? w.vip : w.plus) + '  ·  ' + amt + ' ' + (period === 'year' ? w.year : w.month)}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.8, marginTop: 8 }}>{w.t}</Text>

            {done ? (
              <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 24, marginTop: 22 }}>{done === 'pass' ? w.pass : w.wait}</Text>
            ) : (
              <>
                <Text style={[{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 24 }, NUM]}>{w.s1.replace('{a}', amt)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#262626', paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text selectable style={{ flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{INSTAPAY.handle}</Text>
                  <Pressable onPress={copy} accessibilityRole="button" hitSlop={8} style={{ paddingHorizontal: 10 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700', textDecorationLine: 'underline' }}>{copied ? w.copied : w.copy}</Text>
                  </Pressable>
                </View>
                <Text style={{ color: '#737373', fontSize: 13, marginTop: 14 }}>{w.qr}</Text>
                <View style={{ alignSelf: 'center', marginTop: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF', padding: 8 }}>
                  <Image source={{ uri: publicMedia(INSTAPAY.qr) }} style={{ width: 210, height: 225 }} resizeMode="contain" accessibilityLabel="InstaPay QR" />
                </View>

                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 26 }}>{w.s2}</Text>
                {shot ? <Image source={{ uri: shot.uri }} style={{ width: 140, height: 220, borderRadius: 14, marginTop: 12, alignSelf: 'center' }} resizeMode="cover" /> : null}
                <Pressable onPress={choose} accessibilityRole="button" style={{ marginTop: 12 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FFFFFF' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>{shot ? w.again : w.pick}</Text>
                  </View>
                </Pressable>
                <TextInput value={ref} onChangeText={setRef} placeholder={w.ref} placeholderTextColor="#737373" autoCorrect={false} maxLength={60}
                  style={{ color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#262626', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, marginTop: 12, outlineStyle: 'none' }} />
                <Pressable onPress={send} disabled={!shot || busy} accessibilityRole="button" style={{ marginTop: 16, opacity: shot ? 1 : 0.4 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FFFFFF' }}>
                    {busy ? <ActivityIndicator color="#000000" /> : <Text style={{ color: '#000000', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 14 }}>{w.send}</Text>}
                  </View>
                </Pressable>
                {/* who the money goes to, said plainly */}
                <View style={{ flexDirection: 'row', marginTop: 16 }}>
                  <Ionicons name="lock-closed-outline" size={14} color="#A3A3A3" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginStart: 8 }}>
                    <Text style={{ color: '#D4D4D4', fontSize: 13, fontWeight: '600', lineHeight: 19 }}>{w.to}</Text>
                    <Text style={{ color: '#737373', fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>{w.toSub}</Text>
                  </View>
                </View>
              </>
            )}
            {note ? <Text style={{ color: '#A3A3A3', fontSize: 14, marginTop: 14, textAlign: 'center' }}>{note}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
