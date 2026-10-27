import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, PanResponder, Image, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from '../../ui/Gradient';
import { C } from '../../constants/theme';
import { worldBoard } from '../../services/squadGames';
import { todayChallenge } from './challenges';
import { kindLabel } from './WorldSheet';
import { gw, fill } from './words';
import { sayCh, useChallengeWords } from './challengeWords';
import { WorldSheet } from './WorldSheet';
import { tapLight, tapSuccess } from '../../utils/feedback';
import { publicMedia } from '../../lib/publicMedia';

const KNOB = 46;
const PAD = 4;

/* ─── SLIDE, DON'T TAP ────────────────────────────────────────────────
   Saying "I'm in" with the thumb all the way across is a small promise,
   not a stray tap. Arabic slides right to left. A screen reader gets
   the same thing as one action. */
const SlideIn = ({ label, rtl, onDone }) => {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, w - KNOB - PAD * 2);
  const maxRef = useRef(0); maxRef.current = max;
  const dir = rtl ? -1 : 1;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => tapLight(),
    onPanResponderMove: (_, g) => x.setValue(Math.min(maxRef.current, Math.max(0, g.dx * dir))),
    onPanResponderRelease: (_, g) => {
      const v = Math.min(maxRef.current, Math.max(0, g.dx * dir));
      if (maxRef.current && v > maxRef.current * 0.85) {
        Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start(() => {
          tapSuccess(); onDone();
          setTimeout(() => x.setValue(0), 400);
        });
      } else Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start();
    },
  })).current;
  const textFade = x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible accessibilityRole="button" accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={() => onDone()}
      style={{ direction: 'ltr', height: KNOB + PAD * 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', marginTop: 14, overflow: 'hidden', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } : null) }}
    >
      <Animated.Text numberOfLines={1} style={{ opacity: textFade, color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center', paddingHorizontal: KNOB + PAD * 2 }}>{label}</Animated.Text>
      <Animated.View {...pan.panHandlers} style={{ position: 'absolute', top: PAD, [rtl ? 'right' : 'left']: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: Animated.multiply(x, dir) }], cursor: 'grab' }}>
        <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={20} color="#141414" />
      </Animated.View>
    </View>
  );
};

/* ─── TONIGHT'S SKY, IN THE FEED ──────────────────────────────────────
   One quiet card under the plans: the day's golden-hour strip and how
   many places it has reached so far — real photos, real count, and an
   honest "be the first" while it is empty. Slide to join; once your
   photo is in, the card just says so. */
// welcome-sunset.jpg is 522×900; its horizon is 42% down
const SUN_RATIO = 900 / 522;
const SUN_HORIZON = 0.42;
const H = 244;
// a breath of shadow under the words, so they read on a bright sky
const SOFT = { textShadowColor: 'rgba(0,0,0,0.28)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } };

export const WorldCard = ({ userId, lang, city }) => {
  useChallengeWords(lang);
  const [b, setB] = useState(null);
  const [open, setOpen] = useState(false);
  const T = (k) => gw(lang, k);
  const today = todayChallenge();
  useEffect(() => { worldBoard(today.key, 1).then((r) => r && r.ok && setB(r)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = !!(b && b.mine);
  const [w, setW] = useState(0);
  const shared = b && b.entries && b.entries[0] && b.entries[0].photo;
  return (
    <>
      {/* a real sky — the latest one somebody shared today, or ours —
          a quiet fade so the words read, one line, one action */}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 16, height: H, borderRadius: 24, overflow: 'hidden', backgroundColor: '#2A1E1A' }}>
        {shared ? (
          <Image source={{ uri: shared }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : w && today.img !== 'welcome-sunset.jpg' ? (
          <Image source={{ uri: publicMedia(today.img) }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : w ? (
          /* our own sunset: tall, so it is framed by hand — the sky fills
             the card and the horizon sits low, under the words */
          <Image source={{ uri: publicMedia('welcome-sunset.jpg') }} resizeMode="cover"
            style={{ position: 'absolute', left: 0, width: w, height: w * SUN_RATIO, top: -(w * SUN_RATIO * SUN_HORIZON - H * 0.56) }} />
        ) : null}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.6)']} locations={[0, 0.5, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 }}>
          <Pressable onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.6 }, SOFT]}>{(T('today_k') + ' · ' + kindLabel(lang, today.c)).toUpperCase()}</Text>
              <Text style={[{ color: '#FFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 }, SOFT]}>{mine ? T('slid_d') : sayCh(lang, today)}</Text>
              <Text style={[{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5, fontWeight: '500', marginTop: 3 }, SOFT]} numberOfLines={1}>
                {b && b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : sayCh(lang, { en: today.s_en, ar: today.s_ar })}
              </Text>
            </View>
            {mine ? <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={22} color="#FFF" /> : null}
          </Pressable>
          {!mine ? <SlideIn label={T('slide')} rtl={lang === 'ar'} onDone={() => setOpen(true)} /> : null}
        </LinearGradient>
      </View>
      {open ? <WorldSheet userId={userId} lang={lang} city={city} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
