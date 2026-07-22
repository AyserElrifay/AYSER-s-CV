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

/* ─── سيكو سيكو · SEKO SEKO — Egyptian street games, GTA-Vice-City look ───
   A real walkable top-down 2D neighbourhood in the Vice City sunset
   palette (hot pink · teal · purple · warm dusk) that you roam with your
   own character. Level 1 is a Cairo hara (حارة). The first street game is
   الاستغماية (hide & seek): the neighbourhood kids have hidden around the
   block — walk up and find them all before the timer runs out.

   This is the WORLD/engine — future levels drop into other countries with
   new street games. Real global leaderboard (game key 'sekoseko'), your
   real avatar as the character. Nothing scripted or fake.               */

const WORLD_W = 1500;
const WORLD_H = 1050;
const PLAYER_SPEED = 4.4;
const FIND_RADIUS = 52;
const ROUND_SEC = 60;

// Vice-City-tinted Cairo blocks — warm dusk buildings with neon edges.
const BUILDINGS = [
  { x: 120, y: 120, w: 240, h: 150, c: '#3A2A5E', edge: '#FF2E88', emoji: '🏬' },
  { x: 520, y: 90, w: 200, h: 180, c: '#4A2A55', edge: '#20E3D2', emoji: '🕌' },
  { x: 900, y: 130, w: 260, h: 150, c: '#5A2E4E', edge: '#FF9E2C', emoji: '🏢' },
  { x: 180, y: 430, w: 200, h: 200, c: '#432A5C', edge: '#20E3D2', emoji: '🏠' },
  { x: 560, y: 470, w: 220, h: 150, c: '#5A2E4E', edge: '#FF2E88', emoji: '🏪' },
  { x: 980, y: 440, w: 220, h: 210, c: '#3A2A5E', edge: '#FFD23F', emoji: '🏨' },
  { x: 140, y: 780, w: 260, h: 150, c: '#4A2A55', edge: '#FF9E2C', emoji: '🏬' },
  { x: 560, y: 800, w: 220, h: 150, c: '#432A5C', edge: '#20E3D2', emoji: '🏠' },
  { x: 980, y: 790, w: 250, h: 160, c: '#5A2E4E', edge: '#FF2E88', emoji: '🏢' },
];
const PALMS = [
  { x: 440, y: 330 }, { x: 840, y: 340 }, { x: 1230, y: 320 },
  { x: 430, y: 700 }, { x: 860, y: 700 }, { x: 1250, y: 690 },
  { x: 70, y: 520 }, { x: 1330, y: 520 },
];
// the hidden kids of the hara — tucked against building corners
const KID_EMOJIS = ['🧒', '👦', '👧', '🧕', '👳'];
const HIDE_SPOTS = [
  { x: 360, y: 250 }, { x: 720, y: 250 }, { x: 380, y: 610 },
  { x: 1200, y: 620 }, { x: 780, y: 940 },
];

