import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Easing, Platform, Modal, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { Wordmark } from './Wordmark';
import { tapLight, tapMedium } from '../utils/feedback';
import { publicMedia } from '../lib/publicMedia';

/* ─── THE FIRST THIRTY SECONDS ────────────────────────────────────────
   Ayser showed the opening screens of a competitor: full-bleed, two
   enormous words a screen ("MEET. PEOPLE."), one short line, dots, Skip,
   and an arrow at the end. "عايزين حاجات زي كده عشان الـexperience".

   The idea, not their work: nothing of theirs is used. Each page is one
   photo Ayser sent of real places at home — tea passed round, the
   Stanley Bridge jump, Qaitbay, a fire by the sea, two chairs facing the
   sunset — under two big words. They set the mood; none is captioned as
   a Moments evening, and none shows a child or a face up close.
   And no "join thousands of people": there is no number on this screen
   that we have not counted.

   The photos live in public/media, not in the app bundle, and only the
   page on screen and its neighbours load, so the first download does
   not grow. Seen once; after that the plain welcome screen does the job. */

export const INTRO_SEEN = 'moments.introSeen';
export function introSeen() { try { return localStorage.getItem(INTRO_SEEN) === '1'; } catch (e) { return true; } }
const markSeen = () => { try { localStorage.setItem(INTRO_SEEN, '1'); } catch (e) {} };

const reduceMotion = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* the photo, drifting a little closer while its page is on screen */
const Photo = ({ name, active, width, height }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduceMotion()) { v.setValue(0); return undefined; }
    const a = Animated.timing(v, { toValue: 1, duration: 9000, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' });
    a.start();
    return () => a.stop();
  }, [active]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, width, height, transform: [{ scale }] }}>
      <Image source={{ uri: publicMedia(name) }} resizeMode="cover" accessibilityIgnoresInvertColors style={{ width, height }} />
    </Animated.View>
  );
};

const SLIDES = [
  { a: 'in_1a', b: 'in_1b', s: 'in_1s', photo: 'intro-people.jpg' },
  { a: 'in_2a', b: 'in_2b', s: 'in_2s', photo: 'intro-plans.jpg' },
  { a: 'in_3a', b: 'in_3b', s: 'in_3s', photo: 'intro-talk.jpg' },
  { a: 'in_4a', b: 'in_4b', s: 'in_4s', photo: 'intro-showup.jpg' },
  { a: 'in_5a', b: 'in_5b', s: 'in_5s', photo: 'intro-live.jpg' },
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
              {/* only this page and its neighbours load their photo */}
              {Math.abs(k - i) <= 1 ? <Photo name={sl.photo} active={i === k} width={width} height={height} /> : null}
              {/* dark at the top for Skip, clear in the middle, and the
                  words on near-black at the bottom so they always read */}
              <LinearGradient colors={['rgba(17,17,17,0.55)', 'rgba(17,17,17,0)', 'rgba(17,17,17,0.35)', 'rgba(17,17,17,0.94)']}
                locations={[0, 0.22, 0.5, 0.8]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 40 }}>
                {k === last ? <Wordmark white height={110} /> : null}
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
