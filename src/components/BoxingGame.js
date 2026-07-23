import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { submitScore, fetchLeaderboard } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';

/* Games in Egyptian Arabic when the user turns it on (Settings). */
const gamesAr = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem('mm_games_ar') === '1'; } catch (e) { return false; } };
const GT = {
  jab: ['JAB 👊', 'لكمة 👊'], hook: ['HOOK 🥊', 'هوك 🥊'], block: ['BLOCK 🛡️', 'صدّ 🛡️'],
  start: ['FIGHT! ▶', 'يلا نتخانق ▶'], again: ['Rematch', 'تاني'], board: ['🏆 Global leaderboard', '🏆 الترتيب العالمي'],
  round: ['Round', 'جولة'], score: ['SCORE', 'النتيجة'], won: ['K.O! 🏆', 'ضربة قاضية! 🏆'], lost: ['You got knocked out 💫', 'اتعلقت لك واحدة 💫'],
  ready: ['Block the ⚠️ hits. Jab fast, hook hard. Knock them out!', 'صدّ لما تشوف ⚠️. لكمة سريعة، وهوك قوي. ونوّمه!'],
};
const gt = (k) => GT[k][gamesAr() ? 1 : 0];

/* ─── BOXING — pixel/cartoon arcade boxing (solo vs a scaling rival) ───
   Timing combat: the rival telegraphs a hit (⚠️) — hold BLOCK to soak it,
   or you eat the damage. Jab is fast & light, hook is slow & heavy; the
   rival blocks sometimes too. K.O. the rival to advance to a tougher one;
   it never ends until you're knocked out. Real global leaderboard.       */

const MAX_HP = 100;
const TICK = 100; // ms

const OPPONENTS = [
  { name: 'Sandbag Sami', emoji: '🥊', color: '#6B7280' },
  { name: 'Tough Tarek', emoji: '🥊', color: '#B45309' },
  { name: 'Iron Iman', emoji: '🥊', color: '#7C3AED' },
  { name: 'Champ Karim', emoji: '🏆', color: '#DC2626' },
];

