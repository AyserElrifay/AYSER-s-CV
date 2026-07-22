import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { GAME_LOCATIONS, USERS } from '../constants/mockData';
import { useAuth } from '../context/AuthContext';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { submitScore, fetchLeaderboard, finishMatch, subscribeMatchLive } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';

// Games in Egyptian Arabic when the user turns it on (Settings).
const gamesAr = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem('mm_games_ar') === '1'; } catch (e) { return false; } };
const GT = {
  score: ['SCORE', 'النتيجة'], start: ['START RUN ▶', 'يلا نجري ▶'], best: ['Best', 'أعلى'],
  over: ['Tough luck!', 'حظ أوحش!'], again: ['Run again ↻', 'تاني ↻'], board: ['🏆 Global leaderboard', '🏆 الترتيب العالمي'],
  hazards: ['Dodge the hazards, grab the loot:', 'فوت الموانع واجمع الكنوز:'], pick: ['PICK YOUR CITY', 'اختار مدينتك'],
};
const gt = (k) => GT[k][gamesAr() ? 1 : 0];

/* ─── CATCH YOUR MATE — navy nights, levels & loot ───
   · Deep-navy track, 4 lanes, your own cartoon character as the runner
   · LEVELS: every 250 pts the game speeds up + spawns faster, with a
     level-up banner animation
   · LOOT falls between the hazards: 🪙 +10 · ⭐ +25 · 💎 +50
   · HAZARDS still end the run — but collision is fair now: an obstacle
     that has already passed you can never kill you, and a lane switch
     gets a short grace window (this was the "I switch and instantly
     lose" bug)
   · Animated lane changes (spring), collect pops, player bob
   · Best score really persists (localStorage on web)

   REAL multiplayer — when `matchId` is passed, this is a genuine live
   duel against a real friend: same game, same track mechanics, but now
   both of you run it at once. A 45-second sprint over a Supabase
   Realtime broadcast channel (never simulated, same wire real calls
   use) — live scores, a synced countdown, and whoever's still standing
   (or scored higher) at the buzzer really did catch their mate.       */

const LANES = 4;
const HAZARDS = ['🚧', '🛵', '🪨', '🛑', '🚗', '🧺'];
const FAST_HAZARD = '🚓';
const LOOT = [
  { e: '🪙', pts: 10, w: 6 },
  { e: '⭐', pts: 25, w: 3 },
  { e: '💎', pts: 50, w: 1 },
];
const PLAYER_Y_FROM_BOTTOM = 96;
const LEVEL_EVERY = 250;
const BEST_KEY = 'mm_runner_best';
const DUEL_MS = 45000; // 45-second real-time head-to-head sprint

const pickLoot = () => {
  const total = LOOT.reduce((n, l) => n + l.w, 0);
  let r = Math.random() * total;
  for (const l of LOOT) { r -= l.w; if (r <= 0) return l; }
  return LOOT[0];
};

