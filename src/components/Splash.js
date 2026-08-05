import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, Platform } from 'react-native';
import { C, R } from '../constants/theme';
import { Wordmark, LogoMark } from './Wordmark';
import { useTheme } from '../context/ThemeContext';

/* ── THE FIRST HALF-SECOND ───────────────────────────────────────────
   While the app works out whether you're signed in, it has to show
   something. It used to show an empty canvas — and an empty canvas is
   indistinguishable from a broken app, which is exactly how it read
   when the session lookup hung and the wait never ended.

   ── It is the real logo, and it is short ──
   The first version of this invented its own mark: a purple tile with a
   capital M, and three coloured dots flying in to build it. That was
   not the logo. Moments has one — the purple tile with the lowercase m
   and the gold dot, and the "moments" wordmark with the gold spark
   above it — and the opening screen is the single place it matters most
   that they match, because it is the first thing anyone sees.

   So it's the artwork itself, and the animation is one gesture rather
   than a sequence: the mark settles, the wordmark comes up under it.
   440ms in, 220ms out. A launch animation is a door, not a performance;
   the second time you see it you only want it to be over.

   And it still ends properly rather than being cut off mid-way — the
   splash owns its exit and hands over when it's done. */

export const Splash = ({ ready, onDone }) => {
  const { isDark } = useTheme();   // the wordmark has a light and a dark cut
  const enter = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);
  const entered = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => { entered.current = true; });
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [enter]);

  /* Leave the moment the app is ready — but never mid-entrance, because
     an opening cut in half looks like a glitch. */
  useEffect(() => {
    if (!ready || leaving.current) return undefined;
    const go = () => {
      if (leaving.current) return;
      leaving.current = true;
      Animated.timing(out, {
        toValue: 1, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(() => { onDone && onDone(); });
    };
    if (entered.current) { go(); return undefined; }
    const t = setTimeout(go, 460);
    return () => clearTimeout(t);
  }, [ready, out, onDone]);

  const fade = out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const swell = out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });

  const markScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const markFade = enter.interpolate({ inputRange: [0, 0.45], outputRange: [0, 1], extrapolate: 'clamp' });
  const wordFade = enter.interpolate({ inputRange: [0.35, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const wordRise = enter.interpolate({ inputRange: [0.35, 1], outputRange: [12, 0], extrapolate: 'clamp' });

  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, opacity: fade }}>
      <Animated.View style={{ opacity: markFade, transform: [{ scale: Animated.multiply(markScale, swell) }] }}>
        <LogoMark size={84} />
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', marginTop: 20, opacity: wordFade, transform: [{ translateY: wordRise }] }}>
        <Wordmark height={44} white={isDark} />
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>Don't scroll it. Live it.</Text>
      </Animated.View>

      {slow ? (
        <View style={{ alignItems: 'center', marginTop: 26 }}>
          <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', lineHeight: 19 }}>
            Taking longer than it should — your connection might be having a moment.
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
            }}
            style={{ marginTop: 14 }}
          >
            <View style={{ backgroundColor: C.purple, borderRadius: R, paddingHorizontal: 24, paddingVertical: 11 }}>
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>Try again</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
};
