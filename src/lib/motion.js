import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Easing } from 'react-native';

/* ─── WHY THIS FILE EXISTS ───────────────────────────────────────────
   Ayser: "ما فيهوش اي حاجه توحي السرعه" — nothing about it suggests
   speed.

   He is right, and the fix is not more milliseconds. The app already
   paints in 4.2 seconds on a 4G phone and it still felt slow, because
   speed is not a measurement people take — it is a thing they feel,
   and they feel it in the quarter-second between touching something
   and seeing it answer.

   Two answers, and they are worth more than any further byte-shaving:

     Tap   — the thing you touch moves under your finger, at once,
             before any network or navigation happens. Nothing here
             waits on anything: it is the fastest possible answer to
             "did that work?", and it is what separates an app that
             feels alive from one that feels like a web page.

     Rise  — things arrive rather than appear. A list that snaps into
             existence reads as a redraw; the same list sliding up 10px
             over 260ms reads as it being delivered to you. Staggering
             the rows by 40ms turns a wall of content into a sequence,
             which the eye follows instead of scanning.

   ── AND THE PART THAT IS FOR AYSER'S PARENTS ─────────────────────
   "الناس الكبيره ما ينزعجون" — none of this is bounce, spin or
   overshoot. Everything moves a short distance, in one direction, and
   stops. Movement that draws attention to itself is exactly what makes
   an interface tiring to somebody who is not enjoying the novelty, and
   this app has to work for a nine-year-old and for a grandmother on
   the same afternoon.

   Every animation runs on the native driver: transform and opacity
   only, so it never touches layout and never costs a frame. */

const SPRING = { friction: 7, tension: 220, useNativeDriver: true };

/* ── ONE NODE, NOT TWO ───────────────────────────────────────────────
   The first version wrapped the children in an Animated.View and put
   the caller's style on THAT, leaving the Pressable itself unstyled.
   Anything positional then went to the wrong element: `flex: 1` was
   handed to a child of a content-sized parent, so two chips meant to
   share a row came out squeezed against the left edge instead.

   Animating the Pressable directly keeps layout and movement on the
   same node, and `style` means what it means everywhere else. */
const Touchable = Animated.createAnimatedComponent(Pressable);

/* Something you touch. Use it anywhere Pressable was used; every prop
   passes straight through. */
export const Tap = ({ children, style, scale = 0.96, disabled, ...rest }) => {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(s, { ...SPRING, toValue: v }).start();
  return (
    <Touchable
      {...rest}
      disabled={disabled}
      style={[style, { transform: [{ scale: s }] }]}
      onPressIn={(e) => { if (!disabled) to(scale); if (rest.onPressIn) rest.onPressIn(e); }}
      onPressOut={(e) => { to(1); if (rest.onPressOut) rest.onPressOut(e); }}
    >
      {children}
    </Touchable>
  );
};

/* Something that has just arrived. `delay` staggers a list; keep it
   small — past about 300ms in total a stagger stops reading as
   delivery and starts reading as a wait. */
export const Rise = ({ children, delay = 0, from = 10, style }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [t, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
};

/* A soft, slow breath — for one hero element only. Anything that
   pulses in more than one place at a time is a distraction. */
export const Breathe = ({ children, style, to = 1.04, ms = 2600 }) => {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: to, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [s, to, ms]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
};
