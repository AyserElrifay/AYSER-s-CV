import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { worldBoard } from '../../services/squadGames';
import { todayChallenge, weekChallenges, SWATCH, ICON } from './challenges';
import { kindLabel, WEEK_SUB } from './WorldSheet';
import { gw, fill } from './words';
import { sayCh, useChallengeWords } from './challengeWords';
import { WorldSheet } from './WorldSheet';
import { tapLight, tapSelection } from '../../utils/feedback';

/* ─── TODAY'S LITTLE CHALLENGE, AT THE END OF THE FEED ────────────────
   Ayser: the big photo with "slide to join" sat between the top of
   Home and the posts, louder than everything around it. Now it is one
   small card after the posts — the day's photo as a square on the
   side, the challenge in one line, how many places it reached, one
   violet "Join" — in the same paper-and-hairline style as the rest of
   the feed. Tapping anywhere opens the day (WorldSheet); once your
   photo is in, it just says so.
   Ayser: "اي علاقه الصوره … ممكن تبقي swipe". The square is now a real
   photo somebody shared for that challenge, or else the colour itself /
   a plain icon (challenges.js, SWATCH and ICON) — no stock picture that
   has nothing to do with it. And the card swipes: today's challenge,
   then this week's three, with dots under it. */

/* the square on the side: a photo people really shared, else what the challenge is about */
const Tile = ({ ch, photo }) => {
  const box = { width: 76, height: 76, borderRadius: 18, overflow: 'hidden' };
  if (photo) return <Image source={{ uri: photo }} resizeMode="cover" style={[box, { backgroundColor: C.glassHi }]} />;
  const sw = ch.c === 'colour' && SWATCH[ch.en];
  if (sw) {
    return (
      <View style={[box, { flexDirection: 'row', borderWidth: 1, borderColor: C.line }]}>
        {sw.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
      </View>
    );
  }
  return (
    <View style={[box, { backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name={ICON[ch.c] || 'sparkles-outline'} size={30} color={C.purple} />
    </View>
  );
};

const Page = ({ ch, b, week, lang, T, width, onOpen }) => {
  const mine = !!(b && b.mine);
  const photo = b && b.entries && b.entries[0] && b.entries[0].photo;
  const sub = b && b.count ? fill(T('entries'), { n: b.count, c: b.countries })
    : week ? sayCh(lang, { en: WEEK_SUB[ch.c][0], ar: WEEK_SUB[ch.c][1] }) : sayCh(lang, { en: ch.s_en, ar: ch.s_ar });
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={sayCh(lang, ch)} style={{ width }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <Tile ch={ch} photo={photo} />
        <View style={{ width: 14 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }} numberOfLines={1}>{(T(week ? 'tab_week' : 'today_k') + ' · ' + kindLabel(lang, ch.c)).toUpperCase()}</Text>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginTop: 3 }} numberOfLines={2}>{mine && !week ? T('slid_d') : sayCh(lang, ch)}</Text>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
        </View>
        {mine ? <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={20} color={C.faint} style={{ marginStart: 8 }} /> : (
          <View style={{ marginLeft: 10, marginRight: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.purple }}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700' }}>{T('in')}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export const WorldCard = ({ userId, lang, city }) => {
  useChallengeWords(lang);
  const T = (k) => gw(lang, k);
  const [list] = useState(() => [todayChallenge(), ...weekChallenges()]);
  const [boards, setBoards] = useState({});
  const [open, setOpen] = useState(null);       // index of the page opened, or null
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (open != null) return;
    list.forEach((ch) => worldBoard(ch.key, 1).then((r) => r && r.ok && setBoards((m) => ({ ...m, [ch.key]: r }))));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = (e) => {
    if (!width) return;
    const i = Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width);
    if (i !== at && i >= 0 && i < list.length) { setAt(i); tapSelection(); }
  };
  return (
    <>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ marginTop: 8, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, overflow: 'hidden' }}>
        {width ? (
          <ScrollView horizontal pagingEnabled keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
            {list.map((ch, i) => (
              <Page key={ch.key} ch={ch} b={boards[ch.key]} week={i > 0} lang={lang} T={T} width={width} onOpen={() => { tapLight(); setOpen(i); }} />
            ))}
          </ScrollView>
        ) : <View style={{ height: 100 }} />}
        <View style={{ flexDirection: 'row', justifyContent: 'center', paddingBottom: 10, marginTop: -2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {list.map((ch, i) => <View key={ch.key} style={{ width: i === at ? 16 : 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === at ? C.purple : C.line }} />)}
        </View>
      </View>
      {open != null ? <WorldSheet userId={userId} lang={lang} city={city} start={open ? 'week' : 'today'} pick={open - 1} onClose={() => setOpen(null)} /> : null}
    </>
  );
};
