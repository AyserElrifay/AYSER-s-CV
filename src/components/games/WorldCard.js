import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, PanResponder } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
  const fillW = x.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [KNOB + PAD * 2, Math.max(KNOB + PAD * 2, w)], extrapolate: 'clamp' });
  // no ring around the knob at rest: the track fills only once it moves
  const fillOn = x.interpolate({ inputRange: [0, 8], outputRange: [0, 1], extrapolate: 'clamp' });
  const textFade = x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible accessibilityRole="button" accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={() => onDone()}
      style={{ direction: 'ltr', height: KNOB + PAD * 2, borderRadius: 999, backgroundColor: C.glass, borderWidth: 1, borderColor: C.purple, justifyContent: 'center', marginTop: 12, overflow: 'hidden' }}
    >
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, [rtl ? 'right' : 'left']: 0, width: fillW, opacity: fillOn, borderRadius: 999, backgroundColor: C.purpleSoft }} />
      <Animated.Text numberOfLines={1} style={{ opacity: textFade, color: C.text, fontSize: 13.5, fontWeight: '900', textAlign: 'center', paddingHorizontal: KNOB + PAD * 2 }}>{label}</Animated.Text>
      <Animated.View {...pan.panHandlers} style={{ position: 'absolute', top: PAD, [rtl ? 'right' : 'left']: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: Animated.multiply(x, dir) }], cursor: 'grab' }}>
        <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={22} color="#FFF" />
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
      <View style={{ marginTop: 16, borderRadius: 20, padding: 14, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.line }}>
        <Pressable onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center', marginEnd: 12 }}>
            {mine ? <Ionicons name="checkmark" size={24} color={C.green} /> : <MaterialCommunityIcons name="weather-sunset" size={26} color={C.gold} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{mine ? T('slid') : T('world_card')}</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
              {b && b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : T('world_card_s')}
            </Text>
          </View>
          {mine ? <Text style={{ color: C.purple, fontSize: 18, fontWeight: '900' }}>{lang === 'ar' ? '←' : '→'}</Text> : null}
        </Pressable>
        {!mine ? <SlideIn label={T('slide')} rtl={lang === 'ar'} onDone={() => setOpen(true)} /> : null}
      </View>
      {open ? <WorldSheet userId={userId} lang={lang} city={city} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
