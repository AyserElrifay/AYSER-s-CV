import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { getPlus } from '../lib/plus';
import { buyPlus } from '../services/payments';
import { tapLight, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── MOMENTS PLUS ────────────────────────────────────────────────────
   What Plus adds, what it costs, and one button. The price is the
   owner's (set in the Studio); until there is one, Plus says it is on
   its way rather than showing a made-up number. Everything else in
   Moments stays free. */
const PERKS = [['papyrus', '🌾'], ['focus', '🪁'], ['trips', '🧳'], ['icons', '🎨'], ['widgets', '🧩']];

const money = (n, cur, lang) => {
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang || 'en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); } catch (e) { return n + ' ' + cur; }
};

export const PlusSheet = ({ onClose, why }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [p, setP] = useState(null);
  const [plan, setPlan] = useState('year');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { getPlus(true).then(setP); }, []);

  const price = p && p.price;
  const until = p && p.member && p.member.until ? new Date(p.member.until) : null;
  const save = price ? Math.round((1 - price.year / (price.month * 12)) * 100) : 0;
  const buy = async () => {
    if (busy) return;
    tapLight(); setBusy(true); setErr(null);
    const r = await buyPlus(plan);
    setBusy(false);
    if (!r.ok) setErr(t(r.reason === 'not_configured' || r.reason === 'not_ready' ? 'px_pay_soon' : 'px_err'));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: '#14121F', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: insets.bottom + 22 }}>
        <View style={{ alignItems: 'center', marginTop: -8, marginBottom: 6 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, textAlign: 'center' }}>✦ MOMENTS PLUS</Text>
        <Text style={{ color: '#F9F9F6', fontSize: 23, fontWeight: '900', textAlign: 'center', marginTop: 4 }}>{t('px_title')}</Text>
        {why ? <Text style={{ color: '#C9C9D1', fontSize: 13.5, textAlign: 'center', marginTop: 4 }}>{t('px_why_' + why)}</Text> : null}

        <View style={{ marginTop: 14 }}>
          {PERKS.map(([k, e]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
              <Text style={{ fontSize: 20, width: 34 }}>{e}</Text>
              <Text style={{ color: '#F9F9F6', fontSize: 15, fontWeight: '700', flex: 1 }}>{t('px_f_' + k)}</Text>
            </View>
          ))}
        </View>

        {p == null ? <ActivityIndicator color={C.gold} style={{ marginVertical: 18 }} /> : p.plus && !p.founding ? (
          <Text style={{ color: C.gold, fontSize: 15, fontWeight: '900', textAlign: 'center', marginTop: 16 }}>
            {until ? t('px_you_until').replace('{date}', until.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long', year: 'numeric' })) : t('px_you')}
          </Text>
        ) : p.founding ? (
          <Text style={{ color: C.gold, fontSize: 14.5, fontWeight: '800', textAlign: 'center', marginTop: 16 }}>{t('px_founding')}</Text>
        ) : !price ? (
          <Text style={{ color: '#C9C9D1', fontSize: 14, textAlign: 'center', marginTop: 16 }}>{t('px_soon')}</Text>
        ) : (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row' }}>
              {['month', 'year'].map((k, i) => (
                <Pressable key={k} onPress={() => { tapSelection(); setPlan(k); }} accessibilityRole="radio" accessibilityState={{ selected: plan === k }} style={{ flex: 1, marginEnd: i === 0 ? 10 : 0 }}>
                  <View style={{ borderRadius: 18, borderWidth: 2, borderColor: plan === k ? C.gold : 'rgba(255,255,255,0.15)', padding: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#C9C9D1', fontSize: 12.5, fontWeight: '800' }}>{t('px_' + k)}</Text>
                    <Text style={{ color: '#F9F9F6', fontSize: 19, fontWeight: '900', marginTop: 2 }}>{money(price[k], price.currency, lang)}</Text>
                    {k === 'year' && save > 0 ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', marginTop: 2 }}>{t('px_save').replace('{n}', String(save))}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={buy} disabled={busy} accessibilityRole="button" style={{ marginTop: 14 }}>
              <View style={{ borderRadius: 999, backgroundColor: C.gold, paddingVertical: 16, alignItems: 'center' }}>
                {busy ? <ActivityIndicator color="#1A1A1A" /> : <Text style={{ color: '#1A1A1A', fontSize: 16.5, fontWeight: '900' }}>{t('px_get')}</Text>}
              </View>
            </Pressable>
            {err ? <Text style={{ color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{err}</Text> : null}
          </View>
        )}
        <Text style={{ color: '#8E8AA3', fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('px_free_note')}</Text>
      </View>
    </Modal>
  );
};
