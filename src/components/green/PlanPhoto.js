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
import { useLang } from '../../context/LanguageContext';
import { RE_OF } from '../../lib/activityMatch';
import { loadMemberPhotos, memberPhotosFor, memberPhotosReady, onMemberPhotos } from '../../lib/memberPhotos';

/* activities Ayser sent real free photos and clips for (Pexels,
   credited): the activity, never "this plan". A clip carries its own
   still (same name, .jpg), shown first and on data saver. A few are
   Ayser's own (padel-ayser-*, by Shahd Elzayaat) and carry her name; `own` ones (ours, blurred) carry no badge. */
const n = (pre, k, credit) => Array.from({ length: k }, (_, i) => ({ img: pre + (i + 1) + '.jpg', credit }));
const clip = (pre, k) => Array.from({ length: k }, (_, i) => ({ img: pre + (i + 1) + '.jpg', clip: pre + (i + 1) + '.mp4' }));
/* what you DO comes first (a sunset walk is a walk); where it happens —
   the beach, a church, a rooftop — only when nothing else matched */
const STOCK = [
  /* Ayser asked for these two under volunteering; their pictures come
     when he sends them — until then they keep their drawn cover */
  { id: 'animals', re: RE_OF.animals, files: [] },
  { id: 'cleanup', re: RE_OF.cleanup, files: [] },
  { id: 'school', re: RE_OF.school, files: [{ img: 'act-talk-2.jpg' }, { img: 'act-talk-1.jpg' }, { img: 'act-kids-2.jpg' }] },
  { id: 'kids', re: RE_OF.kids, files: [{ img: 'reel-kids.jpg', clip: 'reel-kids.mp4' }].concat(clip('act-kids-v', 1).concat([{ img: 'sport-football-1.jpg' }], [1, 2, 3, 4, 5].map((k) => ({ img: 'act-kids-' + k + (k === 1 || k === 3 ? 'w' : '') + '.jpg' })))) },
  { id: 'volunteer', re: RE_OF.volunteer, files: [{ img: 'reel-volunteer.jpg', clip: 'reel-volunteer.mp4' }].concat(n('act-volunteer-', 3).concat([{ img: 'sport-football-1.jpg' }], [1, 2, 3, 4, 5].map((k) => ({ img: 'act-kids-' + k + (k === 1 || k === 3 ? 'w' : '') + '.jpg' })))) },
  { id: 'talk', re: RE_OF.talk, files: [{ img: 'reel-talk.jpg', clip: 'reel-talk.mp4' }].concat(n('act-talk-', 6)) },
  { id: 'music', re: RE_OF.music, files: [{ img: 'reel-music.jpg', clip: 'reel-music.mp4', own: true }].concat(clip('act-music-v', 1).map((x) => ({ ...x, own: true }))) },
  { id: 'match', re: RE_OF.match, files: [{ img: 'reel-match.jpg', clip: 'reel-match.mp4', own: true }].concat(clip('act-match-v', 1).map((x) => ({ ...x, own: true }))) },
  { id: 'climb', re: RE_OF.climb, files: [
    { img: 'reel-climb.jpg', clip: 'reel-climb.mp4' },
    { img: 'act-climb-1.jpg' }, { img: 'mario-crew-w.jpg' }, { img: 'mario-ferrata-w.jpg' }, { img: 'mario-mirror-w.jpg' },
    { img: 'mario-ropes-w.jpg' },
  ].map((x) => ({ ...x, own: true })) },
  { id: 'padel', re: RE_OF.padel, files: [{ img: 'reel-padel.jpg', clip: 'reel-padel.mp4', credit: 'Shahd Elzayaat · Pexels', who: 'men' }].concat(n('act-padel-', 4).map((x, i) => (i === 1 ? x : { ...x, who: 'women' })).concat(clip('act-padel-v', 3), [1, 2, 3, 4].map((k) => ({ img: 'padel-ayser-' + k + (k === 1 || k === 3 ? 'w' : '') + '.jpg', credit: 'Shahd Elzayaat', who: 'men' })))) },
  /* `who` marks a picture of only women or only men, so a girls-only or
     guys-only plan never opens on the other */
  { id: 'football', re: RE_OF.football, files: [{ img: 'reel-football.jpg', clip: 'reel-football.mp4', credit: 'Moments · Pexels', who: 'men' }].concat([1, 2, 3].map((k) => ({ img: 'football-crew-' + k + '.jpg', own: true, who: 'men' })), [5, 4].map((k) => ({ img: 'sport-football-' + k + '.jpg', who: 'women' })), [2, 3].map((k) => ({ img: 'sport-football-' + k + '.jpg', who: 'men' }))) },
  { id: 'crochet', re: RE_OF.crochet, files: [{ img: 'reel-crochet.jpg', clip: 'reel-crochet.mp4' }].concat(clip('act-crochet-v', 4).concat(n('act-crochet-', 3))) },
  { id: 'sketch', re: RE_OF.sketch, files: [{ img: 'reel-sketch.jpg', clip: 'reel-sketch.mp4' }].concat(n('art-sketch-', 5)) },
  { id: 'walk', re: RE_OF.walk, files: [{ img: 'reel-walk.jpg', clip: 'reel-walk.mp4' }].concat(n('act-walk-', 5).concat(clip('act-walk-v', 1))) },
  { id: 'swim', re: RE_OF.swim, files: [{ img: 'reel-swim.jpg', clip: 'reel-swim.mp4' }].concat(n('act-swim-', 2)) },
  { id: 'read', re: RE_OF.read, files: [{ img: 'reel-read.jpg', clip: 'reel-read.mp4' }].concat(n('act-read-', 6)) },
  { id: 'coffee', re: RE_OF.coffee, files: [{ img: 'reel-coffee.jpg', clip: 'reel-coffee.mp4' }].concat(n('act-coffee-', 3).concat(clip('act-coffee-v', 2))) },
  { id: 'movie', re: RE_OF.movie, files: [{ img: 'reel-movie.jpg', clip: 'reel-movie.mp4' }].concat(clip('act-movie-v', 1).map((x) => ({ ...x, own: true }))) },
  { id: 'beach', re: RE_OF.beach, files: [{ img: 'reel-beach.jpg', clip: 'reel-beach.mp4' }].concat(n('act-beach-', 1).concat(clip('act-beach-v', 2))) },
  { id: 'church', re: RE_OF.church, files: [{ img: 'cave-church-2.jpg' }, { img: 'cave-church-silhouette.jpg' }].map((x) => ({ ...x, own: true })) },
  { id: 'rooftop', re: RE_OF.rooftop, files: [{ img: 'rooftop-giza.jpg', own: true }] },
];
/* each plan gets its own run of pictures: the first football plan on the
   list starts on photo 1, the next on photo 4, and so on — so two plans
   side by side never open on the same one */
