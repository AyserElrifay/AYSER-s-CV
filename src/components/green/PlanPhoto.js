import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { lookOf } from '../../lib/activityPins';
import { tapLight } from '../../utils/feedback';
import { placePhoto } from '../../lib/commonsPhoto';
import { publicMedia } from '../../lib/publicMedia';
import { getPrefs } from '../../services/prefs';
import { isSaving } from '../../lib/dataSaver';

/* activities Ayser sent real free photos and clips for (Pexels,
   credited): the activity, never "this plan". A clip carries its own
   still (same name, .jpg), shown first and on data saver. A few are
   Ayser's own (padel-ayser-*, by Shahd Elzayaat) and carry her name; `own` ones (ours, blurred) carry no badge. */
const n = (pre, k, credit) => Array.from({ length: k }, (_, i) => ({ img: pre + (i + 1) + '.jpg', credit }));
const clip = (pre, k) => Array.from({ length: k }, (_, i) => ({ img: pre + (i + 1) + '.jpg', clip: pre + (i + 1) + '.mp4' }));
const STOCK = [
  { re: /volunteer|charity|donat|food bank|تطوع|متطوع|خيري|تبرع/i, files: n('act-volunteer-', 3) },
  { re: /\bmatch|watch party|ماتش|مباراة|نشجع|تشجيع|\bcheer|📺/i, files: clip('act-match-v', 1).map((x) => ({ ...x, own: true })) },
  { re: /climb|zip ?line|abseil|rappel|تسلق|زيب|🧗/i, files: n('act-climb-', 1).map((x) => ({ ...x, own: true })) },
  { re: /foot|soccer|كور|⚽/i, files: n('sport-football-', 5) },
  { re: /sketch|draw|رسم|اسكتش|✏️|🎨|\bart\b/i, files: n('art-sketch-', 5) },
  { re: /padel|بادل|tennis|تنس|🎾/i, files: n('act-padel-', 4).concat(clip('act-padel-v', 5), n('padel-ayser-', 4, 'Shahd Elzayaat')) },
  { re: /walk|hike|hiking|trail|stroll|مشي|تمشي|مشوار|🥾|🚶/i, files: n('act-walk-', 5).concat(clip('act-walk-v', 1)) },
  { re: /swim|pool|سباح|حمام سباحة|🏊/i, files: n('act-swim-', 2) },
  { re: /beach|\bsea\b|seaside|شاطئ|بحر|🏖|🌊/i, files: n('act-beach-', 1).concat(clip('act-beach-v', 2)) },
  { re: /\bread|\bbook|library|كتاب|قراء|مكتب[ةه]|📚|📖|\bfocus\b/i, files: n('act-read-', 6) },
  { re: /coffee|caf[eé]|espresso|latte|قهو|كافيه|☕/i, files: n('act-coffee-', 3).concat(clip('act-coffee-v', 2)) },
];
const stockOf = (g) => {
  const s = String((g && g.title) || '') + ' ' + String((g && g.kind) || '');
  const hit = STOCK.find((x) => x.re.test(s));
  if (!hit) return null;
  return hit.files[String((g && g.id) || '').split('').reduce((m, c) => m + c.charCodeAt(0), 0) % hit.files.length];
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
  /* a football, sketching, padel, walk, swimming, beach, reading or coffee plan with
     no photo of its own: a real photo of the activity (Pexels, credited) — the game, not this game */
  const ball = !url ? stockOf(g) : null;
  if (ball) {
    return (
      <View>
        <View style={{ height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi, marginBottom: 11 }}>
          {ball.clip && Platform.OS === 'web' && !isSaving((getPrefs() || {}).dataSaver) ? (
            <video src={publicMedia(ball.clip)} poster={publicMedia(ball.img)} autoPlay muted loop playsInline preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <Image source={{ uri: publicMedia(ball.img) }} style={{ width: '100%', height: 150 }} accessibilityIgnoresInvertColors />
          )}
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 16 }}>{look.emoji}</Text>
          </View>
          {ball.own ? null : (
            <View style={{ position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={{ color: '#FFF', fontSize: 9.5 }}>{ball.credit ? '📷 ' + ball.credit : '📷 Pexels'}</Text>
          </View>
          )}
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
