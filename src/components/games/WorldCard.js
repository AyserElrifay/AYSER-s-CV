import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, PanResponder } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { worldBoard, skyKey } from '../../services/squadGames';
import { gw, fill } from './words';
import { WorldSheet } from './WorldSheet';
import { tapLight, tapSuccess } from '../../utils/feedback';

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
      style={{ direction: 'ltr', height: KNOB + PAD * 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', marginTop: 16, overflow: 'hidden' }}
    >
      <Animated.Text numberOfLines={1} style={{ opacity: textFade, color: '#FFF', fontSize: 14, fontWeight: '800', textAlign: 'center', paddingHorizontal: KNOB + PAD * 2 }}>{label}</Animated.Text>
      <Animated.View {...pan.panHandlers} style={{ position: 'absolute', top: PAD, [rtl ? 'right' : 'left']: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: Animated.multiply(x, dir) }], cursor: 'grab' }}>
        <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={22} color="#E8590C" />
      </Animated.View>
    </View>
  );
};

/* ─── TONIGHT'S SKY, IN THE FEED ──────────────────────────────────────
   One quiet card under the plans: the day's golden-hour strip and how
   many places it has reached so far — real photos, real count, and an
   honest "be the first" while it is empty. Slide to join; once your
   photo is in, the card just says so. */
export const WorldCard = ({ userId, lang, city }) => {
  const [b, setB] = useState(null);
  const [open, setOpen] = useState(false);
  const T = (k) => gw(lang, k);
  useEffect(() => { worldBoard(skyKey(), 1).then((r) => r && r.ok && setB(r)); }, [open]);
  const mine = !!(b && b.mine);
  return (
    <>
      {/* one sunset, one line, one action */}
      <LinearGradient colors={['#FF9A3C', '#F0506E', '#8B3FD9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginTop: 16, borderRadius: 24, padding: 18 }}>
        <Pressable onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>{mine ? T('slid') : T('world_card')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '600', marginTop: 3 }} numberOfLines={1}>
              {b && b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : T('world_card_s')}
            </Text>
          </View>
          {mine ? <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={22} color="#FFF" /> : null}
        </Pressable>
        {!mine ? <SlideIn label={T('slide')} rtl={lang === 'ar'} onDone={() => setOpen(true)} /> : null}
      </LinearGradient>
      {open ? <WorldSheet userId={userId} lang={lang} city={city} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
