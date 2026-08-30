import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { AvatarRing } from './AvatarRing';
import { useLang } from '../context/LanguageContext';
import { Tap } from '../lib/motion';

/* ─── THE RAIL AT THE TOP ────────────────────────────────────────────
   Moments — stories with sounds. Tap one to watch it, ✦ to add yours.

   ── WHEN IT IS EMPTY, WHICH IS AT THE BEGINNING ──────────────────
   It was a single dashed circle sitting alone above a wide gap: the
   shape of a row with nothing in it, which reads as something the app
   failed to load rather than something you have not done yet. So when
   there is nothing to show, the rail says what the row is FOR, beside
   the button that fills it. The moment somebody posts, the sentence
   gets out of the way and the faces take the space. */
const Add = ({ onPress, label, big }) => (
  <Tap testID="add-story" onPress={onPress} style={{ alignItems: 'center', marginRight: 14 }}>
    <LinearGradient
      colors={[C.purple, '#C026D3']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: big ? 66 : 62, height: big ? 66 : 62, borderRadius: 33, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: (big ? 66 : 62) - 5, height: (big ? 66 : 62) - 5, borderRadius: 31,
        backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="add" size={28} color={C.purple} />
      </View>
    </LinearGradient>
    <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700', marginTop: 6 }}>{label}</Text>
  </Tap>
);

export const StoriesBar = ({ stories, onOpenStory, onAddStory }) => {
  const { t } = useLang();

  if (!stories.length) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
        <Add onPress={onAddStory} label={t('your_vibe_label')} big />
        <Text style={{ flex: 1, color: C.faint, fontSize: 13, lineHeight: 19, marginLeft: 2 }}>
          {t('sb_empty_hint')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingRight: 8 }}>
      <Add onPress={onAddStory} label={t('your_vibe_label')} />
      {stories.map((s, i) => (
        <Tap key={s.user.id + i} onPress={() => onOpenStory(i)} style={{ alignItems: 'center', marginRight: 14 }}>
          <AvatarRing uri={s.user.avatar} size={62} live={s.user.live} />
          <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700', marginTop: 6 }}>{s.user.name.split(' ')[0]}</Text>
        </Tap>
      ))}
    </ScrollView>
  );
};
