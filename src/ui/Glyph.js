import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';

/* ─── ONE QUIET SET OF ICONS INSTEAD OF EMOJIS ────────────────────────
   Ayser: "إزاي كده emojis بالشكل ده مع الفخامة اللي برّه — خلّي الموضوع
   مترابط … وحّد الأبلكيشن". The screens kept their emojis as data (a
   habit, a value, a slot in the day); here each one is drawn as the same
   thin outline icon the rest of the app uses, in the text colour. An
   emoji with no match draws nothing, rather than a coloured picture. */
const MAP = {
  '🔥': 'flame-outline', '📖': 'book-outline', '📚': 'library-outline', '🏃': 'walk-outline', '🏃‍♂️': 'walk-outline', '🏃‍♀️': 'walk-outline',
  '💧': 'water-outline', '🧘': 'leaf-outline', '🧘‍♀️': 'leaf-outline', '🧘‍♂️': 'leaf-outline', '🗣️': 'chatbubbles-outline', '🗣': 'chatbubbles-outline',
  '🎸': 'musical-notes-outline', '🎵': 'musical-notes-outline', '🎶': 'musical-notes-outline', '🥗': 'nutrition-outline', '🍎': 'nutrition-outline',
  '💪': 'barbell-outline', '🏋️': 'barbell-outline', '🏋️‍♀️': 'barbell-outline', '📞': 'call-outline', '💬': 'chatbubble-outline',
  '🚀': 'rocket-outline', '🌬️': 'cloudy-outline', '🌬': 'cloudy-outline', '🎨': 'color-palette-outline', '👨‍👩‍👧': 'people-outline',
  '👨‍👩‍👧‍👦': 'people-outline', '🌿': 'leaf-outline', '🌱': 'leaf-outline', '🤝': 'hand-left-outline', '🪞': 'eye-outline',
  '🕊️': 'paper-plane-outline', '🧭': 'compass-outline', '❤️': 'heart-outline', '☮️': 'radio-button-off-outline', '✈️': 'airplane-outline',
  '🏡': 'home-outline', '🏠': 'home-outline', '🎓': 'school-outline', '⚽': 'football-outline', '🍳': 'restaurant-outline',
  '🎮': 'game-controller-outline', '🥾': 'trail-sign-outline', '📷': 'camera-outline', '☕': 'cafe-outline', '📝': 'create-outline',
  '✍️': 'create-outline', '💻': 'laptop-outline', '🛌': 'bed-outline', '😴': 'moon-outline', '🌙': 'moon-outline', '☀️': 'sunny-outline',
  '⏰': 'alarm-outline', '⏱️': 'stopwatch-outline', '🎯': 'locate-outline', '✅': 'checkmark-circle-outline', '📅': 'calendar-outline',
  '🗓️': 'calendar-outline', '🍽️': 'restaurant-outline', '🚶': 'walk-outline', '🚴': 'bicycle-outline', '🏊': 'water-outline',
  '🧹': 'sparkles-outline', '🛒': 'cart-outline', '💼': 'briefcase-outline', '📈': 'trending-up-outline', '💰': 'wallet-outline',
  '🎁': 'gift-outline', '🎂': 'gift-outline', '💡': 'bulb-outline', '🌍': 'earth-outline', '🌎': 'earth-outline', '🧠': 'bulb-outline',
  '🎧': 'headset-outline', '📱': 'phone-portrait-outline', '🏆': 'trophy-outline', '⭐': 'star-outline', '✨': 'sparkles-outline',
  '🙏': 'heart-outline', '🫶': 'heart-outline', '🐶': 'paw-outline', '🐱': 'paw-outline', '👶': 'happy-outline', '🌸': 'flower-outline',
  '🍵': 'cafe-outline', '🥤': 'water-outline', '🧃': 'water-outline', '🎬': 'film-outline', '🎤': 'mic-outline', '🧩': 'extension-puzzle-outline',
};
export const glyphOf = (e) => MAP[String(e || '').trim()] || null;

/* the icon sits in a View: margins (marginEnd above all) then follow the
   writing direction, which a bare icon's text style did not in Arabic */
export const Glyph = ({ e, size = 16, color, style }) => {
  const name = glyphOf(e);
  return name ? <View style={style}><Ionicons name={name} size={size} color={color || C.text} /></View> : null;
};
