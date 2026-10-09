import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Wordmark } from './Wordmark';
import { ACTIVITY_LOOK } from '../lib/activityPins';
import { tapLight } from '../utils/feedback';

/* ─── THE FIRST THING ANYBODY SEES ────────────────────────────────────
   Ayser: "عايزين welcome page زي المنافسين". The ones he showed open on
   a picture of the app's world and two buttons, and leave the form for
   later. The old first screen was a sign-in box: it asked for a
   password before it had said what the app is.

   This is a drawn map, ours — no stock photos, nobody's pictures used
   without asking — with the kinds of things people really do on
   Moments standing on it in the same bright cards the real map uses
   (src/lib/activityPins.js). No member counts, no "join 1M people":
   there is nothing on this screen that is not true of the app on the
   day you open it. */

const SCENE = [
  { kind: 'culture', key: 'welcome_act_opera',  x: 0.06, y: 0.10, tilt: -6 },
  { kind: 'walk',    key: 'welcome_act_walk',   x: 0.62, y: 0.05, tilt: 5 },
  { kind: 'sport',   key: 'welcome_act_ball',   x: 0.70, y: 0.46, tilt: -4 },
  { kind: 'art',     key: 'welcome_act_sketch', x: 0.05, y: 0.55, tilt: 4 },
  { kind: 'food',    key: 'welcome_act_food',   x: 0.36, y: 0.66, tilt: -3 },
  { kind: 'circle',  key: 'welcome_act_lang',   x: 0.36, y: 0.03, tilt: 3 },
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
      <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 6,
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        <Text style={{ color: '#1F2937', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>{t(item.key)}</Text>
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

export const Welcome = ({ onStart, onSignIn }) => {
  const { t } = useLang();
  const { isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, []);
  const land = isDark ? ['#16324A', '#1F2B4D'] : ['#D9F5E5', '#DCEEFF'];
  return (
    <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
      {/* the map, drawn: land, a river, two parks — and what is on */}
      <LinearGradient colors={land} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ alignSelf: 'stretch', height: 330, borderRadius: 30, overflow: 'hidden', marginBottom: 22 }}>
        <View style={{ position: 'absolute', left: '-10%', top: '58%', width: '130%', height: 46, borderRadius: 30,
          backgroundColor: isDark ? '#1E5A8A' : '#9ED8F5', transform: [{ rotate: '-14deg' }] }} />
        <View style={{ position: 'absolute', left: '55%', top: '-8%', width: 44, height: '80%', borderRadius: 30,
          backgroundColor: isDark ? '#1E5A8A' : '#9ED8F5', transform: [{ rotate: '22deg' }] }} />
        <View style={{ position: 'absolute', left: '8%', top: '30%', width: 96, height: 70, borderRadius: 40,
          backgroundColor: isDark ? '#1D4B35' : '#B7EBC3' }} />
        <View style={{ position: 'absolute', right: '6%', top: '74%', width: 110, height: 64, borderRadius: 40,
          backgroundColor: isDark ? '#1D4B35' : '#B7EBC3' }} />
        {/* you are here */}
        <View style={{ position: 'absolute', left: '50%', top: '42%', marginLeft: -9, marginTop: -9 }}>
          <Animated.View style={{ position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: C.purple,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }] }} />
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.purple, borderWidth: 3, borderColor: '#fff' }} />
        </View>
        {SCENE.map((item, i) => <Card key={item.key} item={item} i={i} t={t} />)}
      </LinearGradient>

      <Wordmark height={64} style={{ marginBottom: 6 }} />
      <Text style={{ color: C.text, fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31, marginTop: 4 }}>
        {t('welcome_title')}
      </Text>
      <Text style={{ color: C.dim, fontSize: 14.5, textAlign: 'center', lineHeight: 21, marginTop: 8, paddingHorizontal: 10 }}>
        {t('welcome_sub')}
      </Text>

      <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 20, marginBottom: 24 }}>
        <Feature emoji="🗓️" label={t('welcome_f_week')} />
        <Feature emoji="🤝" label={t('welcome_f_join')} />
        <Feature emoji="🌿" label={t('welcome_f_green')} />
      </View>

      <Pressable onPress={() => { tapLight(); onStart(); }} accessibilityRole="button"
        style={{ alignSelf: 'stretch', backgroundColor: C.purple, borderRadius: 999, paddingVertical: 16, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16.5, fontWeight: '900' }}>{t('welcome_start')}</Text>
      </Pressable>
      <Pressable onPress={() => { tapLight(); onSignIn(); }} accessibilityRole="button"
        style={{ alignSelf: 'stretch', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: C.line }}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{t('welcome_have')}</Text>
      </Pressable>
    </View>
  );
};
