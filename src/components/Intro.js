import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Easing, Platform, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { Wordmark } from './Wordmark';
import { ACTIVITY_LOOK } from '../lib/activityPins';
import { tapLight, tapMedium } from '../utils/feedback';

/* ─── THE FIRST THIRTY SECONDS ────────────────────────────────────────
   Ayser showed the opening screens of a competitor: full-bleed, two
   enormous words a screen ("MEET. PEOPLE."), one short line, dots, Skip,
   and an arrow at the end. "عايزين حاجات زي كده عشان الـexperience".

   The idea, not their work: no footage, photos, logo, colours or words
   of theirs. Every picture here is drawn by the app from its own pieces
   — the faces on the map, the activity cards, the talk room's clock,
   the pass's stamp — so the intro shows what Moments really does.
   And no "join thousands of people": there is no number on this screen
   that we have not counted.

   Seen once; after that the plain welcome screen does the job. */

export const INTRO_SEEN = 'moments.introSeen';
export function introSeen() { try { return localStorage.getItem(INTRO_SEEN) === '1'; } catch (e) { return true; } }
const markSeen = () => { try { localStorage.setItem(INTRO_SEEN, '1'); } catch (e) {} };

const reduceMotion = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useLoop = (ms, delay = 0) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion()) { v.setValue(0.5); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return v;
};

/* 1 · people gathering round you */
const PEOPLE = [
  { l: 'M', c: '#F43F5E', x: -96, y: -70 }, { l: 'Y', c: '#0EA5E9', x: 92, y: -88 },
  { l: 'S', c: '#F59E0B', x: -110, y: 64 }, { l: 'A', c: '#10B981', x: 100, y: 58 },
  { l: 'H', c: '#A855F7', x: 4, y: -128 },
];
const Person = ({ p, i }) => {
  const v = useLoop(2600, i * 260);
  const tx = v.interpolate({ inputRange: [0, 1], outputRange: [p.x, p.x * 0.72] });
  const ty = v.interpolate({ inputRange: [0, 1], outputRange: [p.y, p.y * 0.72] });
  return (
    <Animated.View style={{ position: 'absolute', transform: [{ translateX: tx }, { translateY: ty }] }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: p.c, borderWidth: 3, borderColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{p.l}</Text>
      </View>
    </Animated.View>
  );
};
const ArtPeople = () => {
  const pulse = useLoop(1600);
  return (
    <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(167,139,250,0.6)',
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }) }} />
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#7C3AED', borderWidth: 4, borderColor: '#fff' }} />
      {PEOPLE.map((p, i) => <Person key={p.l} p={p} i={i} />)}
    </View>
  );
};

/* 2 · things to join, standing up like the map's cards */
const CARDS = [
  { k: 'walk', key: 'in_card_walk', time: '19:30', x: -70, y: -90, r: -8 },
  { k: 'coffee', key: 'in_card_coffee', time: '·', x: 74, y: -20, r: 6 },
  { k: 'culture', key: 'in_card_opera', time: '20:00', x: -54, y: 74, r: -3 },
];
const PlanCard = ({ c, i, t }) => {
  const v = useLoop(2200, i * 380);
  const look = ACTIVITY_LOOK[c.k];
  return (
    <Animated.View style={{ position: 'absolute', transform: [{ translateX: c.x }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [c.y, c.y - 10] }) }, { rotate: c.r + 'deg' }] }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 10, paddingEnd: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
        <LinearGradient colors={[look.from, look.to]} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>{look.emoji}</Text>
        </LinearGradient>
        <View style={{ marginStart: 10 }}>
          <Text style={{ color: '#111', fontSize: 15, fontWeight: '900' }}>{t(c.key)}</Text>
          <Text style={{ color: '#666', fontSize: 12.5, fontWeight: '700' }}>{c.time === '·' ? t('gn_now') : c.time}</Text>
        </View>
      </View>
    </Animated.View>
  );
};
const ArtPlans = ({ t }) => (
  <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
    {CARDS.map((c, i) => <PlanCard key={c.k} c={c} i={i} t={t} />)}
  </View>
);

