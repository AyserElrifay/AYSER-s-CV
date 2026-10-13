import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, FlatList, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { placePhoto } from '../lib/commonsPhoto';
import { publicMedia } from '../lib/publicMedia';
import { lastFix } from '../services/squadAdmin';
import { tapLight, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { openPartner } from '../lib/partnerLink';

/* ─── PLACES, AS BIG AS THEIR PHOTOS ───────────────────────────────────
   Ayser: "طريقه عرض hype احسن". A list where every place is a full-width
   photo: what kind of place it is in a chip on the top left, how far it
   is on the top right, its name large over the bottom of the picture.
   Nearest first, from where you last really were.

   The photo is, in order: one Ayser took himself; a freely licensed one
   of that very place on Wikimedia Commons, with its credit on the card;
   or a colour and the place's emoji. Never a photo copied off a café's
   page or a map listing — those belong to whoever took them. */

const km = (a, b) => {
  const R = 6371; const r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const far = (d) => (d == null ? null : d < 1 ? Math.round(d * 1000) + ' m' : d < 100 ? d.toFixed(d < 10 ? 1 : 0) + ' km' : Math.round(d) + ' km');
const TINTS = [['#0EA5E9', '#7C3AED'], ['#F59E0B', '#EF4444'], ['#10B981', '#0EA5E9'], ['#EC4899', '#F59E0B'], ['#6366F1', '#14B8A6']];
const tintOf = (id) => TINTS[String(id).split('').reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];

const CardPhoto = ({ place, h }) => {
  const own = place.photo ? publicMedia(place.photo) : null;
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (own) return undefined;
    let alive = true;
    placePhoto({ name: place.name, lat: place.lat, lng: place.lng }).then((p) => { if (alive && p && /^https:\/\//.test(p.url)) setPhoto(p); }).catch(() => {});
    return () => { alive = false; };
  }, [place.id]);
  const uri = own || (photo && photo.url);
  if (uri) return <Image source={{ uri }} accessibilityLabel={place.name} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h, backgroundColor: C.glassHi }} />;
  const c = tintOf(place.id);
  return (
    <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: h * 0.34, opacity: 0.9 }}>{place.emoji}</Text>
    </LinearGradient>
  );
};

/* the credit for a Commons photo, small, under the card — the same one
   the place's own page shows */
const Credit = ({ place, t }) => {
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (place.photo) return undefined;
    let alive = true;
    placePhoto({ name: place.name, lat: place.lat, lng: place.lng }).then((p) => { if (alive) setPhoto(p); }).catch(() => {});
    return () => { alive = false; };
  }, [place.id]);
  if (!photo || !photo.page) return null;
  return (
    <Pressable onPress={() => { try { Linking.openURL(photo.page); } catch (e) {} }} accessibilityRole="link" style={{ position: 'absolute', bottom: 6, right: 12 }}>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9.5 }} numberOfLines={1}>
        {t('photo_credit').replace('{who}', photo.artist || t('photo_someone')).replace('{license}', photo.license)}
      </Text>
    </Pressable>
  );
};

/* Ayser: "أماكن الـ dating والهدايا والـ souvenirs". Two kinds tagged on
   real places in src/constants/destinations.js — somewhere good for a
   date (a view, a sunset, a garden, a waterfront), and somewhere to buy
   a gift worth bringing home (bazaars, crafts, markets). */
const PINNED = ['Date spot', 'Souvenirs'];
export const tagLabel = (x, t) => (x === 'Date spot' ? '💕 ' + t('pf_tag_date') : x === 'Souvenirs' ? '🎁 ' + t('pf_tag_souv') : x);

