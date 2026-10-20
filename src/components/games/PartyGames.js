import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { gw, fill, QUESTIONS, PLACES, ACT, DONT } from './words';
import { tapLight, tapMedium, tapSelection, tapSuccess, tapWarning } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';

/* ─── AT THE TABLE ────────────────────────────────────────────────────
   Games for when you are already out together: one phone, passed
   round. Nothing is sent anywhere; nothing needs a signal.
     Questions      three small decks to get talking
     The outsider   everyone sees the place but one; find them
     Act it out     mime it in 60 seconds
     Don't say it   explain a word without the three under it
   The cards are in words.js, written for Moments. */

const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const Big = ({ label, onPress, ghost, color }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1 }}>
    <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: ghost ? C.glassHi : (color || C.purple) }}>
      <Text style={{ color: ghost ? C.text : '#FFF', fontSize: 15.5, fontWeight: '900' }}>{label}</Text>
    </View>
  </Pressable>
);

const Card = ({ children, tone }) => (
  <View style={{ minHeight: 240, borderRadius: 26, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: tone || C.purpleSoft, marginTop: 18 }}>
    {children}
  </View>
);

const Questions = ({ lang, T }) => {
  const [deck, setDeck] = useState('warm');
  const [order, setOrder] = useState(() => shuffle(QUESTIONS.warm));
  const [i, setI] = useState(0);
  const choose = (d) => { tapSelection(); setDeck(d); setOrder(shuffle(QUESTIONS[d])); setI(0); };
  const q = order[i % order.length];
  return (
    <>
      <View style={{ flexDirection: 'row', marginTop: 14, gap: 8 }}>
        {['warm', 'deep', 'fun'].map((d) => (
          <Pressable key={d} onPress={() => choose(d)} accessibilityRole="tab" accessibilityState={{ selected: deck === d }} style={{ flex: 1 }}>
            <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: deck === d ? C.text : C.glassHi }}>
              <Text style={{ color: deck === d ? C.bg : C.text, fontSize: 13, fontWeight: '900' }}>{T(d)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Card>
        <Text style={{ color: C.text, fontSize: 23, fontWeight: '900', textAlign: 'center', lineHeight: 32 }}>{lang === 'ar' ? q[1] : q[0]}</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 16 }}>{(i % order.length) + 1 + ' / ' + order.length}</Text>
      </Card>
      <View style={{ flexDirection: 'row', marginTop: 16 }}><Big label={T('next')} onPress={() => { tapLight(); setI(i + 1); }} /></View>
    </>
  );
};

const Outsider = ({ lang, T }) => {
  const [n, setN] = useState(4);
  const [g, setG] = useState(null);      // { place, out, turn, seen }
  const begin = () => { tapMedium(); setG({ place: PLACES[Math.floor(Math.random() * PLACES.length)], out: Math.floor(Math.random() * n), turn: 0, seen: false, done: false, show: false }); };
  if (!g) {
    return (
      <>
        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20 }}>{T('players').toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
          <Pressable onPress={() => { tapSelection(); setN(Math.max(3, n - 1)); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="−"><Ionicons name="remove-circle" size={40} color={C.purple} /></Pressable>
          <Text style={{ color: C.text, fontSize: 44, fontWeight: '900', marginHorizontal: 28 }}>{n}</Text>
          <Pressable onPress={() => { tapSelection(); setN(Math.min(12, n + 1)); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="+"><Ionicons name="add-circle" size={40} color={C.purple} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 24 }}><Big label={T('start')} onPress={begin} /></View>
      </>
    );
  }
  const place = lang === 'ar' ? g.place[1] : g.place[0];
  if (g.done) {
    return (
      <>
        <Card>
          <Text style={{ fontSize: 42 }}>🕵️</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 12, lineHeight: 27 }}>{T('o_talk')}</Text>
          {g.show ? <Text style={{ color: C.purple, fontSize: 20, fontWeight: '900', marginTop: 16 }}>{fill(T('o_place'), { p: place }) + ' · #' + (g.out + 1)}</Text> : null}
        </Card>
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          {!g.show ? <Big label={T('o_show')} ghost onPress={() => { tapSuccess(); setG({ ...g, show: true }); }} /> : null}
          <Big label={T('again')} onPress={begin} />
        </View>
      </>
    );
  }
  const isOut = g.turn === g.out;
  return (
    <>
      <Card tone={g.seen ? (isOut ? C.coralSoft : C.greenSoft) : C.purpleSoft}>
        {!g.seen ? (
          <>
            <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', textAlign: 'center' }}>{fill(T('o_pass'), { n: g.turn + 1 })}</Text>
            <Text style={{ color: C.faint, fontSize: 13, marginTop: 8 }}>{g.turn + 1 + ' / ' + n}</Text>
          </>
        ) : isOut ? (
          <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', textAlign: 'center', lineHeight: 29 }}>{'🕵️ ' + T('o_you_out')}</Text>
        ) : (
          <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{'📍 ' + fill(T('o_place'), { p: place })}</Text>
        )}
      </Card>
      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        {!g.seen ? <Big label={T('o_see')} onPress={() => { tapMedium(); setG({ ...g, seen: true }); }} />
          : <Big label={T('o_hide')} ghost onPress={() => { tapLight(); setG(g.turn + 1 >= n ? { ...g, done: true } : { ...g, turn: g.turn + 1, seen: false }); }} />}
      </View>
    </>
  );
};