export const BoxingGame = ({ onClose }) => {
  const { user } = useAuth();
  const meAvatar = user ? buildAvatarUrl(user.id, user.avatar_dna) : null;
  const [phase, setPhase] = useState('ready'); // ready | playing | won | lost
  const [pHp, setPHp] = useState(MAX_HP);
  const [cHp, setCHp] = useState(MAX_HP);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [warn, setWarn] = useState(false);   // rival telegraph
  const [board, setBoard] = useState(null);
  const [flash, setFlash] = useState(null);  // 'me' | 'them' | null — hit flash
  const [cpuBlocking, setCpuBlocking] = useState(false);

  const blockingRef = useRef(false);
  const loop = useRef(null);
  const atk = useRef(0);       // ticks until the rival strikes
  const jabCd = useRef(0);     // player cooldowns (ms)
  const hookCd = useRef(0);
  const cpuBlockT = useRef(0);
  const roundRef = useRef(1);
  const scoreRef = useRef(0);
  const pHpRef = useRef(MAX_HP);
  const cHpRef = useRef(MAX_HP);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => () => clearInterval(loop.current), []);

  const opp = OPPONENTS[Math.min(round - 1, OPPONENTS.length - 1)];
  // difficulty scales with round
  const cpuDmg = 7 + (round - 1) * 3;
  const cpuEveryTicks = Math.max(9, 22 - round * 2); // strikes more often later

  const doShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };
  const showFlash = (who) => { setFlash(who); setTimeout(() => setFlash(null), 160); };

  const startFight = (nextRound) => {
    tapMedium(); sfxPop();
    const r = nextRound || 1;
    roundRef.current = r; setRound(r);
    pHpRef.current = MAX_HP; cHpRef.current = MAX_HP; setPHp(MAX_HP); setCHp(MAX_HP);
    atk.current = Math.max(9, 22 - r * 2);
    jabCd.current = 0; hookCd.current = 0; cpuBlockT.current = 0;
    setWarn(false); setCpuBlocking(false);
    setPhase('playing');

    clearInterval(loop.current);
    loop.current = setInterval(() => {
      jabCd.current = Math.max(0, jabCd.current - TICK);
      hookCd.current = Math.max(0, hookCd.current - TICK);

      // rival occasionally raises a guard (reduces YOUR damage)
      if (cpuBlockT.current > 0) {
        cpuBlockT.current -= TICK;
        if (cpuBlockT.current <= 0) setCpuBlocking(false);
      } else if (Math.random() < 0.06) {
        cpuBlockT.current = 500; setCpuBlocking(true);
      }

      // rival attack timer + telegraph
      atk.current -= 1;
      if (atk.current === 2) setWarn(true); // ~200ms warning
      if (atk.current <= 0) {
        setWarn(false);
        const dmg = blockingRef.current ? Math.round(cpuDmg * 0.25) : cpuDmg;
        pHpRef.current = Math.max(0, pHpRef.current - dmg);
        setPHp(pHpRef.current);
        showFlash('me'); doShake();
        if (!blockingRef.current) { tapMedium(); } else { tapLight(); }
        atk.current = cpuEveryTicks + Math.floor(Math.random() * 6);
        if (pHpRef.current <= 0) return endFight(false);
      }
    }, TICK);
  };

  const punch = (kind) => {
    if (phase !== 'playing') return;
    const cd = kind === 'hook' ? hookCd : jabCd;
    if (cd.current > 0) return;
    cd.current = kind === 'hook' ? 900 : 350;
    tapLight(); sfxPop();
    let dmg = kind === 'hook' ? 15 : 6;
    if (cpuBlocking) dmg = Math.round(dmg * 0.3);
    dmg += Math.floor(Math.random() * 3);
    cHpRef.current = Math.max(0, cHpRef.current - dmg);
    setCHp(cHpRef.current);
    showFlash('them');
    if (cHpRef.current <= 0) endFight(true);
  };

  const endFight = (won) => {
    clearInterval(loop.current);
    setWarn(false);
    if (won) {
      tapSuccess(); sfxSuccess();
      const gained = 100 * roundRef.current + Math.round(pHpRef.current);
      scoreRef.current += gained; setScore(scoreRef.current);
      if (roundRef.current < 99) {
        // brief celebration then next, tougher rival
        setPhase('won');
        setTimeout(() => { if (loop.current !== null) startFight(roundRef.current + 1); }, 1400);
      }
    } else {
      tapMedium(); sfxStar();
      setPhase('lost');
      if (user && scoreRef.current > 0) submitScore(user.id, 'boxing', scoreRef.current);
    }
  };

  const setBlock = (on) => { blockingRef.current = on; };
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  const Boxer = ({ side, hp, avatar, emoji, name, color, flashing, guarding }) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', marginRight: 6 }} numberOfLines={1}>{name}</Text>
      </View>
      {/* health bar */}
      <View style={{ width: '86%', height: 12, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: '#000', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: Math.max(0, hp) + '%', backgroundColor: hp > 40 ? '#22C55E' : hp > 18 ? '#F59E0B' : '#EF4444' }} />
      </View>
      <View style={{ height: 92, justifyContent: 'flex-end', marginTop: 10 }}>
        {avatar ? (
          <View style={{ alignItems: 'center', opacity: flashing ? 0.5 : 1 }}>
            <Image source={{ uri: avatar }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: flashing ? '#EF4444' : color }} />
            <Text style={{ fontSize: 26, marginTop: -8 }}>{guarding ? '🛡️' : '🥊'}</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 52, opacity: flashing ? 0.5 : 1 }}>{guarding ? '🛡️' : emoji}</Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={['#1A0B2E', '#2B1055', '#0B0620']} style={{ flex: 1 }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); clearInterval(loop.current); loop.current = null; onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>BOXING 🥊</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>{gt('round')} {round} · {opp.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>{gt('score')}</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        {/* the ring */}
        <Animated.View style={{ flex: 1, marginTop: 10, marginHorizontal: 12, borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 2, borderColor: 'rgba(245,179,1,0.4)', transform: [{ translateX: shakeX }] }}>
          {/* ring ropes */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(245,179,1,0.5)' }} />
          <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, height: 3, backgroundColor: 'rgba(245,179,1,0.3)' }} />

          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: 18 }}>
            <Boxer side="me" hp={pHp} avatar={meAvatar} emoji="🧑" name={gamesAr() ? 'انت' : 'You'} color={C.gold} flashing={flash === 'me'} guarding={blockingRef.current} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: '900' }}>VS</Text>
            <Boxer side="them" hp={cHp} avatar={null} emoji={opp.emoji} name={opp.name} color={opp.color} flashing={flash === 'them'} guarding={cpuBlocking} />
          </View>

          {/* telegraph warning */}
          {warn && phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ backgroundColor: 'rgba(239,68,68,0.92)', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>⚠️ {gamesAr() ? 'صدّ!' : 'BLOCK!'}</Text>
              </View>
            </View>
          ) : null}

          {/* READY */}
          {phase === 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,6,32,0.8)', padding: 24 }}>
              <Text style={{ fontSize: 46 }}>🥊</Text>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 6 }}>BOXING</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 20, maxWidth: 300 }}>{gt('ready')}</Text>
              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('boxing').then(setBoard).catch(() => setBoard([])); }} style={{ marginTop: 16 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{gt('board')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => startFight(1)} style={{ marginTop: 18 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 44, paddingVertical: 15 }}>
                  <Text style={{ color: '#0B0620', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>{gt('start')}</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* WON (between rounds) */}
          {phase === 'won' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,6,32,0.55)' }}>
              <Text style={{ fontSize: 44 }}>🏆</Text>
              <Text style={{ color: C.gold, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{gt('won')}</Text>
              <Text style={{ color: '#FFF', fontSize: 13, marginTop: 6 }}>{gamesAr() ? 'الجولة الجاية أصعب…' : 'Next rival is tougher…'}</Text>
            </View>
          ) : null}

          {/* LOST */}
          {phase === 'lost' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,6,32,0.88)', padding: 26 }}>
              <Text style={{ fontSize: 48 }}>💫</Text>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{gt('lost')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>{gt('round')} {round} · {gt('score')} {score}</Text>
              <Pressable onPress={() => startFight(1)} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 38, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color="#0B0620" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#0B0620', fontSize: 14, fontWeight: '900' }}>{gt('again')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('boxing').then(setBoard).catch(() => setBoard([])); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>{gt('board')}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* LEADERBOARD */}
          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(11,6,32,0.94)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
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
        </Animated.View>

        {/* controls */}
        {phase === 'playing' ? (
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 30 }}>
            <Pressable onPressIn={() => { setBlock(true); tapLight(); }} onPressOut={() => setBlock(false)} style={{ flex: 1, marginRight: 8 }}>
              <View style={{ backgroundColor: 'rgba(59,130,246,0.25)', borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 18, paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{gt('block')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => punch('jab')} style={{ flex: 1, marginRight: 8 }}>
              <View style={{ backgroundColor: 'rgba(245,179,1,0.22)', borderWidth: 1.5, borderColor: C.gold, borderRadius: 18, paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{gt('jab')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => punch('hook')} style={{ flex: 1 }}>
              <View style={{ backgroundColor: 'rgba(239,68,68,0.25)', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 18, paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{gt('hook')}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>
    </Modal>
  );
};
