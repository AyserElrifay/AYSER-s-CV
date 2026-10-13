import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { photoPlaces } from '../lib/placePoints';
import { publicMedia } from '../lib/publicMedia';
import { lastFix } from '../services/squadAdmin';
import { showOnMap } from '../lib/mapBus';
import { tapLight } from '../utils/feedback';

/* ─── PLACES WORTH GOING TO, IN REAL PHOTOS ──────────────────────────
   Ayser: "عايزينه ممتع، جذاب … بسيط وسلس ودايمًا سريع". One row on
   Home: the places that have a real photo (credited, Pexels or ours),
   nearest first. Tap one and its page opens on the map. The list is the
   small places.json the build writes, fetched after the feed is up, so
   Home is not a byte heavier; the pictures arrive as they scroll in. */
const Card = ({ p, onPress }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(press, { toValue: v, friction: 6, tension: 220, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={p.name} style={{ marginEnd: 10 }}>
      <Animated.View style={{ width: 138, height: 176, borderRadius: 20, overflow: 'hidden', backgroundColor: C.glassHi, transform: [{ scale: press }] }}>
        <Animated.Image source={{ uri: publicMedia(p.photo) }} onLoad={() => Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start()}
          style={{ position: 'absolute', width: 138, height: 176, opacity: fade }} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 }} />
        <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }} numberOfLines={2}>{p.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11.5, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
            {p.km != null && p.km < 300 ? (p.km < 1 ? Math.round(p.km * 1000) + ' m' : Math.round(p.km) + ' km') : p.area}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export const PlaceRail = () => {
  const { t } = useLang();
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    // after the feed has had its moment
    const id = setTimeout(() => { photoPlaces(lastFix(), 12).then((r) => { if (alive) setList(r); }).catch(() => {}); }, 900);
    return () => { alive = false; clearTimeout(id); };
  }, []);
  if (!list || !list.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 10 }}>{'📍 ' + t('pr_title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" decelerationRate="fast" snapToInterval={148}>
        {list.map((p) => <Card key={p.id} p={p} onPress={() => { tapLight(); showOnMap({ lat: p.lat, lng: p.lng, placeId: p.id }); }} />)}
      </ScrollView>
    </View>
  );
};
