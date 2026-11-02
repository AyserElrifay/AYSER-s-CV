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
  /* Ayser, November 2026 ("خد رأي ستيف جوبز"): one line, one button */
  return (
    <Pressable testID="btn-prompt-camera" onPress={() => { tapLight(); onShare && onShare(prompt); }} accessibilityRole="button" accessibilityLabel={lw(lang, 'pp_share')}
      style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingVertical: 12, paddingStart: 16, paddingEnd: 12, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1 }}>{lang === 'ar' ? lw(lang, 'pp_label') : lw(lang, 'pp_label').toUpperCase()}</Text>
        <Text numberOfLines={2} style={{ color: C.text, fontSize: 15.5, fontWeight: '600', lineHeight: 21, marginTop: 3 }}>{prompt}</Text>
      </View>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', marginStart: 12 }}>
        <Ionicons name="camera" size={21} color="#FFFFFF" />
      </View>
    </Pressable>
  );
};
