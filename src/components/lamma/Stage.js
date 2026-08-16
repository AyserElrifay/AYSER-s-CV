import React from 'react';
import { View, Text, Modal, Pressable, Image, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { channelFor } from './channels';
import { say, sayNote } from './languages';
import { Strip, useCountdown, distributionSegments } from './Strip';
import { tapMedium } from '../../utils/feedback';

/* ─── لمّة · THE SHARED SCREEN ───────────────────────────────────────
   What the room looks like when the host is sharing their screen on a
   call and reading the questions out. It is a different job from the
   phone in somebody's hand, so it is a different screen:

   WIDE, because a shared screen is a laptop, a television or a phone
   turned sideways, and a column of phone-sized text down the middle of
   a 16:9 window is a waste of a room's attention.

   BIG, because it is being read from three metres away by somebody who
   is also holding a cup of tea. The type is sized off the window
   rather than fixed, so it fills whatever it is thrown onto.

   AND ONE THING AT A TIME. The question comes up ALONE first — that is
   the page the host reads out loud — and the four choices arrive only
   when the host says so, which is also the moment the clock starts for
   everybody. Nobody loses the fifteen seconds it took to read it.

   ── IT SHOWS NOTHING THE PLAYERS DO NOT HAVE ──────────────────────
   No right answer before the reveal, no scores mid-question, nothing
   the phones do not also have. Somebody watching the shared screen
   cannot learn anything from it that they could not learn from their
   own phone — because half the room WILL be looking at both.        */

/* ── THE BODY, SEPARATE FROM THE MODAL ────────────────────────────
   A Modal draws itself into the document and nothing else can see
   inside it — which also means the layout cannot be rendered and read
   anywhere except a real browser. The wrapper and the picture are two
   different jobs, so they are two exports: Stage is the sheet, and
   this is what is on it. */
export const StageBody = ({
  onClose,
  question, lang, status, index, total,
  joinCode, playerCount, timerMs, result,
  isHost, onShowOptions, onNext,
  t,
}) => {
  const { width, height } = useWindowDimensions();
  const wide = width >= height;               // a shared screen, usually
  const revealed = !!(result && result.ok);
  const progress = useCountdown(timerMs, question && question.id);

  /* Sized off the window, not off a phone. The clamps stop a huge
     monitor turning one question into a billboard and a small laptop
     losing the last line of a long one. */
  const qSize = Math.max(22, Math.min(56, width / (wide ? 24 : 17)));
  const oSize = Math.max(15, Math.min(30, width / (wide ? 46 : 26)));
  const pad = wide ? 40 : 20;

  const options = Array.isArray(question && question.options) ? question.options : [];
  const counts = [0, 0, 0, 0];
  if (revealed && Array.isArray(result.distribution)) {
    result.distribution.forEach((d) => {
      if (d && d.index >= 0 && d.index < 4) counts[d.index] = d.votes || 0;
    });
  }
  const showChoices = status !== 'reading';

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0620', padding: pad }}>

        {/* the room, along the top: who is in it and how they get in */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: wide ? 18 : 12 }}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={wide ? 30 : 24} color="rgba(255,255,255,0.55)" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: wide ? 15 : 12, fontWeight: '900', letterSpacing: 2 }}>
              {t('lamma_code_label')}
            </Text>
            <Text style={{ color: '#FFF', fontSize: wide ? 40 : 26, fontWeight: '900', letterSpacing: wide ? 12 : 7 }}>
              {joinCode || '—'}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: wide ? 18 : 13, fontWeight: '900' }}>
            {playerCount} · {(index + 1)}/{total}
          </Text>
        </View>

        {/* the clock — only once there is one to run */}
        {showChoices && !revealed ? (
          <View style={{ marginBottom: wide ? 22 : 14 }}>
            <Strip mode="countdown" progress={progress} width={width - pad * 2} segments={[]} />
          </View>
        ) : null}
        {revealed ? (
          <View style={{ marginBottom: wide ? 22 : 14 }}>
            <Strip mode="distribution" progress={0} width={width - pad * 2} segments={distributionSegments(counts)} />
          </View>
        ) : null}

        {/* the question, as big as it can honestly be */}
        <View style={{ flex: showChoices ? 0 : 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: wide && question && question.media_url ? 'row' : 'column', alignItems: 'center' }}>
            {question && question.media_url ? (
              <Image
                source={{ uri: question.media_url }}
                resizeMode="cover"
                style={{
                  width: wide ? width * 0.32 : '100%',
                  height: wide ? height * 0.34 : height * 0.22,
                  borderRadius: 22,
                  marginEnd: wide ? 28 : 0,
                  marginBottom: wide ? 0 : 16,
                }}
              />
            ) : null}
            <Text style={{
              color: '#FFF', fontSize: qSize, fontWeight: '900', lineHeight: qSize * 1.32,
              textAlign: 'center', flex: wide && question && question.media_url ? 1 : 0,
            }}>
              {say(question, lang)}
            </Text>
          </View>

          {!showChoices ? (
            <Text style={{
              color: 'rgba(255,255,255,0.45)', fontSize: wide ? 20 : 14, fontWeight: '800',
              textAlign: 'center', marginTop: 26,
            }}>
              {t('lamma_reading_now')}
            </Text>
          ) : null}
        </View>

        {/* and the four, when they are due */}
        {showChoices ? (
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: wide ? 20 : 14 }}>
            {options.map((o, i) => {
              const ch = channelFor(i);
              const isRight = revealed && result.correct_index === i;
              return (
                <View key={i} style={{
                  width: wide ? '49%' : '100%',
                  minHeight: wide ? '44%' : 62,
                  backgroundColor: isRight ? ch.color : 'rgba(255,255,255,0.07)',
                  borderWidth: 2, borderColor: isRight ? ch.color : 'rgba(255,255,255,0.16)',
                  borderRadius: 20, paddingHorizontal: wide ? 22 : 14, paddingVertical: wide ? 18 : 12,
                  marginBottom: wide ? 12 : 9,
                  flexDirection: 'row', alignItems: 'center',
                  opacity: revealed && !isRight ? 0.4 : 1,
                }}>
                  <View style={{
                    width: wide ? 48 : 34, height: wide ? 48 : 34, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isRight ? 'rgba(255,255,255,0.25)' : ch.soft,
                  }}>
                    <MaterialCommunityIcons name={ch.icon} size={wide ? 26 : 19} color={isRight ? '#FFF' : ch.color} />
                  </View>
                  <Text style={{ color: '#FFF', fontSize: oSize, fontWeight: '800', marginStart: 14, flex: 1, minWidth: 0 }}>
                    {say(o, lang)}
                  </Text>
                  {revealed ? (
                    <Text style={{ color: isRight ? '#FFF' : 'rgba(255,255,255,0.55)', fontSize: oSize, fontWeight: '900', marginStart: 10 }}>
                      {counts[i]}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* the line that teaches, once the answer is out */}
        {revealed && sayNote(question, lang) ? (
          <Text style={{
            color: 'rgba(255,255,255,0.7)', fontSize: Math.max(13, oSize * 0.8), fontWeight: '700',
            textAlign: 'center', marginTop: 6, marginBottom: 4,
          }}>
            {sayNote(question, lang)}
          </Text>
        ) : null}

        {/* and the one button the host needs, whichever moment it is */}
        {isHost ? (
          <Pressable
            onPress={() => { tapMedium(); (status === 'reading' ? onShowOptions : onNext)(); }}
            style={{ marginTop: 10 }}
          >
            <View style={{
              backgroundColor: C.purple, borderRadius: 999,
              paddingVertical: wide ? 18 : 14, alignItems: 'center',
            }}>
              <Text style={{ color: '#FFF', fontSize: wide ? 20 : 15, fontWeight: '900' }}>
                {status === 'reading' ? t('lamma_show_choices') : t('lamma_next')}
              </Text>
            </View>
          </Pressable>
        ) : null}
    </View>
  );
};

export const Stage = (props) => (
  <Modal visible={!!props.visible} animationType="fade" transparent={false} onRequestClose={props.onClose}>
    <StageBody {...props} />
  </Modal>
);
