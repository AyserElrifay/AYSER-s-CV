import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { PLACES } from './worldCulture';
import { useLang } from '../context/LanguageContext';
import { tapLight } from '../utils/feedback';

/* ─── THE HERITAGE ROOM ──────────────────────────────────────────────
   Ayser: "خلي بردو مومنتس يبان انه بيحافظ علي تراث و الثقافه."

   The word that matters in that sentence is يبان — SHOW that it does.
   Because it already did, and nobody could see it.

   Six real places, their real history and the customs of the people who
   live around them, have been in this app for months — written properly,
   drawn in code, and locked inside two arcade games. A player who
   climbed far enough earned a culture card. Everybody else never knew
   they existed. Heritage kept where only a good player can reach it is
   heritage nobody is keeping.

   So it comes out of the games and stands on its own.

   ── AND IT IS NOT LOCKED ─────────────────────────────────────────
   The obvious design is to keep the cards earned: grey silhouettes
   until you clear the chapter, because unlocking feels good. That is
   exactly the mistake that hid them in the first place. A person who
   opens this to read about Petra should read about Petra. The game
   still gives you the moment of earning one; this room simply refuses
   to make anybody play a platformer to learn how coffee is refused in
   Jordan.

   ── WHAT IS IN A CARD, AND WHY THOSE TWO THINGS ──────────────────
   A fact, and a custom.

   The fact is the monument — what it is and why it is remarkable. The
   custom is the part nobody puts in a guidebook: what actually happens
   when you are in somebody's house there. A traveller who knows the
   second one arrives differently, and that is the whole difference
   between visiting a country and being in it.

   ── NOTHING HERE BELONGS TO ANYBODY ──────────────────────────────
   Every monument is ancient and every drawing of it is made from
   shapes, by us. No photograph is licensed, no logo is borrowed, no
   description is lifted. A heritage feature that infringed somebody's
   copyright would be a joke at its own expense.                      */

/* The palette of a place, painted as the card it belongs to. Each one
   already carries its own sky and stone — that is what the games draw
   it with, and it is what makes Petra look like Petra rather than like
   a coloured box with a name on it. */
const Card = ({ place, lang, open, onToggle, t }) => {
  const ar = lang === 'ar';
  const title = ar ? (place.siteAr || place.site) : place.site;
  const where = ar
    ? ((place.cityAr || place.city) + ' · ' + (place.countryAr || place.country))
    : (place.city + ' · ' + place.country);
  const fact = ar ? (place.factAr || place.fact) : place.fact;
  const custom = ar ? (place.customAr || place.custom) : place.custom;

  return (
    <Pressable onPress={onToggle}>
      <View style={{
        borderRadius: 18, overflow: 'hidden', marginBottom: 12,
        borderWidth: 1, borderColor: C.line, backgroundColor: C.glass,
      }}>
        {/* the sky of that place, as its own band of colour */}
        <View style={{ height: 78, backgroundColor: place.sky[1], flexDirection: 'row' }}>
          {place.sky.map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
          <View style={{ position: 'absolute', left: 14, top: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 26 }}>{place.flag}</Text>
            <View style={{ marginStart: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11.5, marginTop: 1 }}>{where}</Text>
            </View>
          </View>
          {/* the token this place gives you in the games */}
          <View style={{
            position: 'absolute', insetInlineEnd: 12, top: 22,
            backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ color: place.accent, fontSize: 10.5, fontWeight: '900' }}>
              {ar ? (place.tokenNameAr || place.tokenName) : place.tokenName}
            </Text>
          </View>
        </View>

        <View style={{ padding: 14 }}>
          <Text style={{ color: C.faint, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
            {t('culture_the_place')}
          </Text>
          <Text style={{ color: C.text, fontSize: 13, lineHeight: 20, marginTop: 4 }}>{fact}</Text>

          {open ? (
            <>
              <Text style={{ color: C.faint, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 14 }}>
                {t('culture_the_custom')}
              </Text>
              <Text style={{ color: C.text, fontSize: 13, lineHeight: 20, marginTop: 4 }}>{custom}</Text>
            </>
          ) : (
            <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800', marginTop: 10 }}>
              {t('culture_read_custom')}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export const CultureSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(null);

  return (
    <Pressable
      onPress={onClose}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16, maxHeight: '90%',
        }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{t('culture_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 19, marginTop: 4, marginBottom: 16 }}>
            {t('culture_sub')}
          </Text>

          {PLACES.map((p) => (
            <Card
              key={p.id}
              place={p}
              lang={lang}
              t={t}
              open={open === p.id}
              onToggle={() => { tapLight(); setOpen(open === p.id ? null : p.id); }}
            />
          ))}

          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginTop: 2 }}>
            <Text style={{ color: C.dim, fontSize: 11.5, lineHeight: 17 }}>{t('culture_drawn_note')}</Text>
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
