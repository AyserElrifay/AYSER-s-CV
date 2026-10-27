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

/* The Earth, turning. Ayser: the play button over the globe made it look
   like a video ad — it was a video, and an iPhone that won't autoplay (Low
   Power Mode, data saver) puts Safari's own play button on it. So there is
   no video any more: NASA's Blue Marble (public domain) as a flat map,
   sliding inside a circle the way the real Earth turns, west to east,
   with light from the upper left, a dark limb and a thin blue atmosphere.
   Starts on Egypt and Europe. Nothing to press; it simply turns. With
   "reduce motion" on, it stands still. */
let earthStyle = false;
const POLE = -22;   // px: Antarctica and the Arctic mostly out of the circle
const ensureEarthStyle = (size) => {
  if (earthStyle || typeof document === 'undefined') return;
  earthStyle = true;
  const w = Math.round(size * 2.3);                                 // the map a little larger: the poles trimmed
  const start = -Math.round(w / 2 + (w / 2) * (30 / 180) - size / 2);   // 30°E (Egypt) in the middle
  const el = document.createElement('style');
  el.textContent = '@keyframes mm-earth-turn{from{background-position:' + start + 'px ' + POLE + 'px}to{background-position:' + (start + w) + 'px ' + POLE + 'px}}';
  document.head.appendChild(el);
};
const Earth = () => {
  const reduce = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const breathe = useRef(new Animated.Value(0)).current;
  const size = 300;
  useEffect(() => {
    Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);
  if (Platform.OS === 'web') ensureEarthStyle(size);
  const w = Math.round(size * 2.3);
  const start = -Math.round(w / 2 + (w / 2) * (30 / 180) - size / 2);
  return (
    <Animated.View pointerEvents="none" style={{ width: size, height: size,
      opacity: breathe, transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
      {Platform.OS === 'web' ? (
        <div style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', overflow: 'hidden',
          backgroundImage: 'url(' + publicMedia('earth-map.jpg') + ')', backgroundSize: w + 'px ' + Math.round(w / 2) + 'px', backgroundRepeat: 'repeat-x',
          backgroundPosition: start + 'px ' + POLE + 'px', animation: reduce ? 'none' : 'mm-earth-turn 120s linear infinite',
          boxShadow: '0 0 70px rgba(80,140,255,0.38), 0 0 18px rgba(120,170,255,0.35)' }}>
          {/* the sphere: light from the upper left, the night side and the limb in shadow */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.35) 74%, rgba(0,0,0,0.85) 100%), linear-gradient(105deg, rgba(0,0,0,0) 55%, rgba(0,0,10,0.55) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 24px rgba(140,190,255,0.45)' }} />
        </div>
      ) : <Image source={{ uri: publicMedia('earth-spin.jpg') }} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }} />}
    </Animated.View>
  );
};

/* ── TWO AFTERNOONS OUT ── Ayser sent two clips (Cairo downtown and a
   vintage market) by @khaledelnagar9, who agreed to them being here.
   They are not Moments outings, so they are not called that: they show
   the kind of afternoon the app is for, with the maker's name on them.
   No sound, no controls; the still shows until the clip is really
   playing, so a phone that won't autoplay (Low Power Mode) shows a
   picture, never Safari's play button. */
const CLIPS = [
  { k: 'hang', en: 'An afternoon downtown', ar: 'عصرية في وسط البلد' },
  { k: 'shop', en: 'A vintage market', ar: 'سوق الحاجات القديمة' },
];
const Clip = ({ c, lang, w }) => {
  const [on, setOn] = useState(false);
  const h = Math.round(w * 16 / 9);
  return (
    <View style={{ width: w, marginHorizontal: 6 }}>
      <View style={{ width: w, height: h, borderRadius: 22, overflow: 'hidden', backgroundColor: '#111' }}>
        <Image source={{ uri: publicMedia('welcome-' + c.k + '.jpg') }} style={{ position: 'absolute', width: w, height: h }} />
        {Platform.OS === 'web' ? (
          <video src={publicMedia('welcome-' + c.k + '.mp4')} muted autoPlay loop playsInline preload="auto" disablePictureInPicture
            onPlaying={() => setOn(true)} aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 1 : 0, transition: 'opacity 400ms', pointerEvents: 'none' }} />
        ) : null}
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginTop: 10, textAlign: 'center' }} numberOfLines={1}>{lang === 'ar' ? c.ar : c.en}</Text>
    </View>
  );
};
const Clips = ({ lang }) => {
  const w = Math.min(150, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 360, 480) - 68) / 2));
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row' }}>{CLIPS.map((c) => <Clip key={c.k} c={c} lang={lang} w={w} />)}</View>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 10 }}>{(lang === 'ar' ? 'فيديو: ' : 'Video: ') + '\u2066@khaledelnagar9\u2069'}</Text>
    </View>
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
          {/* two real afternoons out, where the Earth used to turn */}
          <View style={{ marginTop: 18 }}><Clips lang={lang} /></View>
        </View>

        <Animated.View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 26, width: '100%', maxWidth: 480, alignSelf: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
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
