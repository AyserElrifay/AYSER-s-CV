import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { lw, todaysPrompt } from '../constants/loopWords';
import { tapLight } from '../utils/feedback';

/* ─── TODAY'S PHOTO PROMPT ────────────────────────────────────────────
   Ayser, October 2026: no more stories from nowhere. The camera opens
   from one prompt a day ("Share the sky from your window right now"),
   the photo or short clip goes into the feed with the prompt on it, and
   people react and comment there. Posting is never behind the feed's
   clock — only the scrolling is. */
export const PhotoPrompt = ({ onShare }) => {
  const { lang } = useLang();
  const prompt = todaysPrompt(lang);
  return (
    <View style={{ marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1 }}>
        {lang === 'ar' ? lw(lang, 'pp_label') : lw(lang, 'pp_label').toUpperCase()}
      </Text>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', lineHeight: 25, marginTop: 6 }}>{prompt}</Text>
      <Pressable testID="btn-prompt-camera" onPress={() => { tapLight(); onShare && onShare(prompt); }} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}>
          <Ionicons name="camera-outline" size={17} color="#FFFFFF" />
          {/* the gap on both sides, so it holds in Arabic too */}
          <Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '700', marginHorizontal: 8 }}>{lw(lang, 'pp_share')}</Text>
        </View>
      </Pressable>
    </View>
  );
};