/* the 60-second rounds: Act it out and Don't say it */
const Timed = ({ lang, T, kind }) => {
  const [deck, setDeck] = useState(() => shuffle(kind === 'act' ? ACT : DONT));
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(null);   // null = not started
  const [score, setScore] = useState(0);
  const tick = useRef(null);
  useEffect(() => () => clearInterval(tick.current), []);
  const go = () => {
    tapMedium(); setScore(0); setLeft(60);
    clearInterval(tick.current);
    tick.current = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(tick.current); tapWarning(); return 0; }
      return s - 1;
    }), 1000);
  };
  const step = (got) => { if (got) { tapSuccess(); setScore((s) => s + 1); } else tapLight(); if (i + 1 >= deck.length) { setDeck(shuffle(deck)); setI(0); } else setI(i + 1); };
  const card = deck[i];
  const word = kind === 'act' ? (lang === 'ar' ? card[1] : card[0]) : (lang === 'ar' ? card.ar : card.en);

  if (left == null || left === 0) {
    return (
      <>
        <Card>
          <Text style={{ fontSize: 44 }}>{left === 0 ? '⏰' : kind === 'act' ? '🎭' : '🤐'}</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 12 }}>{left === 0 ? T('time_up') : T('ready')}</Text>
          {left === 0 ? <Text style={{ color: C.purple, fontSize: 22, fontWeight: '900', marginTop: 10 }}>{fill(T('round'), { n: score })}</Text> : null}
        </Card>
        <View style={{ flexDirection: 'row', marginTop: 16 }}><Big label={left === 0 ? T('again') : T('start')} onPress={go} /></View>
      </>
    );
  }
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text style={{ color: left <= 10 ? C.coral : C.text, fontSize: 22, fontWeight: '900' }}>{'⏱ ' + left}</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{T('score') + ' ' + score}</Text>
      </View>
      <Card tone={C.glass}>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', textAlign: 'center' }}>{kind === 'act' ? word : word[0]}</Text>
        {kind === 'dont' ? (
          <View style={{ marginTop: 18, alignItems: 'center' }}>
            {word.slice(1).map((w) => <Text key={w} style={{ color: C.coral, fontSize: 18, fontWeight: '800', marginTop: 4, textDecorationLine: 'line-through' }}>{w}</Text>)}
          </View>
        ) : null}
      </Card>
      <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
        <Big label={T('skip')} ghost onPress={() => step(false)} />
        <Big label={'✓ ' + T('got')} color={C.green} onPress={() => step(true)} />
      </View>
    </>
  );
};

export const PartyGames = ({ lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const T = (k) => gw(lang, k);
  const [game, setGame] = useState(null);
  const LIST = [
    { k: 'q', e: '💬' }, { k: 'outsider', e: '🕵️' }, { k: 'act', e: '🎭' }, { k: 'dont', e: '🤐' },
  ];
  return (
    <Modal visible animationType="slide" onRequestClose={() => (game ? setGame(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={() => { tapLight(); if (game) setGame(null); else onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={T(game ? 'back' : 'close')}>
            {game ? <Ionicons name="chevron-back" size={26} color={C.text} /> : <Ionicons name="chevron-down" size={26} color={C.text} />}
          </Pressable>
          {!game ? (
            <>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🃏 ' + T('table')}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{T('party_s')}</Text>
              {LIST.map((g) => (
                <Pressable key={g.k} onPress={() => { tapLight(); setGame(g.k); }} accessibilityRole="button">
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 12 }}>
                    <Text style={{ fontSize: 30, width: 46 }}>{g.e}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }}>{T(g.k)}</Text>
                      <Text style={{ color: C.dim, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{T(g.k + '_s')}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.3, marginTop: 8 }}>{LIST.find((g) => g.k === game).e + ' ' + T(game)}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{T(game + '_s')}</Text>
              {game === 'q' ? <Questions lang={lang} T={T} /> : game === 'outsider' ? <Outsider lang={lang} T={T} /> : <Timed key={game} lang={lang} T={T} kind={game} />}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
