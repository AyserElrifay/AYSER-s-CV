import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';

/* ─── "+15m ADDED TO YOUR MOMENTS FEED" ───────────────────────────────
   Ayser, October 2026 ("Earn your time"): the moment you tick a thing
   off My day or scan the QR at a real table, say so — wherever you are
   in the app, not only on Home. src/lib/feedGate.js sends the event. */

const W = {
  en: { todo: 'Task completed! +{m}m added to your Moments Feed', checkin: 'Checked in! +{m}m added to your Moments Feed', any: '+{m}m added to your Moments Feed' },
  ar: { todo: 'خلّصت مهمة! اتضافلك {m} دقيقة في الفيد', checkin: 'سجّلت حضورك! اتضافلك {m} دقيقة في الفيد', any: 'اتضافلك {m} دقيقة في الفيد' },
};

export const BonusToast = () => {
  const { lang } = useLang();
  const [msg, setMsg] = useState(null);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let t = null;
    const on = (e) => {
      const d = (e && e.detail) || {};
      const w = W[lang === 'ar' ? 'ar' : 'en'];
      setMsg((w[d.key] || w.any).replace('{m}', String(d.minutes || 0)));
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      clearTimeout(t);
      t = setTimeout(() => Animated.timing(a, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setMsg(null)), 2800);
    };
    try { window.addEventListener('mm-feed-bonus', on); } catch (e) {}
    return () => { clearTimeout(t); try { window.removeEventListener('mm-feed-bonus', on); } catch (e) {} };
  }, [lang, a]);
  if (!msg) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 20, right: 20, bottom: 110, alignItems: 'center', zIndex: 50, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111111', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, maxWidth: 440 }}>
        <Ionicons name="hourglass-outline" size={15} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700', marginStart: 8, flexShrink: 1 }}>{msg}</Text>
      </View>
    </Animated.View>
  );
};
