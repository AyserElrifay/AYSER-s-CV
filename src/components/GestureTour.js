import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useLang } from '../context/LanguageContext';

/* ── THE FOUR THINGS WORTH KNOWING ───────────────────────────────────
   Shown once, the first time somebody gets into the app, and never
   again unless they ask for it from Settings.

   The rule it follows: only teach what you'd never find on your own.
   Tapping things is obvious and doesn't need a lesson. A swipe from the
   edge of the screen does — nothing on screen suggests it exists, so
   without being told once, it may as well not be there.

   Four cards, because five is a chore. Each one shows the gesture
   moving rather than describing it: a dot that travels the path your
   thumb would take, looping quietly until you move on. Watching a
   gesture happen is worth more than a paragraph about it. */

/* This is the very first thing anybody sees, so it is the last place
   in the app that should be speaking English at someone who chose
   another language. Each card names its two keys and the sentences
   live where every other sentence lives. */
const STEPS = [
  { key: 'map', emoji: '🌍', t: 'tour_map_t', b: 'tour_map_b', motion: 'pinch' },
  { key: 'feed', emoji: '📸', t: 'tour_cam_t', b: 'tour_cam_b', motion: 'edge' },
  { key: 'chats', emoji: '🔥', t: 'tour_fire_t', b: 'tour_fire_b', motion: 'pull' },
  { key: 'character', emoji: '🧍', t: 'tour_you_t', b: 'tour_you_b', motion: 'turn' },
];

const KEY = 'mm_gesture_tour_v1';

export function tourSeen() {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch (e) { return true; }
}
export function markTourSeen() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, '1'); } catch (e) {}
}

/* A dot that travels the path your thumb would take. Same component for
   every gesture — only the path changes. */
const Motion = ({ kind }) => {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(t, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [kind, t]);

  const dot = (style, key) => (
    <Animated.View
      key={key}
      style={[{
        position: 'absolute', width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 2, borderColor: C.purple,
      }, style]}
    />
  );

  const frame = { width: 150, height: 108, alignSelf: 'center', marginBottom: 18, justifyContent: 'center', alignItems: 'center' };

  if (kind === 'pinch') {
    const outA = t.interpolate({ inputRange: [0, 1], outputRange: [0, -34] });
    const outB = t.interpolate({ inputRange: [0, 1], outputRange: [0, 34] });
    return (
      <View style={frame}>
        <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(124,58,237,0.35)' }} />
        {dot({ transform: [{ translateX: outA }, { translateY: outA }] }, 'a')}
        {dot({ transform: [{ translateX: outB }, { translateY: outB }] }, 'b')}
      </View>
    );
  }

  if (kind === 'edge') {
    const x = t.interpolate({ inputRange: [0, 1], outputRange: [-58, 44] });
    const fade = t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });
    return (
      <View style={frame}>
        <View style={{ width: 108, height: 96, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(124,58,237,0.35)' }} />
        <View style={{ position: 'absolute', left: 21, top: 6, bottom: 6, width: 4, borderRadius: 2, backgroundColor: 'rgba(124,58,237,0.45)' }} />
        {dot({ opacity: fade, transform: [{ translateX: x }] }, 'a')}
      </View>
    );
  }

  if (kind === 'pull') {
    const y = t.interpolate({ inputRange: [0, 1], outputRange: [-32, 32] });
    return (
      <View style={frame}>
        <View style={{ width: 108, height: 96, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(124,58,237,0.35)' }} />
        <View style={{ position: 'absolute', top: 21, left: 6, right: 6, height: 4, borderRadius: 2, backgroundColor: 'rgba(124,58,237,0.45)' }} />
        {dot({ transform: [{ translateY: y }] }, 'a')}
      </View>
    );
  }

  // turn
  const x = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-36, 36, -36] });
  return (
    <View style={frame}>
      <View style={{ width: 46, height: 92, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(124,58,237,0.35)' }} />
      {dot({ transform: [{ translateX: x }] }, 'a')}
    </View>
  );
};

export const GestureTour = ({ onClose }) => {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const finish = () => {
    markTourSeen();
    tapSuccess();
    onClose && onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,6,18,0.86)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={finish} />

        <View style={{
          backgroundColor: C.bg2, borderTopLeftRadius: R + 10, borderTopRightRadius: R + 10,
          paddingTop: 22, paddingHorizontal: 26, paddingBottom: insets.bottom + 20,
        }}>
          <Text style={{ fontSize: 30, textAlign: 'center' }}>{step.emoji}</Text>

          <View style={{ marginTop: 16 }}>
            <Motion kind={step.motion} />
          </View>

          <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center', lineHeight: 26 }}>
            {t(step.t)}
          </Text>
          <Text style={{ color: C.faint, fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
            {t(step.b)}
          </Text>

          {/* where you are in the four */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
            {STEPS.map((s, n) => (
              <View
                key={s.key}
                style={{
                  width: n === i ? 20 : 7, height: 7, borderRadius: 4, marginHorizontal: 3,
                  backgroundColor: n === i ? C.purple : C.glassHi,
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => {
              if (last) { finish(); return; }
              tapSelection();
              setI((n) => n + 1);
            }}
            style={{ marginTop: 20 }}
          >
            <View style={{ backgroundColor: C.purple, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>
                {last ? t('tour_got_it') : t('tour_next')}
              </Text>
            </View>
          </Pressable>

          {!last ? (
            <Pressable onPress={finish} style={{ marginTop: 12, alignSelf: 'center' }}>
              <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>{t('tour_skip')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};
