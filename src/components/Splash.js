import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, Platform } from 'react-native';
import { C, R } from '../constants/theme';

/* ── THE FIRST HALF-SECOND ───────────────────────────────────────────
   While the app works out whether you're signed in, it has to show
   something. It used to show an empty canvas — and an empty canvas is
   indistinguishable from a broken app, which is exactly how it read
   when the session lookup hung and the wait never ended.

   So: the wordmark, a pulse to say it's alive, and — if it's still
   going after five seconds — an honest line and a way out. Nobody
   should ever be left staring at a blank rectangle wondering whether
   to force-quit. */
export const Splash = () => {
  const pulse = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    const t = setTimeout(() => setSlow(true), 5000);
    return () => { loop.stop(); clearTimeout(t); };
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Animated.View style={{ transform: [{ scale }], opacity: glow }}>
        <View style={{
          width: 74, height: 74, borderRadius: 24, backgroundColor: C.purple,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '900' }}>M</Text>
        </View>
      </Animated.View>

      <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', letterSpacing: 3, marginTop: 20 }}>MOMENTS</Text>
      <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Don't scroll it. Live it.</Text>

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
    </View>
  );
};
