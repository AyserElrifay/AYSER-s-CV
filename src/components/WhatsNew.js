import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R } from '../constants/theme';
import { RELEASE } from '../constants/release';
import { useLang } from '../context/LanguageContext';
import { tapMedium } from '../utils/feedback';

/* ── WHAT'S NEW ─────────────────────────────────────────────────────
   Opens once when someone comes back to a version they haven't seen,
   then never again until the next release id. The seen id is stored,
   not a boolean, so shipping the next thing re-opens it exactly once
   more.

   Someone opening Moments for the very first time doesn't get it —
   nothing is "new" to them yet, and it would just be a wall between
   them and the app. */

const KEY = 'moments.whatsnew.seen';
const FIRST_RUN = 'moments.opened.before';

export const WhatsNew = () => {
  const insets = useSafeAreaInsets();
  const { lang, rtl } = useLang();
  const [show, setShow] = useState(false);
  const ar = lang === 'ar';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [seen, before] = await Promise.all([
          AsyncStorage.getItem(KEY),
          AsyncStorage.getItem(FIRST_RUN),
        ]);
        if (!before) {
          // brand new here: remember them, and let this release count as read
          await AsyncStorage.multiSet([[FIRST_RUN, '1'], [KEY, RELEASE.id]]);
          return;
        }
        if (alive && seen !== RELEASE.id) setShow(true);
      } catch (e) { /* no storage: simply don't show it */ }
    })();
    return () => { alive = false; };
  }, []);

  const close = async () => {
    tapMedium();
    setShow(false);
    try { await AsyncStorage.setItem(KEY, RELEASE.id); } catch (e) {}
  };

  if (!show) return null;
  const title = (RELEASE.title && (RELEASE.title[lang] || RELEASE.title.en)) || 'What’s new';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,6,20,0.62)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: C.bg2, borderTopLeftRadius: R + 10, borderTopRightRadius: R + 10,
          borderWidth: 1, borderColor: C.line, paddingBottom: insets.bottom + 16, maxHeight: '84%',
        }}>
          <LinearGradient
            colors={[C.purple, '#5B21B6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderTopLeftRadius: R + 10, borderTopRightRadius: R + 10, paddingVertical: 26, paddingHorizontal: 22, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 30 }}>✨</Text>
            <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>{title}</Text>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {RELEASE.items.map((it, i) => {
              const copy = (ar && it.ar) || it.en;
              return (
                <View key={i} style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginBottom: 18 }}>
                  <Text style={{ fontSize: 24, marginHorizontal: 12 }}>{it.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', textAlign: rtl ? 'right' : 'left' }}>{copy.t}</Text>
                    <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 3, textAlign: rtl ? 'right' : 'left' }}>{copy.s}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Pressable onPress={close} style={{ marginHorizontal: 20 }}>
            <LinearGradient
              colors={[C.purple, '#5B21B6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{ar ? 'يلا نجرّب' : 'Let’s go'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
