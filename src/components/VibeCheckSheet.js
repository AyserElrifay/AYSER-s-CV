import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { myTrust, passVibeCheck } from '../services/green';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE CARE CHECK ──────────────────────────────────────────────────
   Positive friction. The map and everybody on it are open from the
   first minute; messaging a stranger and hosting something big are
   earned. Two ways in, and the screen says both: four questions about
   how people treat each other here, or join one small hangout first.

   The questions are the care code, asked rather than recited. The
   answers are checked by the database (vibe_check_pass), so a wrong
   set is told how many it got right and can simply try again. */

const QUESTIONS = [
  { q: 'vc_q1', a: ['vc_q1_a', 'vc_q1_b', 'vc_q1_c'] },
  { q: 'vc_q2', a: ['vc_q2_a', 'vc_q2_b', 'vc_q2_c'] },
  { q: 'vc_q3', a: ['vc_q3_a', 'vc_q3_b', 'vc_q3_c'] },
  { q: 'vc_q4', a: ['vc_q4_a', 'vc_q4_b', 'vc_q4_c'] },
];

export const VibeCheckSheet = ({ why, onClose, onFindHangout }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [answers, setAnswers] = useState([null, null, null, null]);
  const [state, setState] = useState(null);   // null | 'busy' | 'passed' | { right }
  const [xp, setXp] = useState(null);

  useEffect(() => { myTrust().then((r) => { if (r && typeof r.xp === 'number') setXp(r.xp); }).catch(() => {}); }, []);

  const done = answers.every((a) => a !== null);
  const submit = async () => {
    if (!done || state === 'busy') return;
    setState('busy');
    const r = await passVibeCheck(answers);
    if (r && r.ok) { tapSuccess(); setState('passed'); }
    else setState({ right: r && typeof r.right === 'number' ? r.right : null, reason: r && r.reason });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.2 }}>{t('vc_kicker')}</Text>
                <Text style={{ color: C.text, fontSize: 23, fontWeight: '900', marginTop: 4 }}>{t('vc_title')}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color={C.text} />
              </Pressable>
            </View>
            <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
              {why === 'dm' ? t('vc_why_dm') : why === 'big' ? t('vc_why_big') : t('vc_why')}
            </Text>

            {state === 'passed' ? (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ fontSize: 46 }}>🤝</Text>
                <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>{t('vc_passed')}</Text>
                <Pressable onPress={() => { tapLight(); onClose(); }} style={{ marginTop: 18, backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('done')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {QUESTIONS.map((qq, i) => (
                  <View key={qq.q} style={{ marginTop: 18 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>{(i + 1) + '. ' + t(qq.q)}</Text>
                    {qq.a.map((ak, j) => {
                      const on = answers[i] === j;
                      return (
                        <Pressable key={ak} onPress={() => { tapLight(); setState(null); setAnswers((a) => a.map((x, k) => (k === i ? j : x))); }} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass, borderRadius: 14, padding: 12, marginBottom: 7 }}>
                            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? C.purple : C.faint} />
                            <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', marginStart: 9, flex: 1, minWidth: 0 }}>{t(ak)}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                {state && state.right != null ? (
                  <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginTop: 8 }}>{t('vc_not_yet').replace('{n}', String(state.right))}</Text>
                ) : state && state.reason ? (
                  <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginTop: 8 }}>{t('lamma_offline')}</Text>
                ) : null}
                <Pressable onPress={submit} disabled={!done || state === 'busy'} style={{ marginTop: 14 }}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 15, alignItems: 'center', opacity: done && state !== 'busy' ? 1 : 0.45 }}>
                    <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{t('vc_submit')}</Text>
                  </View>
                </Pressable>

                <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginTop: 22, paddingTop: 16 }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('vc_or_title')}</Text>
                  <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>
                    {t('vc_or_body')}{xp != null ? ' ' + t('vc_xp').replace('{n}', String(xp)) : ''}
                  </Text>
                  {onFindHangout ? (
                    <Pressable onPress={() => { tapLight(); onClose(); onFindHangout(); }} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{t('vc_find')} ›</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
