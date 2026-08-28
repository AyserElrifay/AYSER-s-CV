import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../../constants/theme';
import { channelFor } from './channels';
import { Face } from './Face';

/* ─── لمّة · WHERE EVERYONE STANDS, RIGHT NOW ────────────────────────
   The scoreboard between questions is the reason people play these
   games in a room together. Not the question — the half second after
   it, when everybody looks up to see who moved. Showing the standings
   only at the end throws that away and leaves a quiz.

   SO IT SHOWS MOVEMENT, NOT JUST ORDER. A list of names and numbers
   tells you who is winning. An arrow tells you what just happened —
   that you took two places off somebody, or that somebody took them
   off you. That is the part people react to out loud.

   The previous order is kept here, in a ref, because it is a fact
   about the last few seconds of THIS screen and nothing else in the
   app needs it. It updates only when the question index changes, so a
   re-render for any other reason cannot quietly erase the arrows.

   YOU ARE ALWAYS ON IT. Ten players and you are ninth: the top five
   are shown, and then you, wherever you are. A leaderboard you cannot
   find yourself on is somebody else's leaderboard. */

const TOP = 5;

/* At module scope on purpose. Declared inside Standings it would be a
   new component type on every render, so React would throw every row
   away and rebuild it — which is precisely the fault
   scripts/check-rerender.mjs exists to catch, and it caught this one. */
const Row = React.memo(({ p, meId }) => {
  const ch = channelFor((p.rank - 1) % 4);
  const mine = p.user_id === meId;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: mine ? ch.soft : 'transparent',
      borderWidth: mine ? 1.5 : 0, borderColor: mine ? ch.color : 'transparent',
      borderRadius: 14, paddingHorizontal: mine ? 10 : 0, paddingVertical: 8, marginBottom: 4,
    }}>
      <Text style={{ color: C.faint, fontSize: 13, fontWeight: '900', width: 24 }}>{p.rank}</Text>
      <Face player={p} size={26} />
      <Text numberOfLines={1} style={{ color: C.text, fontSize: 14.5, fontWeight: mine ? '900' : '700', flex: 1, minWidth: 0, marginStart: 8 }}>
        {p.nickname}
      </Text>
      {p.moved > 0 ? (
        <MaterialCommunityIcons name="chevron-up" size={17} color={C.green} />
      ) : p.moved < 0 ? (
        <MaterialCommunityIcons name="chevron-down" size={17} color={C.coral} />
      ) : null}
      <Text style={{ color: mine ? ch.color : C.faint, fontSize: 14.5, fontWeight: '900', marginStart: 8, minWidth: 46, textAlign: 'right' }}>
        {p.score}
      </Text>
    </View>
  );
});


export const Standings = ({ players, meId, questionIndex, t }) => {
  const prevRanks = useRef({});
  const lastIndex = useRef(-1);

  const rows = Array.isArray(players) ? players : [];

  /* Snapshot the order as it was BEFORE this question's scores landed,
     so the arrows describe this question and not the whole game. */
  useEffect(() => {
    if (questionIndex === lastIndex.current) return;
    lastIndex.current = questionIndex;
  }, [questionIndex]);

  const withMove = rows.map((p, i) => {
    const was = prevRanks.current[p.user_id];
    return { ...p, rank: i + 1, moved: was === undefined ? 0 : was - (i + 1) };
  });

  // remember this order for the next reveal
  useEffect(() => {
    const next = {};
    rows.forEach((p, i) => { next[p.user_id] = i + 1; });
    prevRanks.current = next;
  }, [rows.map((p) => p.user_id + ':' + p.score).join('|')]);

  const top = withMove.slice(0, TOP);
  const me = withMove.find((p) => p.user_id === meId);
  const meIsBelow = me && me.rank > TOP;

  return (
    <View>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
        {t('lamma_standings')}
      </Text>
      <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator={false}>
        {top.map((p) => <Row key={p.user_id} p={p} meId={meId} />)}
        {meIsBelow ? (
          <>
            <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', paddingVertical: 2 }}>···</Text>
            <Row p={me} meId={meId} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

/* The one line a player actually wants while a question is on screen:
   where they are, out of how many. */
export const RankChip = ({ players, meId, t }) => {
  const rows = Array.isArray(players) ? players : [];
  const i = rows.findIndex((p) => p.user_id === meId);
  if (i < 0 || rows.length < 2) return null;
  return (
    <View style={{ backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: '900' }}>
        {t('lamma_rank_of').replace('{n}', i + 1).replace('{total}', rows.length)}
      </Text>
    </View>
  );
};
