import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { AvatarRing } from './AvatarRing';
import { useLang } from '../context/LanguageContext';

/* Moments rail — stories with sounds. Tap to watch, + to add yours. */
export const StoriesBar = ({ stories, onOpenStory, onAddStory }) => {
  const { t } = useLang();
  return (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingRight: 8 }}>
    <Pressable testID="add-story" onPress={onAddStory} style={{ alignItems: 'center', marginRight: 14 }}>
      <View
        style={{
          width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.purple,
          borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft,
        }}
      >
        <Ionicons name="add" size={26} color={C.purple} />
      </View>
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>{t('your_vibe_label')}</Text>
    </Pressable>
    {stories.map((s, i) => (
      <Pressable key={s.user.id + i} onPress={() => onOpenStory(i)} style={{ alignItems: 'center', marginRight: 14 }}>
        <AvatarRing uri={s.user.avatar} size={62} live={s.user.live} />
        <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>{s.user.name.split(' ')[0]}</Text>
      </Pressable>
    ))}
  </ScrollView>
  );
};
