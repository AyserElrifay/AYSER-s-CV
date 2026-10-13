import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Linking, Platform, ScrollView } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { placePhoto } from '../lib/commonsPhoto';
import { publicMedia } from '../lib/publicMedia';
import { getPrefs } from '../services/prefs';
import { isSaving } from '../lib/dataSaver';

/* ─── THE PHOTO AT THE TOP OF A PLACE ─────────────────────────────────
   Only when a freely licensed photo of THAT place exists on Wikimedia
   Commons (src/lib/commonsPhoto.js), and always with who took it and
   the licence, linked to the file's own page. Otherwise nothing at all
   — the sheet looks as it did, with its emoji.
   A few places carry a photo Ayser sent himself (`photo` in
   src/constants/destinations.js); that one comes first, with no
   credit line because it is ours. Some carry a short silent clip of
   his instead (`video`, with `photo` as its still): it plays muted on a
   loop, and on data saver only the still shows. */

/* a place with several of our own photos (\`photos\`): swipe through them */
const Gallery = ({ place, height }) => {
  const [w, setW] = useState(0);
  const [at, setAt] = useState(0);
  const list = [place.photo].concat(place.photos.filter((x) => x !== place.photo));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%', height, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi }}>
      {w ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEventThrottle={64}
          onScroll={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / w); if (i !== at) setAt(i); }}>
          {list.map((f) => <Image key={f} source={{ uri: publicMedia(f) }} accessibilityLabel={place.name} style={{ width: w, height }} />)}
        </ScrollView>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
        {list.map((f, i) => <View key={f} style={{ width: i === at ? 14 : 6, height: 6, borderRadius: 3, marginHorizontal: 2, backgroundColor: i === at ? '#FFF' : 'rgba(255,255,255,0.55)' }} />)}
      </View>
    </View>
  );
};

export const PlacePhoto = ({ place, height = 180 }) => {
  const { t } = useLang();
  const [photo, setPhoto] = useState(null);
  const own = place && place.photo ? publicMedia(place.photo) : null;
  useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (place && !own) placePhoto({ name: place.name, lat: place.lat, lng: place.lng }).then((p) => { if (alive) setPhoto(p); }).catch(() => {});
    return () => { alive = false; };
  }, [place && place.name, place && place.lat, place && place.lng, own]);
  if (own) {
    const clip = place.video && Platform.OS === 'web' && !isSaving((getPrefs() || {}).dataSaver) ? publicMedia(place.video) : null;
    return (
      <View style={{ marginBottom: 12 }}>
        {clip ? (
          <View style={{ width: '100%', height, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi }}>
            <video src={clip} poster={own} autoPlay muted loop playsInline preload="metadata" aria-label={place.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </View>
        ) : (
          place.photos && place.photos.length ? <Gallery place={place} height={height} /> : (
            <Image source={{ uri: own }} accessibilityLabel={place.name} style={{ width: '100%', height, borderRadius: 16, backgroundColor: C.glassHi }} />
          )
        )}
        {/* a free-licence photo says where it came from */}
        {place.credit ? <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 5 }} numberOfLines={1}>{t('photo_from').replace('{who}', place.credit)}</Text> : null}
      </View>
    );
  }
  if (!photo || !/^https:\/\//.test(photo.url)) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Image source={{ uri: photo.url }} accessibilityLabel={photo.title} style={{ width: '100%', height, borderRadius: 16, backgroundColor: C.glassHi }} />
      <Pressable onPress={() => { try { Linking.openURL(photo.page); } catch (e) {} }} accessibilityRole="link" style={{ marginTop: 5 }}>
        <Text style={{ color: C.faint, fontSize: 10.5 }} numberOfLines={1}>
          {t('photo_credit').replace('{who}', photo.artist || t('photo_someone')).replace('{license}', photo.license)}
        </Text>
      </Pressable>
    </View>
  );
};
