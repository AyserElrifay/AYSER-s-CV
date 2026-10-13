import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, Platform } from 'react-native';
import { C, R } from '../constants/theme';

/* ── THE FIRST HALF-SECOND ───────────────────────────────────────────
   While the app works out whether you're signed in, it has to show
   something — an empty canvas is indistinguishable from a broken app.

   ── ONE OPENING, NOT TWO ──
   Ayser: "انميشن واحدة بس في بداية فتح الابلكيشن — الكايت والنجمة
   حلوين، مش لازم البوكس البربل". The page already opens on the star
   that becomes a kite (scripts/inject-html.mjs), drawn before any of
   the app's code has arrived. This used to follow it with a second
   opening of its own — the purple tile and the wordmark — so every
   launch was two animations back to back. Now it is only the quiet
   background the kite flies off from, and it hands over the moment the
   app is ready. If that takes unusually long it still says so, with a
   way to try again. */

export const Splash = ({ ready, onDone }) => {
  const out = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || leaving.current) return;
    leaving.current = true;
    Animated.timing(out, {
      toValue: 1, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => { onDone && onDone(); });
  }, [ready, out, onDone]);

  const fade = out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, opacity: fade }}>
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