const H = 210;
const Card = ({ place, dist, onOpen, t }) => (
  <Pressable onPress={() => { tapLight(); onOpen(place); }} accessibilityRole="button" accessibilityLabel={place.name} style={{ marginBottom: 14 }}>
    <View style={{ height: H, borderRadius: 24, overflow: 'hidden', backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.line }}>
      <CardPhoto place={place} h={H} />
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} locations={[0, 0.35, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
        <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>{String((place.tags && place.tags[0]) || '').toUpperCase()}</Text>
      </View>
      {dist != null ? (
        <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>{far(dist)}</Text>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 20, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', marginEnd: 10 }}>
          <Text style={{ fontSize: 23 }}>{place.emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900' }} numberOfLines={1}>{place.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>{'📍 ' + [place.area, place.flag].filter(Boolean).join(' ')}</Text>
        </View>
      </View>
      <Credit place={place} t={t} />
    </View>
  </Pressable>
);

/* the places come from the map screen as a prop rather than an import:
   a list two lazy pieces both import gets pulled into the first
   download, and this one is ninety kilobytes */
export const PlacesFeed = ({ onClose, onOpen, places }) => {
  const DESTINATIONS = places || [];
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [tag, setTag] = useState(null);
  const [where, setWhere] = useState(null);       // a country, or null = everywhere (nearest first)
  const [picking, setPicking] = useState(false);
  const here = lastFix();

  const all = useMemo(() => DESTINATIONS
    .map((d) => ({ d, dist: here ? km(here, d) : null }))
    .sort((a, b) => (a.dist == null || b.dist == null ? (b.d.hero ? 1 : 0) - (a.d.hero ? 1 : 0) : a.dist - b.dist)), [here && here.lat, here && here.lng]);
  const tags = useMemo(() => {
    const n = {};
    DESTINATIONS.forEach((d) => (d.tags || []).forEach((x) => { n[x] = (n[x] || 0) + 1; }));
    // date spots and gifts & souvenirs always first; then the commonest kinds
    return PINNED.filter((x) => n[x]).concat(Object.keys(n).filter((x) => x !== 'Photo' && PINNED.indexOf(x) < 0).sort((a, b) => n[b] - n[a]).slice(0, 9));
  }, []);
  /* where to: every country that has places, with how many */
  const countries = useMemo(() => {
    const n = {};
    DESTINATIONS.forEach((d) => { const k = d.country; if (!n[k]) n[k] = { name: k, flag: d.flag, n: 0 }; n[k].n += 1; });
    return Object.values(n).sort((a, b) => b.n - a.n);
  }, [DESTINATIONS.length]);
  const shown = all.filter((x) => (!tag || (x.d.tags || []).includes(tag)) && (!where || x.d.country === where.name));

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 25 }}>
      <FlatList
        data={shown}
        keyExtractor={(x) => x.d.id}
        initialNumToRender={4}
        windowSize={5}
        maxToRenderPerBatch={4}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }}
        ListHeaderComponent={(
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
                <Ionicons name="chevron-down" size={26} color={C.text} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>{t('pf_count').replace('{n}', String(shown.length))}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'📍 ' + t('pf_title')}</Text>
            <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{here ? t('pf_sub_near') : t('pf_sub')}</Text>
            {/* coming through Moments: said once, plainly, not dressed up as places */}
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              {[['☕', 'pf_soon_cafes'], ['🛏️', 'pf_soon_stays']].map(([e, k], i) => (
                <Pressable key={k} onPress={() => { tapLight(); openPartner('place'); }} accessibilityRole="button" style={{ flex: 1, marginEnd: i === 0 ? 10 : 0 }}>
                  <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, padding: 12, minHeight: 84 }}>
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', marginTop: 4 }}>{t(k)}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t('bk_soon') + ' · ' + t('pf_soon_own')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* where to */}
            <Pressable onPress={() => { tapSelection(); setPicking((v) => !v); }} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: C.purpleSoft, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{where ? where.flag + ' ' + where.name : '🧭 ' + t('pf_where_any')}</Text>
                <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={15} color={C.purple} style={{ marginStart: 6 }} />
              </View>
            </Pressable>
            {picking ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {[null].concat(countries).map((c) => (
                  <Pressable key={c ? c.name : 'any'} onPress={() => { tapSelection(); setWhere(c); setPicking(false); }} style={{ marginEnd: 8, marginBottom: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: (where && c && where.name === c.name) || (!where && !c) ? C.purple : C.line, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{c ? c.flag + ' ' + c.name + ' · ' + c.n : '🧭 ' + t('pf_where_any')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 12, marginBottom: 14 }}>
              {[null].concat(tags).map((x) => (
                <Pressable key={x || 'all'} onPress={() => { tapSelection(); setTag(x); }} accessibilityRole="tab" accessibilityState={{ selected: tag === x }}
                  style={{ marginEnd: 8, borderRadius: 999, borderWidth: 1, borderColor: tag === x ? C.text : C.line, backgroundColor: tag === x ? C.text : 'transparent', paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Text style={{ color: tag === x ? C.bg : C.text, fontSize: 13.5, fontWeight: '800' }}>{x ? tagLabel(x, t) : t('bk_everywhere')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        renderItem={({ item }) => <Card place={item.d} dist={item.dist} onOpen={onOpen} t={t} />}
      />
    </View>
  );
};
