import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Linking } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { placePhoto } from '../lib/commonsPhoto';

/* ─── THE PHOTO AT THE TOP OF A PLACE ─────────────────────────────────
   Only when a freely licensed photo of THAT place exists on Wikimedia
   Commons (src/lib/commonsPhoto.js), and always with who took it and
   the licence, linked to the file's own page. Otherwise nothing at all
   — the sheet looks as it did, with its emoji. */

export const PlacePhoto = ({ place, height = 180 }) => {
  const { t } = useLang();
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (place) placePhoto({ name: place.name, lat: place.lat, lng: place.lng }).then((p) => { if (alive) setPhoto(p); }).catch(() => {});
    return () => { alive = false; };
  }, [place && place.name, place && place.lat, place && place.lng]);
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
