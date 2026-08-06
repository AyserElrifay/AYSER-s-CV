import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { submitScore, fetchLeaderboard } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { parseDna } from '../services/avatarArt';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';
import { gamesAr } from './worldCulture';
import { drawRunner } from './rushArt';
import {
  STAGES, makeStage, drawHopScene, goalText, vehiclesOn, trainAt,
  VW_WORLD, COLS, COL, ROW_H, colX, rowY,
} from './hopArt';

/* ─── THE CROSSING · Six Cities ───────────────────────────────────────
   Get to the other side. Traffic, water, and a railway between you and
   a monument that has been standing there for a thousand years.

   HOW IT PLAYS: tap to hop forward, swipe to go sideways or back. On the
   water you have to be ON something — miss the boat and you are in the
   river. And the street closes behind you, so standing still is its own
   way of losing.

   Same six places as The Climb, same culture card at the end of each,
   and the same fixed virtual width so every screen plays the identical
   crossing.                                                            */

const BEST_KEY = 'mm_hop_best';
const PROGRESS_KEY = 'mm_hop_progress';
const CARDS_KEY = 'mm_hop_cards';

const HOP_MS = 135;            // how long one hop takes
const FOOT = ROW_H - 9;        // where the feet sit inside a row
const BEHIND_START = 2.6;      // rows below the start the closing line begins
const BEHIND_SPEED = 7;        // px/s, and it speeds up
const HIT_HALF = 11;           // how wide you are, for the traffic

const loadInt = (k) => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } };
const saveInt = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
const loadCards = () => { try { return JSON.parse(localStorage.getItem(CARDS_KEY) || '[]') || []; } catch (e) { return []; } };
const saveCard = (id) => {
  try {
    const has = loadCards();
    if (has.indexOf(id) < 0) localStorage.setItem(CARDS_KEY, JSON.stringify(has.concat([id])));
  } catch (e) {}
};

