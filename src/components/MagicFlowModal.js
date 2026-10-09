import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, Image, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { kmBetween } from '../utils/geo';
import { getCurrentCoords } from '../utils/location';
import { showOnMap } from '../lib/mapBus';
import { useLang } from '../context/LanguageContext';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight } from '../utils/feedback';

/* ──────────────── JOINING A MOMENT ──────────────────────────────────
   This used to be "Magic Flow": an estimated arrival worked out from a
   made-up starting point, "light traffic" whatever the traffic, three
   rides with invented prices from a company that does not exist, and a
   "squad chat" that was never created. Every number on it was fake.

   What is left is what is true: what the moment is, where and when it
   is, how far it is from you — only if your phone has already told us
   where you are; we do not ask just for this — and three things you can
   really do: say you are going, see it on the map, or get directions
   from the maps app you already use. */

/* the distance only when location is already allowed — joining
   something is not a reason to pop a permission prompt */
async function coordsIfAllowed() {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.permissions) return null;
      const st = await navigator.permissions.query({ name: 'geolocation' });
      return st.state === 'granted' ? await getCurrentCoords() : null;
    }
    return await getCurrentCoords();
  } catch (e) { return null; }
}

const directionsUrl = (c) => 'https://www.google.com/maps/dir/?api=1&destination=' + c.latitude + ',' + c.longitude;

export const MagicFlowModal = ({ post, onClose, onComplete }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [km, setKm] = useState(null);

  useEffect(() => {
    setKm(null);
    if (!post || !post.coords) return;
    let live = true;
    coordsIfAllowed().then((me) => { if (live && me) setKm(kmBetween(me, post.coords)); });
    return () => { live = false; };
  }, [post && post.id]);

  if (!post) return null;
  const where = post.place || null;
  const still = post.thumb || (post.type !== 'reel' && post.type !== 'vod' ? post.media : null);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: insets.bottom + 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', flex: 1 }}>{t('join_title')}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={19} color={C.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {still ? (
              <Image source={{ uri: still }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.glassHi }} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles" size={26} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{post.caption || (post.user && post.user.name) || ''}</Text>
              <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }} numberOfLines={1}>
                {[post.user && post.user.name, post.startsIn].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          <View style={{ backgroundColor: C.glassHi, borderRadius: 16, padding: 14, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location" size={16} color={C.purple} />
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginStart: 6, flex: 1 }} numberOfLines={1}>
                {where || (post.coords ? t('join_pinned') : t('join_no_place'))}
              </Text>
            </View>
            {km != null ? (
              <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>
                {t('join_km_away').replace('{n}', km < 10 ? km.toFixed(1) : String(Math.round(km)))}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => { tapLight(); onComplete(post.id); }}
            accessibilityRole="button"
            style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 16 }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{t('join_going')}</Text>
          </Pressable>

          {post.coords ? (
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Pressable
                onPress={() => { tapLight(); onClose(); showOnMap({ lat: post.coords.latitude, lng: post.coords.longitude, postId: post.id }); }}
                accessibilityRole="button"
                style={{ flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.line, flexDirection: 'row', justifyContent: 'center', marginEnd: 8 }}
              >
                <Ionicons name="map-outline" size={16} color={C.text} />
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginStart: 6 }}>{t('show_on_map')}</Text>
              </Pressable>
              <Pressable
                onPress={() => { tapLight(); Linking.openURL(directionsUrl(post.coords)).catch(() => {}); }}
                accessibilityRole="link"
                style={{ flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.line, flexDirection: 'row', justifyContent: 'center' }}
              >
                <Ionicons name="navigate-outline" size={16} color={C.text} />
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginStart: 6 }}>{t('join_directions')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 12 }}>{t('join_private')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
