import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, Platform } from 'react-native';
import { C, R } from '../constants/theme';

/* ── THE FIRST SECOND ────────────────────────────────────────────────
   While the app works out whether you're signed in, it has to show
   something. It used to show an empty canvas — and an empty canvas is
   indistinguishable from a broken app, which is exactly how it read
   when the session lookup hung and the wait never ended.

   ── Why it's an animation and not a picture ──
   A logo that simply appears is a loading screen. A logo that *arrives*
   is an opening. The difference costs nothing and is most of what makes
   an app feel made rather than assembled.

   So the mark builds itself out of the app's own three colours: purple,
   coral and gold fly in from three directions, land together, and the
   tile closes over them. Nothing is decorative for its own sake — those
   are the same three colours that mean button, alert and star
   everywhere else in the app, so the first thing you see is the palette
   you're about to use.

   ── The handoff ──
   It also has to end properly. A launch animation chopped off mid-way
   is worse than none at all, so the splash owns its own exit: once the
   app is ready it plays out — mark swells, everything lifts away — and
   only then hands over. And it never lingers on a fast boot: the exit
   starts the moment loading ends, as long as the entrance has had its
   beat.

   And if it's still going after five seconds, an honest line and a way
   out. Nobody should be left staring at a rectangle wondering whether
   to force-quit. */

const DOTS = [
  { color: C.purple, from: [-70, -54] },
  { color: C.coral, from: [72, -40] },
  { color: C.gold, from: [4, 84] },
];

export const Splash = ({ ready, onDone }) => {
  // 0 → 1 the mark assembles; then `out` 0 → 1 it leaves
  const enter = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);
  const entered = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 820, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => { entered.current = true; });

    // a slow heartbeat while it waits, so a long boot still looks alive
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(820),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    const t = setTimeout(() => setSlow(true), 5000);
    return () => { loop.stop(); clearTimeout(t); };
  }, [enter, pulse]);

  /* Leave as soon as the app is ready — but never mid-entrance, because
     a launch animation cut in half looks like a glitch. */
  useEffect(() => {
    if (!ready || leaving.current) return undefined;
    const go = () => {
      if (leaving.current) return;
      leaving.current = true;
      Animated.timing(out, {
        toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(() => { onDone && onDone(); });
    };
    if (entered.current) { go(); return undefined; }
    const t = setTimeout(go, 860);
    return () => clearTimeout(t);
  }, [ready, out, onDone]);

  const fade = out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const swell = out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const lift = out.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  // the tile closes over the dots in the last third of the entrance
  const tileScale = enter.interpolate({ inputRange: [0, 0.62, 0.86, 1], outputRange: [0.2, 0.2, 1.08, 1] });
  const tileFade = enter.interpolate({ inputRange: [0, 0.6, 0.78], outputRange: [0, 0, 1] });
  const letterFade = enter.interpolate({ inputRange: [0, 0.82, 1], outputRange: [0, 0, 1] });
  const wordFade = enter.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0, 0, 1] });
  const wordRise = enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const beat = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, opacity: fade }}>
      <Animated.View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center', transform: [{ scale: swell }, { translateY: lift }] }}>
        {/* the three colours flying in */}
        {DOTS.map((d, i) => {
          const x = enter.interpolate({ inputRange: [0, 0.68], outputRange: [d.from[0], 0], extrapolate: 'clamp' });
          const y = enter.interpolate({ inputRange: [0, 0.68], outputRange: [d.from[1], 0], extrapolate: 'clamp' });
          const o = enter.interpolate({ inputRange: [0, 0.1, 0.66, 0.8], outputRange: [0, 1, 1, 0] });
          const s = enter.interpolate({ inputRange: [0, 0.68], outputRange: [0.5, 1], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: d.color,
                opacity: o, transform: [{ translateX: x }, { translateY: y }, { scale: s }],
              }}
            />
          );
        })}

        {/* the tile they become */}
        <Animated.View
          style={{
            width: 74, height: 74, borderRadius: 24, backgroundColor: C.purple,
            alignItems: 'center', justifyContent: 'center',
            opacity: tileFade, transform: [{ scale: Animated.multiply(tileScale, beat) }],
          }}
        >
          <Animated.Text style={{ color: '#FFF', fontSize: 34, fontWeight: '900', opacity: letterFade }}>M</Animated.Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', opacity: wordFade, transform: [{ translateY: wordRise }] }}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', letterSpacing: 3, marginTop: 18 }}>MOMENTS</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Don't scroll it. Live it.</Text>
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