export const SekoSeko = ({ onClose }) => {
  const { user } = useAuth();
  const meAvatar = user ? buildAvatarUrl(user.id, user.avatar_dna) : null;
  const [phase, setPhase] = useState('ready'); // ready | playing | won | lost
  const [pos, setPos] = useState({ x: WORLD_W / 2, y: WORLD_H - 120 });
  const [kids, setKids] = useState([]); // {id, x, y, emoji, found}
  const [foundCount, setFoundCount] = useState(0);
  const [left, setLeft] = useState(ROUND_SEC);
  const [track, setTrack] = useState({ w: 0, h: 0 });
  const [board, setBoard] = useState(null);
  const [hint, setHint] = useState(null); // nearest-kid distance hint

  const posRef = useRef(pos);
  const dirRef = useRef({ dx: 0, dy: 0 });
  const kidsRef = useRef([]);
  const loop = useRef(null);
  const timer = useRef(null);
  const startedAt = useRef(0);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { clearInterval(loop.current); clearInterval(timer.current); }, []);

  // web keyboard controls (arrows / WASD)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const set = (e, on) => {
      const k = e.key.toLowerCase();
      const d = dirRef.current;
      if (k === 'arrowleft' || k === 'a') d.dx = on ? -1 : (d.dx < 0 ? 0 : d.dx);
      else if (k === 'arrowright' || k === 'd') d.dx = on ? 1 : (d.dx > 0 ? 0 : d.dx);
      else if (k === 'arrowup' || k === 'w') d.dy = on ? -1 : (d.dy < 0 ? 0 : d.dy);
      else if (k === 'arrowdown' || k === 's') d.dy = on ? 1 : (d.dy > 0 ? 0 : d.dy);
      else return;
      e.preventDefault();
    };
    const kd = (e) => set(e, true);
    const ku = (e) => set(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const start = () => {
    tapMedium(); sfxPop();
    const placed = HIDE_SPOTS.map((s, i) => ({ id: 'k' + i, x: s.x, y: s.y, emoji: KID_EMOJIS[i % KID_EMOJIS.length], found: false }));
    kidsRef.current = placed;
    setKids(placed);
    setFoundCount(0);
    const startPos = { x: WORLD_W / 2, y: WORLD_H - 120 };
    posRef.current = startPos; setPos(startPos);
    dirRef.current = { dx: 0, dy: 0 };
    setLeft(ROUND_SEC);
    startedAt.current = Date.now();
    setPhase('playing');

    loop.current = setInterval(() => {
      const d = dirRef.current;
      if (d.dx || d.dy) {
        const p = posRef.current;
        let nx = p.x + d.dx * PLAYER_SPEED;
        let ny = p.y + d.dy * PLAYER_SPEED;
        nx = Math.max(30, Math.min(WORLD_W - 30, nx));
        ny = Math.max(30, Math.min(WORLD_H - 30, ny));
        const np = { x: nx, y: ny };
        posRef.current = np;
        setPos(np);
        // find nearby hidden kids
        let nearest = Infinity;
        let foundNow = 0;
        const next = kidsRef.current.map((k) => {
          if (k.found) return k;
          const dist = Math.hypot(k.x - nx, k.y - ny);
          if (dist < nearest) nearest = dist;
          if (dist < FIND_RADIUS) { foundNow++; return { ...k, found: true }; }
          return k;
        });
        if (foundNow) {
          kidsRef.current = next;
          setKids(next);
          const total = next.filter((k) => k.found).length;
          setFoundCount(total);
          tapSuccess(); sfxStar();
          pop.setValue(0);
          Animated.timing(pop, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          if (total >= HIDE_SPOTS.length) win();
        }
        setHint(nearest === Infinity ? null : nearest);
      }
    }, 30);

    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { lose(); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const stopLoops = () => { clearInterval(loop.current); clearInterval(timer.current); };

  const win = () => {
    stopLoops();
    tapSuccess(); sfxSuccess();
    const secsUsed = Math.round((Date.now() - startedAt.current) / 1000);
    const timeLeft = Math.max(0, ROUND_SEC - secsUsed);
    const score = 500 + timeLeft * 10; // finishing fast scores higher
    setPhase('won');
    if (user) submitScore(user.id, 'sekoseko', score);
  };

  const lose = () => {
    stopLoops();
    tapLight(); sfxPop();
    const score = kidsRef.current.filter((k) => k.found).length * 50;
    setPhase('lost');
    if (user && score > 0) submitScore(user.id, 'sekoseko', score);
  };

  // camera — the world scrolls so the player stays centred
  const camX = track.w ? track.w / 2 - pos.x : 0;
  const camY = track.h ? track.h / 2 - pos.y : 0;

  const setDir = (dx, dy) => { dirRef.current = { dx, dy }; };
  const dpad = (dx, dy) => ({
    onPressIn: () => { tapLight(); setDir(dx, dy); },
    onPressOut: () => setDir(0, 0),
  });

  const hintLabel = hint == null ? '' : hint < 130 ? 'سخن جدًا 🔥' : hint < 260 ? 'سخن 🌡️' : hint < 420 ? 'دافي' : 'بارد ❄️';

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#160E2E' }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FF2E88', fontSize: 15, fontWeight: '900', letterSpacing: 2 }}>سيكو سيكو</Text>
            <Text style={{ color: '#20E3D2', fontSize: 11, marginTop: 2, fontWeight: '700' }}>🇪🇬 حارة مصرية · استغماية</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' }}>لقيت</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{foundCount}/{HIDE_SPOTS.length}</Text>
          </View>
        </View>

        {/* the world viewport */}
        <View
          style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1E1436', borderWidth: 1, borderColor: 'rgba(255,46,136,0.35)' }}
          onLayout={(e) => setTrack({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {/* the scrolling neighbourhood */}
          <View style={{ position: 'absolute', width: WORLD_W, height: WORLD_H, transform: [{ translateX: camX }, { translateY: camY }] }}>
            {/* warm dusk ground */}
            <LinearGradient colors={['#241844', '#2E1A3E', '#3A1E36']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width: WORLD_W, height: WORLD_H }} />

            {/* roads — teal-lined asphalt corridors */}
            <View style={{ position: 'absolute', left: 0, top: WORLD_H / 2 - 46, width: WORLD_W, height: 92, backgroundColor: '#191026' }} />
            <View style={{ position: 'absolute', left: WORLD_W / 2 - 46, top: 0, width: 92, height: WORLD_H, backgroundColor: '#191026' }} />
            <View style={{ position: 'absolute', left: 0, top: WORLD_H / 2 - 2, width: WORLD_W, height: 4, backgroundColor: 'rgba(32,227,210,0.4)' }} />
            <View style={{ position: 'absolute', left: WORLD_W / 2 - 2, top: 0, width: 4, height: WORLD_H, backgroundColor: 'rgba(32,227,210,0.4)' }} />

            {/* buildings */}
            {BUILDINGS.map((b, i) => (
              <View key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, backgroundColor: b.c, borderRadius: 10, borderWidth: 2, borderColor: b.edge, alignItems: 'center', justifyContent: 'center', shadowColor: b.edge, shadowOpacity: 0.5, shadowRadius: 12 }}>
                <Text style={{ fontSize: 40, opacity: 0.85 }}>{b.emoji}</Text>
              </View>
            ))}

            {/* palms */}
            {PALMS.map((p, i) => (
              <Text key={i} style={{ position: 'absolute', left: p.x, top: p.y, fontSize: 34 }}>🌴</Text>
            ))}

            {/* the hidden kids — greyed until found */}
            {kids.map((k) => (
              <Animated.Text
                key={k.id}
                style={{
                  position: 'absolute', left: k.x - 15, top: k.y - 18, fontSize: 30,
                  opacity: k.found ? 1 : 0.14,
                  transform: k.found ? [{ scale: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.5, 1] }) }] : [],
                }}
              >
                {k.emoji}
              </Animated.Text>
            ))}

            {/* the player — your avatar, centred by the camera */}
            {phase !== 'ready' ? (
              <View style={{ position: 'absolute', left: pos.x - 22, top: pos.y - 22, alignItems: 'center' }}>
                {meAvatar ? (
                  <Image source={{ uri: meAvatar }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#FF2E88' }} />
                ) : (
                  <Text style={{ fontSize: 38 }}>🧍</Text>
                )}
              </View>
            ) : null}
          </View>

          {/* hot/cold hint while playing */}
          {phase === 'playing' && hintLabel ? (
            <View style={{ position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{hintLabel}</Text>
            </View>
          ) : null}

          {/* timer */}
          {phase === 'playing' ? (
            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: left <= 10 ? C.coral : '#FFF', fontSize: 13, fontWeight: '900' }}>⏱ {left}s</Text>
            </View>
          ) : null}

          {/* READY */}
          {phase === 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,14,46,0.82)', padding: 24 }}>
              <Text style={{ fontSize: 44 }}>🫣</Text>
              <Text style={{ color: '#FF2E88', fontSize: 20, fontWeight: '900', marginTop: 6, letterSpacing: 1 }}>استغماية في الحارة</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 300 }}>
                عيال الحتة اتخبّوا في الحارة كلها 🏘️{'\n'}لُفّ بشخصيتك ولاقيهم كلهم قبل ما الوقت يخلص.{'\n'}كل ما تقرّب من حد، الشاشة هتقولك «سخن» ولا «بارد».
              </Text>
              <Text style={{ color: '#20E3D2', fontSize: 11.5, marginTop: 10, fontWeight: '800' }}>
                {Platform.OS === 'web' ? 'حرّك بالأسهم أو WASD · أو دوس الأزرار تحت' : 'استخدم الأزرار تحت للحركة'}
              </Text>

              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('sekoseko').then(setBoard).catch(() => setBoard([])); }} style={{ marginTop: 16 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>🏆 الترتيب العالمي</Text>
                </View>
              </Pressable>

              <Pressable onPress={start} style={{ marginTop: 18 }}>
                <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 44, paddingVertical: 15 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>يلا نلعب ▶</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* WON / LOST */}
          {phase === 'won' || phase === 'lost' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,14,46,0.9)', padding: 26 }}>
              <Text style={{ fontSize: 50 }}>{phase === 'won' ? '🏆' : '⏱️'}</Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>
                {phase === 'won' ? 'لقيتهم كلهم! 🎉' : 'الوقت خلص!'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>
                لقيت {foundCount} من {HIDE_SPOTS.length}
              </Text>
              <Pressable onPress={start} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 38, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>تاني</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); onClose(); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>خروج</Text>
              </Pressable>
            </View>
          ) : null}

          {/* GLOBAL LEADERBOARD */}
          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(22,14,46,0.94)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 16, maxHeight: '80%' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>🏆 الترتيب العالمي</Text>
                {board === 'loading' ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>…</Text>
                ) : board.length === 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>مفيش نتايج لسه — كن أول واحد!</Text>
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
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' }}>إغلاق</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </View>

        {/* on-screen D-pad */}
        {phase === 'playing' ? (
          <View style={{ paddingVertical: 14, paddingBottom: 26, alignItems: 'center' }}>
            <Pressable {...dpad(0, -1)}>
              <View style={dpadBtn}><Ionicons name="chevron-up" size={26} color="#FFF" /></View>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable {...dpad(-1, 0)}>
                <View style={dpadBtn}><Ionicons name="chevron-back" size={26} color="#FFF" /></View>
              </Pressable>
              <View style={{ width: 58 }} />
              <Pressable {...dpad(1, 0)}>
                <View style={dpadBtn}><Ionicons name="chevron-forward" size={26} color="#FFF" /></View>
              </Pressable>
            </View>
            <Pressable {...dpad(0, 1)}>
              <View style={dpadBtn}><Ionicons name="chevron-down" size={26} color="#FFF" /></View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const dpadBtn = {
  width: 58, height: 52, margin: 3, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(255,46,136,0.18)', borderWidth: 1, borderColor: 'rgba(255,46,136,0.5)',
};
