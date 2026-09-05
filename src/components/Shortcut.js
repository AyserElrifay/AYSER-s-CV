import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { C } from '../constants/theme';

/* ─── THE PLACES TO GO, IN ONE LINE ───────────────────────────────────
   Ayser, twice: "أنا مش عجبني ان tap chats زحمه كده" and then "خلي تاب
   الentertaining تبقي مور simple".

   Both screens had the same fault and it is worth naming precisely: a
   destination was being given a CARD. A card is a title, a subtitle,
   an icon, a chevron and eighty pixels of height — and six of them in
   a column is a menu of features, which is what you build when you have
   not decided what the screen is for.

   A destination is a button. Six buttons are one line. What each one
   is for is explained inside it, where somebody who tapped it is
   actually asking.

   The same row on both screens on purpose: two screens that solve the
   same problem the same way teach the app in one lesson instead of
   two. */
export const Shortcut = ({ emoji, label, onPress }) => (
  <Pressable onPress={onPress} style={{ alignItems: 'center', width: 76 }}>
    <View style={{
      width: 52, height: 52, borderRadius: 26, backgroundColor: C.glass,
      borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 23 }}>{emoji}</Text>
    </View>
    {/* two lines, because a label cut off mid-word is worse than a
        label on two lines */}
    <Text numberOfLines={2} style={{ color: C.dim, fontSize: 10.5, lineHeight: 13, fontWeight: '800', marginTop: 5, textAlign: 'center', width: 74 }}>
      {label}
    </Text>
  </Pressable>
);

/* Scrolls when there are more than a screenful — five fit on the
   narrowest phone we support, and it must never wrap into a second
   row, which is how a row of buttons turns back into a grid of cards. */
export const ShortcutRow = ({ children, style }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingRight: 8 }}
    style={[{ marginBottom: 16, marginTop: 2, flexGrow: 0 }, style]}
  >
    {children}
  </ScrollView>
);
