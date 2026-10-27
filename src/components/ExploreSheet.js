import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../ui/Gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { publicMedia } from '../lib/publicMedia';
import { tapLight } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── EXPLORE ─────────────────────────────────────────────────────────
   Ayser: "countries و heritage و settling in المفروض يندمجوا في حتة واحدة
   … زوّد صور واربط بأماكن الخروج والاكتشاف والرحلات الداخلية".
   They were five doors in three rooms: Places and Settling in on
   Together, Countries and Heritage in the Chill Zone, Trips beside them.
   Now one door, and behind it one column of photographs — where to go
   near you, where to go for the weekend, the country you are in, its
   customs, and the first steps if you just arrived. Each card opens the
   screen it always opened; only the way in changed.
   Heritage then went inside Countries: one page per country, with its
   monument and its customs, instead of two doors to the same place. */
const CARDS = [
  { k: 'places', img: 'trip-alex-1.jpg', t: 'tg_places', s: 'ex_places_s' },
  { k: 'trips', img: 'offer-desert.jpg', t: 'bk_tile', s: 'ex_trips_s' },
  { k: 'countries', img: 'earth-spin.jpg', t: 'country_title', s: 'ex_countries_s' },
  { k: 'settle', img: 'intro-people.jpg', t: 'st_title', s: 'ex_settle_s' },
];

export const ExploreSheet = ({ onPick, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg, zIndex: 5 }} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start', outlineStyle: 'none' }}>
            <Ionicons name="close" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginTop: 8 }}>{t('ex_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 15, marginTop: 4, marginBottom: 6 }}>{t('ex_sub')}</Text>
          {CARDS.map((c) => (
            <Pressable key={c.k} onPress={() => { tapLight(); onPick(c.k); }} accessibilityRole="button" accessibilityLabel={t(c.t)}
              style={({ pressed }) => ({ marginTop: 12, transform: [{ scale: pressed ? 0.985 : 1 }], outlineStyle: 'none' })}>
              <View style={{ height: 150, borderRadius: 22, overflow: 'hidden', backgroundColor: C.glassHi }}>
                <Image source={{ uri: publicMedia(c.img) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} locations={[0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
                <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, flexDirection: 'row', alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900', letterSpacing: -0.3 }}>{t(c.t)}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>{t(c.s)}</Text>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-forward" size={17} color="#FFF" />
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};
