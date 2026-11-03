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

/* ─── HOW MOMENTS WORKS, IN FIVE STEPS ────────────────────────────────
   Ayser, November 2026: "أبلكيشن يعلّم الناس إزاي يحجزوا خروجة من الأول".
   The real way an evening goes, like Instagram stories, each on a short
   looping clip: find a weekend table, claim the seat, the chat opens four
   hours before, arrive and scan the table's QR, keep the night. Shown once
   after the first sign-in, and again any time from Space's menu ("How
   Moments works"). Tap right to go on, left to go back; Skip is always
   there. Its words live here so they load only with it. */

export const FIRST_TOUR = 'mm_first_tour_v1';
export function firstTourSeen() { try { return localStorage.getItem(FIRST_TOUR) === '1'; } catch (e) { return true; } }
const markSeen = () => { try { localStorage.setItem(FIRST_TOUR, '1'); } catch (e) {} markTourSeen(); };

const L = {
  en: [
    ['1. Find your weekend table', 'Open Together. Tables run Thursday to Saturday — ten seats each, set up by the Moments team. Pick one you like.'],
    ['2. Claim your seat', 'Make your profile card once (three photos, two short answers), then tap Claim Seat. The exact place opens 12 hours before.'],
    ['3. The chat opens 4 hours before', 'See who is coming — their seat and what they are into, faces blurred until you meet. Say hi or send a voice note.'],
    ['4. Arrive and scan the table QR', 'Moments guides you the last few hundred metres. At the table, tap Scan QR on Space: faces open and Guess Who starts.'],
    ['5. Keep the night', 'Rate the evening, your page in the Moments Book fills itself, and every table you go to takes you up a level.'],
    'Skip', 'Next', 'Find a table',
  ],
  ar: [
    ['١. لاقي ترابيزة الويكند', 'افتح Together. الترابيزات من الخميس للسبت — ١٠ كراسي في كل واحدة، والفريق هو اللي بيجهّزها. اختار اللي تعجبك.'],
    ['٢. احجز كرسيك', 'اعمل كارتك مرة واحدة (٣ صور وإجابتين قصيرين)، وبعدين دوس «احجز كرسي». المكان بالظبط بيظهر قبلها بـ ١٢ ساعة.'],
    ['٣. الشات بيفتح قبلها بـ ٤ ساعات', 'شوف مين جاي — رقم كرسيه وبيحب إيه، والوشوش متغبّشة لحد ما تتقابلوا. قول أهلاً أو ابعت فويس.'],
    ['٤. وصلت؟ امسح QR الترابيزة', 'مومنتس بيوصّلك آخر كام متر. على الترابيزة دوس «امسح QR» من Space: الوشوش بتبان ولعبة خمّن مين بتبدأ.'],
    ['٥. السهرة تفضل معاك', 'قيّم السهرة، صفحتك في كتاب مومنتس بتتملى لوحدها، وكل ترابيزة بتروحها بتطلّعك مستوى.'],
    'تخطي', 'التالي', 'يلا نلاقي ترابيزة',
  ],
};
// a real evening: a café table, people meeting, music, the walk there, a night to keep
const CLIPS = ['act-coffee-v1', 'welcome-hang', 'act-music-v1', 'act-walk-v1', 'painting-night'];
const N = CLIPS.length;
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
    a.start(({ finished }) => { if (finished) setI((x) => (x < N - 1 ? x + 1 : x)); });
    return () => a.stop();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => { tapLight(); if (i < N - 1) setI(i + 1); else { tapSuccess(); done(); goToTab('TOGETHER'); } };
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
            {CLIPS.map((c, k) => (
              <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 3, overflow: 'hidden' }}>
                <Animated.View style={{ height: 3, backgroundColor: '#FFFFFF', width: k < i ? '100%' : k > i ? '0%' : bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
            ))}
          </View>
          <Pressable onPress={() => { tapLight(); done(); }} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-end', marginTop: 14 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' }}>{W[N]}</Text>
          </Pressable>
        </View>
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 30 }} pointerEvents="box-none">
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.8, lineHeight: lang === 'ar' ? 46 : 38 }}>{title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, lineHeight: 25, marginTop: 10 }}>{sub}</Text>
          <Pressable onPress={next} accessibilityRole="button" style={{ marginTop: 26 }}>
            <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: '#FFFFFF' }}>
              <Text style={{ color: '#000000', fontSize: 16.5, fontWeight: '700' }}>{i < N - 1 ? W[N + 1] : W[N + 2]}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
