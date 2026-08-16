import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../../constants/theme';
import { channelFor } from './channels';
import { Face } from './Face';

/* ─── لمّة · HOW EGYPTIAN ARE YOU ────────────────────────────────────
   The scoreboard says who was fastest. This says who actually KNEW,
   which is a different question and the more interesting one when the
   room is half Egyptian and half not.

   IT IS NOT THE SCORE. Points reward the tap that lands first, so a
   quick guesser can finish above somebody who was right more often.
   This is right answers over the whole pack — counted by the server
   from answers.is_correct, which no phone can write.

   THE DENOMINATOR IS THE PACK, NOT WHAT YOU ANSWERED. Walking in for
   the last five questions and getting them all should not crown you.

   THE TITLES ARE A JOKE AND THE NUMBER IS NOT. Nobody is laughed at
   here: the worst title says you are lost in the desert, which is a
   thing to be, not a person to be. Somebody who has never left Bucharest
   getting sixty per cent is a good evening, and it should read like one. */

const LEVELS = [
  { at: 100, key: 'lamma_lvl_pharaoh', emoji: '👑' },
  { at: 80,  key: 'lamma_lvl_local',   emoji: '🏙️' },
  { at: 60,  key: 'lamma_lvl_cousin',  emoji: '🫖' },
  { at: 40,  key: 'lamma_lvl_tourist', emoji: '🐫' },
  { at: 20,  key: 'lamma_lvl_doc',     emoji: '📺' },
  { at: 0,   key: 'lamma_lvl_lost',    emoji: '🏜️' },
];

export const levelFor = (pct) => LEVELS.find((l) => pct >= l.at) || LEVELS[LEVELS.length - 1];

const Row = React.memo(({ p, meId, total, t }) => {
  const pct = total > 0 ? Math.round((p.correct / total) * 100) : 0;
  const lvl = levelFor(pct);
  const ch = channelFor((p.rank - 1) % 4);
  const mine = p.user_id === meId;
  return (
    <View style={{
      backgroundColor: mine ? ch.soft : C.glass,
      borderWidth: mine ? 1.5 : 1, borderColor: mine ? ch.color : C.line,
      borderRadius: 16, padding: 13, marginBottom: 9,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Face player={p} size={34} />
        <Text style={{ fontSize: 18, marginStart: 8 }}>{lvl.emoji}</Text>
        <View style={{ flex: 1, minWidth: 0, marginStart: 10 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>
            {p.nickname}
          </Text>
          <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
            {t(lvl.key)}
          </Text>
        </View>
        <Text style={{ color: mine ? ch.color : C.text, fontSize: 20, fontWeight: '900', marginStart: 10 }}>
          {pct}%
        </Text>
      </View>

      {/* the same number again, as a length — a bar is read before a
          digit is, and this is the line people point at */}
      <View style={{ height: 8, borderRadius: 999, backgroundColor: C.glassHi, marginTop: 10, overflow: 'hidden' }}>
        <View style={{ width: pct + '%', height: '100%', backgroundColor: ch.color, borderRadius: 999 }} />
      </View>

      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700', marginTop: 6 }}>
        {t('lamma_right_of').replace('{n}', p.correct).replace('{total}', total)}
      </Text>
    </View>
  );
});

export const EgyptMeter = ({ results, meId, t }) => {
  if (!results || !results.ok) return null;
  const total = results.total || 0;
  const players = Array.isArray(results.players) ? results.players : [];
  if (!total || !players.length) return null;

  const ranked = players.map((p, i) => ({ ...p, rank: i + 1, correct: p.correct || 0 }));

  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{t('lamma_egypt_meter')}</Text>
      <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginTop: 4, marginBottom: 12 }}>
        {t('lamma_egypt_how')}
      </Text>
      {ranked.map((p) => <Row key={p.user_id} p={p} meId={meId} total={total} t={t} />)}
    </View>
  );
};
