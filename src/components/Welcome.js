import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Wordmark } from './Wordmark';
import { ACTIVITY_LOOK } from '../lib/activityPins';
import { tapLight } from '../utils/feedback';
import { publicMedia } from '../lib/publicMedia';
import { moodOfToday } from '../lib/mood';

/* ─── THE FIRST THING ANYBODY SEES ────────────────────────────────────
   Ayser: "عايزين welcome page زي المنافسين". The ones he showed open on
   a picture of the app's world and two buttons, and leave the form for
   later. The old first screen was a sign-in box: it asked for a
   password before it had said what the app is.

   Behind the cards: one photo Ayser sent of places at home — Dahab from
   above, a fisherman on the Alexandria sea wall, a heron at sunset, a
   dog watching the kites in Dahab, a park's trees, tea on a tray, a
   desert cave, a street cat, a breakfast table, a Saint Catherine
   wadi, a sunset over the Red Sea, the Nile through the trees, cushions
   by the sea in Sinai — a different one each
   day. They set the mood; none is captioned as a Moments evening, and
   none shows a face up close. On them, the kinds of things people
   really do on Moments, in the same bright cards the real map uses
   (src/lib/activityPins.js). No member counts, no "join 1M people":
   there is nothing on this screen that is not true of the app on the
   day you open it. */

const PHOTOS = ['welcome-dahab.jpg', 'welcome-fisher.jpg', 'welcome-heron.jpg', 'welcome-kite.jpg', 'welcome-trees.jpg', 'welcome-tea.jpg', 'welcome-cave.jpg', 'welcome-cat.jpg', 'welcome-breakfast.jpg', 'welcome-catherine.jpg', 'welcome-sunset.jpg', 'welcome-nile.jpg', 'welcome-seaside.jpg', 'welcome-moldova.jpg'];
/* and, every other day, people out together (src/lib/mood.js) — a mood, never shown as members */
const photoOfToday = () => { const d = Math.floor(Date.now() / 86400000); return d % 2 ? moodOfToday() : PHOTOS[Math.floor(d / 2) % PHOTOS.length]; };

const SCENE = [
  { kind: 'culture', key: 'welcome_act_opera',  x: 0.06, y: 0.10, tilt: -6 },
  { kind: 'walk',    key: 'welcome_act_walk',   x: 0.62, y: 0.05, tilt: 5 },
  { kind: 'sport',   key: 'welcome_act_ball',   x: 0.70, y: 0.46, tilt: -4 },
  { kind: 'art',     key: 'welcome_act_sketch', x: 0.05, y: 0.55, tilt: 4 },
  { kind: 'food',    key: 'welcome_act_food',   x: 0.36, y: 0.66, tilt: -3 },
  { kind: 'circle',  key: 'welcome_act_lang',   x: 0.33, y: 0.03, tilt: 3 },
];
const FOOD = { emoji: '🍲', from: '#FB923C', to: '#FACC15' };

const Card = ({ item, i, t }) => {
  const look = item.kind === 'food' ? FOOD : ACTIVITY_LOOK[item.kind];
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const reduce = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600 + i * 170, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bob, { toValue: 0, duration: 1600 + i * 170, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: (item.x * 100) + '%', top: (item.y * 100) + '%', alignItems: 'center',
      transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { rotate: item.tilt + 'deg' }],
    }}>
      <LinearGradient colors={[look.from, look.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 62, height: 62, borderRadius: 20, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
          shadowColor: '#0F172A', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
        <Text style={{ fontSize: 30 }}>{look.emoji}</Text>
      </LinearGradient>
      <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, maxWidth: 104,
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        <Text style={{ color: '#1F2937', fontSize: 11, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>{t(item.key)}</Text>
      </View>
    </Animated.View>
  );
};

const Feature = ({ emoji, label }) => (
  <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
    <Text style={{ fontSize: 22 }}>{emoji}</Text>
    <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 5 }}>{label}</Text>
  </View>
);

/* ─── HELLO, LIKE A NEW iPHONE ─────────────────────────────────────────
   Ayser: "الواجهة اللي في الأول دي لازم تبقى تحفة، وفين كوكب الأرض؟ خد
   inspiration لما تعمل setup لأي جهاز Apple". The first screen is now
   the real Earth turning slowly in the dark, and "hello" fading through
   the languages Moments speaks — then the name, one line, and the way
   in. The Earth is the same three.js globe as the map's (natural
   colours here); until it has loaded, a soft drawn planet holds its
   place, so the screen is never empty. */
