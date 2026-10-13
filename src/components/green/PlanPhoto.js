import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { lookOf } from '../../lib/activityPins';
import { tapLight } from '../../utils/feedback';
import { placePhoto } from '../../lib/commonsPhoto';
import { publicMedia } from '../../lib/publicMedia';

/* activities Ayser sent real free photos for (Pexels, credited):
   the activity, never "this plan" */
const STOCK = [
  { re: /foot|soccer|كور|⚽/i, files: [1, 2, 3, 4, 5].map((n) => 'sport-football-' + n + '.jpg') },
  { re: /sketch|draw|رسم|اسكتش|✏️|🎨|^art$|\bart\b/i, files: [1, 2, 3, 4, 5].map((n) => 'art-sketch-' + n + '.jpg') },
];
const stockOf = (g) => {
  const s = String((g && g.title) || '') + ' ' + String((g && g.kind) || '');
  const hit = STOCK.find((x) => x.re.test(s));
  if (!hit) return null;
  return hit.files[String((g && g.id) || '').split('').reduce((n, c) => n + c.charCodeAt(0), 0) % hit.files.length];
};

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
    if (own || !name) return undefined;
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
      {'📷 ' + (p.title || (t ? t('pl_place_photo') : 'Photo of the place')) + ' · ' + (p.artist ? p.artist + ' · ' : '') + p.license + ' · Wikimedia Commons'}
    </Text>
  );
};

/* ─── THE TOP OF A PLAN: ITS PLACE, BIG ───────────────────────────────
   Ayser: "عايز الخانات دي يبقى فيها صور للأماكن". A 58-pixel square
   does not make anybody want to go anywhere. With a real photo — the
   host's, last week's, or the place's own from Commons — the card
   opens on it, full width; without one it keeps the drawn tile beside
   the title, exactly as before. A Commons photo carries its credit on
   the picture itself, which its licence asks for. */
export const PlanHead = ({ g, children }) => {
  const place = usePlacePhoto(g);
  const own = planPhotoOf(g);
  const url = own || (place && safe(place.url));
  const look = lookOf(g && g.kind);
  /* a football or sketching plan with no photo of its own: a real photo
     of the activity (Pexels, credited) — the game, not this game */
  const ball = !url ? stockOf(g) : null;
  if (ball) {
    return (
      <View>
        <View style={{ height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi, marginBottom: 11 }}>
          <Image source={{ uri: publicMedia(ball) }} style={{ width: '100%', height: 150 }} accessibilityIgnoresInvertColors />
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 16 }}>{look.emoji}</Text>
          </View>
          <View style={{ position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={{ color: '#FFF', fontSize: 9.5 }}>📷 Pexels</Text>
          </View>
        </View>
        {children}
      </View>
    );
  }
  if (!url) {
    /* no real photo of this place: a bright cover in the activity's own
       colours rather than a stranger's stock picture passed off as this
       plan, or a wrong photo of somewhere else */
    return (
      <View>
        <LinearGradient colors={[look.from, look.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ height: 120, borderRadius: 16, marginBottom: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Text style={{ fontSize: 120, position: 'absolute', right: -14, bottom: -34, opacity: 0.22 }}>{look.emoji}</Text>
          <Text style={{ fontSize: 50 }}>{look.emoji}</Text>
        </LinearGradient>
        {children}
      </View>
    );
  }
  return (
    <View>
      <View style={{ height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi, marginBottom: 11 }}>
        <Image source={{ uri: url }} style={{ width: '100%', height: 150 }} accessibilityLabel={(place && place.title) || (g && g.place_name) || ''} />
        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 16 }}>{look.emoji}</Text>
        </View>
        {!own && place ? (
          <View style={{ position: 'absolute', right: 6, bottom: 6, maxWidth: '80%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={{ color: '#FFF', fontSize: 9.5 }} numberOfLines={1}>{'📷 ' + place.title + (place.artist ? ' · ' + place.artist : '') + ' · ' + place.license}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
};
