import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { cachedPoster, derivePoster, posterTint } from '../lib/poster';

/* ─── THE STORIES RAIL: WHAT IS IN THEM, NOT WHO POSTED THEM ──────────
   Ayser: "خلي الستوريز من بره مش صورة أكونت الشخص، خليها توري إيه اللي
   جواها". A row of round profile photos says only "these people posted
   something"; a row of the moments themselves — a sunset, a table of
   friends, a painting half done — says what is going on, and that is
   the reason to tap. So each person is a tall card of their newest
   story, their face small in the corner (ringed while it is new), and
   their name at the bottom. A video shows a frame of itself
   (src/lib/poster.js), never a black box. */

const isVideo = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(u || ''));
const W = 84;
const H = 124;

const StoryCard = ({ s, onPress, label }) => {
  const video = isVideo(s.media);
  const [cover, setCover] = useState(() => (video ? cachedPoster(s.id) : s.media) || null);
  useEffect(() => {
    if (!video || cover || !s.media) return undefined;
    let alive = true;
    derivePoster(s.id, s.media).then((u) => { if (alive && u) setCover(u); }).catch(() => {});
    return () => { alive = false; };
  }, [s.id, s.media]);
  const face = s.user && s.user.avatar;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ marginEnd: 10 }}>
      <View style={{ width: W, height: H, borderRadius: 16, overflow: 'hidden', backgroundColor: posterTint(s.id) }}>
        {cover ? <Image source={{ uri: cover }} style={{ width: W, height: H }} /> : (
          /* a story of only words, or a frame not ready yet: their face, large and soft */
          face ? <Image source={{ uri: face }} blurRadius={8} style={{ width: W, height: H, opacity: 0.85 }} /> : null
        )}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52 }} />
        <Text style={{ position: 'absolute', left: 8, right: 8, bottom: 7, color: '#FFF', fontSize: 11.5, fontWeight: '800' }} numberOfLines={1}>{label}</Text>
        {video ? (
          <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={11} color="#FFF" />
          </View>
        ) : null}
      </View>
      {/* who: small, in the corner, ringed while it is new */}
      <LinearGradient colors={s.user && s.user.live ? [C.coral, C.purple] : [C.purple, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 6, left: 6, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={{ uri: face }} style={{ width: 25, height: 25, borderRadius: 12.5, borderWidth: 1.5, borderColor: '#FFF', backgroundColor: C.glassHi }} />
      </LinearGradient>
      {s.count > 1 ? (
        <View style={{ position: 'absolute', top: 8, right: video ? 32 : 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>{s.count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

/* Moments rail — stories with sounds. Tap to watch, + to add yours. */
export const StoriesBar = ({ stories, onOpenStory, onAddStory }) => {
  const { t } = useLang();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingRight: 8 }}>
      <Pressable testID="add-story" onPress={onAddStory} accessibilityRole="button" accessibilityLabel={t('your_vibe_label')} style={{ marginEnd: 10 }}>
        <View style={{
          width: W, height: H, borderRadius: 16, borderWidth: 1.5, borderColor: C.purple,
          borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft,
        }}>
          <Ionicons name="add" size={28} color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '800', marginTop: 6 }}>{t('your_vibe_label')}</Text>
        </View>
      </Pressable>
      {stories.map((s, i) => (
        <StoryCard key={s.user.id + i} s={s} onPress={() => onOpenStory(i)} label={s.user.name.split(' ')[0]} />
      ))}
    </ScrollView>
  );
};
