import React, { useEffect, useState } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from '../ui/Gradient';
import { C, TEXT_BGS } from '../constants/theme';
import { cachedPoster, derivePoster, posterTint } from '../lib/poster';

/* ─── ONE GRID FOR EVERY PROFILE ─────────────────────────────────
   Ayser, November 2026: "خلي الأكاونت لما يتفتح من أي حتة شبه الـ
   space". Your own Space and somebody else's profile draw their moments
   with this one tile, so a profile looks the same whoever it belongs to. */

export const GAP = 3;
export const COL = 3;
export const SIZE = (Dimensions.get('window').width - 32 - GAP * (COL - 1)) / COL;

/* a moments row from the database → what a tile needs */
export const gridItem = (row) => (row.media_url
  ? { id: row.id, media: row.media_url, thumb: row.thumb_url || null, kind: row.type === 'reel' ? 'reel' : undefined, vibes: row.vibesCount || 0 }
  : { id: row.id, text: row.caption, textBg: row.text_bg || 'plain', vibes: row.vibesCount || 0 });

export const GridCell = ({ item }) => {
  const [derived, setDerived] = useState(() => cachedPoster(item.id));
  const needs = !item.text && !item.thumb && item.kind === 'reel' && !!item.media;
  useEffect(() => {
    if (!needs || derived) return undefined;
    let alive = true;
    derivePoster(item.id, item.media).then((url) => { if (alive && url) setDerived(url); });
    return () => { alive = false; };
  }, [needs, derived, item.id, item.media]);

  if (item.text) {
    const bg = TEXT_BGS[item.textBg] || TEXT_BGS.plain;
    return (
      <LinearGradient
        colors={bg.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', padding: 8 }}
      >
        {/* Four lines of 15px is 60px of text in a tile that, after its
            own padding, has room for about three. The fourth was being
            sliced through the middle with no ellipsis, so a post ended
            mid-word and looked broken rather than trimmed.

            Three lines, a height that says so, and a tail ellipsis: the
            reader can see the sentence was cut on purpose. */}
        <Text
          numberOfLines={3}
          ellipsizeMode="tail"
          style={{
            color: bg.text, fontSize: 11.5, fontWeight: '700', textAlign: 'center',
            lineHeight: 15, maxHeight: 45, width: '100%',
          }}>
          {item.text}
        </Text>
      </LinearGradient>
    );
  }
  /* An <Image> handed a video URL draws nothing, which is exactly what
     a posted reel looked like here: a blank white square. Videos carry
     their own still now; one that predates that gets a dark tile with a
     play mark on it, which at least reads as a video rather than as a
     hole in the grid. */
  /* A clip that came without a still used to leave a near-black tile
     with a play mark on it, and a grid of those is what "الفديوهات ...
     لونها اسود" actually looks like. One is taken from the clip
     itself now, once ever — see src/lib/poster.js — and until it
     arrives the tile wears a colour of its own rather than black. */
  const still = item.thumb || derived || (item.kind === 'reel' ? null : item.media);
  if (!still) {
    return (
      <View style={{ width: SIZE, height: SIZE, backgroundColor: posterTint(item.id), alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="play-circle-outline" size={26} color="rgba(255,255,255,0.72)" />
      </View>
    );
  }
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Image source={{ uri: still }} style={{ width: SIZE, height: SIZE, backgroundColor: posterTint(item.id) }} />
      {item.kind === 'reel' ? (
        <MaterialCommunityIcons name="play-box-outline" size={16} color="#fff" style={{ position: 'absolute', top: 6, right: 6, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 }} />
      ) : null}
      <View style={{ position: 'absolute', bottom: 5, left: 6, flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name="star-four-points" size={11} color={C.gold} />
        <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', marginLeft: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>{item.vibes}</Text>
      </View>
    </View>
  );
};

