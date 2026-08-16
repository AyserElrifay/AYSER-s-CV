import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { channelFor } from './channels';
import { Strip, useCountdown, distributionSegments } from './Strip';
import { createQuestionClock } from '../../lib/lammaClock';
import { say } from './languages';
import { tapMedium, tapSuccess, tapError } from '../../utils/feedback';

/* ─── لمّة · A QUESTION ON A PHONE ───────────────────────────────────
   The whole game happens on this screen, so the rules it follows are
   worth stating:

   IT NEVER SAYS RIGHT OR WRONG BEFORE THE REVEAL. Tapping locks your
   choice and says "sent" — nothing more. Colouring the tile green the
   instant you tap would tell you the answer while the question is still
   open for everyone else, and one player who knows can tell four who do
   not. The verdict arrives from the server, after the deadline, or it
   does not arrive at all.

   THE CLOCK STARTS WHEN YOU SEE IT. Not when the message arrived — see
   src/lib/lammaClock.js. Somebody on a slow connection reads the same
   question with the same twenty seconds as everybody else.

   POSITIONS DO NOT MIRROR. The tiles keep their places in Arabic and in
   English, because the colour and the shape are the muscle memory. Only
   the text inside them follows the language.

   IT SPEAKS FIVE. A question and every one of its options carry
   Arabic, English, French, Spanish and Romanian. The player picks one
   in the room — see LangPicker — and the rest of the room may be
   reading something else entirely. The resolver and the reasons behind
   it live in ./languages.js.                                         */

export const QuestionCard = ({
  question,            // { id, text_ar, text_en, options, timer_ms, media_url }
  index, total,
  onAnswer,            // (selectedIndex, elapsedMs) => void
  result,              // null until the reveal: { correct_index, distribution, your_result }
  t,
  lang = 'en',
}) => {
  const clock = useRef(createQuestionClock()).current;
  const [picked, setPicked] = useState(null);
  const [barW, setBarW] = useState(0);
  const progress = useCountdown(question && question.timer_ms, question && question.id);

  // a new question is a new clock and a clean slate
  useEffect(() => {
    clock.reset();
    setPicked(null);
    clock.markRendered();
  }, [question && question.id, clock]);

  const options = Array.isArray(question && question.options) ? question.options : [];
  const revealed = !!(result && result.ok);

  const choose = (i) => {
    if (picked !== null || revealed) return;   // one answer, and the first one stands
    tapMedium();
    setPicked(i);
    onAnswer(i, clock.sinceRendered());
  };

  // when the verdict lands, say it once, with the phone as well as the screen
  useEffect(() => {
    if (!revealed || !result.your_result) return;
    if (result.your_result.is_correct) tapSuccess(); else tapError();
  }, [revealed]);

  const counts = [0, 0, 0, 0];
  if (revealed && Array.isArray(result.distribution)) {
    result.distribution.forEach((d) => {
      if (d && d.index >= 0 && d.index < 4) counts[d.index] = d.votes || 0;
    });
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      {/* الشريط — counting down, then re-segmenting into the room's split */}
      <View onLayout={(e) => setBarW(e.nativeEvent.layout.width)} style={{ marginTop: 8, marginBottom: 14 }}>
        <Strip
          mode={revealed ? 'distribution' : 'countdown'}
          progress={progress}
          width={barW}
          segments={revealed ? distributionSegments(counts) : []}
        />
      </View>

      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>
        {(index + 1)} / {total}
      </Text>

      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', lineHeight: 31, marginBottom: 16 }}>
        {say(question, lang)}
      </Text>

      {/* A picture is part of the question, not a poster: it is capped
          so that on a small phone the four answers are still on screen
          without scrolling. Nobody should have to scroll during a
          countdown. */}
      {question && question.media_url ? (
        <Image
          source={{ uri: question.media_url }}
          resizeMode="cover"
          style={{ width: '100%', aspectRatio: 16 / 9, maxHeight: 172, borderRadius: 16, marginBottom: 14 }}
        />
      ) : null}

      <View style={{ flex: 1 }}>
        {options.map((o, i) => {
          const ch = channelFor(i);
          const mine = picked === i;
          const isRight = revealed && result.correct_index === i;
          const isMineWrong = revealed && mine && !isRight;

          return (
            <Pressable key={i} onPress={() => choose(i)} disabled={picked !== null || revealed}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isRight ? ch.color : isMineWrong ? C.glassHi : mine ? ch.soft : C.glass,
                borderWidth: mine || isRight ? 2 : 1,
                borderColor: isRight ? ch.color : mine ? ch.color : C.line,
                borderRadius: 18, paddingHorizontal: 14, paddingVertical: 15, marginBottom: 10,
                opacity: revealed && !isRight && !mine ? 0.5 : 1,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isRight ? 'rgba(255,255,255,0.25)' : ch.soft,
                }}>
                  <MaterialCommunityIcons name={ch.icon} size={19} color={isRight ? '#FFF' : ch.color} />
                </View>
                <Text style={{
                  color: isRight ? '#FFF' : C.text, fontSize: 16, fontWeight: '800',
                  marginStart: 12, flex: 1,
                }}>
                  {say(o, lang)}
                </Text>
                {/* The count needs its own space. Without a margin it
                    sits flush against the answer and Arabic reads it as
                    part of the name — "3محمود عبد العزيز" — because
                    bidi puts a Latin digit hard against the Arabic
                    with nothing between them. A logical margin, so it
                    is on the correct side in both directions. */}
                {revealed ? (
                  <Text style={{ color: isRight ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900', marginStart: 10 }}>
                    {counts[i]}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Sent, and nothing else — no hint, no colour, no verdict. */}
      {picked !== null && !revealed ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: C.green, fontSize: 14, fontWeight: '900' }}>{t('lamma_answer_sent')}</Text>
        </View>
      ) : null}

      {revealed && result.your_result ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: result.your_result.is_correct ? C.green : C.coral, fontSize: 17, fontWeight: '900' }}>
            {result.your_result.is_correct ? t('lamma_correct') : t('lamma_wrong')}
          </Text>
          {result.your_result.points > 0 ? (
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 3 }}>
              +{result.your_result.points} {t('lamma_points')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};
