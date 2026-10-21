import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { feelGathering } from '../services/green';
import { titleFor } from '../lib/activityPins';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── AFTER A PLAN ────────────────────────────────────────────────────
   Ayser: "بعد كل خروجة يطلعلك حاجة تقول فيها إحساسك وبالناس وبالمكان،
   سريع بسيط أوي". One face for how it felt, then — if you like — one
   word for the people and one for the place. Three taps and it is gone.
   Only after a plan you checked in to (green_feel in RUN_ME.sql); the
   people and the place stay private, for learning what brings people
   back. "Not now" means not again for this plan. */
const FACES = ['😞', '😕', '🙂', '😊', '🤩'];
const skipKey = (id) => 'mm.after.skip.' + id;
export const afterSkipped = (id) => { try { return localStorage.getItem(skipKey(id)) === '1'; } catch (e) { return false; } };

const Choice = ({ on, label, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1, marginHorizontal: 3 }}>
    <View style={{ borderRadius: 14, paddingVertical: 11, alignItems: 'center', backgroundColor: on ? C.text : C.glass, borderWidth: 1, borderColor: on ? C.text : C.line }}>
      <Text style={{ color: on ? C.bg : C.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{label}</Text>
    </View>
  </Pressable>
);

export const AfterOuting = ({ g, onClose }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [feel, setFeel] = useState(0);
  const [people, setPeople] = useState(0);
  const [place, setPlace] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const later = () => { try { localStorage.setItem(skipKey(g.id), '1'); } catch (e) {} onClose(); };
  useSheetBack(later);
  const send = async () => {
    if (!feel || busy) return;
    setBusy(true);
    const r = await feelGathering(g.id, feel, people || null, place || null);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setDone(true); setTimeout(onClose, 1400); } else later();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,6,18,0.5)' }}>
        <Pressable style={{ flex: 1 }} onPress={later} accessibilityLabel={t('not_now')} />
        <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 22, paddingBottom: insets.bottom + 18 }}>
          {done ? (
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', textAlign: 'center', paddingVertical: 24 }}>{'✓ ' + t('ao_thanks')}</Text>
          ) : (
            <>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 }} numberOfLines={2}>
                {t('rt_q').replace('{title}', titleFor(g.title, lang))}
              </Text>
              {g.place_name ? <Text style={{ color: C.faint, fontSize: 13.5, textAlign: 'center', marginTop: 3 }} numberOfLines={1}>{g.place_name}</Text> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 }}>
                {FACES.map((f, i) => (
                  <Pressable key={f} onPress={() => { tapSelection(); setFeel(i + 1); }} accessibilityRole="button" accessibilityLabel={String(i + 1)} hitSlop={4}>
                    <View style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: feel === i + 1 ? C.purpleSoft : 'transparent', borderWidth: 2, borderColor: feel === i + 1 ? C.purple : 'transparent', opacity: feel && feel !== i + 1 ? 0.45 : 1 }}>
                      <Text style={{ fontSize: 30 }}>{f}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              {feel ? (
                <>
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 7 }}>{t('ao_people').toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
                    {[1, 2, 3].map((n) => <Choice key={n} on={people === n} label={t('ao_p' + n)} onPress={() => { tapLight(); setPeople(n); }} />)}
                  </View>
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 16, marginBottom: 7 }}>{t('ao_place').toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
                    {[1, 2, 3].map((n) => <Choice key={n} on={place === n} label={t('ao_l' + n)} onPress={() => { tapLight(); setPlace(n); }} />)}
                  </View>
                </>
              ) : null}
              <Pressable onPress={send} disabled={!feel || busy} accessibilityRole="button" style={{ marginTop: 20 }}>
                <View style={{ borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: feel ? C.purple : C.glassHi }}>
                  <Text style={{ color: feel ? '#FFF' : C.faint, fontSize: 15.5, fontWeight: '900' }}>{t('rt_send')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); later(); }} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 12 }} hitSlop={8}>
                <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '800' }}>{t('not_now')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};
