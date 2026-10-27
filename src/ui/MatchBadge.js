import React from 'react';
import { View, Text } from 'react-native';
import { C, NUM } from '../constants/theme';

/* "94% Vibe Match ⚡" — the server's score (RUN_ME.sql, vibe_match), shown
   only when it is real and high enough to mean something. Two words, so
   they live here and stay small enough for the first download. */
const MATCH = { en: 'Vibe Match', ar: 'توافق', cs: 'shoda', es: 'afinidad', et: 'sobivus', fr: 'affinité', hi: 'मैच', it: 'affinità', ja: '相性', ko: '궁합',
  nl: 'match', pt: 'afinidade', ro: 'potrivire', ru: 'совпадение', tr: 'uyum', uk: 'збіг', zh: '契合度' };
const OFFICIAL = { en: 'Official table', ar: 'ترابيزة رسمية', cs: 'Oficiální stůl', es: 'Mesa oficial', et: 'Ametlik laud', fr: 'Table officielle', hi: 'ऑफ़िशियल टेबल',
  it: 'Tavolo ufficiale', ja: '公式テーブル', ko: '공식 테이블', nl: 'Officiële tafel', pt: 'Mesa oficial', ro: 'Masă oficială', ru: 'Официальный стол', tr: 'Resmi masa', uk: 'Офіційний стіл', zh: '官方桌' };
export const MATCH_MIN = 60;

export const MatchBadge = ({ score, lang, onBrand, style }) => {
  if (score == null || score < MATCH_MIN) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: onBrand ? C.sun : C.purpleSoft }, style]}>
      <Text style={[{ color: onBrand ? '#17131F' : C.purple, fontSize: 12, fontWeight: '800' }, NUM]}>{score + '% ' + (MATCH[lang] || MATCH.en) + ' ⚡'}</Text>
    </View>
  );
};

export const OfficialBadge = ({ lang, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: C.purple }, style]}>
    <Text style={{ color: C.sun, fontSize: 11, fontWeight: '900', marginEnd: 4 }}>✦</Text>
    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>{OFFICIAL[lang] || OFFICIAL.en}</Text>
  </View>
);
