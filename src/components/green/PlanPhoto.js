import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { lookOf } from '../../lib/activityPins';
import { tapLight } from '../../utils/feedback';
import { placePhoto } from '../../lib/commonsPhoto';

/* ─── A PLAN'S PICTURE: REAL, OR ITS DRAWN LOOK ───────────────────────
   Ayser: photos or emoji? Real photos where there are real ones — the
   host's own, or the first photo people really posted from that spot
   or from last week's edition (green_past_photos in RUN_ME.sql). No
   stock picture of "a walk" pretending to be this one. With none, the
   plan keeps the colour and emoji it always had: honest, and ours.

   Only https addresses are drawn; nothing else ever reaches an <img>. */

const safe = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);

export const planPhotoOf = (g) => safe(g && g.photo_url) || safe(g && g.weekly_photo) || safe(g && Array.isArray(g.past_photos) ? g.past_photos[0] : null);

/* With no photo of the plan itself: a photo of the PLACE, if a freely
   licensed one of that very place exists on Wikimedia Commons — found
   and credited by src/lib/commonsPhoto.js, kept on the phone a month.
   "Cairo Opera House" finds the Opera House; a park with no article
   finds nothing and keeps its emoji. Never somebody's photo off Google
   or Instagram: those belong to the people who took them. */
export const usePlacePhoto = (g) => {
  const own = planPhotoOf(g);
  const name = g && g.place_name;
  const [p, setP] = useState(null);
  useEffect(() => {
    let alive = true;
    setP(null);
    if (own || !name || g.lat == null || g.lng == null) return undefined;
    placePhoto({ name, lat: g.lat, lng: g.lng }).then((r) => { if (alive) setP(r); }).catch(() => {});
    return () => { alive = false; };
  }, [own, name, g && g.lat, g && g.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return own ? null : p;
};

export const PlanThumb = ({ g, size = 58, radius = 18, tilt = false }) => {
  const place = usePlacePhoto(g);
  const url = planPhotoOf(g) || (place && safe(place.url));
  const look = lookOf(g && g.kind);
  if (url) {
    return (
      <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: C.glassHi, transform: tilt ? [{ rotate: '-4deg' }] : undefined }}>
        <Image source={{ uri: url }} style={{ width: size, height: size }} />
        {/* the kind still shows, small, in its corner */}
        <View style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 3 }}>
          <Text style={{ fontSize: Math.round(size * 0.22) }}>{look.emoji}</Text>
        </View>
      </View>
    );
  }
  return (
    <LinearGradient colors={[look.from, look.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', transform: tilt ? [{ rotate: '-4deg' }] : undefined }}>
      <Text style={{ fontSize: Math.round(size * 0.48) }}>{look.emoji}</Text>
    </LinearGradient>
  );
};

/* "From last time" — the photos people really took there. A long press
   reports one (see TogetherScreen / GreenSheet). */
export const PastPhotos = ({ g, t, onReport }) => {
  const list = (Array.isArray(g && g.past_photos) ? g.past_photos : []).map(safe).filter(Boolean);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>{t('pl_last_time').toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {list.map((u) => (
          <Pressable key={u} onLongPress={() => { tapLight(); onReport && onReport(u); }} delayLongPress={450} accessibilityRole="image" accessibilityLabel={t('pl_last_time')}
            style={{ marginEnd: 8 }}>
            <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: C.glassHi }} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

/* the credit a Commons photo asks for, shown where the plan is opened */
export const PlaceCredit = ({ g, t }) => {
  const p = usePlacePhoto(g);
  if (!p) return null;
  return (
    <Text style={{ color: C.faint, fontSize: 11, marginTop: 8 }} numberOfLines={2}>
      {'📷 ' + (t ? t('pl_place_photo') : 'Photo of the place') + ' · ' + (p.artist ? p.artist + ' · ' : '') + p.license + ' · Wikimedia Commons'}
    </Text>
  );
};