/* 3 · a short talk, then a real place */
const ArtTalk = ({ t, active }) => {
  const [s, setS] = useState(14 * 60 + 59);
  useEffect(() => {
    if (!active) return undefined;
    const h = setInterval(() => setS((x) => (x > 0 ? x - 1 : 14 * 60 + 59)), 1000);
    return () => clearInterval(h);
  }, [active]);
  const mm = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  return (
    <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 210, height: 210, borderRadius: 105, borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: -3, left: -3, width: 210, height: 210, borderRadius: 105, borderWidth: 3, borderColor: 'transparent', borderTopColor: '#34D399', borderRightColor: '#34D399', transform: [{ rotate: '20deg' }] }} />
        <Text style={{ color: '#fff', fontSize: 50, fontWeight: '200', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{mm}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 }}>{t('tr_kicker')}</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
        <Text style={{ fontSize: 15 }}>☕</Text>
        <Text style={{ color: '#111', fontSize: 13.5, fontWeight: '800', marginStart: 6 }}>{t('in_then_cafe')}</Text>
      </View>
    </View>
  );
};

/* 4 · the stamp on your pass */
const ArtStamp = ({ t, active }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { v.setValue(0); return; }
    if (reduceMotion()) { v.setValue(1); return; }
    Animated.spring(v, { toValue: 1, friction: 5, tension: 70, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [active]);
  return (
    <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 230, height: 150, borderRadius: 20, backgroundColor: '#F9F9F6', padding: 14, transform: [{ rotate: '-4deg' }] }}>
        <Text style={{ color: '#999', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 }}>MOMENTS · {t('pp_local_pass')}</Text>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={{ width: 52, height: 64, borderRadius: 10, backgroundColor: '#DDD6FE' }} />
          <View style={{ marginStart: 10 }}>
            <View style={{ width: 80, height: 10, borderRadius: 5, backgroundColor: '#1A1A1A' }} />
            <View style={{ width: 60, height: 8, borderRadius: 4, backgroundColor: '#BBB', marginTop: 8 }} />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              {['🇪🇬', '🇪🇪', '🇫🇷'].map((f) => <Text key={f} style={{ fontSize: 16, marginEnd: 4 }}>{f}</Text>)}
            </View>
          </View>
        </View>
      </View>
      <Animated.View style={{ position: 'absolute', right: 8, top: 96, width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#34D399', alignItems: 'center', justifyContent: 'center',
        opacity: v, transform: [{ rotate: '-14deg' }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) }] }}>
        <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>{t('xp_lvl_regular').toUpperCase()}</Text>
        <Text style={{ color: '#34D399', fontSize: 22, fontWeight: '900' }}>+50</Text>
        <Text style={{ color: '#34D399', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }}>XP</Text>
      </Animated.View>
    </View>
  );
};

const SLIDES = [
  { a: 'in_1a', b: 'in_1b', s: 'in_1s', glow: '#7C3AED', Art: ArtPeople },
  { a: 'in_2a', b: 'in_2b', s: 'in_2s', glow: '#F97316', Art: ArtPlans },
  { a: 'in_3a', b: 'in_3b', s: 'in_3s', glow: '#10B981', Art: ArtTalk },
  { a: 'in_4a', b: 'in_4b', s: 'in_4s', glow: '#0EA5E9', Art: ArtStamp },
  { a: 'in_5a', b: 'in_5b', s: 'in_5s', glow: '#7C3AED', Art: null },
];

