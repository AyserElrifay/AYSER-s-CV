import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, SUPABASE_READY } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { getProfile } from '../../services/profiles';
import { tapLight, tapMedium, tapSuccess, tapCelebrate } from '../../utils/feedback';
import { sfxPop } from '../../utils/sfx';
import { ytId } from '../../lib/ytId';
import { lazyOverlay } from '../../lib/lazyScreen';
// the YouTube player loads when a karaoke song starts (the English Circle shares it)
const YtKaraoke = lazyOverlay(() => import('./YtKaraoke').then((m) => ({ default: m.YtKaraoke })));
import { appSettings } from '../../services/offers';
import { useSheetBack } from '../../hooks/useSheetBack';
import { SPY_PACKS, TABOO, BOMB, SONGS, parseCustom, pick } from './tableContent';
import { GEARS, VOTES } from './sparkDecks';

/* ─── LAMMA · THE TABLE GAMES ─────────────────────────────────────────
   Ayser, October 2026: four heads-up games for the people around one
   table, each on their own phone:
     · Spy at the Table (المندَسّ) — everybody shares a word but one; with
       Double Agent the spy gets a close cousin of it instead.
     · Arousty & the Table Bomb — describe a word without its four
       forbidden words while the other team holds a "Caught you!"
       buzzer; or one phone, five seconds, name three, pass it on.
     · Table Sparks — "Who at this table…" with the players' own names,
       and hot takes that split the table.
     · Campfire & Karaoke — the same lyrics scrolling on every phone, and
       chords above them for whoever has the guitar.
   One phone starts a room and shows a 6-digit code; the others type it.
   The starting phone runs the game and tells the others what is on
   screen, over one Realtime channel (nothing is stored). */

const W = {
  en: {
    title: 'Table games', sub: 'One phone starts, everybody joins with the code.',
    spy: 'Spy at the Table', spyS: 'One of you does not know the word.',
    taboo: 'Arousty', tabooS: 'Describe it without the 4 forbidden words.',
    bomb: 'Table Bomb', bombS: 'One phone · 5 seconds · name three · pass it.',
    sparks: 'Spill or Spark', sparksS: 'The truth out loud — or take the Spark.',
    spot: 'Spotlight on', spill: 'Spill the truth', pass: 'Pass & take the Spark', spillNow: 'Answer out loud to the table.', sparkTitle: 'THE SPARK', truthTitle: 'THE TRUTH', blind: 'BLIND TABLE VOTE', secs: '{n}s', topVote: 'The table says', noVotes: 'Nobody voted this time.', yourTurn: 'Your turn',
    karaoke: 'Campfire & Karaoke', karaokeS: 'The same lyrics on every phone, chords for the guitar.',
    start: 'Start a room', join: 'Join', codePh: '6-digit code', code: 'Room code', players: 'At the table',
    waiting: 'Waiting for the host to start…', go: 'Start', next: 'Next', leave: 'Leave',
    needMore: 'Needs at least {n} players.', bad: 'No room with that code.',
    pack: 'Pack', double: 'Double Agent', doubleS: 'The spy gets a close word instead of nothing.',
    yourWord: 'Your word', youSpy: 'You are the spy', youSpyS: 'Blend in. Guess the word.', youDouble: 'Your word (you might be the spy)',
    tapShow: 'Tap to see your card', tapHide: 'Tap to hide', talk: 'Take turns saying one word about it.',
    voteNow: 'Vote now', voteWho: 'Who is the spy?', voted: 'Voted', reveal: 'Reveal',
    spyWas: 'The spy was {n}', wordWas: 'The word was {w}', caught: 'Caught!', escaped: 'The spy got away!',
    team: 'Team {n}', describe: 'Describe it!', guess: 'Guess!', police: 'Watch the forbidden words',
    gotIt: 'Got it', skip: 'Skip', buzz: 'Caught You!', buzzed: 'CAUGHT YOU!', score: '{a} : {b}', timeUp: 'Time!', nextTurn: 'Next team',
    forbidden: 'Forbidden', describer: '{n} is describing',
    bombGo: 'Light the fuse', boom: 'BOOM — pass the phone!', again: 'Again',
    whoTitle: 'Who at this table', hotTitle: 'Hot take', agree: 'Agree', disagree: 'Disagree', votes: '{n} votes',
    ytTitle: 'Karaoke from YouTube', ytPh: 'Paste a YouTube karaoke link', ytPlay: 'Play for the room', ytBad: 'That is not a YouTube link.', ourSongs: 'Our songs (lyrics on every phone)',
    karaokeLyrics: 'Pick a song', chords: 'Guitarist Chords', own: 'Paste your own song', ownPh: '[Am]First line\n[G]Second line…', play: 'Play', stop: 'Stop',
    ownNote: 'Only songs you have the right to sing.',
    offline: 'Table games need the internet.',
    howTo: 'How to play: one player starts on one phone, everyone else joins with the 6-digit code.',
    joinTable: 'JOIN TABLE', rules: 'Mini rules', best: 'Best with {n}+',
    tabooBomb: 'Arousty & 5s Bomb', karaokeC: 'Campfire Karaoke',
    rSpy: ['Everyone sees the word — except the spy.', 'Take turns: one word each about it.', 'Vote. Catch the spy, or the spy guesses the word.'],
    rTaboo: ['Describe the word without the 4 forbidden ones.', 'Slip, and the table buzzes “Caught You!”.', 'Bomb: name three in 5 seconds, then pass the phone.'],
    rSparks: ['One player is picked: spill the truth out loud, or pass and take the Spark.', 'The host picks the gear: Icebreaker, Unfiltered or Late Night.', 'Every 4th turn the whole table votes in secret — 15 seconds.'],
    rKaraoke: ['The host picks a song.', 'The lyrics move on every phone together.', 'The guitarist switches on the chords.'],
  },
  ar: {
    title: 'ألعاب الترابيزة', sub: 'موبايل واحد يبدأ، والباقي يدخلوا بالكود.',
    spy: 'المندَسّ', spyS: 'واحد فيكم مش عارف الكلمة.',
    taboo: 'عروستي', tabooS: 'اوصفها من غير الـ٤ كلمات الممنوعة.',
    bomb: 'قنبلة الترابيزة', bombS: 'موبايل واحد · ٥ ثواني · قول تلاتة · وعدّيه.',
    sparks: 'قول ولا Spark', sparksS: 'قول الحقيقة بصوت عالي — أو خد الـ Spark.',
    spot: 'الدور على', spill: 'قول الحقيقة', pass: 'عدّي وخد الـ Spark', spillNow: 'جاوب بصوت عالي للترابيزة.', sparkTitle: 'الـ SPARK', truthTitle: 'الحقيقة', blind: 'تصويت سرّي', secs: '{n} ث', topVote: 'الترابيزة اختارت', noVotes: 'محدش صوّت المرة دي.', yourTurn: 'دورك',
    karaoke: 'غنّوا سوا', karaokeS: 'نفس الكلام على كل موبايل، والكوردات للجيتار.',
    start: 'ابدأ أوضة', join: 'ادخل', codePh: 'كود من ٦ أرقام', code: 'كود الأوضة', players: 'على الترابيزة',
    waiting: 'مستنيين المنظّم يبدأ…', go: 'ابدأ', next: 'اللي بعده', leave: 'اخرج',
    needMore: 'محتاجين {n} لاعبين على الأقل.', bad: 'مفيش أوضة بالكود ده.',
    pack: 'الباقة', double: 'عميل مزدوج', doubleS: 'المندس ياخد كلمة قريبة بدل ما مياخدش حاجة.',
    yourWord: 'كلمتك', youSpy: 'إنت المندَسّ', youSpyS: 'اندمج وخمّن الكلمة.', youDouble: 'كلمتك (يمكن تكون إنت المندس)',
    tapShow: 'دوس عشان تشوف كارتك', tapHide: 'دوس عشان تخبّيه', talk: 'كل واحد يقول كلمة عنها بالدور.',
    voteNow: 'صوّتوا', voteWho: 'مين المندَسّ؟', voted: 'صوّت', reveal: 'اكشف',
    spyWas: 'المندس كان {n}', wordWas: 'الكلمة كانت {w}', caught: 'اتمسك!', escaped: 'المندس هرب!',
    team: 'فريق {n}', describe: 'اوصف!', guess: 'خمّن!', police: 'خلّي بالك من الكلمات الممنوعة',
    gotIt: 'جابوها', skip: 'عدّي', buzz: 'مسكتك!', buzzed: 'مسكتك!', score: '{a} : {b}', timeUp: 'الوقت خلص!', nextTurn: 'الفريق اللي بعده',
    forbidden: 'ممنوع', describer: '{n} بيوصف',
    bombGo: 'ولّع الفتيل', boom: 'بووم — عدّي الموبايل!', again: 'تاني',
    whoTitle: 'مين فينا', hotTitle: 'رأي', agree: 'مع', disagree: 'ضد', votes: '{n} أصوات',
    ytTitle: 'كاريوكي من يوتيوب', ytPh: 'حط لينك كاريوكي من يوتيوب', ytPlay: 'شغّلها للأوضة', ytBad: 'ده مش لينك يوتيوب.', ourSongs: 'أغانينا (الكلام على كل موبايل)',
    karaokeLyrics: 'اختار أغنية', chords: 'كوردات الجيتار', own: 'حط أغنيتك', ownPh: '[Am]أول سطر\n[G]تاني سطر…', play: 'شغّل', stop: 'وقّف',
    ownNote: 'بس الأغاني اللي من حقكم تغنوها.',
    offline: 'ألعاب الترابيزة محتاجة نت.',
    howTo: 'إزاي تلعبوا: واحد يبدأ على موبايل، والباقي يدخلوا بالكود اللي من ٦ أرقام.',
    joinTable: 'ادخل الترابيزة', rules: 'كيف تلعب', best: 'أحلى مع {n}+',
    tabooBomb: 'عروستي وقنبلة الـ٥ ثواني', karaokeC: 'غنّوا سوا',
    rSpy: ['الكل بيشوف الكلمة — إلا المندس.', 'بالدور: كل واحد يقول كلمة عنها.', 'صوّتوا. امسكوا المندس، أو هو يخمّن الكلمة.'],
    rTaboo: ['اوصف الكلمة من غير الـ٤ الممنوعين.', 'لو غلطت، الترابيزة تقول «مسكتك!».', 'القنبلة: قول تلاتة في ٥ ثواني وعدّي الموبايل.'],
    rSparks: ['واحد بيتختار: يقول الحقيقة بصوت عالي، أو يعدّي وياخد الـ Spark.', 'المنظّم يختار الجو: خفيف، صريح، أو عميق.', 'كل رابع دور الترابيزة كلها تصوّت في السر — ١٥ ثانية.'],
    rKaraoke: ['المنظّم يختار أغنية.', 'الكلام بيتحرك على كل الموبايلات مع بعض.', 'اللي بيعزف يشغّل الكوردات.'],
  },
};
const wl = (lang, k) => (W[lang === 'ar' ? 'ar' : 'en'][k]) || W.en[k];
const w = (lang, k, v) => { let s = (W[lang === 'ar' ? 'ar' : 'en'][k]) || W.en[k]; Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); }); return s; };
const INK = '#18181B';         // charcoal
const CREAM = '#FAF8F5';       // warm paper — the room (Ayser, November 2026: soft, not neon)
const BG = CREAM;
const GOLD = '#8A6A2E';
/* one colour per game, like a box on the shelf (Ayser, November 2026) */
const GAME = {
  spy: { bg: '#E6F0EC', line: '#C9DDD3', icon: 'eye-off-outline', name: 'spy', sub: 'spyS', rules: 'rSpy', n: 4 },
  taboo: { bg: '#FDF3D8', line: '#EEDDA8', icon: 'timer-outline', name: 'tabooBomb', sub: 'tabooS', rules: 'rTaboo', n: 4 },
  sparks: { bg: '#FCE8E8', line: '#F1CACA', icon: 'flame-outline', name: 'sparks', sub: 'sparksS', rules: 'rSparks', n: 3 },
  karaoke: { bg: '#EFEBF9', line: '#D8CFF0', icon: 'musical-notes-outline', name: 'karaokeC', sub: 'karaokeS', rules: 'rKaraoke', n: 2 },
};
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));


