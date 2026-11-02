import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight } from '../utils/feedback';

/* straight into the table games lobby: the code, and the four games (Ayser, November 2026) */
const TableGames = lazyOverlay(() => import('./lamma/TableGames').then((m) => ({ default: m.TableGames })));

const W = {
  en: { t: 'Lamma — Table Icebreakers', s: 'One room code for the whole table: The Spy, Arousty & 5s Bomb, Table Sparks and Campfire Karaoke.' },
  ar: { t: 'لمّة — ألعاب الترابيزة', s: 'كود أوضة واحد للترابيزة كلها: المندَسّ، عروستي وقنبلة الـ٥ ثواني، مين فينا، وغنّوا سوا.' },
};

/* ─── THE DOOR TO LAMMA ── on Together and on Space (Ayser, October 2026) */
export const LammaCard = ({ style }) => {
  const { lang } = useLang();
  const w = W[lang === 'ar' ? 'ar' : 'en'];
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID="lamma-card" onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" accessibilityLabel={w.t} style={style}>
        {({ pressed }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, backgroundColor: '#17131F', transform: [{ scale: pressed ? 0.985 : 1 }] }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#6C3CE9', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people" size={21} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0, marginHorizontal: 12 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' }}>{'✦ ' + w.t}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>{w.s}</Text>
            </View>
            <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </Pressable>
      {open ? <TableGames onClose={() => setOpen(false)} /> : null}
    </>
  );
};
