import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { SETTLE, settleFor } from '../constants/settleIn';
import { tapLight, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── SETTLING IN ──────────────────────────────────────────────────────
   Ayser: "مهاجر وصل بلد جديده ازاي يتأقلم … من غير ما يبقي في عنصريه او
   تحيز … اعمل ده بشكل لا يسيئ مشاكل او متعملهوش".

   For somebody who just arrived, and for the people welcoming them —
   the screen says both, because settling in goes both ways.

   In this order, deliberately:
     1. HOW WE TALK ABOUT CULTURES. Four lines, first, before any fact
        about any country: curious not judging, nobody speaks for a
        whole people, ask about the person, anyone may pass.
     2. GOOD QUESTIONS, AND ONES THAT HURT. The everyday shape bias
        takes is a question ("where are you really from?"). Naming
        a few is the most useful thing a screen like this can do.
     3. EVERYDAY LIFE in a country — situations, not character, with
        "starting points, not rules about anyone" above them
        (src/constants/settleIn.js says how they must be written).
     4. MEET THE OTHER WAY ROUND. A culture swap: newcomers and locals
        each bring one custom, food or word. People speaking for
        themselves, in person — not strangers writing about a people.
     5. The papers (First 30 days), where that exists. */

const Line = ({ icon, color, text }) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
    <Ionicons name={icon} size={17} color={color || C.purple} style={{ marginTop: 1 }} />
    <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21, marginStart: 10, flex: 1 }}>{text}</Text>
  </View>
);

const Head = ({ children }) => (
  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 24 }}>{String(children).toUpperCase()}</Text>
);

export const SettleSheet = ({ onClose, myCode, onSwap, onPapers }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [code, setCode] = useState(settleFor(myCode) ? myCode : SETTLE[0].code);
  const place = settleFor(code);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 10 }}>{'🤝 ' + t('st_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 20, marginTop: 4 }}>{t('st_sub')}</Text>

          {/* 1 · how we talk about cultures — before any fact */}
          <View style={{ marginTop: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{t('st_care_title')}</Text>
            <Line icon="eye-outline" text={t('st_care_1')} />
            <Line icon="people-outline" text={t('st_care_2')} />
            <Line icon="person-outline" text={t('st_care_3')} />
            <Line icon="hand-left-outline" text={t('st_care_4')} />
          </View>

          {/* 2 · good questions, and ones that hurt */}
          <Head>{t('st_ask_title')}</Head>
          <Line icon="chatbubble-ellipses-outline" color={C.green} text={t('st_ask_1')} />
          <Line icon="chatbubble-ellipses-outline" color={C.green} text={t('st_ask_2')} />
          <Line icon="chatbubble-ellipses-outline" color={C.green} text={t('st_ask_3')} />
          <Head>{t('st_avoid_title')}</Head>
          <Line icon="close-circle-outline" color="#E11D48" text={t('st_avoid_1')} />
          <Line icon="close-circle-outline" color="#E11D48" text={t('st_avoid_2')} />
          <Line icon="close-circle-outline" color="#E11D48" text={t('st_avoid_3')} />

          {/* 3 · everyday life, situation by situation */}
          <Head>{t('st_customs')}</Head>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>
            {SETTLE.map((c) => (
              <Pressable key={c.code} onPress={() => { tapSelection(); setCode(c.code); }} accessibilityRole="tab" accessibilityState={{ selected: code === c.code }}
                style={{ marginEnd: 8, borderRadius: 999, borderWidth: 1, borderColor: code === c.code ? C.text : C.line, backgroundColor: code === c.code ? C.text : 'transparent', paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: code === c.code ? C.bg : C.text, fontSize: 14, fontWeight: '800' }}>{c.flag + ' ' + (ar ? c.nameAr : c.name)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 10, fontStyle: 'italic' }}>{t('st_note')}</Text>
          {place ? place.cards.map((k, i) => (
            <View key={i} style={{ marginTop: 10, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={k.icon} size={18} color={C.purple} />
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginStart: 8, flex: 1 }}>{ar ? k.tAr : k.t}</Text>
              </View>
              <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{ar ? k.bAr : k.b}</Text>
            </View>
          )) : null}
          {myCode && !settleFor(myCode) ? <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>{t('st_none')}</Text> : null}

          {/* 4 · meet the other way round */}
          <View style={{ marginTop: 24, backgroundColor: '#1A1A1A', borderRadius: 22, padding: 18 }}>
            <Text style={{ color: '#F9F9F6', fontSize: 18, fontWeight: '900' }}>{t('st_swap_title')}</Text>
            <Text style={{ color: '#C9C9D1', fontSize: 14, lineHeight: 20, marginTop: 6 }}>{t('st_swap_sub')}</Text>
            <Pressable onPress={() => { tapLight(); onSwap && onSwap({ kind: 'circle', title: t('st_swap_plan_title'), about: t('st_swap_plan_about'), minutes: 60 }); }} accessibilityRole="button" style={{ marginTop: 14 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.purple }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('st_swap_cta')}</Text>
              </View>
            </Pressable>
          </View>

          {/* 5 · the papers, where we have them */}
          {onPapers ? (
            <Pressable onPress={() => { tapLight(); onPapers(); }} accessibilityRole="button" style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 }}>
                <Text style={{ fontSize: 20 }}>🧭</Text>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginStart: 10, flex: 1 }}>{t('st_papers')}</Text>
                <Ionicons name="chevron-forward" size={17} color={C.dim} />
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
