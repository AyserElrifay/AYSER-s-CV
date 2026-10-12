import React from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { AV_NEUTRAL } from '../constants/mockData';

/* ─── HANGOUT CREATORS NEAR YOU ───────────────────────────────────────
   The hosts people actually came to, most people first. Every number on
   a card is the database's (top_creators in RUN_ME.sql): hangouts that
   really happened with three or more people checked in. Nobody is here
   because they paid or posted a lot. When there is nobody yet, the rail
   says how to be the first one instead of showing made-up faces. */
export const CreatorsRail = ({ creators, me, onFollow, onBecome }) => {
  const { t } = useLang();
  const list = (creators || []).filter((c) => c && c.id);
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="star" size={15} color={C.gold} />
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginStart: 6, flex: 1 }}>{t('cr_rail_title')}</Text>
        <Pressable onPress={onBecome} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '800' }}>{t('cr_rail_become')} ›</Text>
        </Pressable>
      </View>
      {list.length ? (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingEnd: 8 }}>
          {list.map((c) => {
            const self = c.id === me;
            return (
              <View key={c.id} style={{ width: 168, marginEnd: 10, backgroundColor: C.glass, borderWidth: 1, borderColor: c.is_creator ? C.gold : C.line, borderRadius: 20, padding: 14, alignItems: 'center' }}>
                <Image source={{ uri: c.avatar_url || AV_NEUTRAL }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.glassHi }} />
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 8 }} numberOfLines={1}>{(c.country_flag ? c.country_flag + ' ' : '') + (c.name || '…')}</Text>
                {c.is_creator ? (
                  <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '800', marginTop: 2 }}>{'★ ' + t('rw_creator_badge')}</Text>
                ) : null}
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 6, textAlign: 'center' }} numberOfLines={2}>
                  {t('cr_card_line').replace('{h}', String(c.hosted || 0)).replace('{p}', String(c.people || 0))}
                </Text>
                {c.next ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{t('cr_next') + ' ' + c.next.title}</Text> : null}
                {self ? (
                  <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800', marginTop: 10 }}>{t('cr_you')}</Text>
                ) : (
                  <Pressable onPress={() => onFollow && onFollow(c)} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'stretch' }}>
                    <View style={{ borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: c.i_follow ? 'transparent' : C.purple, borderWidth: 1, borderColor: c.i_follow ? C.line : C.purple }}>
                      <Text style={{ color: c.i_follow ? C.text : '#FFF', fontSize: 13, fontWeight: '900' }}>{c.i_follow ? t('cr_following') : t('cr_follow')}</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Pressable onPress={onBecome} accessibilityRole="button">
          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('cr_none_title')}</Text>
            <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('cr_none_sub')}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
};
