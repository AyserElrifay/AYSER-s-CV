import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { worldBoard } from '../../services/squadGames';
import { todayChallenge } from './challenges';
import { kindLabel } from './WorldSheet';
import { gw, fill } from './words';
import { sayCh, useChallengeWords } from './challengeWords';
import { WorldSheet } from './WorldSheet';
import { tapLight } from '../../utils/feedback';
import { publicMedia } from '../../lib/publicMedia';

/* ─── TODAY'S LITTLE CHALLENGE, AT THE END OF THE FEED ────────────────
   Ayser: the big photo with "slide to join" sat between the top of
   Home and the posts, louder than everything around it. Now it is one
   small card after the posts — the day's photo as a square on the
   side, the challenge in one line, how many places it reached, one
   violet "Join" — in the same paper-and-hairline style as the rest of
   the feed. Tapping anywhere opens the day (WorldSheet); once your
   photo is in, it just says so. */
export const WorldCard = ({ userId, lang, city }) => {
  useChallengeWords(lang);
  const [b, setB] = useState(null);
  const [open, setOpen] = useState(false);
  const T = (k) => gw(lang, k);
  const today = todayChallenge();
  useEffect(() => { worldBoard(today.key, 1).then((r) => r && r.ok && setB(r)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = !!(b && b.mine);
  const shared = b && b.entries && b.entries[0] && b.entries[0].photo;
  const photo = shared || publicMedia(today.img || 'welcome-sunset.jpg');
  return (
    <>
      <Pressable onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" accessibilityLabel={sayCh(lang, today)}>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 12 }}>
          <Image source={{ uri: photo }} resizeMode="cover" style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: C.glassHi }} />
          <View style={{ flex: 1, minWidth: 0, marginStart: 14 }}>
            <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }} numberOfLines={1}>{(T('today_k') + ' · ' + kindLabel(lang, today.c)).toUpperCase()}</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginTop: 3 }} numberOfLines={1}>{mine ? T('slid_d') : sayCh(lang, today)}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {b && b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : sayCh(lang, { en: today.s_en, ar: today.s_ar })}
            </Text>
          </View>
          {mine ? <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={20} color={C.faint} style={{ marginStart: 8 }} /> : (
            <View style={{ marginStart: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.purple }}>
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700' }}>{T('in')}</Text>
            </View>
          )}
        </View>
      </Pressable>
      {open ? <WorldSheet userId={userId} lang={lang} city={city} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
