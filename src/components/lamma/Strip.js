import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { C } from '../../constants/theme';
import { channelFor } from './channels';

/* ─── الشريط · ONE BAR, THREE JOBS ───────────────────────────────────
   The thing لمّة is remembered by. It is the same object all the way
   through a game, doing three different jobs, and it never cuts between
   them — it changes shape while you watch:

     ‹countdown›     draining while a question is open
     ‹distribution›  re-segmenting to show how the room split
     ‹leaderboard›   re-segmenting again, one slice per player

   WHY IT IS BUILT OUT OF TRANSFORMS. The obvious way to drain a bar is
   to animate its width. A width is a layout: the browser re-measures
   and repaints on every frame, for the whole twenty seconds, while a
   room full of phones is also decoding a picture. That is exactly what
   the story progress bar in this app used to do — measured at 181
   layouts per three seconds, which on a mid-range Android is where
   dropped frames come from.

   So the bar is drawn at full width and slid out from behind a clip.
   The only thing changing per frame is a transform, which the compositor
   does without troubling layout at all. Same picture, none of the cost,
   and no React re-render per tick — the value is animated, not the
   tree.                                                               */

const H = 14;

export const Strip = ({
  mode = 'countdown',     // countdown | distribution | leaderboard
  progress,               // Animated.Value 1→0, for countdown
  segments = [],          // [{ key, weight, color, label }] for the other two
  width = 0,
}) => {
  /* Segments are laid out as flex weights, so no pixel arithmetic has
     to be right for the bar to be right. */
  const total = segments.reduce((n, s) => n + Math.max(0, s.weight || 0), 0);

  if (mode !== 'countdown') {
    return (
      <View style={{ height: H, borderRadius: H / 2, overflow: 'hidden', flexDirection: 'row', backgroundColor: C.glassHi }}>
        {total <= 0 ? null : segments.map((s) => (
          <View
            key={s.key}
            style={{
              flexGrow: Math.max(0, s.weight || 0),
              flexBasis: 0,
              backgroundColor: s.color || C.purple,
              borderEndWidth: 1.5,
              borderEndColor: C.bg2,
            }}
          />
        ))}
      </View>
    );
  }

  /* The clip stays put; the fill slides out of it. translateX is
     negative-to-zero so it drains from the trailing edge — which the
     browser mirrors on its own in Arabic, because the whole document is
     already in RTL and a transform inherits that frame. Nothing here
     asks which language it is. */
  const shift = progress
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [-(width || 300), 0] })
    : 0;

  return (
    <View style={{ height: H, borderRadius: H / 2, overflow: 'hidden', backgroundColor: C.glassHi }}>
      <Animated.View
        style={{
          height: H,
          width: '100%',
          backgroundColor: C.purple,
          transform: [{ translateX: shift }],
        }}
      />
    </View>
  );
};

/* Drives the countdown. The animation is started once and left alone —
   it is not re-created on every render, because restarting an animation
   mid-question is how a bar ends up stuttering or jumping backwards. */
export function useCountdown(timerMs, runningKey) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(1);
    const anim = Animated.timing(v, {
      toValue: 0,
      duration: Math.max(1000, timerMs || 20000),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [runningKey, timerMs, v]);
  return v;
}

/* The room's split across the four answers, as bar segments. */
export const distributionSegments = (counts = []) =>
  [0, 1, 2, 3].map((i) => ({
    key: 'ch' + i,
    weight: counts[i] || 0,
    color: channelFor(i).color,
  }));

/* The scoreboard as bar segments — the leader's slice is widest, and
   you can see the gap without reading a single number. */
export const leaderboardSegments = (players = []) =>
  players.slice(0, 8).map((p, i) => ({
    key: p.user_id || 'p' + i,
    weight: Math.max(1, p.score || 0),
    /* Only tokens that exist in src/constants/theme.js. The palette has
       five accents and no more, so past the fifth player the slices
       repeat at lower emphasis rather than inventing colours that
       belong to no theme and would not follow dark mode. AYSER: if you
       want eight distinct players on the bar, the palette needs three
       more accents — that is your call, not mine to guess. */
    color: [C.purple, C.coral, C.green, C.blue, C.gold, C.dim, C.faint, C.line][i % 8],
    label: p.nickname,
  }));

export const StripLabel = ({ children }) => (
  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', marginBottom: 6 }}>{children}</Text>
);
