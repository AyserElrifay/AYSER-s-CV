import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../../constants/theme';
import { startGame, groupStreak, weMet, uploadPhoto, pingGroup } from '../../services/squadGames';
import { gw, fill, say, ROULETTE, LIKELY, BINGO } from './words';
import { tapLight, tapMedium, tapSelection, tapSuccess } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';

/* ─── GAMES FOR A GROUP ───────────────────────────────────────────────
   Opened from the games button in a group chat. Starting a game posts
   it into the chat (sgame_start); the chat is where it is played. Below
   the games: the group's weeks in a row, its twin group across the
   world, one world, and the games for when you are at the table. */

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const Row = ({ emoji, title, sub, onPress }) => (
  <Pressable onPress={() => { tapLight(); onPress(); }} accessibilityRole="button">
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Text style={{ fontSize: 26, width: 40 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </View>
  </Pressable>
);

const Main = ({ label, onPress, busy, disabled, ghost }) => (
  <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" style={{ marginTop: 14 }}>
    <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: ghost ? C.glassHi : C.purple, opacity: disabled ? 0.5 : 1 }}>
      {busy ? <ActivityIndicator color={ghost ? C.text : '#FFF'} /> : <Text style={{ color: ghost ? C.text : '#FFF', fontSize: 15, fontWeight: '900' }}>{label}</Text>}
    </View>
  </Pressable>
);

const field = () => ({ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: C.glass, marginTop: 10 });

