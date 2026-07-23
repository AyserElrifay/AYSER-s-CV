import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { submitScore, fetchLeaderboard } from '../services/games';
import { buildCity, drawWorld, drawPerson, HIDE_SPOTS, WORLD_W, WORLD_H } from './sekoArt';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';

/* ─── سيكو سيكو · SEKO SEKO — Egyptian street games, real GTA-Vice-City look ───
   A walkable top-down neighbourhood drawn on a canvas (Vice City sunset:
   neon buildings, lit windows, palms, cars, street-lamp glow). Level 1 is
   a Cairo hara; the first street game is الاستغماية (hide & seek) — roam
   and find every hidden kid before the timer. The world/engine is reusable
   for more games and countries. Real global leaderboard. Web-first (the
   canvas runs in every browser, incl. mobile Safari). */

const PLAYER_SPEED = 4.6;
const FIND_RADIUS = 54;
const ROUND_SEC = 60;
const KID_SHIRTS = ['#ff5e8a', '#3bd1c0', '#f2b134', '#7c5cff', '#ff9e2c'];

export const SekoSeko = ({ onClose }) => {
  const { user } = useAuth();
  const meAvatar = user ? buildAvatarUrl(user.id, user.avatar_dna) : null;
  const [phase, setPhase] = useState('ready'); // ready | playing | won | lost
  const [foundCount, setFoundCount] = useState(0);
  const [left, setLeft] = useState(ROUND_SEC);
  const [board, setBoard] = useState(null);
  const [hint, setHint] = useState('');

  const cityRef = useRef(null);
  if (!cityRef.current) cityRef.current = buildCity();
  const posRef = useRef({ x: 750, y: WORLD_H - 120 });
  const dirRef = useRef({ dx: 0, dy: 0 });
  const kidsRef = useRef([]);
  const loop = useRef(null);
  const timer = useRef(null);
  const startedAt = useRef(0);
  const phaseRef = useRef('ready');
  const hostRef = useRef(null);

  useEffect(() => () => { clearInterval(loop.current); clearInterval(timer.current); }, []);

  // ── the canvas: draws the Vice-City world every frame (web) ──
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    // hostRef.current is the underlying <div> on react-native-web
    const host = hostRef.current;
    if (!host || !host.appendChild) return undefined;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let raf, alive = true;
    const render = () => {
      if (!alive) return;
      const rect = host.getBoundingClientRect();
      const VW = Math.max(1, rect.width), VH = Math.max(1, rect.height);
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      if (canvas.width !== Math.round(VW * dpr)) { canvas.width = Math.round(VW * dpr); canvas.height = Math.round(VH * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const p = posRef.current;
      const cam = {
        x: Math.max(0, Math.min(Math.max(0, WORLD_W - VW), p.x - VW / 2)),
        y: Math.max(0, Math.min(Math.max(0, WORLD_H - VH), p.y - VH / 2)),
      };
      drawWorld(ctx, VW, VH, cam, cityRef.current);
      const kids = kidsRef.current;
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        drawPerson(ctx, k.x - cam.x, k.y - cam.y, KID_SHIRTS[i % KID_SHIRTS.length], '#e8b98a', !k.found);
      }
      // the player, centred (gold ring)
      const sx = p.x - cam.x, sy = p.y - cam.y;
      ctx.strokeStyle = '#f5b301'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 17, 0, 7); ctx.stroke();
      drawPerson(ctx, sx, sy, '#ffffff');
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => { alive = false; if (raf) cancelAnimationFrame(raf); try { host.removeChild(canvas); } catch (e) {} };
  }, []);

  // web keyboard controls (arrows / WASD)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const set = (e, on) => {
      const k = e.key.toLowerCase(); const d = dirRef.current;
      if (k === 'arrowleft' || k === 'a') d.dx = on ? -1 : (d.dx < 0 ? 0 : d.dx);
      else if (k === 'arrowright' || k === 'd') d.dx = on ? 1 : (d.dx > 0 ? 0 : d.dx);
      else if (k === 'arrowup' || k === 'w') d.dy = on ? -1 : (d.dy < 0 ? 0 : d.dy);
      else if (k === 'arrowdown' || k === 's') d.dy = on ? 1 : (d.dy > 0 ? 0 : d.dy);
      else return;
      e.preventDefault();
    };
    const kd = (e) => set(e, true); const ku = (e) => set(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const setP = (ph) => { phaseRef.current = ph; setPhase(ph); };

  const start = () => {
    tapMedium(); sfxPop();
    kidsRef.current = HIDE_SPOTS.map((s, i) => ({ id: 'k' + i, x: s.x, y: s.y, found: false }));
    setFoundCount(0);
    posRef.current = { x: 750, y: WORLD_H - 120 };
    dirRef.current = { dx: 0, dy: 0 };
    setLeft(ROUND_SEC); setHint('');
    startedAt.current = Date.now();
    setP('playing');

    let lastHint = '';
    loop.current = setInterval(() => {
      const d = dirRef.current;
      if (d.dx || d.dy) {
        const p = posRef.current;
        const nx = Math.max(30, Math.min(WORLD_W - 30, p.x + d.dx * PLAYER_SPEED));
        const ny = Math.max(30, Math.min(WORLD_H - 30, p.y + d.dy * PLAYER_SPEED));
        posRef.current = { x: nx, y: ny };
        let nearest = Infinity, foundNow = 0;
        for (const k of kidsRef.current) {
          if (k.found) continue;
          const dist = Math.hypot(k.x - nx, k.y - ny);
          if (dist < nearest) nearest = dist;
          if (dist < FIND_RADIUS) { k.found = true; foundNow++; }
        }
        if (foundNow) {
          const total = kidsRef.current.filter((k) => k.found).length;
          setFoundCount(total); tapSuccess(); sfxStar();
          if (total >= HIDE_SPOTS.length) return win();
        }
        const lbl = nearest === Infinity ? '' : nearest < 150 ? 'سخن جدًا 🔥' : nearest < 320 ? 'سخن 🌡️' : nearest < 520 ? 'دافي' : 'بارد ❄️';
        if (lbl !== lastHint) { lastHint = lbl; setHint(lbl); }
      }
    }, 30);

    timer.current = setInterval(() => {
      setLeft((s) => { if (s <= 1) { lose(); return 0; } return s - 1; });
    }, 1000);
  };

  const stopLoops = () => { clearInterval(loop.current); clearInterval(timer.current); };
  const win = () => {
    stopLoops(); tapSuccess(); sfxSuccess();
    const timeLeft = Math.max(0, ROUND_SEC - Math.round((Date.now() - startedAt.current) / 1000));
    if (user) submitScore(user.id, 'sekoseko', 500 + timeLeft * 10);
    setP('won');
  };
  const lose = () => {
    stopLoops(); tapLight(); sfxPop();
    const score = kidsRef.current.filter((k) => k.found).length * 50;
    if (user && score > 0) submitScore(user.id, 'sekoseko', score);
    setP('lost');
  };

  const setDir = (dx, dy) => { dirRef.current = { dx, dy }; };
  const dpad = (dx, dy) => ({ onPressIn: () => { tapLight(); setDir(dx, dy); }, onPressOut: () => setDir(0, 0) });

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

        {/* the world viewport — canvas fills this, overlays sit on top */}
        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1E1436', borderWidth: 1, borderColor: 'rgba(255,46,136,0.35)' }}>
          <View ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          {Platform.OS !== 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>سيكو سيكو بيشتغل في المتصفح 🌆</Text>
            </View>
          ) : null}

          {/* hot/cold hint */}
          {phase === 'playing' && hint ? (
            <View style={{ position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{hint}</Text>
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
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,14,46,0.72)', padding: 24 }}>
              <Text style={{ fontSize: 44 }}>🫣</Text>
              <Text style={{ color: '#FF2E88', fontSize: 20, fontWeight: '900', marginTop: 6, letterSpacing: 1 }}>استغماية في الحارة</Text>
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 300 }}>
                عيال الحتة اتخبّوا في الحارة كلها 🌆{'\n'}لُفّ بشخصيتك ولاقيهم كلهم قبل ما الوقت يخلص.{'\n'}كل ما تقرّب من حد، الشاشة تقولك «سخن» ولا «بارد».
              </Text>
              <Text style={{ color: '#20E3D2', fontSize: 11.5, marginTop: 10, fontWeight: '800' }}>
                {Platform.OS === 'web' ? 'حرّك بالأسهم أو WASD · أو دوس الأزرار تحت' : 'استخدم الأزرار تحت'}
              </Text>
              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('sekoseko').then(setBoard).catch(() => setBoard([])); }} style={{ marginTop: 16 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
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
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,14,46,0.86)', padding: 26 }}>
              <Text style={{ fontSize: 50 }}>{phase === 'won' ? '🏆' : '⏱️'}</Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>
                {phase === 'won' ? 'لقيتهم كلهم! 🎉' : 'الوقت خلص!'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>لقيت {foundCount} من {HIDE_SPOTS.length}</Text>
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

          {/* LEADERBOARD */}
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

        {/* D-pad */}
        {phase === 'playing' ? (
          <View style={{ paddingVertical: 14, paddingBottom: 26, alignItems: 'center' }}>
            <Pressable {...dpad(0, -1)}><View style={dpadBtn}><Ionicons name="chevron-up" size={26} color="#FFF" /></View></Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable {...dpad(-1, 0)}><View style={dpadBtn}><Ionicons name="chevron-back" size={26} color="#FFF" /></View></Pressable>
              <View style={{ width: 58 }} />
              <Pressable {...dpad(1, 0)}><View style={dpadBtn}><Ionicons name="chevron-forward" size={26} color="#FFF" /></View></Pressable>
            </View>
            <Pressable {...dpad(0, 1)}><View style={dpadBtn}><Ionicons name="chevron-down" size={26} color="#FFF" /></View></Pressable>
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
