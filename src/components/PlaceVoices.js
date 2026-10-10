import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { fetchPostsNearby } from '../services/posts';
import { fetchStoriesNearby } from '../services/stories';
import { SUPABASE_READY } from '../lib/supabase';
import { AV_NEUTRAL } from '../constants/mockData';
import { tapLight } from '../utils/feedback';

/* ─── WHAT PEOPLE SAY HERE ────────────────────────────────────────────
   Ayser: "ما ينفعش ناخد كمان صور وبوستات وستوريز اليوزرز في الأماكن،
   وكمان بوستات آراءهم". Yes — everything people really shared at this
   spot, in three plain parts:

     · live now — stories from the last 24 hours, here;
     · photos — moments people posted here;
     · what people say — the words: a tip, an opinion, or a heads-up
       ("overpriced", "closed on Fridays"), the heads-up marked as one.

   And one button to add yours, which opens the composer with this
   place — and its real spot — already filled in, so what you write
   belongs to the place. Nothing here is written by us. */

const isVideo = (p) => p.type === 'vod' || p.type === 'reel' || /\.(mp4|mov|webm)(\?|$)/i.test(p.media_url || '');

const ago = (iso, t) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return t('pv_min').replace('{n}', String(m));
  const h = Math.round(m / 60);
  if (h < 48) return t('pv_hours').replace('{n}', String(h));
  return t('pv_days').replace('{n}', String(Math.round(h / 24)));
};

export const PlaceVoices = ({ place, onShare, onOpenPerson }) => {
  const { t } = useLang();
  const [posts, setPosts] = useState(null);
  const [stories, setStories] = useState([]);

  useEffect(() => {
    let alive = true;
    setPosts(null); setStories([]);
    if (!SUPABASE_READY || !place || place.lat == null) { setPosts([]); return undefined; }
    fetchPostsNearby({ lat: place.lat, lng: place.lng, name: place.name }).then((r) => { if (alive) setPosts(r || []); }).catch(() => { if (alive) setPosts([]); });
    fetchStoriesNearby({ lat: place.lat, lng: place.lng }).then((r) => { if (alive) setStories(r || []); }).catch(() => {});
    return () => { alive = false; };
  }, [place && place.name, place && place.lat, place && place.lng]);

  const photos = (posts || []).filter((p) => p.media_url);
  const words = (posts || []).filter((p) => !p.media_url && String(p.caption || '').trim());
  const person = (u) => u && onOpenPerson && onOpenPerson({ id: u.id, name: u.name || 'Explorer', avatar: u.avatar_url || AV_NEUTRAL, handle: u.handle, verified: !!u.verified, intent: u.intent, bio: u.bio });
  const head = { color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 10 };

  return (
    <View>
      {stories.length ? (
        <>
          <Text style={head}>{t('pv_live').toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {stories.map((s) => (
              <Pressable key={s.id} onPress={() => { tapLight(); person(s.user); }} accessibilityRole="button" style={{ marginEnd: 10, alignItems: 'center', width: 72 }}>
                <View style={{ width: 66, height: 66, borderRadius: 33, padding: 3, borderWidth: 2.5, borderColor: C.purple }}>
                  <Image source={{ uri: s.media_url || (s.user && s.user.avatar_url) || AV_NEUTRAL }} style={{ width: '100%', height: '100%', borderRadius: 30, backgroundColor: C.glassHi }} />
                </View>
                <Text style={{ color: C.text, fontSize: 11, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{(s.user && s.user.name) || '—'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {posts === null ? (
        <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 16 }}>{t('looking_for_moments')}</Text>
      ) : null}

      {photos.length ? (
        <>
          <Text style={head}>{t('moments_here').replace('{n}', photos.length)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {photos.map((p) => (
              <Pressable key={p.id} onPress={() => { tapLight(); person(p.user); }} style={{ marginEnd: 10 }}>
                <View style={{ width: 108, height: 148, borderRadius: 14, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                  <Image source={{ uri: p.thumb_url || p.media_url }} style={{ width: '100%', height: '100%' }} />
                  {isVideo(p) ? (
                    <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="play" size={13} color="#FFF" />
                    </View>
                  ) : null}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 7, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={{ uri: (p.user && p.user.avatar_url) || AV_NEUTRAL }} style={{ width: 16, height: 16, borderRadius: 8, marginEnd: 5 }} />
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700', flex: 1 }} numberOfLines={1}>{(p.user && p.user.name) || 'Explorer'}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {words.length ? (
        <>
          <Text style={head}>{t('pv_say').toUpperCase()}</Text>
          {words.slice(0, 8).map((p) => {
            const warn = p.intent === 'warning';
            return (
              <Pressable key={p.id} onPress={() => { tapLight(); person(p.user); }} accessibilityRole="button"
                style={{ flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
                <Image source={{ uri: (p.user && p.user.avatar_url) || AV_NEUTRAL }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.glassHi }} />
                <View style={{ flex: 1, minWidth: 0, marginStart: 10 }}>
                  <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>
                    <Text style={{ color: C.text, fontWeight: '800' }}>{(p.user && p.user.name) || 'Explorer'}</Text>
                    {' · ' + ago(p.created_at, t)}
                    {warn ? <Text style={{ color: C.coral, fontWeight: '800' }}>{'  ⚠️ ' + t('pv_heads_up')}</Text> : null}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginTop: 2 }} numberOfLines={4}>{p.caption}</Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}

      {posts && !photos.length && !words.length && !stories.length ? (
        <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', marginTop: 16 }}>{t('pv_none')}</Text>
      ) : null}

      {onShare ? (
        <Pressable onPress={() => { tapLight(); onShare(place); }} accessibilityRole="button"
          style={{ marginTop: 14, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={C.text} />
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginStart: 6 }}>{t('pv_share')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
