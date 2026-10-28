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
   Ayser, October 2026: the loop, in three slides like Instagram stories,
   each on a short looping video of a real day:
     1 · Snap & connect — the day's photo prompt and the Daily Question,
         before the feed's clock runs out
     2 · Do & earn — My day tasks and real check-ins add feed time;
         Moments+ adds more every day
     3 · Level up for the world — English Circles, Cairo outings and
         local volunteering, towards Erasmus+ and travel abroad
   A bar at the top fills while each plays; a tap on the right goes on,
   on the left goes back; Skip is always there. Seen once. Its words live
   here so they load only with it. */

export const FIRST_TOUR = 'mm_first_tour_v1';
export function firstTourSeen() { try { return localStorage.getItem(FIRST_TOUR) === '1'; } catch (e) { return true; } }
const markSeen = () => { try { localStorage.setItem(FIRST_TOUR, '1'); } catch (e) {} markTourSeen(); };

const L = {
  en: [
    ['1. Snap & Connect', 'Share the day’s photo prompt (the sky, your food, your day) and answer the Daily Question before your feed timer runs out.'],
    ['2. Do & Earn', 'Finish tasks in My day or check in at a real outing to add minutes to your feed. Moments+ gives you more time every day.'],
    ['3. Level Up for the World', 'Join English Circles, Cairo outings and local volunteering to level up, and get ready for Erasmus+ youth exchanges and travel abroad.'],
    'Skip', 'Next', 'Let’s go',
  ],
  ar: [
    ['١. صوّر واتعرّف', 'شارك صورة النهارده (السما، أكلك، يومك) وجاوب على سؤال اليوم قبل ما وقت الفيد يخلص.'],
    ['٢. اعمل واكسب', 'خلّص مهامك في يومي أو سجّل حضورك في خروجة حقيقية وهيتضافلك دقايق في الفيد. ومومنتس+ بيديك وقت أكتر كل يوم.'],
    ['٣. اطلع مستوى للعالم', 'انضم لدواير الإنجليزي وخروجات القاهرة وأيام التطوّع عشان تطلع مستوى، وتجهّز نفسك لتبادل شباب Erasmus+ والسفر برّه.'],
    'تخطي', 'التالي', 'يلا بينا',
  ],
};
// a real day: coffee and a photo, an evening out, a trip together
const CLIPS = ['act-coffee-v1', 'welcome-hang', 'desert-trip'];
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