export const Intro = ({ onStart, onSignIn }) => {
  const { t, rtl } = useLang();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const scroller = useRef(null);
  const last = SLIDES.length - 1;

  /* In Arabic the pages run right to left. A right-to-left ScrollView
     scrolls backwards on the web, so the strip itself stays
     left-to-right and the pages are laid in it in reverse: page k
     sits at place last - k, and the first page starts at the far right. */
  const place = (k) => (rtl ? last - k : k);
  const scrollTo = (k, animated) => {
    try { scroller.current && scroller.current.scrollTo({ x: place(k) * width, animated }); } catch (e) {}
  };
  const go = (n) => {
    const k = Math.max(0, Math.min(last, n));
    setI(k);
    scrollTo(k, true);
  };
  useEffect(() => { const h = setTimeout(() => scrollTo(i, false), 0); return () => clearTimeout(h); }, [rtl, width]);
  const finish = (fn) => { tapMedium(); markSeen(); fn && fn(); };

  return (
    <Modal visible animationType="fade" onRequestClose={() => go(last)}>
      <View style={{ flex: 1, backgroundColor: '#111111' }}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => { const k = place(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width))); if (k !== i && k >= 0 && k <= last) setI(k); }}
          style={{ flex: 1, direction: 'ltr' }}
        >
          {(rtl ? [...SLIDES].reverse() : SLIDES).map((sl) => { const k = SLIDES.indexOf(sl); return (
            <View key={sl.a} style={{ width, height, overflow: 'hidden', direction: rtl ? 'rtl' : 'ltr' }}>
              {/* each slide's own light, low behind the picture */}
              <LinearGradient colors={[sl.glow + '55', '#11111100']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.75 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.75 }} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 40 }}>
                {sl.Art ? <sl.Art t={t} active={i === k} /> : <Wordmark white height={110} />}
              </View>
              <View style={{ paddingHorizontal: 26, paddingBottom: insets.bottom + (k === last ? 196 : 120) }}>
                <Text style={{ color: '#fff', fontSize: Math.min(56, width * 0.14), fontWeight: '900', letterSpacing: -1.5, lineHeight: Math.min(56, width * 0.14) * 1.02 }}>
                  {t(sl.a) + '\n' + t(sl.b)}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 420 }}>{t(sl.s)}</Text>
              </View>
            </View>
          ); })}
        </ScrollView>

        {/* Skip goes to the end, where the choice is */}
        {i < last ? (
          <Pressable onPress={() => { tapLight(); go(last); }} accessibilityRole="button" hitSlop={12}
            style={{ position: 'absolute', top: insets.top + 14, left: 22, paddingVertical: 8, paddingHorizontal: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700' }}>{t('in_skip')}</Text>
          </Pressable>
        ) : null}
        {i < last ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 12, right: 20 }}>
            <Wordmark white height={40} />
          </View>
        ) : null}

        {/* the bottom: dots and the next step */}
        <View style={{ position: 'absolute', left: 26, right: 26, bottom: insets.bottom + 26 }}>
          {i < last ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {SLIDES.map((_, k) => (
                  <Pressable key={k} onPress={() => go(k)} accessibilityRole="button" accessibilityLabel={String(k + 1)} hitSlop={6}
                    style={{ width: k === i ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? '#A78BFA' : 'rgba(255,255,255,0.35)', marginEnd: 7 }} />
                ))}
              </View>
              <Pressable onPress={() => { tapLight(); go(i + 1); }} accessibilityRole="button" accessibilityLabel={t('in_next')}
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={rtl ? "arrow-back" : "arrow-forward"} size={26} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable onPress={() => finish(onStart)} accessibilityRole="button"
                style={{ backgroundColor: '#7C3AED', borderRadius: 999, paddingVertical: 17, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{t('welcome_start')}</Text>
              </Pressable>
              <Pressable onPress={() => finish(onSignIn)} accessibilityRole="button"
                style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}>
                <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800' }}>{t('welcome_have')}</Text>
              </Pressable>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textAlign: 'center', marginTop: 14 }}>{t('in_private')}</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};
