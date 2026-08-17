import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { channelFor } from './channels';
import { Strip, useCountdown, distributionSegments } from './Strip';
import { createQuestionClock } from '../../lib/lammaClock';
import { say, sayNote } from './languages';
import { wantsStill } from './Podium';
import { tapMedium, tapSuccess, tapError } from '../../utils/feedback';

/* ── THE FOUR ARRIVING, AND THE ONE THAT WAS RIGHT ─────────────────
   Two small movements, both of them saying something the still screen
   was already saying more quietly.

   ARRIVING: the tiles come in one after another, 45ms apart. It reads
   as the question being dealt out rather than the screen redrawing,
   and it gives the eye a reason to start at the top.

   LANDING: when the answer is revealed the correct tile takes one
   beat bigger and settles. On a screen where four tiles are already
   four colours, the one that MOVES is the one you look at.

   At module scope on purpose. Declared inside QuestionCard it would be
   a new component type on every render and React would throw every
   tile away and rebuild it — which is the exact fault
   scripts/check-rerender.mjs exists to catch, and it has caught it
   here before. */
const STAGGER_MS = 45;

const Tile = React.memo(({ index, questionId, isRight, children }) => {
  const still = wantsStill();
  const arrive = useRef(new Animated.Value(still ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) { arrive.setValue(1); return undefined; }
    arrive.setValue(0);
    const a = Animated.timing(arrive, {
      toValue: 1, duration: 260, delay: index * STAGGER_MS,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [questionId, index, still, arrive]);

  useEffect(() => {
    if (!isRight || still) return undefined;
    const a = Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [isRight, still, pop]);

  return (
    <Animated.View style={{
      opacity: arrive,
      transform: [
        { translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
        { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
      ],
    }}>
      {children}
    </Animated.View>
  );
});

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
  timerMs,             // the room's own length, when the host has set one
  index, total,
  onAnswer,            // (selectedIndex, elapsedMs) => void
  result,              // null until the reveal: { correct_index, distribution, your_result }
  t,
  lang = 'en',
}) => {
  const clock = useRef(createQuestionClock()).current;
  const [picked, setPicked] = useState(null);
  const [barW, setBarW] = useState(0);
  /* The bar counts the ROOM's length when the host has chosen one.
     Reading it off the question would draw a twenty-second bar over a
     ten-second question — the tiles would still lock correctly, from
     the server's deadline, but everybody would be watching a lie. */
  const runFor = timerMs || (question && question.timer_ms);
  const progress = useCountdown(runFor, question && question.id);

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
            <Tile key={i} index={i} questionId={question && question.id} isRight={isRight}>
            <Pressable onPress={() => choose(i)} disabled={picked !== null || revealed}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isRight ? ch.color : isMineWrong ? C.glassHi : mine ? ch.soft : C.glass,
                borderWidth: mine || isRight ? 2 : 1,
                borderColor: isRight ? ch.color : mine ? ch.color : C.line,
                borderRadius: 18, paddingHorizontal: 14, paddingVertical: 15, marginBottom: 10,
                opacity: revealed && !isRight && !mine ? 0.45 : 1,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isRight ? 'rgba(255,255,255,0.25)' : ch.soft,
                }}>
                  <MaterialCommunityIcons name={ch.icon} size={19} color={isRight ? '#FFF' : ch.color} />
                </View>
                <Text style={{
                  color: isRight ? '#FFF' : C.text, fontSize: 16, fontWeight: '800',
                  marginStart: 12, flex: 1, minWidth: 0,
                }}>
                  {say(o, lang)}
                </Text>
                {/* ── SAY WHICH ONE WAS RIGHT, IN WORDS ──────────────
                    Colour alone was doing this job and it was not
                    enough: the right tile turned its own colour, which
                    on a screen full of colours is not obviously "this
                    is the answer". A tick and the word for it, and a
                    cross on the one you actually picked, so somebody
                    who got it wrong knows what the right answer WAS —
                    which is the entire point of getting it wrong in a
                    game you are playing to learn something. */}
                {revealed && isRight ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginStart: 8 }}>
                    <MaterialCommunityIcons name="check-circle" size={19} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginStart: 5 }}>
                      {t('lamma_the_answer')}
                    </Text>
                  </View>
                ) : null}
                {isMineWrong ? (
                  <MaterialCommunityIcons name="close-circle" size={19} color={C.coral} style={{ marginStart: 8 }} />
                ) : null}
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
            </Tile>
          );
        })}
      </View>

      {/* Sent, and nothing else — no hint, no colour, no verdict. */}
      {picked !== null && !revealed ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: C.green, fontSize: 14, fontWeight: '900' }}>{t('lamma_answer_sent')}</Text>
        </View>
      ) : null}

      {/* ── AND WHY ────────────────────────────────────────────────
          Being told which tile was right teaches you one fact: which
          tile was right. The line under it is the reason — and it is
          shown to everybody, not only to the people who got it wrong,
          because the person who guessed correctly did not learn
          anything either. */}
      {revealed && sayNote(question, lang) ? (
        <View style={{
          backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
          borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 2,
        }}>
          <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700', lineHeight: 19 }}>
            {sayNote(question, lang)}
          </Text>
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
