import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { tapLight, tapMedium } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';
import { useAuth } from '../context/AuthContext';
import { submitScore } from '../services/games';

/* ─── STACK — our own take on the timing-stacker ──────────────────────
   A block slides back and forth; tap to drop it on the tower. Only the
   part that overlaps the block below survives — the overhang is sliced
   off, so the tower narrows every time you're sloppy. Nail it dead-centre
   for a PERFECT: the block keeps its full width and you bank a bonus.
   Miss the tower completely and it's over. Original art + brand colours,
   real localStorage high score — no clone assets, all ours. */

const BLOCK_H = 34;
const LAND_Y = 130;          // the moving block always slides at this y
const BASE_W = 190;
const PERFECT = 7;           // px tolerance for a perfect drop
const BEST_KEY = 'mm_stack_best';

const hueFor = (n) => 'hsl(' + ((262 + n * 24) % 360) + ', 62%, 60%)';

export const StackGame = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [phase, setPhase] = useState('ready'); // ready | playing | over
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [blocks, setBlocks] = useState([]); // placed, index 0 = bottom
  const [curX, setCurX] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState(false);
  const [best, setBest] = useState(() => {
    try { return Platform.OS === 'web' ? +(window.localStorage.getItem(BEST_KEY) || 0) : 0; } catch (e) { return 0; }
  });

  const curRef = useRef({ x: 0, w: BASE_W, dir: 1 });
  const blocksRef = useRef([]);
  const speedRef = useRef(2.6);
  const loop = useRef(null);

  useEffect(() => () => clearInterval(loop.current), []);

  const centerX = () => Math.max(0, (area.w - BASE_W) / 2);

  const begin = () => {
    tapMedium(); sfxPop();
    const base = { x: centerX(), w: BASE_W, hue: hueFor(0) };
    blocksRef.current = [base];
    setBlocks([base]);
    curRef.current = { x: 0, w: BASE_W, dir: 1 };
    setCurX(0);
    setScore(0); setCombo(0);
    speedRef.current = 2.6;
    setPhase('playing');
    clearInterval(loop.current);
    loop.current = setInterval(tick, 16);
  };

  const tick = () => {
    const c = curRef.current;
    const maxX = Math.max(0, area.w - c.w);
    let nx = c.x + speedRef.current * c.dir;
    if (nx <= 0) { nx = 0; c.dir = 1; }
    else if (nx >= maxX) { nx = maxX; c.dir = -1; }
    c.x = nx;
    setCurX(nx);
  };

  const endGame = () => {
    clearInterval(loop.current);
    setPhase('over');
    if (user && score > 0) submitScore(user.id, 'stack', score); // real global leaderboard
    setBest((b) => {
      const nb = Math.max(b, score);
      try { if (Platform.OS === 'web') window.localStorage.setItem(BEST_KEY, String(nb)); } catch (e) {}
      return nb;
    });
  };

  const drop = () => {
    if (phase !== 'playing') return;
    const c = curRef.current;
    const top = blocksRef.current[blocksRef.current.length - 1];
    const left = Math.max(c.x, top.x);
    const right = Math.min(c.x + c.w, top.x + top.w);
    const overlap = right - left;
    if (overlap <= 0) { tapMedium(); endGame(); return; }

    const perfect = Math.abs(c.x - top.x) <= PERFECT;
    // perfect drop keeps full width (and nudges back toward centre); else slice
    const placed = perfect
      ? { x: top.x, w: top.w, hue: hueFor(blocksRef.current.length) }
      : { x: left, w: overlap, hue: hueFor(blocksRef.current.length) };
    blocksRef.current = [...blocksRef.current, placed];
    setBlocks(blocksRef.current);

    const ns = score + 1 + (perfect ? 1 : 0);
    setScore(ns);
    if (perfect) { setCombo((k) => k + 1); sfxSuccess(); setFlash(true); setTimeout(() => setFlash(false), 160); }
    else { setCombo(0); tapLight(); sfxPop(); }

    // next block: same width as what we just placed, entering from a side
    speedRef.current = Math.min(7.5, 2.6 + ns * 0.16);
    curRef.current = { x: 0, w: placed.w, dir: 1 };
    setCurX(0);
  };

  const topIndex = blocks.length - 1;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0B1020' }}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="close" size={28} color="#FFF" /></Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>STACK</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* play area */}
        <Pressable style={{ flex: 1 }} onPress={phase === 'playing' ? drop : undefined}>
          <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {flash ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(245,179,1,0.12)' }} /> : null}

            {/* live score */}
            {phase === 'playing' ? (
              <Text style={{ position: 'absolute', top: 24, alignSelf: 'center', color: '#FFF', fontSize: 54, fontWeight: '900', width: '100%', textAlign: 'center' }}>{score}</Text>
            ) : null}
            {phase === 'playing' && combo >= 2 ? (
              <Text style={{ position: 'absolute', top: 90, alignSelf: 'center', color: C.gold, fontSize: 14, fontWeight: '900', width: '100%', textAlign: 'center' }}>PERFECT ×{combo} 🔥</Text>
            ) : null}

            {/* placed tower — top block sits just under the landing row */}
            {area.w > 0 && phase !== 'ready' ? blocks.map((b, i) => {
              const y = LAND_Y + BLOCK_H + (topIndex - i) * BLOCK_H;
              if (y > area.h) return null; // scrolled off the bottom
              return (
                <View key={i} style={{ position: 'absolute', top: y, left: b.x, width: b.w, height: BLOCK_H - 2, borderRadius: 7, backgroundColor: b.hue, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }} />
              );
            }) : null}

            {/* moving block */}
            {area.w > 0 && phase === 'playing' ? (
              <View style={{ position: 'absolute', top: LAND_Y, left: curX, width: curRef.current.w, height: BLOCK_H - 2, borderRadius: 7, backgroundColor: hueFor(blocks.length), borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }} />
            ) : null}

            {/* READY */}
            {phase === 'ready' ? (
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Text style={{ fontSize: 46, marginBottom: 6 }}>🧱</Text>
                <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900' }}>Stack</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>Tap to drop each block. Line it up dead-centre for a PERFECT and keep your width. Miss and the tower crumbles.</Text>
                {best > 0 ? <Text style={{ color: C.gold, fontSize: 13, fontWeight: '800', marginTop: 12 }}>Best: {best}</Text> : null}
                <Pressable onPress={begin} style={{ marginTop: 22 }}>
                  <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 44, paddingVertical: 15 }}>
                    <Text style={{ color: '#241146', fontSize: 16, fontWeight: '900' }}>Play ▶</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {/* GAME OVER */}
            {phase === 'over' ? (
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,10,26,0.7)', padding: 26 }}>
                <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900' }}>Tower down!</Text>
                <Text style={{ color: '#FFF', fontSize: 60, fontWeight: '900', marginVertical: 6 }}>{score}</Text>
                <Text style={{ color: C.gold, fontSize: 14, fontWeight: '800', marginBottom: 20 }}>Best {best}{score >= best && score > 0 ? ' · new record! 🎉' : ''}</Text>
                <Pressable onPress={begin}>
                  <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 40, paddingVertical: 14 }}>
                    <Text style={{ color: '#241146', fontSize: 16, fontWeight: '900' }}>Again ↻</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => { tapLight(); onClose(); }} style={{ marginTop: 14 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' }}>Close</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};
