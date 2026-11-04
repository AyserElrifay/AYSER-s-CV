import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { cw, seatNo, interestLine } from '../constants/cardWords';
import { seatCard } from '../services/card';
import { SeatBadge } from './SeatCard';
import { tapLight, tapSuccess, tapMedium } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── BEFORE THE TABLE, AND THE FIRST FIVE MINUTES AT IT ──────────────
   Ayser, November 2026.
   · The seat strip: once the table chat opens (4 hours before), a row of
     the people coming — their seat, a blurred face and what they are into.
     Only what the chat already shows before the scan (RUN_ME.sql
     table_seats): never a name, never a card answer.
   · Guess Who at the Table: after you scan the table's QR, a 5-minute game
     made of the card answers of the people you can now see (seat_card
     opens them only when you have both scanned — the promise on the card).
     Each phone plays its own round; nothing is stored. */
const W = {
  en: { strip: "WHO'S COMING", gw: 'Guess Who at the Table', gwSub: '5 minutes, from the answers on everybody’s card.', play: 'Play', who: 'Who said it?', right: 'Right!', wrong: 'It was {n}', next: 'Next', done: 'Time! You got {s} of {t}.', again: 'Play again', few: 'Needs two more people who scanned in with their card. Try again in a few minutes.', close: 'Close' },
  ar: { strip: 'مين جاي', gw: 'خمّن مين على الترابيزة', gwSub: '٥ دقايق، من الإجابات اللي على كارت كل واحد.', play: 'العب', who: 'مين قال كده؟', right: 'صح!', wrong: 'كان {n}', next: 'اللي بعده', done: 'الوقت خلص! جبت {s} من {t}.', again: 'العب تاني', few: 'محتاجين اتنين كمان عملوا scan وعندهم كارت. جرّب كمان شوية.', close: 'إغلاق' },
};
const tw = (lang, k, v) => { let s = W[lang === 'ar' ? 'ar' : 'en'][k] || W.en[k]; Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); }); return s; };

