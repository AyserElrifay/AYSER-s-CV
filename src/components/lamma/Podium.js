import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import { C } from '../../constants/theme';
import { Face } from './Face';

/* ─── لمّة · THE PODIUM ──────────────────────────────────────────────
   Ayser sent a photograph of a quiz night finishing on three people
   standing on blocks, and asked for that. Not the picture — the
   moment. A list sorted by score tells you who won; a podium that
   RISES tells the room, in the second and a half everybody is looking
   up at the screen, and that second and a half is the whole reason
   people play this together.

   ── THE ORDER THE BLOCKS GROW IN ─────────────────────────────────
   Third, then second, then first, each a beat after the last. Grown
   together, the eye has nowhere to go and the winner arrives with no
   more weight than the person who came third. Grown in that order,
   the room counts up with it out loud. It costs 900ms in total, which
   is shorter than the noise it causes.

   ── NOBODY IS A FOOTNOTE ─────────────────────────────────────────
   The three on blocks, and then every other player in the same rows
   with the same faces at the same size underneath — the difference is
   the block, not the typeface. Somebody who came seventh played the
   same twenty minutes.

   ── AND IT STOPS FOR PEOPLE WHO ASKED IT TO ──────────────────────
   A screen full of moving confetti is a genuine problem for some
   people, and the browser has been able to say so for years. When the
   system asks for reduced motion, everything here arrives already in
   place: the blocks at full height, the confetti not at all. The
   result is the same screen, still — which is the point, rather than
   a lesser version of it.                                            */

const RISE_MS = 420;
const BEAT_MS = 220;
const HEIGHTS = { 0: 116, 1: 84, 2: 62 };      // 1st, 2nd, 3rd
const MEDALS = ['🥇', '🥈', '🥉'];

/* One place to ask, because asking in three components is three
   different answers on a browser that has none. */
export const wantsStill = () => {
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { return false; }
};

/* ── ONE BLOCK ─────────────────────────────────────────────────────
   Grows from nothing to its height. Height cannot be driven on the
   native thread, so this one is honest about it rather than passing
   useNativeDriver and having it silently ignored. It is one view for
   under half a second. */
const Block = ({ place, player, meId, still, delay }) => {
  const grow = useRef(new Animated.Value(still ? 1 : 0)).current;

  useEffect(() => {
    if (still) return undefined;
    const a = Animated.timing(grow, {
      toValue: 1,
      duration: RISE_MS,
      delay,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [still, delay, grow]);

  if (!player) return <View style={{ flex: 1 }} />;

  const mine = meId && player.user_id === meId;
  const tint = place === 0 ? C.gold : place === 1 ? C.blue : C.coral;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Animated.View style={{ opacity: grow, transform: [{ scale: grow }], alignItems: 'center' }}>
        <Text style={{ fontSize: place === 0 ? 30 : 24 }}>{MEDALS[place]}</Text>
        <View style={{ marginTop: 2 }}>
          <Face player={player} size={place === 0 ? 54 : 44} ring={tint} />
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: C.text, fontSize: place === 0 ? 14 : 13, fontWeight: '900',
            marginTop: 5, maxWidth: 104, textAlign: 'center',
          }}>
          {player.nickname}
        </Text>
        <Text style={{ color: tint, fontSize: place === 0 ? 15 : 13.5, fontWeight: '900' }}>
          {player.score}
        </Text>
      </Animated.View>

      <Animated.View style={{
        width: '86%',
        height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, HEIGHTS[place]] }),
        backgroundColor: mine ? tint : C.glassHi,
        borderWidth: 1.5, borderColor: tint,
        borderTopStartRadius: 12, borderTopEndRadius: 12,
        marginTop: 8,
        alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6,
      }}>
        <Text style={{ color: mine ? '#1B1030' : tint, fontSize: 17, fontWeight: '900' }}>
          {place + 1}
        </Text>
      </Animated.View>
    </View>
  );
};

/* ── THE CONFETTI ──────────────────────────────────────────────────
   Drawn, like everything else here: coloured rectangles that fall and
   turn. Twenty-four of them, once, over two and a half seconds, and
   then they are gone — not a loop running behind a screen somebody is
   reading. Nothing is downloaded and no library is involved. */
const PIECES = 24;
const CONFETTI_MS = 2400;

const Confetti = ({ width }) => {
  const fall = useRef(new Animated.Value(0)).current;
  const bits = useRef(
    Array.from({ length: PIECES }, (_, i) => ({
      x: (i / PIECES) + (Math.random() * 0.06 - 0.03),
      delay: Math.random() * 500,
      spin: (Math.random() * 2 - 1) * 720,
      drift: Math.random() * 40 - 20,
      size: 6 + Math.random() * 6,
      colour: [C.gold, C.purple, C.green, C.blue, C.coral][i % 5],
    })),
  ).current;

  useEffect(() => {
    const a = Animated.timing(fall, {
      toValue: 1, duration: CONFETTI_MS, easing: Easing.linear, useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [fall]);

  if (!width) return null;

  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: 0, right: 0, top: 0, height: 320, overflow: 'hidden',
    }}>
      {bits.map((b, i) => {
        const start = b.delay / CONFETTI_MS;
        const range = [0, Math.min(start, 0.99), 1];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: Math.round(b.x * width),
              width: b.size, height: b.size * 1.6,
              backgroundColor: b.colour,
              borderRadius: 2,
              opacity: fall.interpolate({ inputRange: range, outputRange: [0, 1, 0] }),
              transform: [
                { translateY: fall.interpolate({ inputRange: range, outputRange: [-30, -30, 320] }) },
                { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
                { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', b.spin + 'deg'] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
};

/* Second place stands on the left, the winner in the middle, third on
   the right — where a podium puts them, and not where a sorted array
   would. */
export const Podium = ({ players, meId, width, t }) => {
  const rows = Array.isArray(players) ? players : [];
  const still = wantsStill();
  const top = [rows[0] || null, rows[1] || null, rows[2] || null];

  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 10 }}>
        {t('lamma_podium')}
      </Text>
      <View style={{ minHeight: 250, justifyContent: 'flex-end' }}>
        {!still && Platform.OS === 'web' ? <Confetti width={width} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Block place={1} player={top[1]} meId={meId} still={still} delay={BEAT_MS} />
          <Block place={0} player={top[0]} meId={meId} still={still} delay={BEAT_MS * 2} />
          <Block place={2} player={top[2]} meId={meId} still={still} delay={0} />
        </View>
      </View>
    </View>
  );
};