export const GroupGamesSheet = ({ squadId, userId, lang, onClose, onOpen }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const T = (k) => gw(lang, k);
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [streak, setStreak] = useState(null);
  // the composers
  const [idea, setIdea] = useState(() => rnd(ROULETTE));
  const [q, setQ] = useState(() => rnd(LIKELY));
  const [qOwn, setQOwn] = useState('');
  const [photo, setPhoto] = useState(null);
  const [hint, setHint] = useState('');
  const [answer, setAnswer] = useState('');
  const [lines, setLines] = useState(['', '', '']);

  useEffect(() => { groupStreak(squadId).then((r) => r && r.ok && setStreak(r)); }, [squadId]);

  const send = async (k, data, secret) => {
    setBusy(true); setErr(null);
    try {
      const r = await startGame(squadId, k, data, secret);
      if (!r || r.ok === false) { setErr(T(r && ['setup', 'offline', 'slow_down', 'empty'].includes(r.reason) ? r.reason : r && r.reason === 'photo' ? 'photo_err' : 'err')); return; }
      tapSuccess(); pingGroup(squadId, r.id); onClose(true);
    } finally { setBusy(false); }
  };

  const pick = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      setPhoto({ local: res.assets[0].uri, url: null });
      setBusy(true); setErr(null);
      const url = await uploadPhoto(userId, res.assets[0].uri);
      setPhoto({ local: res.assets[0].uri, url });
    } catch (e) { setErr(T('photo_err')); setPhoto(null); } finally { setBusy(false); }
  };

  const toggleMet = async () => {
    tapMedium();
    const r = await weMet(squadId, !(streak && streak.me));
    if (r && r.ok) { setStreak(r); pingGroup(squadId, null); }
  };

  let composer = null;
  if (kind === 'roulette') {
    composer = (
      <>
        <View style={{ alignItems: 'center', paddingVertical: 26, borderRadius: 22, backgroundColor: C.purpleSoft, marginTop: 14 }}>
          <Text style={{ fontSize: 54 }}>{idea.e}</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 10, paddingHorizontal: 16 }}>{say(lang, idea)}</Text>
        </View>
        <Main label={'🎡 ' + T('spin_again')} ghost onPress={() => { tapSelection(); let n = idea; while (n === idea) n = rnd(ROULETTE); setIdea(n); }} />
        <Main label={T('post')} busy={busy} onPress={() => send('roulette', { title: say(lang, idea), emoji: idea.e, kind: idea.kind, hour: idea.hour })} />
      </>
    );
  } else if (kind === 'likely') {
    composer = (
      <>
        <View style={{ padding: 18, borderRadius: 22, backgroundColor: C.purpleSoft, marginTop: 14 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', lineHeight: 25 }}>{T('likely').replace('…', '') + ' ' + (qOwn.trim() || (lang === 'ar' ? q[1] : q[0])) + '?'}</Text>
        </View>
        <Main label={'🔀 ' + T('next')} ghost onPress={() => { tapSelection(); setQOwn(''); let n = q; while (n === q) n = rnd(LIKELY); setQ(n); }} />
        <TextInput value={qOwn} onChangeText={setQOwn} maxLength={140} placeholder="…" placeholderTextColor={C.faint} style={field()} />
        <Main label={T('post')} busy={busy} onPress={() => send('likely', { q: qOwn.trim() || (lang === 'ar' ? q[1] : q[0]) })} />
      </>
    );
  } else if (kind === 'bingo') {
    composer = (
      <>
        <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 10 }}>{T('week_card')}</Text>
        <Main label={T('post')} busy={busy} onPress={() => send('bingo', { cells: shuffle(BINGO).slice(0, 9).map((c) => (lang === 'ar' ? c[1] : c[0])) })} />
      </>
    );
  } else if (kind === 'spot') {
    composer = (
      <>
        <Pressable onPress={pick} accessibilityRole="button" style={{ marginTop: 14 }}>
          <View style={{ height: 190, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: C.glass }}>
            {photo ? <Image source={{ uri: photo.local }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : <><Ionicons name="image-outline" size={30} color={C.purple} /><Text style={{ color: C.purple, fontSize: 14, fontWeight: '900', marginTop: 6 }}>{T('photo')}</Text></>}
          </View>
        </Pressable>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>{T('no_faces')}</Text>
        <TextInput value={answer} onChangeText={setAnswer} maxLength={60} placeholder={T('answer_ph')} placeholderTextColor={C.faint} style={field()} />
        <TextInput value={hint} onChangeText={setHint} maxLength={80} placeholder={T('hint_ph')} placeholderTextColor={C.faint} style={field()} />
        <Main label={T('post')} busy={busy} disabled={!photo || !photo.url || !answer.trim()} onPress={() => send('spot', { photo: photo.url, hint: hint.trim() }, { answer: answer.trim() })} />
      </>
    );
  } else if (kind === 'truths') {
    composer = (
      <>
        {[0, 1, 2].map((i) => (
          <TextInput key={i} value={lines[i]} maxLength={120} onChangeText={(v) => setLines((l) => l.map((x, k) => (k === i ? v : x)))}
            placeholder={(i < 2 ? '✓ ' + T('truth_ph') : '✨ ' + T('plan_ph'))} placeholderTextColor={C.faint} style={field()} />
        ))}
        <Main label={T('post')} busy={busy} disabled={lines.some((l) => !l.trim())}
          onPress={() => {
            // the plan is the third line typed; its place in the card is random
            const order = shuffle([0, 1, 2]);
            send('truths', { lines: order.map((i) => lines[i].trim()) }, { plan: order.indexOf(2) });
          }} />
      </>
    );
  }

  const GAMES = [
    { k: 'roulette', e: '🎡' }, { k: 'likely', e: '🗳️' }, { k: 'bingo', e: '🎯' }, { k: 'spot', e: '📍' }, { k: 'truths', e: '🤞' },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={() => (kind ? setKind(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={() => { tapLight(); if (kind) { setKind(null); setErr(null); } else onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={T(kind ? 'back' : 'close')}>
            {kind ? <Ionicons name="chevron-back" size={26} color={C.text} /> : <Ionicons name="chevron-down" size={26} color={C.text} />}
          </Pressable>
          {kind ? (
            <>
              <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.3, marginTop: 8 }}>{GAMES.find((g) => g.k === kind).e + ' ' + T(kind)}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{T(kind + '_s')}</Text>
              {composer}
            </>
          ) : (
            <>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🎲 ' + T('games')}</Text>

              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20 }}>{T('group').toUpperCase()}</Text>
              {GAMES.map((g) => <Row key={g.k} emoji={g.e} title={T(g.k)} sub={T(g.k + '_s')} onPress={() => { setErr(null); setKind(g.k); }} />)}

              {/* the group's weeks in a row — real, from the people who said so */}
              <View style={{ borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 22 }}>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>
                  {'🔥 ' + (streak && streak.weeks ? fill(T('weeks'), { n: streak.weeks }) : T('weeks0'))}
                </Text>
                <Text style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>{T('met_s') + (streak && streak.this_week ? ' · ' + fill(T('met_n'), { n: streak.this_week }) : '')}</Text>
                <Main label={(streak && streak.me ? '✓ ' : '') + T('met')} ghost={!!(streak && streak.me)} onPress={toggleMet} disabled={!streak} />
              </View>

              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 24 }}>{T('world').toUpperCase()}</Text>
              <Row emoji="🌍" title={T('twin')} sub={T('twin_s')} onPress={() => onOpen('twin')} />
              <Row emoji="🌅" title={T('world')} sub={T('world_s')} onPress={() => onOpen('world')} />

              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 24 }}>{T('table').toUpperCase()}</Text>
              <Row emoji="🃏" title={T('table')} sub={T('party_s')} onPress={() => onOpen('party')} />
            </>
          )}
          {err ? <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 14 }}>{err}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
