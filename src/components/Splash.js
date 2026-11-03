import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, Platform } from 'react-native';
import { C, R } from '../constants/theme';

/* ── THE FIRST HALF-SECOND ───────────────────────────────────────────
   Ayser, November 2026: the star that becomes a kite is back
   (scripts/inject-html.mjs, on the cream page). This is only the quiet
   page it flies off from, and it fades as soon as the app is ready. If that takes unusually long it
   says so, with a way to try again. */
const ready_ = () => { try { window.dispatchEvent(new Event('mm-app-ready')); } catch (e) {} };

export const Splash = ({ ready, onDone }) => {
  const out = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    ready_();   // the page's own copy of the wordmark steps aside: this one is in the same place
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
      {/* the kite flies off this quiet page (scripts/inject-html.mjs): one opening, not two */}
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