const Btn = ({ label, onPress, solid = true, disabled, style, testID }) => (
  <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
    {({ pressed }) => (
      <View style={{ borderRadius: 999, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', backgroundColor: solid ? INK : 'transparent', borderWidth: solid ? 0 : 1, borderColor: 'rgba(24,24,27,0.5)', transform: [{ scale: pressed ? 0.98 : 1 }] }}>
        <Text style={{ color: solid ? CREAM : INK, fontSize: 15.5, fontWeight: '800' }}>{label}</Text>
      </View>
    )}
  </Pressable>
);

/* ── the one-phone 5-second bomb ── */
const Bomb = ({ lang }) => {
  const [card, setCard] = useState(() => BOMB[Math.floor(Math.random() * BOMB.length)]);
  const [left, setLeft] = useState(null);
  const [boom, setBoom] = useState(false);
  useEffect(() => {
    if (left == null) return undefined;
    if (left <= 0) { setBoom(true); try { Vibration.vibrate(600); } catch (e) {} tapMedium(); return undefined; }
    const t = setTimeout(() => { setLeft((x) => x - 1); tapLight(); }, 1000);
    return () => clearTimeout(t);
  }, [left]);
  const go = () => { setBoom(false); setCard(BOMB[Math.floor(Math.random() * BOMB.length)]); setLeft(5); sfxPop(); };
  return (
    <View style={{ alignItems: 'center', marginTop: 20 }}>
      <Text style={{ color: INK, fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 34 }}>{pick(lang, card)}</Text>
      <Text style={{ color: boom ? '#C0392B' : INK, fontSize: boom ? 30 : 110, fontWeight: '900', marginTop: 20, textAlign: 'center' }}>
        {boom ? w(lang, 'boom') : left == null ? '5' : String(left)}
      </Text>
      <Btn label={left == null || boom ? (boom ? w(lang, 'again') : w(lang, 'bombGo')) : '…'} disabled={left != null && !boom} onPress={go} style={{ marginTop: 26, alignSelf: 'stretch' }} />
    </View>
  );
};

/* ── karaoke lyrics, scrolling with the shared clock ── */
const Lyrics = ({ song, elapsed, chords }) => {
  const lines = song.lines || [];
  let cur = -1;
  lines.forEach((l, i) => { if (elapsed >= l[0]) cur = i; });
  return (
    <View style={{ marginTop: 16 }}>
      {lines.map((l, i) => {
        const near = Math.abs(i - cur) <= 3 || (cur < 0 && i < 4);
        if (!near) return null;
        const on = i === cur;
        return (
          <View key={i} style={{ marginBottom: 14, opacity: on ? 1 : i < cur ? 0.35 : 0.6 }}>
            {chords && l[1] ? <Text style={{ color: GOLD, fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>{l[1]}</Text> : null}
            <Text style={{ color: INK, fontSize: on ? 26 : 19, fontWeight: on ? '800' : '600', lineHeight: on ? 34 : 26 }}>{l[2]}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* ── SPILL OR SPARK: the next turn ── a player in the spotlight (never the
   same twice in a row), or, every fourth turn, the blind table vote */
const rnd = (n) => Math.floor(Math.random() * n);
const sparkTurn = (s, players) => {
  const ps = (players && players.length ? players : []).filter((p) => p && p.id);
  const turn = (Number(s.turn) || 0) + 1;
  const deck = GEARS[s.gear] || GEARS.ice;
  if (turn % 4 === 3 && ps.length >= 2) {
    return { mode: 'sparks', gear: s.gear, turn, kind: 'vote', idx: rnd(VOTES.length), votes: {}, names: ps, phase: 'q', ends: Date.now() + 15000 };
  }
  const pool = ps.length > 1 ? ps.filter((p) => p.id !== s.target) : ps;
  const target = pool.length ? pool[rnd(pool.length)].id : null;
  return { mode: 'sparks', gear: s.gear, turn, kind: 'spot', target, names: ps, truth: rnd(deck.truths.length), dare: rnd(deck.dares.length), side: null, phase: 'q' };
};

/* the card turns over to the Spark */
const FlipCard = ({ flipped, front, back }) => {
  const a = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  useEffect(() => { Animated.timing(a, { toValue: flipped ? 1 : 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [flipped]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const b = a.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const face = { borderRadius: 26, padding: 22, minHeight: 200, justifyContent: 'center', backfaceVisibility: 'hidden' };
  return (
    <View style={{ marginTop: 14 }}>
      <Animated.View style={[face, { backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#F1CACA', transform: [{ perspective: 900 }, { rotateY: f }] }]}>{front}</Animated.View>
      <Animated.View style={[face, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#18181B', transform: [{ perspective: 900 }, { rotateY: b }] }]}>{back}</Animated.View>
    </View>
  );
};

export const TableGames = ({ onClose, initialCode = '' }) => {
  const [ytList, setYtList] = useState([]);       // the Studio's karaoke list (app setting karaoke_songs)
  const [ytLink, setYtLink] = useState('');
  const [ytErr, setYtErr] = useState(null);
  useEffect(() => { appSettings().then((x) => setYtList(Array.isArray(x && x.karaoke_songs) ? x.karaoke_songs.filter((k) => ytId(k.url)) : [])).catch(() => {}); }, []);
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const { user } = useAuth();
  const me = user ? user.id : 'me';
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const codeRef = useRef(null);
  const [rules, setRules] = useState(null);   // the game whose rules are open
  const [room, setRoom] = useState(null);           // { code, host }
  const [players, setPlayers] = useState([]);       // [{ id, name }]
  const [st, setSt] = useState(null);               // the shared state, from the host
  const [mine, setMine] = useState({});             // this phone's private card, from the host
  const [peek, setPeek] = useState(false);
  const [flash, setFlash] = useState(false);
  const [err, setErr] = useState(null);
  const [opts, setOpts] = useState({ pack: 'cafes', double: false, chords: false, own: '' });
  const [now, setNow] = useState(Date.now());
  const ch = useRef(null);
  const host = room && room.host;
  const stRef = useRef(null); stRef.current = st;
  const playersRef = useRef([]); playersRef.current = players;
  const recvAt = useRef(0);

  useEffect(() => { if (user) getProfile(user.id).then((p) => setName((p && p.name) || '')).catch(() => {}); }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => () => { if (ch.current) try { supabase.removeChannel(ch.current); } catch (e) {} }, []);

  // the host: say the state to everybody, and keep saying it (late joiners, karaoke clock)
  const broadcast = (s, cards) => {
    setSt(s); recvAt.current = Date.now();
    if (cards && cards[me]) setMine(cards[me]);
    if (ch.current) ch.current.send({ type: 'broadcast', event: 'state', payload: { s, cards: cards || null, at: Date.now() } }).catch(() => {});
  };
  const lastCards = useRef(null);
  useEffect(() => {
    if (!host || !st) return undefined;
    const t = setInterval(() => { if (ch.current) ch.current.send({ type: 'broadcast', event: 'state', payload: { s: stRef.current, cards: lastCards.current, at: Date.now() } }).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [host, !!st]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (c, asHost) => {
    if (!SUPABASE_READY) { setErr(w(lang, 'offline')); return; }
    const chan = supabase.channel('tg-' + c, { config: { broadcast: { self: false }, presence: { key: me } } });
    chan.on('presence', { event: 'sync' }, () => {
      const ps = chan.presenceState();
      setPlayers(Object.keys(ps).map((k) => ({ id: k, name: (ps[k][0] && ps[k][0].name) || '' })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    chan.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (asHost || !payload) return;
      setSt(payload.s); recvAt.current = Date.now();
      if (payload.cards && payload.cards[me]) setMine(payload.cards[me]);
    });
    chan.on('broadcast', { event: 'act' }, ({ payload }) => { if (asHost && payload) onAct(payload); });
    chan.on('broadcast', { event: 'buzz' }, () => { setFlash(true); try { Vibration.vibrate(300); } catch (e) {} setTimeout(() => setFlash(false), 1400); });
    chan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await chan.track({ name: name || 'Player' });
    });
    ch.current = chan;
    setRoom({ code: c, host: asHost });
  };
  const act = (a) => {
    const payload = { ...a, from: me };
    if (host) onAct(payload); else if (ch.current) ch.current.send({ type: 'broadcast', event: 'act', payload }).catch(() => {});
  };

  /* ── THE HOST'S RULES ── everything that changes the game happens here */
  const onAct = (a) => {
    const s = stRef.current;
    if (!s) return;
    if (a.t === 'vote' && (s.phase === 'vote' || s.phase === 'q') && (s.mode !== 'sparks' || s.kind === 'vote')) {
      broadcast({ ...s, votes: { ...(s.votes || {}), [a.from]: a.v } }, lastCards.current);
    } else if (a.t === 'buzz' && s.mode === 'taboo' && s.phase === 'play') {
      if (ch.current) ch.current.send({ type: 'broadcast', event: 'buzz', payload: {} }).catch(() => {});
      setFlash(true); setTimeout(() => setFlash(false), 1400);
      tabooNext(s, -1);
    } else if ((a.t === 'spill' || a.t === 'pass') && s.mode === 'sparks' && s.kind === 'spot' && !s.side && (a.from === s.target || a.from === me)) {
      broadcast({ ...s, side: a.t === 'spill' ? 'truth' : 'dare' });
    } else if (a.t === 'gear' && s.mode === 'sparks' && a.from === me && GEARS[a.v]) {
      broadcast(sparkTurn({ ...s, gear: a.v, turn: s.turn - 1 }, playersRef.current));
    } else if ((a.t === 'got' || a.t === 'skip') && s.mode === 'taboo' && s.phase === 'play' && a.from === s.describer) {
      tabooNext(s, a.t === 'got' ? 1 : 0);
    }
  };
  const tabooNext = (s, delta) => {
    const score = s.score.slice(); if (delta) score[s.turn] = Math.max(0, score[s.turn] + delta);
    broadcast({ ...s, score, card: (s.card + 1) % TABOO.length }, lastCards.current);
  };

  const startMode = (mode) => {
    tapMedium(); sfxPop();
    const ps = playersRef.current.length ? playersRef.current : [{ id: me, name }];
    if (mode === 'spy') {
      const pack = SPY_PACKS[opts.pack] || SPY_PACKS.cafes;
      const pair = pack.words[Math.floor(Math.random() * pack.words.length)];
      const spy = ps[Math.floor(Math.random() * ps.length)].id;
      const cards = {};
      ps.forEach((p) => { cards[p.id] = p.id === spy ? { spy: true, word: opts.double ? pair[1] : null } : { word: pair[0] }; });
      lastCards.current = cards;
      broadcast({ mode, phase: 'roles', pack: opts.pack, double: opts.double, word: pair[0], spy, votes: {} }, cards);
    } else if (mode === 'taboo') {
      const order = shuffle(ps.map((p) => p.id));
      const teams = {}; order.forEach((id, i) => { teams[id] = i % 2; });
      lastCards.current = null;
      broadcast({ mode, phase: 'play', teams, order, turn: 0, turnN: 0, describer: order[0], card: Math.floor(Math.random() * TABOO.length), score: [0, 0], ends: Date.now() + 60000 });
    } else if (mode === 'sparks') {
      lastCards.current = null;
      broadcast(sparkTurn({ mode, gear: 'ice', turn: -1 }, ps));
    } else if (mode === 'karaoke') {
      lastCards.current = null;
      broadcast({ mode, phase: 'pick', chords: opts.chords });
    } else if (mode === 'bomb') {
      lastCards.current = null;
      broadcast({ mode, phase: 'local' });
    }
  };
  const hostNext = () => {
    const s = stRef.current; if (!s) return;
    tapLight();
    if (s.mode === 'spy') {
      if (s.phase === 'roles') broadcast({ ...s, phase: 'vote', votes: {} }, lastCards.current);
      else if (s.phase === 'vote') broadcast({ ...s, phase: 'reveal' }, lastCards.current);
      else startMode('spy');
    } else if (s.mode === 'taboo') {
      const turnN = s.turnN + 1; const turn = turnN % 2;
      const team = s.order.filter((id) => s.teams[id] === turn);
      const describer = team.length ? team[Math.floor(turnN / 2) % team.length] : s.order[0];
      broadcast({ ...s, phase: 'play', turn, turnN, describer, card: (s.card + 1) % TABOO.length, ends: Date.now() + 60000 });
    } else if (s.mode === 'sparks') {
      if (s.kind === 'vote' && s.phase === 'q') broadcast({ ...s, phase: 'reveal' });
      else broadcast(sparkTurn(s, playersRef.current));
    }
  };

  // Spill or Spark: the blind vote reveals itself after 15 seconds, or once everybody voted
  useEffect(() => {
    if (!host || !st || st.mode !== 'sparks' || st.kind !== 'vote' || st.phase !== 'q') return;
    const all = (st.names || []).length && Object.keys(st.votes || {}).length >= (st.names || []).length;
    if (all || now >= (st.ends || 0)) broadcast({ ...st, phase: 'reveal' });
  }, [now, st]); // eslint-disable-line react-hooks/exhaustive-deps
  const celebrated = useRef(null);
  useEffect(() => {
    if (st && st.mode === 'sparks' && st.kind === 'vote' && st.phase === 'reveal' && celebrated.current !== st.turn) { celebrated.current = st.turn; tapCelebrate(); }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  // taboo: the 60 seconds run out on the host's clock
  useEffect(() => {
    if (!host || !st || st.mode !== 'taboo' || st.phase !== 'play') return;
    if (now > st.ends) broadcast({ ...st, phase: 'turnEnd' });
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (id) => ((players.find((p) => p.id === id) || {}).name) || '—';
  const elapsed = st && st.mode === 'karaoke' && st.phase === 'play' ? (st.elapsedAt != null ? st.elapsedAt + (Date.now() - recvAt.current) / 1000 : 0) : 0;
  // the host keeps the karaoke clock and says it again every 2.5 s
  useEffect(() => {
    if (!host || !st || st.mode !== 'karaoke' || st.phase !== 'play') return undefined;
    const t = setInterval(() => broadcast({ ...stRef.current, elapsedAt: (Date.now() - stRef.current.startedAt) / 1000 }), 2500);
    return () => clearInterval(t);
  }, [host, st && st.phase, st && st.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── screens ── */
  const lobby = !room;
  const mode = st && st.mode;
  const myTeam = st && st.teams ? st.teams[me] : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: flash ? '#B3261E' : BG }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={w(lang, 'leave')}>
              <Ionicons name="close" size={26} color={flash ? '#FFFFFF' : INK} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
          {flash ? <Text style={{ color: '#FFFFFF', fontSize: 42, fontWeight: '900', textAlign: 'center', marginTop: 30 }}>{w(lang, 'buzzed')}</Text> : null}

          {lobby ? (
            /* Ayser, November 2026 — "مش شكل ألعاب ولا شيك": the look of a game. Moments violet,
               one big yellow button, a colour per game, and the rules only when you tap a game. */
            <>
              <Text style={{ color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 2, marginTop: 10 }}>{lang === 'ar' ? 'لمّة' : 'LAMMA'}</Text>
              <Text style={{ color: INK, fontSize: 34, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : -1, marginTop: 2 }}>{w(lang, 'title')}</Text>
              <Text style={{ color: 'rgba(24,24,27,0.75)', fontSize: 15, marginTop: 4 }}>{w(lang, 'sub')}</Text>

              <Pressable testID="tg-host" onPress={() => { tapMedium(); setErr(null); open(newCode(), true); }} accessibilityRole="button" style={{ marginTop: 22 }}>
                {({ pressed }) => (
                  <View style={{ borderRadius: 22, paddingVertical: 19, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: INK, transform: [{ scale: pressed ? 0.98 : 1 }] }}>
                    <Ionicons name="play" size={20} color={CREAM} />
                    <Text style={{ color: CREAM, fontSize: 19, fontWeight: '900', marginStart: 8 }}>{w(lang, 'start')}</Text>
                  </View>
                )}
              </Pressable>

              {/* joining: one pill — the code, and an arrow when it is complete */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 22, backgroundColor: 'rgba(24,24,27,0.12)', paddingStart: 18, paddingEnd: 6, height: 58 }}>
                <TextInput ref={codeRef} testID="tg-code" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setErr(null); }} keyboardType="number-pad" maxLength={6}
                  placeholder={w(lang, 'codePh')} placeholderTextColor="rgba(24,24,27,0.5)"
                  style={{ flex: 1, minWidth: 0, width: 10, outlineStyle: 'none', color: INK, fontSize: code ? 22 : 16, fontWeight: code ? '900' : '600', letterSpacing: code ? 6 : 0, textAlign: 'left' }} />
                <Pressable testID="tg-join" disabled={code.length !== 6} onPress={() => { tapMedium(); setErr(null); open(code, false); }} accessibilityRole="button" accessibilityLabel={w(lang, 'joinTable')}>
                  <View style={{ height: 46, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: code.length === 6 ? INK : 'rgba(24,24,27,0.06)' }}>
                    <Text style={{ color: code.length === 6 ? CREAM : 'rgba(24,24,27,0.45)', fontSize: 15, fontWeight: '900' }}>{w(lang, 'join')}</Text>
                    <Ionicons name={lang === 'ar' ? 'arrow-back' : 'arrow-forward'} size={16} color={code.length === 6 ? CREAM : 'rgba(24,24,27,0.45)'} style={{ marginStart: 6 }} />
                  </View>
                </Pressable>
              </View>
              {err ? <Text style={{ color: '#B3261E', fontSize: 13.5, marginTop: 10 }}>{err}</Text> : null}

              {/* the four games: a colour each, big and simple — tap for how to play */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 24 }}>
                {['spy', 'taboo', 'sparks', 'karaoke'].map((k) => {
                  const g = GAME[k]; const ink = INK;
                  return (
                    <Pressable key={k} testID={'tg-card-' + k} onPress={() => { tapLight(); setRules(k); }} accessibilityRole="button" accessibilityLabel={w(lang, g.name)} style={{ width: '48%', marginBottom: 14 }}>
                      {({ pressed }) => (
                        <View style={{ aspectRatio: 0.9, borderRadius: 26, padding: 16, backgroundColor: g.bg, borderWidth: 1, borderColor: g.line, justifyContent: 'space-between', transform: [{ scale: pressed ? 0.97 : 1 }] }}>
                          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={g.icon} size={28} color={ink} />
                          </View>
                          <View>
                            <Text style={{ color: ink, fontSize: 19, fontWeight: '900', lineHeight: 23 }} numberOfLines={2}>{w(lang, g.name)}</Text>
                            <Text style={{ color: ink, opacity: 0.7, fontSize: 12.5, lineHeight: 17, marginTop: 4 }} numberOfLines={2}>{w(lang, g.sub)}</Text>
                            <Text style={{ color: ink, opacity: 0.55, fontSize: 11.5, fontWeight: '800', marginTop: 6 }}>{w(lang, 'best', { n: lang === 'ar' ? '٠١٢٣٤٥٦٧٨٩'[g.n] : g.n })}</Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* how to play one game: three lines, and the yellow button */}
              {rules ? (
                <Modal visible transparent animationType="slide" onRequestClose={() => setRules(null)}>
                  <Pressable onPress={() => setRules(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                    <Pressable onPress={() => {}} testID="tg-rules" style={{ backgroundColor: GAME[rules].bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: insets.bottom + 24 }}>
                      <Text style={{ color: INK, fontSize: 26, fontWeight: '900' }}>{w(lang, GAME[rules].name)}</Text>
                      {(wl(lang, GAME[rules].rules) || []).map((r, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: INK, fontSize: 14, fontWeight: '900' }}>{lang === 'ar' ? '٠١٢٣'[i + 1] : i + 1}</Text>
                          </View>
                          <Text style={{ flex: 1, color: INK, fontSize: 16.5, fontWeight: '600', lineHeight: 23, marginStart: 12 }}>{r}</Text>
                        </View>
                      ))}
                      <Pressable onPress={() => { tapMedium(); setRules(null); setErr(null); open(newCode(), true); }} accessibilityRole="button" style={{ marginTop: 22 }}>
                        <View style={{ borderRadius: 20, paddingVertical: 17, alignItems: 'center', backgroundColor: INK }}>
                          <Text style={{ color: CREAM, fontSize: 17, fontWeight: '900' }}>{w(lang, 'start')}</Text>
                        </View>
                      </Pressable>
                    </Pressable>
                  </Pressable>
                </Modal>
              ) : null}
            </>
          ) : !st ? (
            /* the room, before a game */
            <>
              <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 18 }}>{w(lang, 'code').toUpperCase()}</Text>
              <Text style={{ color: INK, fontSize: 48, fontWeight: '900', letterSpacing: 8, marginTop: 4 }}>{room.code}</Text>
              <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 18 }}>{w(lang, 'players').toUpperCase() + ' · ' + players.length}</Text>
              <Text style={{ color: INK, fontSize: 15, marginTop: 6, lineHeight: 22 }}>{players.map((p) => p.name || '—').join('  ·  ')}</Text>
              {host ? (
                <View style={{ marginTop: 18 }}>
                  {/* spy options */}
                  <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 12, fontWeight: '800', marginBottom: 8 }}>{w(lang, 'pack') + ' · ' + w(lang, 'spy')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {Object.keys(SPY_PACKS).map((k) => (
                      <Pressable key={k} onPress={() => { tapLight(); setOpts({ ...opts, pack: k }); }} style={{ marginEnd: 8, marginBottom: 8 }}>
                        <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: opts.pack === k ? INK : 'transparent', borderWidth: 1, borderColor: 'rgba(24,24,27,0.4)' }}>
                          <Text style={{ color: opts.pack === k ? CREAM : INK, fontSize: 13, fontWeight: '700' }}>{pick(lang, SPY_PACKS[k].name)}</Text>
                        </View>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => { tapLight(); setOpts({ ...opts, double: !opts.double }); }} style={{ marginEnd: 8, marginBottom: 8 }}>
                      <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: opts.double ? GOLD : 'transparent', borderWidth: 1, borderColor: GOLD }}>
                        <Text style={{ color: opts.double ? CREAM : GOLD, fontSize: 13, fontWeight: '700' }}>{w(lang, 'double')}</Text>
                      </View>
                    </Pressable>
                  </View>
                  {/* the same four games as the lobby: tap one, it starts for everybody */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }}>
                    {['spy', 'taboo', 'sparks', 'karaoke'].map((k) => {
                      const g = GAME[k];
                      // Arousty needs two teams of two; with fewer, the 5-second bomb (one phone) plays instead
                      const run = k === 'taboo' && players.length < 4 ? 'bomb' : k;
                      const min = k === 'spy' ? 3 : 1;
                      const few = players.length < min;
                      return (
                        <Pressable key={k} testID={'tg-' + k} disabled={few} onPress={() => startMode(run)} accessibilityRole="button" accessibilityLabel={w(lang, g.name)} style={{ width: '48%', marginTop: 10, opacity: few ? 0.5 : 1 }}>
                          {({ pressed }) => (
                            <View style={{ borderRadius: 22, padding: 14, minHeight: 128, backgroundColor: g.bg, borderWidth: 1, borderColor: g.line, justifyContent: 'space-between', transform: [{ scale: pressed ? 0.97 : 1 }] }}>
                              <Ionicons name={g.icon} size={24} color={INK} />
                              <View>
                                <Text style={{ color: INK, fontSize: 15.5, fontWeight: '900', lineHeight: 20 }} numberOfLines={2}>{w(lang, g.name)}</Text>
                                <Text style={{ color: INK, opacity: 0.6, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{few ? w(lang, 'needMore', { n: min }) : w(lang, run === 'bomb' ? 'bombS' : g.sub)}</Text>
                              </View>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : <Text style={{ color: 'rgba(24,24,27,0.75)', fontSize: 15, marginTop: 22 }}>{w(lang, 'waiting')}</Text>}
            </>
          ) : mode === 'spy' ? (
            <>
              <Text style={{ color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 1.4, marginTop: 18 }}>{(w(lang, 'spy')).toUpperCase()}</Text>
              {st.phase === 'roles' ? (
                <>
                  <Pressable onPress={() => { tapLight(); setPeek((v) => !v); }} accessibilityRole="button" style={{ marginTop: 18 }}>
                    <View style={{ borderRadius: 22, padding: 26, minHeight: 190, alignItems: 'center', justifyContent: 'center', backgroundColor: peek ? (mine.spy && !mine.word ? '#FCE8E8' : '#EFEBF9') : 'rgba(24,24,27,0.08)' }}>
                      {!peek ? <Text style={{ color: INK, fontSize: 17, fontWeight: '700' }}>{w(lang, 'tapShow')}</Text> : mine.spy && !mine.word ? (
                        <>
                          <Text style={{ color: INK, fontSize: 28, fontWeight: '900' }}>{w(lang, 'youSpy')}</Text>
                          <Text style={{ color: 'rgba(24,24,27,0.85)', fontSize: 14.5, marginTop: 6 }}>{w(lang, 'youSpyS')}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={{ color: 'rgba(24,24,27,0.8)', fontSize: 13, fontWeight: '700' }}>{st.double ? w(lang, 'youDouble') : w(lang, 'yourWord')}</Text>
                          <Text style={{ color: INK, fontSize: 32, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{pick(lang, mine.word)}</Text>
                        </>
                      )}
                      {peek ? <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 12, marginTop: 14 }}>{w(lang, 'tapHide')}</Text> : null}
                    </View>
                  </Pressable>
                  <Text style={{ color: 'rgba(24,24,27,0.75)', fontSize: 14.5, marginTop: 14, textAlign: 'center' }}>{w(lang, 'talk')}</Text>
                </>
              ) : st.phase === 'vote' ? (
                <>
                  <Text style={{ color: INK, fontSize: 24, fontWeight: '800', marginTop: 16 }}>{w(lang, 'voteWho')}</Text>
                  {players.filter((p) => p.id !== me).map((p) => {
                    const on = st.votes && st.votes[me] === p.id;
                    return (
                      <Pressable key={p.id} onPress={() => { tapLight(); act({ t: 'vote', v: p.id }); }} style={{ marginTop: 10 }}>
                        <View style={{ borderRadius: 14, padding: 14, backgroundColor: on ? INK : 'rgba(24,24,27,0.08)' }}>
                          <Text style={{ color: on ? CREAM : INK, fontSize: 16, fontWeight: '700' }}>{p.name || '—'}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 13, marginTop: 12 }}>{w(lang, 'votes', { n: Object.keys(st.votes || {}).length })}</Text>
                </>
              ) : (() => {
                const tally = {}; Object.values(st.votes || {}).forEach((v) => { tally[v] = (tally[v] || 0) + 1; });
                const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
                const got = top === st.spy;
                return (
                  <View style={{ alignItems: 'center', marginTop: 24 }}>
                    <Text style={{ color: got ? '#1F8A4C' : '#C0392B', fontSize: 32, fontWeight: '900' }}>{got ? w(lang, 'caught') : w(lang, 'escaped')}</Text>
                    <Text style={{ color: INK, fontSize: 18, marginTop: 12 }}>{w(lang, 'spyWas', { n: nameOf(st.spy) })}</Text>
                    <Text style={{ color: 'rgba(24,24,27,0.8)', fontSize: 16, marginTop: 6 }}>{w(lang, 'wordWas', { w: pick(lang, st.word) })}</Text>
                  </View>
                );
              })()}
              {host ? <Btn label={st.phase === 'roles' ? w(lang, 'voteNow') : st.phase === 'vote' ? w(lang, 'reveal') : w(lang, 'next')} onPress={() => { setPeek(false); hostNext(); }} style={{ marginTop: 24 }} /> : null}
            </>
          ) : mode === 'taboo' ? (
            (() => {
              const card = TABOO[st.card];
              const describing = st.describer === me;
              const guessing = myTeam === st.turn && !describing;
              const left = Math.max(0, Math.ceil((st.ends - now) / 1000));
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                    <Text style={{ color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 1.4, flex: 1 }}>{(w(lang, 'taboo')).toUpperCase()}</Text>
                    <Text style={{ color: INK, fontSize: 15, fontWeight: '900' }}>{w(lang, 'score', { a: st.score[0], b: st.score[1] })}</Text>
                  </View>
                  <Text style={{ color: 'rgba(24,24,27,0.7)', fontSize: 14, marginTop: 6 }}>{w(lang, 'team', { n: st.turn + 1 }) + ' · ' + w(lang, 'describer', { n: nameOf(st.describer) })}</Text>
                  {st.phase === 'turnEnd' ? (
                    <Text style={{ color: INK, fontSize: 34, fontWeight: '900', textAlign: 'center', marginTop: 30 }}>{w(lang, 'timeUp')}</Text>
                  ) : (
                    <>
                      <Text style={{ color: INK, fontSize: 64, fontWeight: '900', textAlign: 'center', marginTop: 10 }}>{left}</Text>
                      {guessing ? (
                        <Text style={{ color: INK, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 16 }}>{w(lang, 'guess')}</Text>
                      ) : (
                        <View style={{ borderRadius: 22, padding: 22, marginTop: 10, backgroundColor: '#EFEBF9' }}>
                          <Text style={{ color: 'rgba(24,24,27,0.8)', fontSize: 12.5, fontWeight: '800' }}>{describing ? w(lang, 'describe') : w(lang, 'police')}</Text>
                          <Text style={{ color: INK, fontSize: 30, fontWeight: '900', marginTop: 6 }}>{pick(lang, card.w)}</Text>
                          <Text style={{ color: '#B3261E', fontSize: 12, fontWeight: '800', marginTop: 14 }}>{w(lang, 'forbidden').toUpperCase()}</Text>
                          {(card.no[lang === 'ar' ? 1 : 0]).map((x) => <Text key={x} style={{ color: INK, fontSize: 17, fontWeight: '700', marginTop: 4 }}>{'✕  ' + x}</Text>)}
                        </View>
                      )}
                      {describing ? (
                        <View style={{ flexDirection: 'row', marginTop: 16 }}>
                          <Btn label={w(lang, 'gotIt')} onPress={() => { tapSuccess(); act({ t: 'got' }); }} style={{ flex: 1, marginEnd: 8 }} />
                          <Btn label={w(lang, 'skip')} solid={false} onPress={() => { tapLight(); act({ t: 'skip' }); }} style={{ flex: 1 }} />
                        </View>
                      ) : !guessing ? (
                        <Pressable testID="tg-buzz" onPress={() => { tapMedium(); act({ t: 'buzz' }); }} accessibilityRole="button" style={{ marginTop: 16 }}>
                          <View style={{ borderRadius: 999, paddingVertical: 20, alignItems: 'center', backgroundColor: '#B3261E' }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>{w(lang, 'buzz')}</Text>
                          </View>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                  {host && st.phase === 'turnEnd' ? <Btn label={w(lang, 'nextTurn')} onPress={hostNext} style={{ marginTop: 24 }} /> : null}
                </>
              );
            })()
          ) : mode === 'bomb' ? (
            <>
              <Text style={{ color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 1.4, marginTop: 18 }}>{(w(lang, 'bomb')).toUpperCase()}</Text>
              <Bomb lang={lang} />
            </>
          ) : mode === 'sparks' ? (
            (() => {
              const gear = GEARS[st.gear] || GEARS.ice;
              const nameOfId = (id) => ((st.names || players).find((p) => p.id === id) || {}).name || '—';
              const gearRow = (
                <View style={{ flexDirection: 'row', marginTop: 16 }}>
                  {Object.keys(GEARS).map((k) => {
                    const on = st.gear === k;
                    return (
                      <Pressable key={k} testID={'gear-' + k} disabled={!host} onPress={() => { tapLight(); act({ t: 'gear', v: k }); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, marginEnd: k === 'late' ? 0 : 6 }}>
                        <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: on ? INK : 'transparent', borderWidth: 1, borderColor: on ? INK : 'rgba(24,24,27,0.18)', opacity: !host && !on ? 0.55 : 1 }}>
                          <Ionicons name={GEARS[k].icon} size={14} color={on ? CREAM : INK} />
                          <Text style={{ color: on ? CREAM : INK, fontSize: 12.5, fontWeight: '800', marginStart: 5 }} numberOfLines={1}>{lang === 'ar' ? GEARS[k].ar : GEARS[k].en}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
              if (st.kind === 'vote') {
                const q = VOTES[st.idx] || VOTES[0];
                const left = Math.max(0, Math.ceil(((st.ends || 0) - now) / 1000));
                const tally = {}; Object.values(st.votes || {}).forEach((v) => { tally[v] = (tally[v] || 0) + 1; });
                const top = Object.keys(tally).sort((x, y) => tally[y] - tally[x])[0];
                return (
                  <>
                    {gearRow}
                    <View testID="spark-vote" style={{ marginTop: 16, borderRadius: 26, padding: 20, backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#F1CACA' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="eye-off-outline" size={15} color="#7A4A4A" />
                        <Text style={{ flex: 1, color: '#7A4A4A', fontSize: 12, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.4, marginStart: 6 }}>{w(lang, 'blind')}</Text>
                        {st.phase === 'q' ? <Text style={{ color: INK, fontSize: 15, fontWeight: '900' }}>{w(lang, 'secs', { n: left })}</Text> : null}
                      </View>
                      <Text style={{ color: INK, fontSize: 22, fontWeight: '800', lineHeight: 30, marginTop: 10 }}>{pick(lang, q)}</Text>
                    </View>
                    {st.phase === 'q' ? (st.names || players).map((p) => {
                      const on = st.votes && st.votes[me] === p.id;
                      return (
                        <Pressable key={p.id} testID="spark-vote-option" onPress={() => { tapLight(); act({ t: 'vote', v: p.id }); }} style={{ marginTop: 8 }}>
                          <View style={{ borderRadius: 14, padding: 14, backgroundColor: on ? INK : 'rgba(24,24,27,0.05)' }}>
                            <Text style={{ color: on ? CREAM : INK, fontSize: 16, fontWeight: '700' }}>{p.name || '—'}</Text>
                          </View>
                        </Pressable>
                      );
                    }) : (
                      <View testID="spark-top" style={{ alignItems: 'center', marginTop: 22 }}>
                        <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 13, fontWeight: '800' }}>{w(lang, 'topVote')}</Text>
                        <Text style={{ color: INK, fontSize: 34, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{top ? nameOfId(top) : w(lang, 'noVotes')}</Text>
                        {top ? <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 13, marginTop: 4 }}>{w(lang, 'votes', { n: tally[top] })}</Text> : null}
                      </View>
                    )}
                    {st.phase === 'q' ? <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 13, marginTop: 12 }}>{w(lang, 'votes', { n: Object.keys(st.votes || {}).length })}</Text> : null}
                    {host ? <Btn label={st.phase === 'q' ? w(lang, 'reveal') : w(lang, 'next')} onPress={hostNext} style={{ marginTop: 22 }} /> : null}
                  </>
                );
              }
              const mineTurn = st.target === me;
              const truth = gear.truths[st.truth] || gear.truths[0];
              const dare = gear.dares[st.dare] || gear.dares[0];
              return (
                <>
                  {gearRow}
                  <View testID="spark-spot" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                    <Ionicons name="locate-outline" size={18} color={INK} />
                    <Text style={{ color: INK, fontSize: 17, fontWeight: '800', marginStart: 6 }}>{mineTurn ? w(lang, 'yourTurn') : w(lang, 'spot') + ': ' + nameOfId(st.target)}</Text>
                  </View>
                  <FlipCard flipped={st.side === 'dare'}
                    front={(
                      <>
                        <Text style={{ color: '#7A4A4A', fontSize: 12, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{w(lang, 'truthTitle')}</Text>
                        <Text testID="spark-truth" style={{ color: INK, fontSize: 22, fontWeight: '700', lineHeight: 30, marginTop: 10 }}>{pick(lang, truth)}</Text>
                        {st.side === 'truth' ? <Text style={{ color: '#7A4A4A', fontSize: 14, fontWeight: '700', marginTop: 12 }}>{w(lang, 'spillNow')}</Text> : null}
                      </>
                    )}
                    back={(
                      <>
                        <Text style={{ color: '#F1CACA', fontSize: 12, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{w(lang, 'sparkTitle')}</Text>
                        <Text testID="spark-dare" style={{ color: CREAM, fontSize: 21, fontWeight: '700', lineHeight: 29, marginTop: 10 }}>{pick(lang, dare)}</Text>
                      </>
                    )} />
                  {!st.side && (mineTurn || host) ? (
                    <View style={{ flexDirection: 'row', marginTop: 14 }}>
                      <Pressable testID="spark-spill" onPress={() => { tapSuccess(); act({ t: 'spill' }); }} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
                        <View style={{ borderRadius: 18, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#F1CACA' }}>
                          <Ionicons name="chatbubble-ellipses-outline" size={18} color={INK} />
                          <Text style={{ color: INK, fontSize: 14, fontWeight: '800', marginTop: 4 }}>{w(lang, 'spill')}</Text>
                        </View>
                      </Pressable>
                      <Pressable testID="spark-pass" onPress={() => { tapMedium(); act({ t: 'pass' }); }} accessibilityRole="button" style={{ flex: 1 }}>
                        <View style={{ borderRadius: 18, paddingVertical: 15, alignItems: 'center', backgroundColor: '#EFEBF9', borderWidth: 1, borderColor: '#D8CFF0' }}>
                          <Ionicons name="flash-outline" size={18} color={INK} />
                          <Text style={{ color: INK, fontSize: 14, fontWeight: '800', marginTop: 4 }}>{w(lang, 'pass')}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ) : null}
                  {host ? <Btn label={w(lang, 'next')} onPress={hostNext} style={{ marginTop: 18 }} /> : null}
                </>
              );
            })()
          ) : mode === 'karaoke' ? (
            st.phase === 'pick' ? (
              <>
                <Text style={{ color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 1.4, marginTop: 18 }}>{(w(lang, 'karaoke')).toUpperCase()}</Text>
                {host ? (
                  <>
                    <Text style={{ color: INK, fontSize: 22, fontWeight: '800', marginTop: 10 }}>{w(lang, 'karaokeLyrics')}</Text>
                    {/* Ayser, November 2026: karaoke videos from YouTube, played inside Moments, in sync on every phone */}
                    <Text style={{ color: GOLD, fontSize: 12.5, fontWeight: '800', marginTop: 16 }}>{w(lang, 'ytTitle')}</Text>
                    {ytList.map((k, i) => (
                      <Pressable key={'yt' + i} testID={'tg-yt-' + i} onPress={() => { tapMedium(); broadcast({ ...st, phase: 'play', song: { id: 'yt', yt: ytId(k.url), title: [k.title, k.title] }, yt: { playing: false, pos: 0, at: Date.now() }, startedAt: Date.now(), elapsedAt: 0 }); }} style={{ marginTop: 10 }}>
                        <View style={{ borderRadius: 14, padding: 14, backgroundColor: 'rgba(24,24,27,0.08)', flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="logo-youtube" size={18} color="#D9C08C" />
                          <Text style={{ color: INK, fontSize: 16, fontWeight: '700', marginHorizontal: 10, flex: 1 }} numberOfLines={1}>{k.title}</Text>
                          <Ionicons name="play" size={16} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                      <TextInput testID="tg-yt-link" value={ytLink} onChangeText={(v) => { setYtLink(v); setYtErr(null); }} placeholder={w(lang, 'ytPh')} placeholderTextColor="rgba(24,24,27,0.35)" autoCapitalize="none"
                        style={{ flex: 1, color: INK, fontSize: 14.5, borderWidth: 1, borderColor: 'rgba(24,24,27,0.25)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 }} />
                      <Btn testID="tg-yt-play" label={w(lang, 'ytPlay')} disabled={!ytLink.trim()} onPress={() => {
                        const id = ytId(ytLink);
                        if (!id) { setYtErr(w(lang, 'ytBad')); return; }
                        tapMedium(); setYtLink('');
                        broadcast({ ...st, phase: 'play', song: { id: 'yt', yt: id, title: ['YouTube', 'YouTube'] }, yt: { playing: false, pos: 0, at: Date.now() }, startedAt: Date.now(), elapsedAt: 0 });
                      }} style={{ marginStart: 8 }} />
                    </View>
                    {ytErr ? <Text style={{ color: '#C0392B', fontSize: 12.5, marginTop: 6 }}>{ytErr}</Text> : null}
                    <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 12.5, fontWeight: '800', marginTop: 18 }}>{w(lang, 'ourSongs')}</Text>
                    {SONGS.map((sg) => (
                      <Pressable key={sg.id} onPress={() => { tapMedium(); broadcast({ ...st, phase: 'play', song: sg, startedAt: Date.now(), elapsedAt: 0 }); }} style={{ marginTop: 10 }}>
                        <View style={{ borderRadius: 14, padding: 14, backgroundColor: 'rgba(24,24,27,0.08)', flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="musical-note" size={18} color="#D9C08C" />
                          <Text style={{ color: INK, fontSize: 16, fontWeight: '700', marginHorizontal: 10, flex: 1 }}>{pick(lang, sg.title)}</Text>
                          <Ionicons name="play" size={16} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    ))}
                    <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 12.5, fontWeight: '800', marginTop: 18 }}>{w(lang, 'own')}</Text>
                    <TextInput value={opts.own} onChangeText={(v) => setOpts({ ...opts, own: v })} placeholder={w(lang, 'ownPh')} placeholderTextColor="rgba(24,24,27,0.35)" multiline
                      style={{ color: INK, fontSize: 15, minHeight: 90, borderWidth: 1, borderColor: 'rgba(24,24,27,0.25)', borderRadius: 14, padding: 12, marginTop: 8, textAlignVertical: 'top' }} />
                    <Text style={{ color: 'rgba(24,24,27,0.5)', fontSize: 12, marginTop: 6 }}>{w(lang, 'ownNote')}</Text>
                    <Btn label={w(lang, 'play')} disabled={!opts.own.trim()} onPress={() => { tapMedium(); broadcast({ ...st, phase: 'play', song: { id: 'own', title: [w(lang, 'own'), w(lang, 'own')], lines: parseCustom(opts.own) }, startedAt: Date.now(), elapsedAt: 0 }); }} style={{ marginTop: 12 }} />
                  </>
                ) : <Text style={{ color: 'rgba(24,24,27,0.75)', fontSize: 15, marginTop: 22 }}>{w(lang, 'waiting')}</Text>}
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                  <Text style={{ color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 1.4, flex: 1 }}>{(pick(lang, st.song.title)).toUpperCase()}</Text>
                  {host && !st.song.yt ? (
                    <Pressable testID="tg-chords" onPress={() => { tapLight(); broadcast({ ...st, chords: !st.chords }); }} accessibilityRole="switch" accessibilityState={{ checked: !!st.chords }}>
                      <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: GOLD, backgroundColor: st.chords ? GOLD : 'transparent' }}>
                        <Text style={{ color: st.chords ? CREAM : GOLD, fontSize: 12, fontWeight: '800' }}>{w(lang, 'chords')}</Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>
                {st.song.yt ? (
                  <YtKaraoke videoId={st.song.yt} host={host} sync={st.yt} lang={lang}
                    onHostTick={(x) => { const cur = stRef.current; if (cur && cur.song && cur.song.yt) broadcast({ ...cur, yt: { ...x, at: Date.now() } }); }} />
                ) : <Lyrics song={st.song} elapsed={elapsed} chords={!!st.chords} />}
                {host ? <Btn label={w(lang, 'stop')} solid={false} onPress={() => broadcast({ ...st, phase: 'pick' })} style={{ marginTop: 12 }} /> : null}
              </>
            )
          ) : null}

          {/* back to the room, for the host */}
          {room && st && host ? (
            <Pressable onPress={() => { tapLight(); lastCards.current = null; setMine({}); broadcast(null); }} style={{ marginTop: 18, alignSelf: 'center' }}>
              <Text style={{ color: 'rgba(24,24,27,0.6)', fontSize: 13.5, fontWeight: '700', textDecorationLine: 'underline' }}>{w(lang, 'players')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