/* the row of seats, before the scan */
export const SeatStrip = ({ seats, me, lang, onPeek }) => {
  const others = (seats || []).filter((s) => s.uid !== me);
  if (others.length < 2) return null;
  return (
    <View testID="seat-strip" style={{ marginTop: 10 }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.2 }}>{tw(lang, 'strip') + '  ·  ' + others.length}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 8, marginHorizontal: -4 }}>
        {others.map((s) => (
          <Pressable key={s.uid} onPress={() => { tapLight(); onPeek && onPeek(s.uid); }} accessibilityRole="button" style={{ marginHorizontal: 4 }}>
            <View style={{ width: 132, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass }}>
              <SeatBadge seat={s} lang={lang} size={40} />
              <Text style={[{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 8 }, NUM]} numberOfLines={1}>
                {s.host ? (s.name || cw(lang, 'organizer')) : s.open && s.name ? s.name : cw(lang, 'seat', { n: seatNo(s.seat) })}
              </Text>
              <Text style={{ color: C.dim, fontSize: 12, lineHeight: 16, marginTop: 2, minHeight: 32 }} numberOfLines={2}>
                {s.host ? cw(lang, 'organizer') : interestLine(s.interests) || '—'}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const GAME_MS = 5 * 60 * 1000;

const GuessGame = ({ deck, people, lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [round, setRound] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const [cards, setCards] = useState(() => shuffle(deck).slice(0, 10));
  const ends = useRef(Date.now() + GAME_MS);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, []);
  const left = Math.max(0, ends.current - now);
  const over = left === 0 || round >= cards.length;
  const card = cards[round];
  const answer = (uid) => {
    if (pick) return;
    setPick(uid);
    if (uid === card.uid) { tapSuccess(); setScore((x) => x + 1); } else tapMedium();
  };
  const again = () => { tapLight(); setCards(shuffle(deck).slice(0, 10)); setRound(0); setPick(null); setScore(0); ends.current = Date.now() + GAME_MS; setNow(Date.now()); };
  const mm = Math.floor(left / 60000); const ss = Math.floor((left % 60000) / 1000);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View testID="guess-who" style={{ flex: 1, backgroundColor: '#FAF8F5', paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={tw(lang, 'close')}><Ionicons name="close" size={26} color="#18181B" /></Pressable>
          <Text style={{ flex: 1, color: '#18181B', fontSize: 17, fontWeight: '800', marginStart: 10 }} numberOfLines={1}>{tw(lang, 'gw')}</Text>
          <Text style={[{ color: '#18181B', fontSize: 17, fontWeight: '800' }, NUM]}>{mm + ':' + String(ss).padStart(2, '0')}</Text>
        </View>
        {over ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ color: '#18181B', fontSize: 28, fontWeight: '800', lineHeight: 36 }}>{tw(lang, 'done', { s: score, t: Math.min(round + (pick ? 1 : 0), cards.length) })}</Text>
            <Pressable onPress={again} accessibilityRole="button" style={{ marginTop: 22 }}>
              <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: C.purple }}>
                <Text style={{ color: C.ink, fontSize: 16, fontWeight: '800' }}>{tw(lang, 'again')}</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 20 }}>
            <View style={{ borderRadius: 24, padding: 20, backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#F1CACA' }}>
              <Text style={{ color: '#7A4A4A', fontSize: 12.5, fontWeight: '800' }}>{card.q}</Text>
              <Text testID="gw-answer" style={{ color: '#18181B', fontSize: 23, fontWeight: '700', lineHeight: 31, marginTop: 8 }}>{'“' + card.a + '”'}</Text>
            </View>
            <Text style={{ color: '#18181B', fontSize: 15, fontWeight: '800', marginTop: 20 }}>{tw(lang, 'who')}</Text>
            {people.map((p) => {
              const isIt = pick && p.uid === card.uid;
              const wrongPick = pick === p.uid && p.uid !== card.uid;
              return (
                <Pressable key={p.uid} testID="gw-option" onPress={() => answer(p.uid)} disabled={!!pick} accessibilityRole="button" style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: isIt ? '#1F8A4C' : wrongPick ? '#B3261E' : 'rgba(24,24,27,0.12)', backgroundColor: isIt ? '#E6F0EC' : '#FFFFFF' }}>
                    <Text style={{ flex: 1, color: '#18181B', fontSize: 15.5, fontWeight: '700' }}>{p.name}</Text>
                    {isIt ? <Ionicons name="checkmark-circle" size={20} color="#1F8A4C" /> : wrongPick ? <Ionicons name="close-circle" size={20} color="#B3261E" /> : null}
                  </View>
                </Pressable>
              );
            })}
            {pick ? (
              <>
                <Text style={{ color: pick === card.uid ? '#1F8A4C' : '#B3261E', fontSize: 16, fontWeight: '800', marginTop: 14 }}>
                  {pick === card.uid ? tw(lang, 'right') : tw(lang, 'wrong', { n: (people.find((p) => p.uid === card.uid) || {}).name || '' })}
                </Text>
                <Pressable testID="gw-next" onPress={() => { tapLight(); setPick(null); setRound((x) => x + 1); }} accessibilityRole="button" style={{ marginTop: 12 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple }}>
                    <Text style={{ color: C.ink, fontSize: 15.5, fontWeight: '800' }}>{tw(lang, 'next')}</Text>
                  </View>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

/* the door to the game, under the chat once you are checked in; it opens by
   itself the first time the game is ready at this table */
export const GuessWho = ({ kind, id, seats, me, lang }) => {
  const [deck, setDeck] = useState(null);
  const [open, setOpen] = useState(false);
  const eligible = useMemo(() => (seats || []).filter((s) => s.uid !== me && s.open && !s.host && s.checked_in), [seats, me]);
  const key = eligible.map((s) => s.uid).sort().join(',');
  useEffect(() => {
    let alive = true;
    if (eligible.length < 2) { setDeck([]); return undefined; }
    Promise.all(eligible.map((s) => seatCard(kind, id, s.uid).then((c) => ({ s, c })).catch(() => null))).then((rows) => {
      if (!alive) return;
      const d = [];
      (rows || []).forEach((x) => {
        if (!x || !x.c || !x.c.ok || !x.c.open || !Array.isArray(x.c.prompts)) return;
        x.c.prompts.forEach((p) => { if (p && p.a && String(p.a).trim()) d.push({ uid: x.s.uid, q: p.q, a: String(p.a).trim() }); });
      });
      setDeck(d);
      const flag = 'mm.gw.' + id;
      let seen = false;
      try { seen = localStorage.getItem(flag) === '1'; } catch (e) {}
      if (!seen && new Set(d.map((c) => c.uid)).size >= 2) { try { localStorage.setItem(flag, '1'); } catch (e) {} setOpen(true); }
    });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const people = eligible.filter((s) => (deck || []).some((c) => c.uid === s.uid)).map((s) => ({ uid: s.uid, name: s.name || cw(lang, 'seat', { n: seatNo(s.seat) }) }));
  const ready = people.length >= 2;
  return (
    <>
      <Pressable testID="gw-door" onPress={() => { tapLight(); setOpen(true); }} disabled={!ready} accessibilityRole="button" style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#F1CACA', opacity: deck == null ? 0.6 : 1 }}>
          <Ionicons name="help-circle-outline" size={24} color="#18181B" />
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={{ color: '#18181B', fontSize: 15, fontWeight: '800' }}>{tw(lang, 'gw')}</Text>
            <Text style={{ color: 'rgba(24,24,27,0.65)', fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>{deck != null && !ready ? tw(lang, 'few') : tw(lang, 'gwSub')}</Text>
          </View>
          {deck == null ? <ActivityIndicator color="#18181B" /> : ready ? <Text style={{ color: '#18181B', fontSize: 14, fontWeight: '900' }}>{tw(lang, 'play')}</Text> : null}
        </View>
      </Pressable>
      {open && ready ? <GuessGame deck={(deck || []).filter((c) => people.some((p) => p.uid === c.uid))} people={people} lang={lang} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
