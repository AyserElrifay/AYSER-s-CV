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
  const list = [place.wide || place.photo].concat(place.photos.filter((x) => x !== place.photo));
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

/* the credits for the copied Commons photos, fetched once when a place
   with one is first opened (kept out of the first download) */
let creditsP = null;
const credits = () => (creditsP = creditsP || fetch(publicMedia('places/credits.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
/* Ayser, November 2026: the credit no longer sits as a line under every
   photo — a small (i) on the photo shows it when tapped. The photographer
   and the licence stay one tap away, as the licence asks. */
const CreditDot = ({ text, url }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', maxWidth: '90%' }}>
      {open ? (
        <Pressable onPress={() => { try { Linking.openURL(url); } catch (e) {} }} accessibilityRole="link" style={{ borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, marginEnd: 6, flexShrink: 1 }}>
          <Text style={{ color: '#FFF', fontSize: 10.5 }} numberOfLines={2}>{text}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel="photo credit" hitSlop={8}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>i</Text>
        </View>
      </Pressable>
    </View>
  );
};

const CommonsCredit = ({ id, t }) => {
  const [c, setC] = useState(null);
  useEffect(() => { let alive = true; credits().then((all) => { if (alive) setC(all[id] || null); }); return () => { alive = false; }; }, [id]);
  if (!c) return null;
  return <CreditDot url={c.p} text={t('photo_credit').replace('{who}', c.a || t('photo_someone')).replace('{license}', c.l)} />;
};

export const PlacePhoto = ({ place, height = 180 }) => {
  const { t } = useLang();
  const [photo, setPhoto] = useState(null);
  const own = place && place.photo ? publicMedia(place.photo) : null;
  useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (place && !own) placePhoto({ name: place.name, lat: place.lat, lng: place.lng, area: place.area }).then((p) => { if (alive) setPhoto(p); }).catch(() => {});
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
        {/* a Commons photo copied for this place: who took it, and the licence */}
        {place.commons ? <CommonsCredit id={place.id} t={t} /> : null}
        {/* a free-licence photo says where it came from */}
        {place.credit ? <Text style={{ color: C.faint, fontSize: 8, opacity: 0.6, marginTop: 4 }} numberOfLines={1}>{t('photo_from').replace('{who}', place.credit)}</Text> : null}
      </View>
    );
  }
  if (!photo || !/^https:\/\//.test(photo.url)) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Image source={{ uri: photo.url }} accessibilityLabel={photo.title} style={{ width: '100%', height, borderRadius: 16, backgroundColor: C.glassHi }} />
      <CreditDot url={photo.page} text={t('photo_credit').replace('{who}', photo.artist || t('photo_someone')).replace('{license}', photo.license)} />
    </View>
  );
};
