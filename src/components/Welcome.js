import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform, Image, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGS } from '../constants/i18n';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { Wordmark } from './Wordmark';
import { tapLight } from '../utils/feedback';
import { publicMedia } from '../lib/publicMedia';

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
const HELLOS = ['Hello', 'أهلاً', 'Bonjour', 'Hola', 'Ciao', 'Merhaba', 'Olá', 'Salut', 'Hallo', 'Привет', 'こんにちは', '안녕하세요', '你好', 'Ahoj', 'Tere', 'नमस्ते'];

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
  const size = 320;
  return (
    <Animated.View pointerEvents="none" style={{ width: size, height: size,
      opacity: breathe, transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
      <Image source={{ uri: publicMedia('earth-spin.jpg') }} style={{ position: 'absolute', width: size, height: size }} />
      {Platform.OS === 'web' && !reduce ? (
        <video src={publicMedia('earth-spin.mp4')} poster={publicMedia('earth-spin.jpg')} autoPlay muted loop playsInline preload="auto"
          style={{ position: 'absolute', width: size, height: size, objectFit: 'cover', display: 'block' }} />
      ) : null}
    </Animated.View>
  );
};

/* "As simple as Steve Jobs would make it": black, the Earth, hello,
   one button. Everything else waits until after "Get started". */
export const Welcome = ({ onStart, onSignIn }) => {
  const { t, lang, setLang } = useLang();
  const insets = useSafeAreaInsets();
  const [langs, setLangs] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 1100, delay: 900, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <Modal visible animationType="none" transparent={false} onRequestClose={onSignIn}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {STARS.map(([x, y, r, o], k) => <View key={k} pointerEvents="none" style={{ position: 'absolute', left: x + '%', top: y + '%', width: r, height: r, borderRadius: r, backgroundColor: '#FFF', opacity: o * 0.8 }} />)}

        {/* the language, small, out of the way */}
        <Pressable onPress={() => { tapLight(); setLangs((v) => !v); }} accessibilityRole="button" hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 14, right: 18, zIndex: 3, outlineStyle: 'none' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, fontWeight: '600' }}>{cur.flag + '  ' + cur.native}</Text>
        </Pressable>
        {langs ? (
          <View style={{ position: 'absolute', top: insets.top + 44, right: 14, zIndex: 4, backgroundColor: 'rgba(28,28,30,0.96)', borderRadius: 16, paddingVertical: 6, maxHeight: 360 }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {LANGS.map((l) => (
                <Pressable key={l.code} onPress={() => { tapLight(); setLang(l.code); setLangs(false); }} style={{ paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: l.code === lang ? '#FFF' : 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: l.code === lang ? '800' : '500' }}>{l.flag + '  ' + l.native}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ height: 70, justifyContent: 'center' }}><Hello /></View>
          <View style={{ width: 320, height: 320, marginTop: 18 }}><Earth /></View>
        </View>

        <Animated.View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 26, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          <Pressable onPress={() => { tapLight(); onStart(); }} accessibilityRole="button"
            style={{ backgroundColor: '#FFF', borderRadius: 999, paddingVertical: 17, alignItems: 'center' }}>
            <Text style={{ color: '#000', fontSize: 17, fontWeight: '700' }}>{t('welcome_start')}</Text>
          </Pressable>
          <Pressable onPress={() => { tapLight(); onSignIn(); }} accessibilityRole="button" hitSlop={8} style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600' }}>{t('welcome_have')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};
