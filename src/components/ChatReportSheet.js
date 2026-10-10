import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { reportInChat, blockPerson } from '../services/standing';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapSuccess } from '../utils/feedback';
import { AV_NEUTRAL } from '../constants/mockData';

/* ─── SOMETHING WRONG IN THIS CHAT ────────────────────────────────────
   One button in the chat header opens this. Three steps, never more:
     1. who (only in a group) and what happened;
     2. the confirmation, saying exactly what will happen — their last
        five messages here go to the Moments team, you block them now,
        they are not told who reported;
     3. done — and, for a threat, the emergency numbers, because an app
        is never the first thing to call.
   "Just block" is there for when you do not want to report anybody. */

const KINDS = [
  { k: 'threat', emoji: '⚠️' },
  { k: 'harassment', emoji: '🚫' },
  { k: 'sexual', emoji: '🔞' },
  { k: 'hate', emoji: '✋' },
  { k: 'other', emoji: '💬' },
];

export const ChatReportSheet = ({ people, dmThreadId, squadId, onClose, onBlocked }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [who, setWho] = useState(people.length === 1 ? people[0] : null);
  const [kind, setKind] = useState(null);
  const [step, setStep] = useState('pick');     // pick | confirm | done | blocked
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const first = who ? String(who.name || '').split(' ')[0] : '';
  /* a report is about a conversation; with no messages yet, block only */
  const canReport = !!(dmThreadId || squadId);

  const report = async () => {
    if (!who || !kind || busy) return;
    setBusy(true); setErr(null);
    try {
      await reportInChat({ userId: who.id, dmThreadId, squadId, reason: kind });
      tapSuccess(); setStep('done');
      if (onBlocked) onBlocked(who.id);
    } catch (e) { setErr(t('lamma_offline')); }
    setBusy(false);
  };
  const justBlock = async () => {
    if (!who || busy || !user) return;
    setBusy(true); setErr(null);
    try { await blockPerson(user.id, who.id); tapSuccess(); setStep('blocked'); if (onBlocked) onBlocked(who.id); } catch (e) { setErr(t('lamma_offline')); }
    setBusy(false);
  };

  const big = { color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 };
  const line = (icon, text) => (
    <View key={text} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
      <Ionicons name={icon} size={18} color={C.text} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: C.text, fontSize: 14, lineHeight: 20, marginStart: 10 }}>{text}</Text>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      <View style={{ maxHeight: '88%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[big, { flex: 1 }]}>
              {step === 'done' ? t('hr_done') : step === 'blocked' ? t('hr_blocked').replace('{name}', first) : step === 'confirm' ? t('hr_confirm').replace('{name}', first) : t('hr_title')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>

          {step === 'pick' && !people.length ? (
            <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 12 }}>{t('hr_nobody')}</Text>
          ) : null}
          {step === 'pick' && people.length ? (
            <>
              {people.length > 1 ? (
                <>
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>{t('hr_who').toUpperCase()}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {people.map((p) => (
                      <Pressable key={p.id} onPress={() => { tapLight(); setWho(p); }} accessibilityRole="radio" accessibilityState={{ checked: who && who.id === p.id }}
                        style={{ alignItems: 'center', width: 70, marginEnd: 8, opacity: !who || who.id === p.id ? 1 : 0.45 }}>
                        <Image source={{ uri: p.avatar || AV_NEUTRAL }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: who && who.id === p.id ? 2.5 : 0, borderColor: C.text }} />
                        <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{String(p.name || '').split(' ')[0]}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}
              {canReport ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 4 }}>{t('hr_what').toUpperCase()}</Text> : null}
              {!canReport ? null : KINDS.map((o) => (
                <Pressable key={o.k} onPress={() => { tapLight(); setKind(o.k); }} accessibilityRole="radio" accessibilityState={{ checked: kind === o.k }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text style={{ fontSize: 18, width: 30 }}>{o.emoji}</Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '700' }}>{t('hr_k_' + o.k)}</Text>
                  <Ionicons name={kind === o.k ? 'radio-button-on' : 'radio-button-off'} size={20} color={kind === o.k ? C.text : C.faint} />
                </Pressable>
              ))}
              {canReport ? <Pressable onPress={() => { if (who && kind) { tapLight(); setStep('confirm'); } }} disabled={!who || !kind} accessibilityRole="button"
                style={{ marginTop: 20, backgroundColor: C.purple, borderRadius: 18, paddingVertical: 16, alignItems: 'center', opacity: who && kind ? 1 : 0.45 }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{t('hr_next')}</Text>
              </Pressable> : null}
              <Pressable onPress={justBlock} disabled={!who || busy} accessibilityRole="button" style={{ marginTop: 14, alignSelf: 'center', padding: 6, opacity: who ? 1 : 0.45 }}>
                <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' }}>{t('hr_just_block')}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              {line('documents-outline', t('hr_c_messages').replace('{name}', first))}
              {line('hand-left-outline', t('hr_c_block').replace('{name}', first))}
              {line('eye-off-outline', t('hr_c_anon'))}
              {line('people-outline', t('hr_c_person'))}
              <Pressable onPress={report} disabled={busy} accessibilityRole="button"
                style={{ marginTop: 22, backgroundColor: C.coral, borderRadius: 18, paddingVertical: 16, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{t('hr_send')}</Text>}
              </Pressable>
              <Pressable onPress={() => setStep('pick')} accessibilityRole="button" style={{ marginTop: 14, alignSelf: 'center', padding: 6 }}>
                <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800' }}>{t('hr_back')}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'done' || step === 'blocked' ? (
            <>
              <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 10 }}>
                {step === 'done' ? t('hr_done_sub').replace('{name}', first) : t('hr_blocked_sub')}
              </Text>
              {kind === 'threat' || kind === 'sexual' ? (
                <View style={{ marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: C.coralSoft }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', lineHeight: 20 }}>{t('hr_danger')}</Text>
                  <Text style={{ color: C.text, fontSize: 14, marginTop: 4 }}>🇪🇬 122 · 🇪🇺 112</Text>
                </View>
              ) : null}
              <Pressable onPress={onClose} accessibilityRole="button" style={{ marginTop: 20, borderRadius: 18, borderWidth: 1.5, borderColor: C.line, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{t('close')}</Text>
              </Pressable>
            </>
          ) : null}

          {err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>{err}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