const order = new Map();
const stockOf = (g) => {
  const s = String((g && g.title) || '') + ' ' + String((g && g.kind) || '');
  const hit = STOCK.find((x) => (x.files.length || memberPhotosFor(x.id).length) && x.re.test(s));
  if (!hit) return null;
  if (!order.has(hit.id)) order.set(hit.id, new Map());
  const seen = order.get(hit.id);
  const key = String((g && g.id) || s);
  if (!seen.has(key)) seen.set(key, seen.size);
  /* the activity's short reel opens the first plan of its kind; the
     plans after it open on stills, so the same clip is never shown twice
     on one screen */
  const aud = g && g.audience;
  const fit = hit.files.filter((f) => !f.who || !aud || aud === 'all' || (aud === 'women' ? f.who === 'women' : f.who === 'men'));
  const files = fit.length ? fit : hit.files.filter((f) => !f.who);
  /* members' own photos of this activity come first after the reel —
     not on a ladies-only plan, whose pictures stay ladies' */
  const members = aud === 'women' ? [] : memberPhotosFor(hit.id);
  if (!files.length && !members.length) return null;
  const reel = files.length && /^reel-/.test(files[0].img) ? files[0] : null;
  const rest = reel ? files.slice(1) : files;
  const n = seen.get(key);
  const len = rest.length;
  /* a member's real photo opens the card; the reel follows it */
  const pics = members.slice();
  if (reel && n === 0) pics.push(reel);
  if (len) {
    const start = (n * Math.max(1, Math.min(3, len - 1))) % len;
    const want = pics.length + Math.min(3, len);
    for (let i = 0; pics.length < want; i++) pics.push(rest[(start + i) % len]);
  }
  if (!pics.length) return reel ? { id: hit.id, pics: [reel] } : null;
  return { id: hit.id, pics };
};