/* a few stars, always in the same places */
const STARS = Array.from({ length: 34 }, (_, k) => {
  const a = Math.sin(k * 12.9898) * 43758.5453, b = Math.sin(k * 78.233) * 12345.678;
  const fx = a - Math.floor(a), fy = b - Math.floor(b);
  return [Math.round(fx * 96), Math.round(fy * 96), fx > 0.85 ? 2.5 : 1.5, 0.25 + (fy * 0.55)];
});
const HELLOS = ['Hello', 'أهلاً', 'Bonjour', 'Hola', 'Ciao', 'Merhaba', 'Olá', 'Salut', 'Hallo', 'Привет', 'こんにちは', '안녕하세요', '你好', 'Ahoj', 'Tere'];

const Hello = () => {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    const run = () => {
      if (!alive) return;
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(1100),
        Animated.timing(fade, { toValue: 0, duration: 550, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => { if (!alive) return; setI((n) => (n + 1) % HELLOS.length); run(); });
    };
    run();
    return () => { alive = false; };
  }, []);
  return (
    <Animated.Text style={{
      color: '#FFFFFF', fontSize: 50, fontWeight: '300', letterSpacing: -0.5, textAlign: 'center',
      opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    }}>{HELLOS[i]}</Animated.Text>
  );
};

/* The Earth: a 12-second loop rendered from NASA's Blue Marble (public
   domain), centred on Egypt and Europe and turning the way the real one
   does — served from our own site, so it plays at once and offline,
   with no 3-D library to fetch. Its first frame is the still under it. */
const Earth = () => {
  const reduce = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);
  const size = 300;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: 128, width: size, height: size, marginLeft: -size / 2,
      opacity: breathe, transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
      <Image source={{ uri: publicMedia('earth-spin.jpg') }} style={{ position: 'absolute', width: size, height: size }} />
      {Platform.OS === 'web' && !reduce ? (
        <video src={publicMedia('earth-spin.mp4')} poster={publicMedia('earth-spin.jpg')} autoPlay muted loop playsInline preload="auto"
          style={{ position: 'absolute', width: size, height: size, objectFit: 'cover', display: 'block' }} />
      ) : null}
    </Animated.View>
  );
};

export const Welcome = ({ onStart, onSignIn }) => {
  const { t } = useLang();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);
  return (
    <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
      <View style={{ alignSelf: 'stretch', height: 440, borderRadius: 34, overflow: 'hidden', marginBottom: 26, backgroundColor: '#000' }}>
        {STARS.map(([x, y, r, o], k) => <View key={k} pointerEvents="none" style={{ position: 'absolute', left: x + '%', top: y + '%', width: r, height: r, borderRadius: r, backgroundColor: '#FFF', opacity: o }} />)}
        <Earth />
        <View pointerEvents="none" style={{ position: 'absolute', top: 34, left: 0, right: 0, alignItems: 'center' }}>
          <Hello />
        </View>
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }} />
      </View>

      <Animated.View style={{ alignSelf: 'stretch', alignItems: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Wordmark height={58} style={{ marginBottom: 4 }} />
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 32, marginTop: 4, letterSpacing: -0.4 }}>
          {t('welcome_title')}
        </Text>
        <Text style={{ color: C.dim, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 8, paddingHorizontal: 14 }}>
          {t('welcome_sub')}
        </Text>

        <Pressable onPress={() => { tapLight(); onStart(); }} accessibilityRole="button"
          style={{ alignSelf: 'stretch', backgroundColor: C.text, borderRadius: 999, paddingVertical: 17, alignItems: 'center', marginTop: 28 }}>
          <Text style={{ color: C.bg, fontSize: 17, fontWeight: '800' }}>{t('welcome_start')}</Text>
        </Pressable>
        <Pressable onPress={() => { tapLight(); onSignIn(); }} accessibilityRole="button" hitSlop={8}
          style={{ alignSelf: 'stretch', paddingVertical: 15, alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: C.purple, fontSize: 15.5, fontWeight: '800' }}>{t('welcome_have')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};
