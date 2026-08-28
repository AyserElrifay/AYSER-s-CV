import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Platform, PanResponder, useWindowDimensions, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { tapSelection } from '../utils/feedback';
import { tourSeen } from '../components/GestureTour';

/* ─── MOVING BETWEEN TABS WITHOUT AIMING AT ANYTHING ────────────────
   Six tabs along the bottom, and every one of them costs a deliberate
   look-down-and-aim. That is the slowest thing in the app: the tap
   itself is instant, but the eye has to leave what it was reading,
   find a 21px icon, and come back. Swiping costs none of that.

   ── WHY ONLY FROM THE EDGE ───────────────────────────────────────
   The obvious build is Instagram's: swipe anywhere. It is also the one
   that breaks this app, because a full-width horizontal swipe is
   already spoken for almost everywhere you would make it. The map pans
   horizontally — that IS the map. The stories rail scrolls sideways.
   The chat rows swipe to reveal. The photo carousels page across. Take
   the whole width for tab switching and you take all of those away, and
   the person who wanted to look at the next photo lands on the map.

   The outer 40px of the screen is spoken for by nothing. No content
   starts there, no rail scrolls there, the map is inset from it. So the
   gesture is unambiguous by construction rather than by a pile of
   exceptions — which means it also works on the map, where a full-width
   swipe never could.

   ── AND WHY IT FLIPS IN ARABIC ───────────────────────────────────
   The tab bar genuinely mirrors in Arabic — the browser's own bidi
   engine reverses the row, so Home really is on the right. A gesture
   that ignored that would move the highlight the wrong way down a bar
   the reader can see, which is worse than having no gesture at all. */

export const TAB_ORDER = ['HOME', 'MAP', 'REELS', 'CHILL', 'CHATS', 'SPACE'];

const EDGE = 40;        // how far in from the side the gesture may start
const OPEN = 55;        // how far it must travel to count
const FLICK = 0.4;      // …or how fast, for a short quick flick
const HINT_KEY = 'moments.swipehint.v1';

/* The hint shows on the first three opens and then never again. It is
   also cancelled the moment you actually swipe, because at that point
   you know, and being told something you have just done is noise. */
const useHint = (enabled) => {
  const [show, setShow] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    /* On a first run the welcome cards are open over the whole screen.
       A pill underneath them is not a hint, it is a thing nobody sees —
       and worse, it would spend one of its three showings doing it. So
       it waits until the tour is behind them. */
    if (!tourSeen()) return;
    AsyncStorage.getItem(HINT_KEY).then((v) => {
      const seen = parseInt(v || '0', 10) || 0;
      if (!alive || seen >= 3) return;
      AsyncStorage.setItem(HINT_KEY, String(seen + 1)).catch(() => {});
      setShow(true);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true })
          .start(() => alive && setShow(false));
      }, 4200);
    }).catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  const dismiss = () => {
    if (done.current) return;
    done.current = true;
    AsyncStorage.setItem(HINT_KEY, '9').catch(() => {});
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShow(false));
  };
  return { show, fade, dismiss };
};

export const SwipeTabs = ({ children }) => {
  const nav = useNavigation();
  /* The route's own name, asked for rather than passed in. The first
     build took the crash-log label instead — "Home", "Chats" — and
     looked for it in a list of route names that are "HOME", "CHATS".
     It never matched once, so every completed swipe fell through and
     did nothing, with no error to show for it. */
  const name = useRoute().name;
  const { width } = useWindowDimensions();
  const { t, rtl } = useLang();
  // On a laptop the tab bar is a sidebar you can see the whole time and
  // the pointer is a mouse — there is no swipe to make, so there is no
  // gesture and no hint.
  const on = !(Platform.OS === 'web' && width >= 820);
  const hint = useHint(on && name === TAB_ORDER[0]);

  /* ── WHERE THE FINGER STARTED, THE ONLY WAY THAT SURVIVES THE WEB ──
     The obvious source is `gestureState.x0`. On a phone it is right; in
     the browser it is 0 — always, for every touch, wherever it began.
     Measured, not assumed: a drag from x=12, one from x=378 and one
     from x=195 all reported x0=0, so an "only from the edge" test built
     on it says yes to the whole screen. The gesture would have looked
     like it worked while quietly stealing every sideways drag in the
     app.

     `moveX` is populated correctly, and the start is simply the current
     position minus how far the gesture has travelled. Same three drags:
     30.8−18.8=12, 359.2−(−18.8)=378, 179.5−(−15.5)=195. Exact. */
  /* dx < 0 is a drag towards the left of the glass. In a left-to-right
     bar that means "forward"; in Arabic the bar is genuinely mirrored —
     the browser's own bidi engine reverses the row, so Home really is
     on the right — and the same drag has to mean "back", or the
     highlight moves the wrong way down a bar the reader can see. */
  const targetOf = (dx) => {
    const forward = rtl ? dx > 0 : dx < 0;
    const i = TAB_ORDER.indexOf(name);
    return i < 0 ? null : (TAB_ORDER[i + (forward ? 1 : -1)] || null);
  };

  const claim = (g) => {
    if (!on) return false;
    const x0 = g.moveX - g.dx;
    if (x0 > EDGE && x0 < width - EDGE) return false;
    if (Math.abs(g.dx) <= 14 || Math.abs(g.dx) <= Math.abs(g.dy) * 2) return false;
    /* ── NEVER SWALLOW A GESTURE YOU ARE NOT GOING TO ACT ON ──────
       There is no tab before Home, so a drag inwards from Home's near
       edge has nowhere to go. The first build still claimed it — and
       claiming it is not harmless, because that same edge already
       opens the camera on the feed. The swipe took the gesture,
       decided there was nothing to move to, and did nothing, and the
       camera shortcut was simply gone. So the target is worked out
       before the claim, not after it. */
    return !!targetOf(g.dx);
  };

  const pan = useMemo(() => PanResponder.create({
    // Claimed on the capture pass so a scrolling list underneath cannot
    // take the gesture first. Safe to capture because the test is so
    // narrow: it has to start in the outer 40px AND be twice as much
    // sideways as it is up or down before this ever says yes.
    onMoveShouldSetPanResponderCapture: (e, g) => claim(g),
    onMoveShouldSetPanResponder: (e, g) => claim(g),
    onPanResponderRelease: (e, g) => {
      const far = Math.abs(g.dx) > OPEN || (Math.abs(g.dx) > 24 && Math.abs(g.vx) > FLICK);
      if (!far) return;
      const next = targetOf(g.dx);
      if (!next) return;
      hint.dismiss();
      tapSelection();
      nav.navigate(next);
    },
    onPanResponderTerminationRequest: () => true,
  }), [on, width, rtl, name, hint, nav]);

  const handlers = on ? pan.panHandlers : {};

  return (
    <View style={{ flex: 1 }} {...handlers}>
      {children}
      {hint.show ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center', opacity: hint.fade,
          }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 7,
            backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14,
          }}>
            <Ionicons name="swap-horizontal" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('swipe_hint')}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};
