import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { ROOFTOP_LOCATIONS } from '../constants/mockData';
import { useAuth } from '../context/AuthContext';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { submitScore, fetchLeaderboard } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';

/* ─── ROOFTOP RUSH — jump the skyline, a different chaser every country ───
   A genuinely different game from Catch Your Mate: single-lane, tap-to-
   jump rooftop obstacles (chimneys, AC units, satellite dishes, laundry
   lines) instead of left/right lane-dodging. Each country is a real
   re-skin — its own sky gradient, its own silhouette landmark, and its
   own themed chaser closing in behind you as you go, not just a color
   swap. Solo, real global leaderboard (one per country, same as the
   real-account leaderboards used everywhere else in the app).           */

const GROUND_Y = 118; // px from the bottom of the track
const PLAYER_X = 64;  // fixed horizontal position of the player
const JUMP_MS = 620;
const OBSTACLES = ['🛰️', '🧱', '📡', '🪴', '🧺'];
const LOOT = ['🪙', '⭐', '💎'];
const LOOT_PTS = { '🪙': 10, '⭐': 25, '💎': 50 };
const LEVEL_EVERY = 300;
const BEST_KEY = 'mm_rooftop_best';

export const RooftopRush = ({ onClose }) => {
  const { user } = useAuth();
  const meAvatar = user ? buildAvatarUrl(user.id, user.avatar_dna) : null;
  const [loc, setLoc] = useState(ROOFTOP_LOCATIONS[0]);
  const [phase, setPhase] = useState('ready'); // ready | playing | over
  const [items, setItems] = useState([]); // obstacles + loot, scrolling right→left
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    }
    return 0;
  });
  const [board, setBoard] = useState(null); // null | 'loading' | [rows]
  const [track, setTrack] = useState({ w: 0, h: 0 });
  const [pops, setPops] = useState([]);
  const [airborne, setAirborne] = useState(false);
  const [caught, setCaught] = useState(false);

  const levelRef = useRef(1);
  const loop = useRef(null);
  const spawn = useRef(null);
  const idc = useRef(0);
  const speedRef = useRef(3.6);
  const airborneRef = useRef(false);
  const landTimer = useRef(null);
  const chaserAnim = useRef(new Animated.Value(0)).current; // 0 = far behind, 1 = right on you
  const chaserGap = useRef(0);

  const jumpY = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, [bob]);

  useEffect(() => () => { clearInterval(loop.current); clearInterval(spawn.current); clearTimeout(landTimer.current); }, []);

  const groundLine = track.h - GROUND_Y;

  const showBanner = () => {
    banner.setValue(0);
    Animated.sequence([
      Animated.spring(banner, { toValue: 1, useNativeDriver: true, tension: 60 }),
      Animated.delay(850),
      Animated.timing(banner, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const addPop = (x, y, label) => {
    const id = 'p' + (++idc.current);
    setPops((p) => [...p, { id, x, y, label }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 650);
  };

  const restartSpawner = () => {
    clearInterval(spawn.current);
    const lvl = levelRef.current;
    const interval = Math.max(560, 1150 - lvl * 90);
    spawn.current = setInterval(() => {
      idc.current += 1;
      const isLoot = Math.random() < 0.3;
      if (isLoot) {
        const e = LOOT[Math.floor(Math.random() * LOOT.length)];
        setItems((prev) => [...prev, { id: 'i' + idc.current, x: track.w + 30, y: groundLine - 78, e, loot: LOOT_PTS[e] }]);
      } else {
        const e = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
        setItems((prev) => [...prev, { id: 'i' + idc.current, x: track.w + 30, y: groundLine - 30, e }]);
      }
    }, interval);
  };

  const doJump = () => {
    if (phase !== 'playing' || airborneRef.current) return;
    tapLight(); sfxPop();
    airborneRef.current = true;
    setAirborne(true);
    jumpY.setValue(0);
    Animated.sequence([
      Animated.timing(jumpY, { toValue: -108, duration: JUMP_MS * 0.42, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(jumpY, { toValue: 0, duration: JUMP_MS * 0.58, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
    clearTimeout(landTimer.current);
    landTimer.current = setTimeout(() => { airborneRef.current = false; setAirborne(false); }, JUMP_MS);
  };

  const start = () => {
    if (track.h === 0) return;
    tapMedium(); sfxPop();
    setItems([]); setScore(0); setLevel(1); levelRef.current = 1;
    setCaught(false);
    speedRef.current = 3.6;
    chaserGap.current = 1;
    chaserAnim.setValue(0);
    setPhase('playing');

    loop.current = setInterval(() => {
      setItems((prev) => {
        let dead = false;
        const collected = [];
        const next = [];
        for (const o of prev) {
          const x = o.x - speedRef.current;
          const inBand = x >= PLAYER_X - 24 && x <= PLAYER_X + 24;
          if (inBand && !o.done) {
            if (o.loot) { collected.push(o); next.push({ ...o, x, done: true }); continue; }
            if (!airborneRef.current) { dead = true; }
            next.push({ ...o, x, done: true });
            continue;
          }
          const done = o.done || x < PLAYER_X - 24;
          if (x > -40) next.push({ ...o, x, done });
        }
        if (collected.length) {
          sfxStar();
          collected.forEach((c) => {
            addPop(PLAYER_X, groundLine - 100, '+' + c.loot);
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
          // the chaser inches closer every level — real visible tension
          chaserGap.current = Math.max(0.18, chaserGap.current - 0.14);
          Animated.timing(chaserAnim, { toValue: 1 - chaserGap.current, duration: 500, useNativeDriver: true }).start();
        }
        speedRef.current = 3.6 + (lvl - 1) * 0.85 + n * 0.003;
        return n;
      });
    }, 30);

    restartSpawner();
  };

  const endRun = () => {
    clearInterval(loop.current); clearInterval(spawn.current);
    tapSuccess(); sfxStar();
    setCaught(true);
    setPhase('over');
    setScore((s) => {
      setBest((b) => {
        const nb = Math.max(b, s);
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(BEST_KEY, String(nb));
        return nb;
      });
      if (user && s > 0) submitScore(user.id, 'rooftop', s); // real global leaderboard
      return s;
    });
  };

  const chaserLeft = chaserAnim.interpolate({ inputRange: [0, 1], outputRange: [PLAYER_X - 70, PLAYER_X - 16] });

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={loc.sky} style={{ flex: 1 }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>ROOFTOP RUSH 🏙️</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>{loc.flag} {loc.city} · Level {level}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>SCORE</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        {/* the track */}
        <Pressable
          style={{ flex: 1, marginTop: 14, marginHorizontal: 12, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.12)' }}
          onLayout={(e) => setTrack({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          onPress={doJump}
        >
          {/* giant landmark silhouette, always in frame */}
          <Text style={{ position: 'absolute', right: 10, top: 18, fontSize: 108, opacity: 0.22 }}>{loc.landmark}</Text>

          {/* rooftop ground line */}
          {track.h > 0 ? (
            <>
              <View style={{ position: 'absolute', left: 0, right: 0, top: groundLine, height: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: groundLine + 2, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' }} />
            </>
          ) : null}

          {/* the chaser — closes in as levels pass, catches you on crash */}
          {track.h > 0 && phase !== 'ready' ? (
            <Animated.View style={{ position: 'absolute', left: chaserLeft, top: groundLine - 46, alignItems: 'center', transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
              <Text style={{ fontSize: 34 }}>{loc.chaser}</Text>
            </Animated.View>
          ) : null}

          {/* obstacles + loot, scrolling toward the player */}
          {items.map((o) => (
            <Text key={o.id} style={{ position: 'absolute', left: o.x - 16, top: o.y, fontSize: o.loot ? 24 : 30, opacity: o.done && !o.loot ? 0.35 : 1 }}>{o.e}</Text>
          ))}

          {/* collect pops */}
          {pops.map((p) => (
            <Text key={p.id} style={{ position: 'absolute', left: p.x, top: p.y, color: C.gold, fontSize: 16, fontWeight: '900' }}>{p.label} ✨</Text>
          ))}

          {/* the player */}
          {track.h > 0 && phase !== 'ready' ? (
            <Animated.View style={{
              position: 'absolute', left: PLAYER_X - 23, top: groundLine - 46, alignItems: 'center',
              transform: [{ translateY: jumpY }],
            }}>
              {meAvatar ? (
                <Image source={{ uri: meAvatar }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: C.gold, backgroundColor: '#0D2B5E' }} />
              ) : (
                <Text style={{ fontSize: 40 }}>🏃</Text>
              )}
            </Animated.View>
          ) : null}

          {/* level-up banner */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: '30%', left: 0, right: 0, alignItems: 'center',
            opacity: banner, transform: [{ scale: banner.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}>
            <View style={{ backgroundColor: 'rgba(245,179,1,0.95)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: '#081226', fontSize: 18, fontWeight: '900' }}>LEVEL {level} 🔥 — {loc.chaserName} is closer!</Text>
            </View>
          </Animated.View>

          {/* jump hint while playing */}
          {phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800' }}>TAP TO JUMP</Text>
            </View>
          ) : null}

          {/* READY overlay — pick your country */}
          {phase === 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <Text style={{ fontSize: 40 }}>{loc.landmark}</Text>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginTop: 8 }}>{loc.chaser} {loc.chaserName} is right behind you</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 6, lineHeight: 19 }}>
                Tap to jump every gap and chimney.{'\n'}🪙 +10 · ⭐ +25 · 💎 +50 — every {LEVEL_EVERY} pts, {loc.chaserName.split(' ').pop()} gets closer.
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginBottom: 12 }}>Best {best}</Text>

              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('rooftop').then(setBoard).catch(() => setBoard([])); }} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>🏆 Global leaderboard</Text>
                </View>
              </Pressable>

              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>PICK YOUR SKYLINE</Text>
              <View style={{ flexDirection: 'row' }}>
                {ROOFTOP_LOCATIONS.map((g) => {
                  const on = g.id === loc.id;
                  return (
                    <Pressable key={g.id} onPress={() => { tapLight(); setLoc(g); }} style={{ alignItems: 'center', marginHorizontal: 8 }}>
                      <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: on ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', borderWidth: on ? 2 : 1, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 26 }}>{g.landmark}</Text>
                      </View>
                      <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: on ? '900' : '600', marginTop: 4 }}>{g.flag} {g.city}</Text>
                      <Text style={{ fontSize: 13, marginTop: 1 }}>{g.chaser}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={start} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 40, paddingVertical: 15, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#081226', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>START RUN ▶</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* GAME OVER overlay */}
          {phase === 'over' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 26 }}>
              <Text style={{ fontSize: 48 }}>{loc.chaser}</Text>
              <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>
                {caught ? loc.caughtLine : 'Run over!'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>
                Score {score} · Level {level} · Best {Math.max(best, score)}
              </Text>
              <Pressable onPress={start} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color="#081226" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#081226', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>RUN AGAIN</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); setPhase('ready'); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>Change skyline</Text>
              </Pressable>
            </View>
          ) : null}

          {/* GLOBAL LEADERBOARD */}
          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 16, maxHeight: '80%' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>🏆 Global leaderboard</Text>
                {board === 'loading' ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>…</Text>
                ) : board.length === 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No scores yet — be the first!</Text>
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
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' }}>Close</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </LinearGradient>
    </Modal>
  );
};