/* the activity's pictures, swiped like a little album, with one line
   that makes you want to come. Only the first may move; the rest are
   stills, so a list of plans stays light. */
const StockHead = ({ stock, look, t, children }) => {
  const [w, setW] = useState(0);
  const [at, setAt] = useState(0);
  const moving = Platform.OS === 'web' && !isSaving((getPrefs() || {}).dataSaver);
  const cur = stock.pics[at] || stock.pics[0];
  return (
    <View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 170, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi, marginBottom: 11 }}>
        {w ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            onScroll={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / w); if (i !== at) setAt(i); }} scrollEventThrottle={64}>
            {stock.pics.map((p, i) => (
              <View key={p.img} style={{ width: w, height: 170 }}>
                {/* a member's own photo is a full address; ours are in public/media */}
                {p.clip && moving && i === stock.pics.findIndex((x) => x.clip) && i <= 1 ? (
                  <video src={publicMedia(p.clip)} poster={publicMedia(p.img)} autoPlay muted loop playsInline preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Image source={{ uri: p.url || publicMedia(p.img) }} style={{ width: w, height: 170 }} accessibilityIgnoresInvertColors />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 16 }}>{look.emoji}</Text>
        </View>
        {cur.own ? null : cur.member ? (
          <View pointerEvents="none" style={{ position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>{cur.credit}</Text>
          </View>
        ) : (
          <Text pointerEvents="none" style={{ position: 'absolute', right: 8, top: 6, color: 'rgba(255,255,255,0.55)', fontSize: 8, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 }}>{cur.credit || 'Pexels'}</Text>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 9, flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ flex: 1, color: '#FFF', fontSize: 13.5, fontWeight: '800', lineHeight: 18 }} numberOfLines={2}>{t('sk_' + stock.id)}</Text>
          {stock.pics.length > 1 ? (
            <View style={{ flexDirection: 'row', marginStart: 8, marginBottom: 4 }}>
              {stock.pics.map((p, i) => <View key={p.img} style={{ width: i === at ? 14 : 6, height: 6, borderRadius: 3, marginStart: 4, backgroundColor: i === at ? '#FFF' : 'rgba(255,255,255,0.5)' }} />)}
            </View>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
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
  const { t } = useLang();
  /* members' photos arrive a moment after the list; the card redraws once */
  const [, setMp] = useState(memberPhotosReady());
  useEffect(() => { loadMemberPhotos(); return onMemberPhotos(() => setMp(true)); }, []);
  const place = usePlacePhoto(g);
  const own = planPhotoOf(g);
  const url = own || (place && safe(place.url));
  const look = lookOf(g && g.kind);
  /* a football, sketching, padel, walk, swimming, beach, reading or coffee plan with
     no photo of its own: a real photo of the activity (Pexels, credited) — the game, not this game */
  const stock = !url ? stockOf(g) : null;
  /* keyed by its pictures: when members' photos arrive the album starts
     again on the first one, instead of the browser holding the old one in view */
  if (stock) return <StockHead key={stock.pics.map((p) => p.img).join('|')} stock={stock} look={look} t={t}>{children}</StockHead>;
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