export const StreetHop = ({ onClose }) => {
  const { user } = useAuth();
  const ar = gamesAr();
  const myDna = React.useMemo(() => parseDna(user && user.avatar_dna), [user && user.avatar_dna]);

  const [stageIdx, setStageIdx] = useState(() => Math.min(STAGES.length - 1, loadInt(PROGRESS_KEY)));
  const [unlocked, setUnlocked] = useState(() => Math.min(STAGES.length - 1, loadInt(PROGRESS_KEY)));
  const [phase, setPhase] = useState('story');   // story | playing | card | lost | picker
  const [rowsDone, setRowsDone] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [secs, setSecs] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => loadInt(BEST_KEY));
  const [board, setBoard] = useState(null);
  const [endLine, setEndLine] = useState('');
  const [cards, setCards] = useState(loadCards);

  const hostRef = useRef(null);
  const world = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef('story');
  const stepRef = useRef(null);
  const dnaRef = useRef(null);

  const rowsRef = useRef(0);
  const tokensRef = useRef(0);
  const scoreRef = useRef(0);
  const secsRef = useRef(0);

  const stage = STAGES[stageIdx];
  const setP = (p) => { phaseRef.current = p; setPhase(p); };

  const buildWorld = useCallback(() => {
    const level = makeStage(4242 + stageIdx * 97, stageIdx);
    level.tokens.forEach((t) => { t.got = false; });
    const startCol = Math.floor(COLS / 2);
    world.current = {
      level,
      row: 0, col: startCol,
      x: colX(startCol), y: rowY(0) + FOOT,
      hop: null,               // { fromX, fromY, toX, toY, at, row, col }
      ride: null,              // { row, offset } while you are on a boat
      face: 1,
      top: 0, tokens: 0, score: 0,
      behindY: rowY(0) + ROW_H * BEHIND_START,
      behindSpeed: BEHIND_SPEED,
      moved: false,            // the street only starts closing once you go
      particles: [], startedAt: 0, camY: null,
    };
  }, [stageIdx]);

  useEffect(() => { buildWorld(); }, [buildWorld]);

  /* ── the canvas ── */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const host = hostRef.current;
    if (!host || !host.appendChild) return undefined;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let alive = true;
    let last = performance.now();

    const frame = (now) => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;

      const rect = host.getBoundingClientRect();
      const cssW = Math.max(1, rect.width), cssH = Math.max(1, rect.height);
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      const s = cssW / VW_WORLD;
      const VH = cssH / s;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);

      const w = world.current;
      if (!w) return;
      if (phaseRef.current === 'playing' && stepRef.current) stepRef.current(w, dt, now, VH);

      // the camera follows you up the street and never slides back down
      const want = w.y - VH * 0.72;
      if (w.camY == null || want < w.camY) w.camY = want;

      drawHopScene(ctx, VW_WORLD, VH, w.camY, w.level, now, {
        particles: w.particles,
        behindY: w.moved ? w.behindY : null,
      });

      // you — with a real arc on the hop, so a hop looks like a hop
      let arc = 0;
      if (w.hop) {
        const k = Math.min(1, (now - w.hop.at) / HOP_MS);
        arc = Math.sin(k * Math.PI) * 15;
      }
      drawRunner(ctx, w.x, w.y - w.camY - arc, {
        phase: now * 0.01,
        airborne: !!w.hop,
        flip: w.face < 0,
        dna: dnaRef.current,
      });
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { host.removeChild(canvas); } catch (e) {}
    };
  }, []);

  /* ── one hop ────────────────────────────────────────────────────
     Grid movement, but the landing is decided when you ARRIVE, not when
     you set off — otherwise a boat that moved under you during the hop
     would drown you for its own movement. */
  const move = useCallback((dx, dy) => {
    const w = world.current;
    if (!w || phaseRef.current !== 'playing' || w.hop) return;
    const row = w.row + dy;
    if (row < 0 || row > w.level.top) return;
    const col = Math.max(0, Math.min(COLS - 1, w.col + dx));
    if (dx === 0 && dy === 0) return;
    if (dx !== 0) w.face = dx > 0 ? 1 : -1;
    /* Stepping OFF a boat keeps where you were standing rather than
       snapping you back to a column — a boat drifts, and being teleported
       sideways because the grid says so is the kind of thing that makes
       a death feel like the game's fault. The landing snaps to a column
       only when the landing is on solid ground. */
    w.hop = {
      fromX: w.x, fromY: w.y,
      toX: w.ride ? w.x + dx * COL : colX(col),
      toY: rowY(row) + FOOT,
      at: performance.now(), row, col,
    };
    w.moved = true;
    tapLight(); sfxPop();
  }, []);

  /* ── input: tap to go forward, swipe for everything else ── */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const host = hostRef.current;
    if (!host || !host.addEventListener) return undefined;
    if (host.style) host.style.touchAction = 'none';

    let sx = 0, sy = 0, down = false;
    const start = (e) => {
      const p = e.touches && e.touches.length ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY; down = true;
      if (e.cancelable) e.preventDefault();
    };
    const end = (e) => {
      if (!down) return;
      down = false;
      const p = (e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e);
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) { move(0, 1); return; }   // a tap goes forward
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
      else move(0, dy < 0 ? 1 : -1);
    };
    host.addEventListener('pointerdown', start);
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', () => { down = false; });
    return () => {
      host.removeEventListener('pointerdown', start);
      host.removeEventListener('pointerup', end);
    };
  }, [move]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const kd = (e) => {
      if (phaseRef.current !== 'playing') return;
      const k = (e.key || '').toLowerCase();
      if (k === 'arrowup' || k === 'w' || k === ' ') { move(0, 1); e.preventDefault(); }
      else if (k === 'arrowdown' || k === 's') { move(0, -1); e.preventDefault(); }
      else if (k === 'arrowleft' || k === 'a') { move(-1, 0); e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { move(1, 0); e.preventDefault(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [move]);

  const burst = (w, x, y, col, n) => {
    for (let i = 0; i < n; i++) {
      w.particles.push({
        x, y, r: 1.4 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 120,
        life: 1, col,
      });
    }
  };

  /* ── one step of the crossing ── */
  const step = (w, dt, now, VH) => {
    const lv = w.level;

    // the hop itself
    if (w.hop) {
      const k = Math.min(1, (now - w.hop.at) / HOP_MS);
      w.x = w.hop.fromX + (w.hop.toX - w.hop.fromX) * k;
      w.y = w.hop.fromY + (w.hop.toY - w.hop.fromY) * k;
      if (k >= 1) {
        w.row = w.hop.row;
        w.col = Math.max(0, Math.min(COLS - 1, Math.round((w.hop.toX - COL / 2) / COL)));
        w.y = w.hop.toY;
        w.hop = null;
        w.ride = null;

        const row = lv.rows[w.row];
        // solid ground puts you back on the grid; water leaves you where
        // you actually landed, because that is what you have to stand on
        w.x = row && row.kind === 'water' ? w.x : colX(w.col);
        if (row && row.kind === 'water') {
          /* Landing on water: you need something under you. Whatever is
             under you now is what you ride, and you keep your place on
             it — stepping onto the front of a boat should not slide you
             to the middle of it. */
          const on = vehiclesOn(row, now).find((v) => w.x > v.x - 4 && w.x < v.x + v.w + 4);
          if (!on) return lose(w, now, ar ? 'وقعت في المية! 🌊' : 'Straight into the water! 🌊');
          w.ride = { row: w.row, offset: w.x - on.x };
        }
        if (w.row > w.top) {
          w.score += (w.row - w.top) * 10;
          w.top = w.row;
        }
        // a token on the square you landed on
        for (const it of lv.tokens) {
          if (it.got || it.row !== w.row) continue;
          if (Math.abs(colX(it.col) - w.x) < COL * 0.6) {
            it.got = true; w.tokens += 1; w.score += 30;
            sfxStar(); tapLight();
            burst(w, colX(it.col), rowY(it.row) + ROW_H / 2, '#FFD23F', 9);
          }
        }
      }
    }

    // riding: the boat carries you, and it can carry you off the edge
    if (w.ride && !w.hop) {
      const row = lv.rows[w.ride.row];
      const on = vehiclesOn(row, now).find((v) => Math.abs(v.x + w.ride.offset - w.x) < 26);
      if (on) w.x = on.x + w.ride.offset;
      else {
        const still = vehiclesOn(row, now).find((v) => w.x > v.x - 4 && w.x < v.x + v.w + 4);
        if (still) w.ride = { row: w.ride.row, offset: w.x - still.x };
        else return lose(w, now, ar ? 'وقعت في المية! 🌊' : 'Straight into the water! 🌊');
      }
      if (w.x < -8 || w.x > VW_WORLD + 8) {
        return lose(w, now, ar ? 'المركب ودّاك بعيد! 🚣' : 'The boat carried you away! 🚣');
      }
    }

    /* Traffic. Checked on the row you are standing on AND the row you
       are hopping into, because being clipped halfway across a lane is
       exactly what being hit by a car is. */
    const check = [w.row];
    // the row you are hopping INTO only starts counting halfway through
    // the hop, so a car cannot hit you before you have left the kerb
    if (w.hop && w.hop.row !== w.row && now - w.hop.at > HOP_MS * 0.5) check.push(w.hop.row);
    for (const ri of check) {
      const row = lv.rows[ri];
      if (!row) continue;
      if (row.kind === 'road') {
        for (const v of vehiclesOn(row, now)) {
          if (w.x + HIT_HALF > v.x && w.x - HIT_HALF < v.x + v.w) {
            burst(w, w.x, w.y, '#FF3B30', 12);
            return lose(w, now, ar ? 'اتخبطت! 💥' : 'You got hit! 💥');
          }
        }
      } else if (row.kind === 'rail') {
        const tr = trainAt(row, now);
        if (tr.x != null && w.x + HIT_HALF > tr.x && w.x - HIT_HALF < tr.x + tr.w) {
          burst(w, w.x, w.y, '#FF3B30', 14);
          return lose(w, now, ar ? 'القطر! 🚆' : 'The train! 🚆');
        }
      }
    }

    // the street closes behind you
    if (w.moved) {
      w.behindSpeed += 0.55 * dt;
      w.behindY -= w.behindSpeed * dt;
      w.behindY = Math.min(w.behindY, w.y + VH * 0.55);
      if (w.y > w.behindY) {
        return lose(w, now, ar ? 'الشارع قفل وراك!' : 'The street closed behind you!');
      }
    }

    for (let i = w.particles.length - 1; i >= 0; i--) {
      const p = w.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 380 * dt;
      p.life -= dt * 1.7;
      if (p.life <= 0) w.particles.splice(i, 1);
    }

    if (w.top !== rowsRef.current) { rowsRef.current = w.top; setRowsDone(w.top); }
    if (w.tokens !== tokensRef.current) { tokensRef.current = w.tokens; setTokens(w.tokens); }
    if (w.score !== scoreRef.current) { scoreRef.current = w.score; setScore(w.score); }
    const el = Math.floor((now - w.startedAt) / 1000);
    if (el !== secsRef.current) { secsRef.current = el; setSecs(el); }

    // the far side
    if (w.row >= lv.top) {
      const g = stage.goal;
      if (g.kind === 'tokens' && w.tokens < g.value) {
        // you arrived without what you came for — walk back and find it
        if (!w.nagged) {
          w.nagged = true;
          setEndLine(ar ? 'ناقصك ' + (g.value - w.tokens) + ' — ارجع هاتهم' : 'Still ' + (g.value - w.tokens) + ' to find — go back for them');
          // never wipe a real message: only clear it if the run is still on
          setTimeout(() => { if (phaseRef.current === 'playing') setEndLine(''); }, 2600);
        }
        return;
      }
      if (g.kind === 'time' && el > g.value) {
        return lose(w, now, ar ? 'الوقت خلص!' : 'Out of time!');
      }
      const bonus = g.kind === 'time' ? Math.max(0, g.value - el) * 12 : 0;
      win(w.score + bonus);
    } else {
      w.nagged = false;                    // say it again if you come back short
      if (stage.goal.kind === 'time' && el > stage.goal.value) {
        return lose(w, now, ar ? 'الوقت خلص!' : 'Out of time!');
      }
    }
  };

  stepRef.current = step;
  dnaRef.current = myDna;

  const keepBest = (total) => {
    setBest((b) => { if (total > b) { saveInt(BEST_KEY, total); return total; } return b; });
  };

  const lose = (w, now, line) => {
    if (phaseRef.current !== 'playing') return;
    setEndLine(line);
    setP('lost');
    tapLight(); sfxPop();
    const total = scoreRef.current;
    if (user && total > 0) submitScore(user.id, 'hop', total).catch(() => {});
    keepBest(total);
  };

  const win = (total) => {
    if (phaseRef.current !== 'playing') return;
    setScore(total);
    scoreRef.current = total;
    setP('card');
    setEndLine('');
    tapSuccess(); sfxSuccess();
    if (user && total > 0) submitScore(user.id, 'hop', total).catch(() => {});
    keepBest(total);
    saveCard(stage.place.id);
    setCards(loadCards());
    if (stageIdx >= unlocked && stageIdx + 1 < STAGES.length) {
      setUnlocked(stageIdx + 1);
      saveInt(PROGRESS_KEY, stageIdx + 1);
    }
  };

  const startRun = () => {
    buildWorld();
    rowsRef.current = 0; tokensRef.current = 0; scoreRef.current = 0; secsRef.current = 0;
    setRowsDone(0); setTokens(0); setScore(0); setSecs(0); setEndLine('');
    if (world.current) world.current.startedAt = performance.now();
    setP('playing');
    tapMedium(); sfxPop();
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const place = stage.place;
  const g = stage.goal;
  const goalPct = g.kind === 'tokens'
    ? Math.min(1, tokens / g.value)
    : g.kind === 'time'
      ? Math.max(0, 1 - secs / g.value)
      : Math.min(1, rowsDone / stage.rows);

  const T = {
    play: ar ? 'يلا نعدّي ▲' : 'START CROSSING ▲',
    again: ar ? 'تاني ↻' : 'Try again ↻',
    next: ar ? 'المدينة اللي بعدها →' : 'Next city →',
    board: ar ? '🏆 الترتيب العالمي' : '🏆 Global leaderboard',
    places: ar ? 'المدن' : 'Cities',
    best: ar ? 'أعلى' : 'Best',
    exit: ar ? 'خروج' : 'Exit',
    goal: ar ? 'التحدي' : 'Challenge',
    how: ar ? 'دوس تخطي لقدام · اسحب عالجنب أو لتحت · على المية لازم تكون فوق مركب'
      : 'Tap to hop forward · swipe to go sideways or back · on water, stay on a boat',
    fact: ar ? 'حاجة تستاهل تتعرف' : 'Worth knowing',
    custom: ar ? 'عادة من هناك' : 'A custom from there',
    got: ar ? 'وصلت وكسبت الكارت' : 'You made it across',
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: place.deep }}>
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FF2E88', fontSize: 14, fontWeight: '900', letterSpacing: 2 }}>THE CROSSING</Text>
            <Text style={{ color: place.accent, fontSize: 11, marginTop: 2, fontWeight: '700' }}>
              {place.flag} {ar ? place.cityAr : place.city} · {ar ? place.siteAr : place.site}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800' }}>SCORE</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: place.deep, borderWidth: 1, borderColor: 'rgba(255,46,136,0.35)' }}>
          <View ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          {Platform.OS !== 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>The Crossing runs in the browser 🚦</Text>
            </View>
          ) : null}

          {phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginRight: 7 }}>
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>▲ {rowsDone}/{stage.rows}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>✦ {tokens}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ color: g.kind === 'time' && secs > g.value - 10 ? '#FF6B6B' : '#FFF', fontSize: 11.5, fontWeight: '900' }}>⏱ {secs}s</Text>
                </View>
              </View>
              <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, height: 7, overflow: 'hidden' }}>
                <View style={{ width: goalPct * 100 + '%', height: '100%', backgroundColor: place.accent }} />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', marginTop: 4 }}>
                {goalText(stage, ar)}
              </Text>
            </View>
          ) : null}

          {phase === 'playing' && endLine ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: '42%', left: 20, right: 20, alignItems: 'center' }}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: '#FFD23F', fontSize: 13.5, fontWeight: '900', textAlign: 'center' }}>{endLine}</Text>
              </View>
            </View>
          ) : null}

          {phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '800', textAlign: 'center' }}>{T.how}</Text>
            </View>
          ) : null}

          {/* ── the story card ── */}
          {phase === 'story' ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 26 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,6,20,0.84)' }}>
              <Text style={{ color: place.accent, fontSize: 11.5, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>
                {ar ? 'المدينة' : 'CITY'} {stageIdx + 1} / {STAGES.length}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
                {place.flag} {ar ? place.cityAr : place.city}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, textAlign: 'center', marginTop: 3 }}>
                {ar
                  ? 'عدّي الشارع و' + stage.traffic.waterAr + ' لحد ' + place.siteAr
                  : 'Across the traffic and ' + stage.traffic.water.toLowerCase() + ', to ' + place.site.toLowerCase()}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 22, textAlign: 'center', marginTop: 14 }}>
                {ar ? place.factAr : place.fact}
              </Text>

              <View style={{ alignSelf: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{T.goal.toUpperCase()}</Text>
                <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900', marginTop: 3 }}>{goalText(stage, ar)}</Text>
              </View>

              <Pressable onPress={startRun} style={{ alignSelf: 'center', marginTop: 22 }}>
                <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 42, paddingVertical: 15 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>{T.play}</Text>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
                <Pressable onPress={() => { tapLight(); setP('picker'); }} style={{ marginHorizontal: 8 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>🗺️ {T.places}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('hop').then(setBoard).catch(() => setBoard([])); }} style={{ marginHorizontal: 8 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{T.board}</Text>
                  </View>
                </Pressable>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, textAlign: 'center', marginTop: 12 }}>{T.best}: {best}</Text>
            </ScrollView>
          ) : null}

          {/* ── the cities ── */}
          {phase === 'picker' ? (
            <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 34 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,6,20,0.95)' }}>
              <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>🗺️ {T.places}</Text>
              {STAGES.map((s, i) => {
                const lock = i > unlocked;
                const has = cards.indexOf(s.place.id) >= 0;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => { if (lock) return; tapLight(); setStageIdx(i); setP('story'); }}
                    style={{ opacity: lock ? 0.45 : 1, marginBottom: 10 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: i === stageIdx ? '#FF2E88' : 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 13 }}>
                      <Text style={{ fontSize: 26, marginRight: 12 }}>{s.place.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{ar ? s.place.cityAr : s.place.city}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 2 }}>{goalText(s, ar)}</Text>
                      </View>
                      {has ? <Text style={{ fontSize: 15, marginRight: 8 }}>🎴</Text> : null}
                      {lock ? <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.6)" /> : <Ionicons name="play" size={16} color={s.place.accent} />}
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => { tapLight(); setP('story'); }} style={{ alignSelf: 'center', marginTop: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800' }}>{ar ? 'رجوع' : 'Back'}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {/* ── the culture card ── */}
          {phase === 'card' ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,6,20,0.92)' }}>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>{T.got.toUpperCase()} 🎴</Text>
              <View style={{ marginTop: 12, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: place.accent, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <View style={{ backgroundColor: place.stone, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30 }}>{place.flag}</Text>
                  <Text style={{ color: place.deep, fontSize: 16, fontWeight: '900', marginTop: 4 }}>{ar ? place.siteAr : place.site}</Text>
                  <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11.5, fontWeight: '800' }}>{ar ? place.cityAr + ' · ' + place.countryAr : place.city + ' · ' + place.country}</Text>
                </View>
                <View style={{ padding: 16 }}>
                  <Text style={{ color: place.accent, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>{T.fact.toUpperCase()}</Text>
                  <Text style={{ color: '#FFF', fontSize: 13, lineHeight: 20, marginTop: 5 }}>{ar ? place.factAr : place.fact}</Text>
                  <Text style={{ color: place.accent, fontSize: 10.5, fontWeight: '900', letterSpacing: 1, marginTop: 14 }}>{T.custom.toUpperCase()}</Text>
                  <Text style={{ color: '#FFF', fontSize: 13, lineHeight: 20, marginTop: 5 }}>{ar ? place.customAr : place.custom}</Text>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13.5, marginTop: 14, textAlign: 'center' }}>
                {score} {ar ? 'نقطة' : 'points'} · ⏱ {secs}s · ✦ {tokens}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pressable onPress={startRun} style={{ margin: 5 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{T.again}</Text>
                  </View>
                </Pressable>
                {stageIdx + 1 < STAGES.length ? (
                  <Pressable onPress={() => { tapLight(); setStageIdx(stageIdx + 1); setP('story'); }} style={{ margin: 5 }}>
                    <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{T.next}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => { tapLight(); onClose(); }} style={{ marginTop: 12, alignSelf: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>{T.exit}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {/* ── didn't make it ── */}
          {phase === 'lost' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,6,20,0.88)', padding: 26 }}>
              <Text style={{ fontSize: 50 }}>💥</Text>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{endLine}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13.5, marginTop: 8 }}>
                {score} {ar ? 'نقطة' : 'points'} · ▲ {rowsDone}/{stage.rows} · ✦ {tokens}
              </Text>
              <Pressable onPress={startRun} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 34, paddingVertical: 14 }}>
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>{T.again}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); setP('story'); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>{ar ? 'رجوع' : 'Back'}</Text>
              </Pressable>
            </View>
          ) : null}

          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,6,20,0.95)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 16, maxHeight: '80%' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>{T.board}</Text>
                {board === 'loading' ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>…</Text>
                ) : board.length === 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
                    {ar ? 'مفيش نتايج لسه — كن أول واحد!' : 'No scores yet — be the first!'}
                  </Text>
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
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' }}>{ar ? 'إغلاق' : 'Close'}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};