export const GameRunner = ({ opponent = USERS.nour, onClose, matchId = null, isHost = false, onRematch = null }) => {
  const { user } = useAuth();
  const meAvatar = user ? buildAvatarUrl(user.id, user.avatar_dna) : null;
  const isMultiplayer = !!matchId;
  const [loc, setLoc] = useState(GAME_LOCATIONS[0]);
  const [phase, setPhase] = useState('ready'); // ready | playing | over
  const [lane, setLane] = useState(1);
  const [items, setItems] = useState([]); // hazards + loot fall together
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    }
    return 0;
  });
  const [board, setBoard] = useState(null); // null | 'loading' | [rows] — global leaderboard
  const [track, setTrack] = useState({ w: 0, h: 0 });
  const [pops, setPops] = useState([]); // collect animations

  // ── multiplayer state ──
  const [mpPhase, setMpPhase] = useState('waiting'); // waiting | countdown | racing | waitingResult | result
  const [meReady, setMeReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [peerScore, setPeerScore] = useState(0);
  const [myFinal, setMyFinal] = useState(null);
  const [peerFinal, setPeerFinal] = useState(null);
  const [duelLeft, setDuelLeft] = useState(DUEL_MS / 1000);
  const liveRef = useRef(null);
  const meReadyRef = useRef(false);
  const peerReadyRef = useRef(false);
  const startedRef = useRef(false);
  const myFinalRef = useRef(null);
  const peerFinalRef = useRef(null);
  const resolvedRef = useRef(false);
  const scoreRef = useRef(0);
  const countdownTimerRef = useRef(null);
  const durTimerRef = useRef(null);
  const duelTickRef = useRef(null);

  const laneRef = useRef(1);
  const levelRef = useRef(1);
  const loop = useRef(null);
  const spawn = useRef(null);
  const idc = useRef(0);
  const speedRef = useRef(3.4);
  const switchAt = useRef(0); // grace window after a lane change

  // animations: player slide + bob, level banner
  const laneAnim = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 340, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 340, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, [bob]);

  useEffect(() => () => { clearInterval(loop.current); clearInterval(spawn.current); }, []);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const laneX = (l) => {
    const pad = 20;
    const usable = track.w - pad * 2;
    return pad + usable * ((l + 0.5) / LANES);
  };
  const playerY = track.h - PLAYER_Y_FROM_BOTTOM;

  const showBanner = () => {
    banner.setValue(0);
    Animated.sequence([
      Animated.spring(banner, { toValue: 1, useNativeDriver: true, tension: 60 }),
      Animated.delay(900),
      Animated.timing(banner, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const addPop = (x, y, label) => {
    const id = 'p' + (++idc.current);
    setPops((p) => [...p, { id, x, y, label }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 700);
  };

  const restartSpawner = () => {
    clearInterval(spawn.current);
    const lvl = levelRef.current;
    const interval = Math.max(340, 760 - lvl * 60);
    spawn.current = setInterval(() => {
      idc.current += 1;
      const l = Math.floor(Math.random() * LANES);
      const isLoot = Math.random() < 0.34;
      if (isLoot) {
        const lt = pickLoot();
        setItems((prev) => [...prev, { id: 'i' + idc.current, lane: l, y: -50, e: lt.e, loot: lt.pts }]);
      } else {
        const fast = lvl >= 3 && Math.random() < 0.18;
        setItems((prev) => [...prev, {
          id: 'i' + idc.current, lane: l, y: -50,
          e: fast ? FAST_HAZARD : HAZARDS[idc.current % HAZARDS.length],
          fast,
        }]);
      }
    }, interval);
  };

  const start = () => {
    if (track.h === 0) return;
    tapMedium(); sfxPop();
    setItems([]); setScore(0); setLevel(1); levelRef.current = 1;
    setLane(1); laneRef.current = 1; laneAnim.setValue(1);
    speedRef.current = 3.4;
    setPhase('playing');

    loop.current = setInterval(() => {
      setItems((prev) => {
        let dead = false;
        const collected = [];
        const next = [];
        for (const o of prev) {
          const v = o.fast ? speedRef.current * 1.55 : speedRef.current;
          const y = o.y + v;
          const inMyLane = o.lane === laneRef.current;
          const inBand = y >= playerY - 30 && y <= playerY + 8; // only while arriving, never after passing
          if (inMyLane && inBand && !o.done) {
            if (o.loot) { collected.push(o); continue; }               // loot: scoop it up
            if (Date.now() - switchAt.current > 140) { dead = true; }  // hazard (with switch grace)
            else { next.push({ ...o, y, done: true }); continue; }     // grace: ghost through, once
          }
          const done = o.done || y > playerY + 8; // passed you → harmless forever
          if (y < track.h + 60) next.push({ ...o, y, done });
        }
        if (collected.length) {
          sfxStar();
          collected.forEach((c) => {
            addPop(laneX(c.lane) - 14, playerY - 30, '+' + c.loot);
            setScore((s) => s + c.loot);
          });
        }
        if (dead) { endRun(); return prev; }
        return next;
      });
      setScore((s) => {
        const n = s + 1;
        const lvl = Math.floor(n / LEVEL_EVERY) + 1;
        if (lvl !== levelRef.current) {
          levelRef.current = lvl;
          setLevel(lvl);
          tapSuccess(); sfxSuccess();
          showBanner();
          restartSpawner();
        }
        speedRef.current = 3.4 + (lvl - 1) * 0.9 + n * 0.004;
        return n;
      });
    }, 30);

    restartSpawner();
  };

  const endRun = () => {
    clearInterval(loop.current); clearInterval(spawn.current);
    tapSuccess(); sfxStar();
    if (!isMultiplayer) setPhase('over');
    setScore((s) => {
      setBest((b) => {
        const nb = Math.max(b, s);
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(BEST_KEY, String(nb));
        return nb;
      });
      if (isMultiplayer) finishMyDuelRun(s);
      else if (user && s > 0) submitScore(user.id, 'runner', s); // real global leaderboard
      return s;
    });
  };

  const move = (dir) => {
    if (phase !== 'playing') return;
    setLane((l) => {
      const n = Math.max(0, Math.min(LANES - 1, l + dir));
      if (n !== l) {
        tapLight();
        laneRef.current = n;
        switchAt.current = Date.now();
        Animated.spring(laneAnim, { toValue: n, useNativeDriver: false, tension: 120, friction: 9 }).start();
      }
      return n;
    });
  };

  // ── REAL multiplayer — live duel over Supabase Realtime broadcast ──
  const tryResolveDuel = (mine, peer) => {
    if (mine == null || peer == null || resolvedRef.current) return;
    resolvedRef.current = true;
    const hostScore = isHost ? mine : peer;
    const guestScore = isHost ? peer : mine;
    const hostId = isHost ? (user && user.id) : (opponent && opponent.id);
    const guestId = isHost ? (opponent && opponent.id) : (user && user.id);
    const winnerId = hostScore === guestScore ? null : (hostScore > guestScore ? hostId : guestId);
    finishMatch(matchId, { hostScore, guestScore, winnerId }).catch(() => {});
    setMpPhase('result');
  };

  const finishMyDuelRun = (finalScore) => {
    if (myFinalRef.current != null) return;
    myFinalRef.current = finalScore;
    setMyFinal(finalScore);
    setMpPhase((p) => (p === 'result' ? p : 'waitingResult'));
    if (user) submitScore(user.id, 'catch_duel', finalScore);
    liveRef.current && liveRef.current.send('finished', { who: user && user.id, score: finalScore });
    tryResolveDuel(finalScore, peerFinalRef.current);
  };

  const beginCountdown = (startAt) => {
    clearTimeout(countdownTimerRef.current);
    setMpPhase('countdown');
    const tick = () => {
      const left = Math.ceil((startAt - Date.now()) / 1000);
      if (left <= 0) {
        setCountdown(null);
        setMpPhase('racing');
        start();
        setDuelLeft(DUEL_MS / 1000);
        clearInterval(duelTickRef.current);
        duelTickRef.current = setInterval(() => setDuelLeft((s) => Math.max(0, s - 1)), 1000);
        durTimerRef.current = setTimeout(() => {
          clearInterval(loop.current); clearInterval(spawn.current);
          clearInterval(duelTickRef.current);
          finishMyDuelRun(scoreRef.current);
        }, DUEL_MS);
        return;
      }
      setCountdown(left);
      countdownTimerRef.current = setTimeout(tick, 150);
    };
    tick();
  };

  const maybeStart = () => {
    if (!isHost || startedRef.current || !meReadyRef.current || !peerReadyRef.current) return;
    startedRef.current = true;
    const startAt = Date.now() + 3000;
    liveRef.current && liveRef.current.send('start', { startAt });
    beginCountdown(startAt);
  };

  useEffect(() => {
    if (!isMultiplayer) return undefined;
    const live = subscribeMatchLive(matchId, {
      ready: ({ who }) => { if (who !== (user && user.id)) { peerReadyRef.current = true; setPeerReady(true); maybeStart(); } },
      start: ({ startAt }) => { if (!isHost) beginCountdown(startAt); },
      score: ({ who, score: s }) => { if (who !== (user && user.id)) setPeerScore(s); },
      finished: ({ who, score: s }) => {
        if (who === (user && user.id)) return;
        peerFinalRef.current = s;
        setPeerFinal(s);
        tryResolveDuel(myFinalRef.current, s);
      },
    });
    liveRef.current = live;
    return () => {
      live.leave();
      clearTimeout(countdownTimerRef.current);
      clearTimeout(durTimerRef.current);
      clearInterval(duelTickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const tapReady = () => {
    if (meReadyRef.current) return;
    tapMedium(); sfxPop();
    meReadyRef.current = true;
    setMeReady(true);
    liveRef.current && liveRef.current.send('ready', { who: user && user.id });
    maybeStart();
  };

  const caughtMate = score >= 600; // solo/practice only — catch them at the end of level 3

  const playerLeft = laneAnim.interpolate({
    inputRange: [0, LANES - 1],
    outputRange: [laneX(0) - 24, laneX(LANES - 1) - 24],
  });

  const oppFirst = ((opponent && opponent.name) || 'Mate').split(' ')[0];

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      {/* deep navy — the requested كحلي look */}
      <LinearGradient colors={['#0A1D3F', '#0D2B5E', '#081226']} style={{ flex: 1 }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>CATCH YOUR MATE 🏃</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
              {isMultiplayer ? 'Live duel vs ' + oppFirst : loc.flag + ' ' + loc.city + ' · Level ' + level}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>{gt('score')}</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        {/* the track */}
        <View
          style={{ flex: 1, marginTop: 14, marginHorizontal: 12, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(4,10,26,0.55)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)' }}
          onLayout={(e) => setTrack({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {/* lane glow guides */}
          {Array.from({ length: LANES - 1 }).map((_, i) => (
            <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: (track.w / LANES) * (i + 1) - 1, width: 2, backgroundColor: 'rgba(96,165,250,0.16)' }} />
          ))}
          {/* side rails */}
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 6, width: 3, borderRadius: 2, backgroundColor: 'rgba(96,165,250,0.3)' }} />
          <View style={{ position: 'absolute', top: 0, bottom: 0, right: 6, width: 3, borderRadius: 2, backgroundColor: 'rgba(96,165,250,0.3)' }} />

          {/* the mate you're chasing — practice/solo mode only (a real
              duel shows their LIVE score in the corner instead) */}
          {!isMultiplayer && track.h > 0 ? (
            <View style={{ position: 'absolute', top: 38, left: laneX(1) - 18, alignItems: 'center' }}>
              <Image source={{ uri: opponent.avatar }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#FFF', opacity: 0.92 }} />
              <Text style={{ fontSize: 18, marginTop: -4 }}>💨</Text>
            </View>
          ) : null}

          {/* real duel — opponent's live score + time left */}
          {isMultiplayer && mpPhase === 'racing' ? (
            <View style={{ position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', zIndex: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Image source={{ uri: opponent.avatar }} style={{ width: 22, height: 22, borderRadius: 11, marginRight: 6 }} />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{peerScore}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '800', marginTop: 4 }}>{duelLeft}s left</Text>
            </View>
          ) : null}

          {/* falling hazards + loot */}
          {items.map((o) => (
            <Text
              key={o.id}
              style={{
                position: 'absolute', left: laneX(o.lane) - 17, top: o.y, fontSize: o.loot ? 26 : 32,
                opacity: o.done && !o.loot ? 0.4 : 1,
                textShadowColor: o.fast ? 'rgba(244,63,94,0.9)' : o.loot ? 'rgba(245,179,1,0.8)' : 'transparent',
                textShadowRadius: o.fast || o.loot ? 10 : 0,
              }}
            >
              {o.e}
            </Text>
          ))}

          {/* collect pops */}
          {pops.map((p) => (
            <Text key={p.id} style={{ position: 'absolute', left: p.x, top: p.y, color: C.gold, fontSize: 16, fontWeight: '900' }}>{p.label} ✨</Text>
          ))}

          {/* the player — your own cartoon character */}
          {track.h > 0 && phase !== 'ready' ? (
            <Animated.View style={{
              position: 'absolute', left: playerLeft, top: playerY - 14, alignItems: 'center',
              transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
            }}>
              {meAvatar ? (
                <>
                  <Image source={{ uri: meAvatar }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: C.gold, backgroundColor: '#0D2B5E' }} />
                  <Text style={{ fontSize: 15, marginTop: -6 }}>👟</Text>
                </>
              ) : (
                <Text style={{ fontSize: 40 }}>🏃</Text>
              )}
            </Animated.View>
          ) : null}

          {/* level-up banner */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center',
            opacity: banner, transform: [{ scale: banner.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}>
            <View style={{ backgroundColor: 'rgba(245,179,1,0.95)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: '#081226', fontSize: 18, fontWeight: '900' }}>LEVEL {level} 🔥</Text>
            </View>
          </Animated.View>

          {/* tap zones while playing */}
          {phase === 'playing' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
              <Pressable style={{ flex: 1 }} onPress={() => move(-1)} />
              <Pressable style={{ flex: 1 }} onPress={() => move(1)} />
            </View>
          ) : null}

          {/* READY overlay — solo/practice only */}
          {!isMultiplayer && phase === 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: opponent.avatar }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' }} />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 10 }}>Racing {oppFirst}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', marginBottom: 6, lineHeight: 19 }}>
                {gt('hazards')}{'\n'}🪙 +10 · ⭐ +25 · 💎 +50 — every 250 pts levels you up.
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginBottom: 12 }}>{gt('best')} {best}</Text>

              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('runner').then(setBoard).catch(() => setBoard([])); }} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{gt('board')}</Text>
                </View>
              </Pressable>

              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>{gt('pick')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 74, flexGrow: 0 }}>
                {GAME_LOCATIONS.map((g) => {
                  const on = g.id === loc.id;
                  return (
                    <Pressable key={g.id} onPress={() => { tapLight(); setLoc(g); }} style={{ alignItems: 'center', marginHorizontal: 6 }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: on ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.1)', borderWidth: on ? 2 : 1, borderColor: on ? '#7EB8FF' : 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 24 }}>{g.landmark}</Text>
                      </View>
                      <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: on ? '900' : '600', marginTop: 4 }}>{g.flag} {g.city}</Text>
                      {g.home ? <Text style={{ color: C.gold, fontSize: 8, fontWeight: '900' }}>HOME</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable onPress={start} style={{ marginTop: 20 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 40, paddingVertical: 15, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#081226', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>{gt('start')}</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* GAME OVER overlay — solo/practice only */}
          {!isMultiplayer && phase === 'over' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,10,26,0.68)', padding: 26 }}>
              <Text style={{ fontSize: 48 }}>{caughtMate ? '🏆' : '💥'}</Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 6 }}>
                {caughtMate ? 'You caught ' + oppFirst + '!' : 'Wiped out!'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>
                Score {score} · Level {level} · Best {Math.max(best, score)}
              </Text>
              <Pressable onPress={start} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color="#081226" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#081226', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>REMATCH</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); setPhase('ready'); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>Change city / mate</Text>
              </Pressable>
            </View>
          ) : null}

          {/* GLOBAL LEADERBOARD — real accounts, real scores, ranked worldwide */}
          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(4,10,26,0.9)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 16, maxHeight: '80%' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>{gt('board')}</Text>
                {board === 'loading' ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>…</Text>
                ) : board.length === 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>{gamesAr() ? 'مفيش نتايج لسه — كن أول واحد!' : 'No scores yet — be the first!'}</Text>
                ) : (
                  <ScrollView>
                    {board.map((r, i) => (
                      <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < board.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ color: i === 0 ? C.gold : i < 3 ? '#FFF' : 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '900', width: 34 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</Text>
                        {r.avatar ? <Image source={{ uri: r.avatar }} style={{ width: 30, height: 30, borderRadius: 15, marginRight: 9 }} /> : <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 9 }} />}
                        <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>{r.flag ? r.flag + ' ' : ''}{r.name}</Text>
                        <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900' }}>{r.score}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                <Pressable onPress={() => setBoard(null)} style={{ marginTop: 12, alignSelf: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' }}>{gamesAr() ? 'إغلاق' : 'Close'}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </View>

        {/* footer controls */}
        {phase === 'playing' ? (
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 30 }}>
            <Pressable onPress={() => move(-1)} style={{ flex: 1, marginRight: 8 }}>
              <View style={{ backgroundColor: 'rgba(96,165,250,0.18)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)', borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </View>
            </Pressable>
            <Pressable onPress={() => move(1)} style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ backgroundColor: 'rgba(96,165,250,0.18)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)', borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* ══════════ REAL multiplayer overlays — cover the whole
            screen (track + footer), painted last so they're on top ══════════ */}
        {isMultiplayer && mpPhase === 'waiting' ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '900', letterSpacing: 1.5, marginBottom: 18 }}>REAL-TIME DUEL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
              <View style={{ alignItems: 'center', marginHorizontal: 18 }}>
                <Image source={{ uri: meAvatar }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: meReady ? C.green : 'rgba(255,255,255,0.3)' }} />
                <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginTop: 8 }}>You</Text>
                <Text style={{ color: meReady ? C.green : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', marginTop: 2 }}>{meReady ? 'Ready ✓' : 'Not ready'}</Text>
              </View>
              <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>VS</Text>
              <View style={{ alignItems: 'center', marginHorizontal: 18 }}>
                <Image source={{ uri: opponent.avatar }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: peerReady ? C.green : 'rgba(255,255,255,0.3)' }} />
                <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginTop: 8 }} numberOfLines={1}>{oppFirst}</Text>
                <Text style={{ color: peerReady ? C.green : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', marginTop: 2 }}>{peerReady ? 'Ready ✓' : 'Waiting…'}</Text>
              </View>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, textAlign: 'center', marginBottom: 20, lineHeight: 18, maxWidth: 280 }}>
              45 seconds, real time. Dodge hazards, grab loot — whoever scores higher (or survives longer) really catches the other. 🏆
            </Text>
            <Pressable onPress={tapReady} disabled={meReady}>
              <View style={{ backgroundColor: meReady ? 'rgba(16,185,129,0.2)' : C.gold, borderRadius: 999, paddingHorizontal: 34, paddingVertical: 15 }}>
                <Text style={{ color: meReady ? C.green : '#081226', fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 }}>
                  {meReady ? 'WAITING FOR ' + oppFirst.toUpperCase() + '…' : "I'M READY 🏁"}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('catch_duel').then(setBoard).catch(() => setBoard([])); }} style={{ marginTop: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800' }}>🏆 Duel leaderboard</Text>
            </Pressable>
          </View>
        ) : null}

        {isMultiplayer && mpPhase === 'countdown' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 96, fontWeight: '900', color: C.gold }}>{countdown > 0 ? countdown : 'GO!'}</Text>
          </View>
        ) : null}

        {isMultiplayer && mpPhase === 'waitingResult' ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,10,26,0.9)', padding: 24 }}>
            <Text style={{ fontSize: 40 }}>⏳</Text>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 10 }}>You scored {myFinal}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 6 }}>Waiting for {oppFirst} to finish…</Text>
          </View>
        ) : null}

        {isMultiplayer && mpPhase === 'result' ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,10,26,0.92)', padding: 26 }}>
            <Text style={{ fontSize: 48 }}>{myFinal > peerFinal ? '🏆' : myFinal < peerFinal ? '😅' : '🤝'}</Text>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
              {myFinal > peerFinal ? 'You caught ' + oppFirst + '!' : myFinal < peerFinal ? oppFirst + ' caught you!' : 'Dead heat!'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 10 }}>You {myFinal} · {oppFirst} {peerFinal}</Text>
            {onRematch ? (
              <Pressable onPress={() => { tapMedium(); onRematch(); }} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color="#081226" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#081226', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>REMATCH</Text>
                </View>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={{ marginTop: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>Exit</Text>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>
    </Modal>
  );
};
