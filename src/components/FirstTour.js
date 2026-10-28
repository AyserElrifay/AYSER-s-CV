import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../ui/Gradient';
import { useLang } from '../context/LanguageContext';
import { publicMedia } from '../lib/publicMedia';
import { goToTab } from '../lib/mapBus';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { markTourSeen } from './GestureTour';

/* ─── THREE STEPS, THE FIRST TIME INSIDE ──────────────────────────────
   Ayser: teach the app in three slides, like Instagram stories, each on
   a short looping video of a real evening:
     1 · Share today's Moment — answer the daily question, find your people
     2 · Claim a weekly Drop — a seat at a Thursday table or a Circle
     3 · Meet & unlock — scan the table's QR, and the chat stays
   A bar at the top fills while each plays; a tap on the right goes on,
   on the left goes back; Skip is always there. Seen once. Its words live
   here so they load only with it. */

export const FIRST_TOUR = 'mm_first_tour_v1';
export function firstTourSeen() { try { return localStorage.getItem(FIRST_TOUR) === '1'; } catch (e) { return true; } }
const markSeen = () => { try { localStorage.setItem(FIRST_TOUR, '1'); } catch (e) {} markTourSeen(); };

const L = {
  en: [
    ['1. Share Today’s Moment', 'Answer the daily question to find people on your wavelength.'],
    ['2. Claim a Weekly Drop', 'Book a seat at a curated Thursday table or Language Circle.'],
    ['3. Meet & Unlock', 'Scan the table QR code in real life to unlock permanent Table Buddy chat.'],
    'Skip', 'Next', 'Let’s go',
  ],
  ar: [
    ['١. شارك لحظة النهارده', 'جاوب على سؤال اليوم عشان تلاقي ناس شبهك.'],
    ['٢. احجز كرسي في Drop الأسبوع', 'احجز مكانك في ترابيزة الخميس أو دايرة اللغة.'],
    ['٣. اتقابلوا وافتحوا الشات', 'امسح كود الـ QR بتاع الترابيزة في الحقيقة، والشات مع اللي قعدوا معاك يفضل مفتوح على طول.'],
    'تخطي', 'التالي', 'يلا بينا',
  ],
};
// short real evenings, looping: coffee, a table, the bus home
const CLIPS = ['act-coffee-v1', 'welcome-hang', 'buddies-bus'];
const SLIDE_MS = 6500;

export const FirstTour = ({ onClose }) => {
  const { lang } = useLang();
  const W = L[lang === 'ar' ? 'ar' : 'en'];
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const bar = useRef(new Animated.Value(0)).current;
  const done = () => { markSeen(); onClose && onClose(); };
  useSheetBack(done);
  useEffect(() => {
    bar.setValue(0);
    const a = Animated.timing(bar, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    a.start(({ finished }) => { if (finished) setI((x) => (x < 2 ? x + 1 : x)); });
    return () => a.stop();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => { tapLight(); if (i < 2) setI(i + 1); else { tapSuccess(); done(); goToTab('HOME'); } };
  const back = () => { tapLight(); if (i > 0) setI(i - 1); };
  const [title, sub] = W[i];
  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={done}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {Platform.OS === 'web' ? (
          <video key={CLIPS[i]} src={publicMedia(CLIPS[i] + '.mp4')} poster={publicMedia(CLIPS[i] + '.jpg')} muted autoPlay loop playsInline preload="auto" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        ) : null}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.85)']} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        {/* tap left: back, tap right: on */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
          <Pressable onPress={lang === 'ar' ? next : back} style={{ flex: 1, outlineStyle: 'none', borderWidth: 0 }} focusable={false} accessibilityLabel="back" />
          <Pressable onPress={lang === 'ar' ? back : next} style={{ flex: 1, outlineStyle: 'none', borderWidth: 0 }} focusable={false} accessibilityLabel="next" />
        </View>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 14 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row' }} pointerEvents="none">
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 3, overflow: 'hidden' }}>
                <Animated.View style={{ height: 3, backgroundColor: '#FFFFFF', width: k < i ? '100%' : k > i ? '0%' : bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
            ))}
          </View>
          <Pressable onPress={() => { tapLight(); done(); }} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-end', marginTop: 14 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' }}>{W[3]}</Text>
          </Pressable>
        </View>
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 30 }} pointerEvents="box-none">
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.8, lineHeight: lang === 'ar' ? 46 : 38 }}>{title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, lineHeight: 25, marginTop: 10 }}>{sub}</Text>
          <Pressable onPress={next} accessibilityRole="button" style={{ marginTop: 26 }}>
            <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: '#FFFFFF' }}>
              <Text style={{ color: '#000000', fontSize: 16.5, fontWeight: '700' }}>{i < 2 ? W[4] : W[5]}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
