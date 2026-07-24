import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { submitScore, fetchLeaderboard, finishMatch, subscribeMatchLive } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';
import {
  CHAPTERS, makeLevel, drawScene, drawRunner, drawChaser, GROUND,
} from './rushArt';

/* ─── ROOFTOP RUSH — a real side-scrolling platformer ─────────────────
   A painted canvas world (see rushArt.js): parallax skylines and alpine
   ranges, rooftops and glossy ice, weather, and a runner with actual
   arms and legs — not an emoji on a coloured box.

   THE STORY runs across four chapters, each with its own terrain, its
   own chaser and its own challenge to clear before the next one opens.
   Rooftops are about timing your jumps; the ice chapters slide, so you
   carry momentum and have to launch off the edges. Progress is saved,
   so you pick up where you left off.

   RACE A MATE: pass a matchId and both of you run the SAME course
   (identical seed) at the same time, with your friend's ghost running
   the track beside you over a live Supabase channel. First to the
   finish line wins — really, not simulated.                            */

const PROGRESS_KEY = 'mm_rush_progress';
const BEST_KEY = 'mm_rooftop_best';

// physics (px / second)
const GRAVITY = 2100;
const JUMP_V = -720;
const DOUBLE_V = -640;
const RUN_SPEED = 300;      // rooftop cruise
const ICE_MAX = 430;        // ice tops out faster
const ICE_ACCEL = 130;
const SPEED_PER_CHAPTER = 22;
const FALL_LIMIT = GROUND + 300;
const CHASER_BASE = 150;    // how far behind the chaser sits when you're clean
const RACE_TARGET = 2600;   // race distance, in world px
const COYOTE_MS = 110;      // grace after running off an edge
const BUFFER_MS = 130;      // a tap just before landing still counts

const gamesAr = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem('mm_games_ar') === '1'; } catch (e) { return false; } };

const loadProgress = () => {
  try {
    if (typeof localStorage === 'undefined') return 0;
    return Math.max(0, Math.min(CHAPTERS.length - 1, parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10) || 0));
  } catch (e) { return 0; }
};
const saveProgress = (n) => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(PROGRESS_KEY, String(n)); } catch (e) {} };

const goalText = (ch, ar) => {
  const g = ch.goal;
  if (g.kind === 'distance') return ar ? 'اجري ' + g.value + ' متر' : 'Run ' + g.value + 'm';
  if (g.kind === 'coins') return ar ? 'اجمع ' + g.value + ' قطعة' : 'Collect ' + g.value + ' pickups';
  return ar ? 'اصمد ' + g.value + ' ثانية' : 'Survive ' + g.value + 's';
};

export const RooftopRush = ({ onClose, matchId = null, isHost = false, opponent = null }) => {
  const { user } = useAuth();
  const ar = gamesAr();
  const isRace = !!matchId;

  const [chapterIdx, setChapterIdx] = useState(() => (isRace ? 0 : loadProgress()));
  const [unlocked, setUnlocked] = useState(() => loadProgress());
  const [phase, setPhase] = useState('story');  // story | playing | won | lost | picker
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [metres, setMetres] = useState(0);
  const [secs, setSecs] = useState(0);
  const [best, setBest] = useState(() => {
    try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  });
  const [board, setBoard] = useState(null);
  const [endLine, setEndLine] = useState('');

  // race state
  const [raceState, setRaceState] = useState('waiting'); // waiting | countdown | racing | done
  const [countdown, setCountdown] = useState(null);
  const [peerDone, setPeerDone] = useState(null);
  const [meReady, setMeReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [raceResult, setRaceResult] = useState(null);

  const hostRef = useRef(null);
  const world = useRef(null);   // the whole mutable game world (never re-renders)
  const rafRef = useRef(null);
  const wireRef = useRef(null);
  const phaseRef = useRef('story');
  const raceRef = useRef('waiting');
  const seedRef = useRef(isRace ? 777001 : Math.floor(Math.random() * 1e6));

  const setP = (p) => { phaseRef.current = p; setPhase(p); };
  const setRP = (p) => { raceRef.current = p; setRaceState(p); };

  /* The render loop is created ONCE. Anything it needs that changes
     between renders goes through a ref, so the canvas is never torn
     down mid-run and the loop never calls yesterday's logic. */
  const stepRef = useRef(null);
  const peerXRef = useRef(0);

  const chapter = CHAPTERS[chapterIdx];

  /* ── build a fresh world for the current chapter ── */
  const buildWorld = useCallback(() => {
    const level = makeLevel(seedRef.current, chapterIdx);
    const start = level.platforms[0];
    world.current = {
      level,
      ice: level.ice,
      x: 120, y: start.y, prevY: start.y,
      vy: 0, vx: level.ice ? 180 : RUN_SPEED + chapterIdx * SPEED_PER_CHAPTER,
      onGround: true, jumps: 0, sliding: false,
      phase: 0, startedAt: 0, coins: 0, score: 0,
      // how far behind you the chaser is RIGHT NOW: clipping things drags
      // it closer, running clean earns the gap back. Let it reach you and
      // the run is over — so the hazards genuinely matter.
      chaseGap: CHASER_BASE, chaserX: 120 - CHASER_BASE, chaserY: start.y,
      particles: [], shakeUntil: 0, deadAt: 0,
      leftGroundAt: 0, bufferedJumpAt: 0,
    };
  }, [chapterIdx]);

  useEffect(() => { buildWorld(); }, [buildWorld]);

  /* ── the race wire ── */
  useEffect(() => {
    if (!isRace) return undefined;
    const wire = subscribeMatchLive(matchId, {
      ready: () => setPeerReady(true),
      start: (p) => { if (!isHost) beginCountdown(p && p.at); },
      score: (p) => { if (p && typeof p.x === 'number') peerXRef.current = p.x; },
      finished: (p) => setPeerDone(p || {}),
    });
    wireRef.current = wire;
    return () => { wire.leave(); wireRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, isRace, isHost]);

  const beginCountdown = (at) => {
    setRP('countdown');
    const start = at || Date.now() + 3200;
    const tick = () => {
      const left = Math.ceil((start - Date.now()) / 1000);
      if (left <= 0) { setCountdown(null); startRun(); return; }
      setCountdown(left);
      setTimeout(tick, 220);
    };
    tick();
  };

  const readyUp = () => {
    tapMedium();
    setMeReady(true);
    if (wireRef.current) wireRef.current.send('ready', {});
  };

  // host fires the synced start once both sides are ready
  useEffect(() => {
    if (!isRace || !isHost || raceRef.current !== 'waiting') return;
    if (meReady && peerReady) {
      const at = Date.now() + 3200;
      if (wireRef.current) wireRef.current.send('start', { at });
      beginCountdown(at);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meReady, peerReady, isRace, isHost]);

  /* ── the canvas + game loop ── */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const host = hostRef.current;
    if (!host || !host.appendChild) return undefined;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
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
      const VW = Math.max(1, rect.width), VH = Math.max(1, rect.height);
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      if (canvas.width !== Math.round(VW * dpr)) {
        canvas.width = Math.round(VW * dpr);
        canvas.height = Math.round(VH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = world.current;
      if (!w) return;

      if (phaseRef.current === 'playing' && stepRef.current) stepRef.current(w, dt, now, VW);

      // camera: player sits about a third in, with a look-ahead
      const cam = {
        x: w.x - VW * 0.32,
        y: w.y - VH * 0.62,
      };
      if (now < w.shakeUntil) {
        cam.x += (Math.random() - 0.5) * 9;
        cam.y += (Math.random() - 0.5) * 9;
      }

      drawScene(ctx, VW, VH, cam, w.level, now, { particles: w.particles });

      // the finish line on a race
      if (isRace) {
        const fx = RACE_TARGET - cam.x;
        if (fx > -40 && fx < VW + 40) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 14; i++) {
            ctx.fillStyle = i % 2 ? '#FFFFFF' : '#12071F';
            ctx.fillRect(fx - 9, w.y - cam.y - 210 + i * 15, 18, 15);
          }
        }
        // your mate's ghost running the same course
        const gx = peerXRef.current - cam.x;
        if (gx > -60 && gx < VW + 60) {
          drawRunner(ctx, gx, w.y - cam.y, { phase: now * 0.014, shirt: '#20E3D2', ghost: true });
        }
      }

      // the chaser
      drawChaser(ctx, w.chaserX - cam.x, w.chaserY - cam.y, w.level.chapter.chaser, now);

      // you
      drawRunner(ctx, w.x - cam.x, w.y - cam.y, {
        phase: w.phase,
        airborne: !w.onGround,
        sliding: w.sliding,
        shirt: '#FF2E88',
      });
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { host.removeChild(canvas); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRace]);

  /* ── one physics step ── */
  const step = (w, dt, now, VW) => {
    const lv = w.level;

    // forward motion — ice builds momentum, roofs cruise
    if (w.ice) w.vx = Math.min(ICE_MAX + chapterIdx * SPEED_PER_CHAPTER, w.vx + ICE_ACCEL * dt);
    w.x += w.vx * dt * (w.sliding ? 1.22 : 1);
    w.phase += dt * (w.onGround ? 13 : 5);

    // gravity
    w.prevY = w.y;
    w.vy += GRAVITY * dt;
    w.y += w.vy * dt;

    /* Ground check, swept: falling fast used to skip straight THROUGH a
       roof between two frames. Comparing where we were with where we are
       now means a landing can never be missed. */
    let landed = false;
    for (const p of lv.platforms) {
      if (w.x < p.x - 6 || w.x > p.x + p.w + 6) continue;
      if (w.vy >= 0 && w.prevY <= p.y + 2 && w.y >= p.y - 2) {
        w.y = p.y; w.vy = 0; landed = true;
        if (!w.onGround) {
          // landing puff
          for (let i = 0; i < 7; i++) {
            w.particles.push({
              x: w.x + (Math.random() - 0.5) * 16, y: w.y, r: 2 + Math.random() * 3,
              vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50,
              life: 1, col: w.ice ? 'rgba(255,255,255,0.9)' : 'rgba(255,220,170,0.8)',
            });
          }
        }
        w.onGround = true; w.jumps = 0; w.leftGroundAt = 0;
        if (now - (w.bufferedJumpAt || 0) < BUFFER_MS) {
          w.bufferedJumpAt = 0; w.vy = JUMP_V; w.onGround = false; w.jumps = 1;
        }
        break;
      }
    }
    if (!landed) {
      if (w.onGround) w.leftGroundAt = now;   // just walked off an edge
      w.onGround = false; w.sliding = false;
    }

    // hazards — clipping one costs you speed and lets the chaser close in
    for (const h of lv.hazards) {
      if (h.hit) continue;
      if (Math.abs(h.x - w.x) < 20 && w.y > h.y - h.h - 8 && w.y <= h.y + 6) {
        h.hit = true;
        w.vx = Math.max(150, w.vx * 0.55);
        w.chaseGap -= 38;              // they gain on you — clip enough and you're had
        w.shakeUntil = now + 220;
        tapLight();
        for (let i = 0; i < 10; i++) {
          w.particles.push({
            x: h.x, y: h.y - h.h / 2, r: 2 + Math.random() * 3,
            vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 140,
            life: 1, col: '#FFD23F',
          });
        }
      }
    }

    // loot
    for (const it of lv.items) {
      if (it.got) continue;
      if (Math.abs(it.x - w.x) < 26 && Math.abs(it.y - (w.y - 28)) < 40) {
        it.got = true;
        const pts = it.kind === 'gem' ? 50 : it.kind === 'star' ? 25 : 10;
        w.coins += 1; w.score += pts;
        sfxStar();
        for (let i = 0; i < 8; i++) {
          w.particles.push({
            x: it.x, y: it.y, r: 1.5 + Math.random() * 2.5,
            vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 130,
            life: 1, col: it.kind === 'gem' ? '#5BE3D2' : '#FFD23F',
          });
        }
      }
    }

    /* The chaser: run clean and you slowly earn breathing room back;
       clip things and it closes for real. Reaching you ends the run. */
    w.chaseGap = Math.min(CHASER_BASE, w.chaseGap + 26 * dt);
    w.chaserX = w.x - w.chaseGap;
    w.chaserY += (w.y - w.chaserY) * Math.min(1, dt * 4);
    if (w.chaseGap <= 24) return die(w, now, ar ? 'مسكوك! 😱' : 'Caught!');

    // fell off the world
    if (w.y > FALL_LIMIT) return die(w, now, ar ? 'وقعت من على السطح! 💥' : 'You missed the jump! 💥');

    // particles
    for (let i = w.particles.length - 1; i >= 0; i--) {
      const p = w.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) w.particles.splice(i, 1);
    }

    // score from distance
    const m = Math.max(0, Math.round((w.x - 120) / 10));
    w.score = Math.max(w.score, 0);
    const total = w.score + m;

    // publish to React (cheap: only when the numbers actually change)
    if (m !== metresRef.current) { metresRef.current = m; setMetres(m); }
    if (w.coins !== coinsRef.current) { coinsRef.current = w.coins; setCoins(w.coins); }
    if (total !== scoreRef.current) { scoreRef.current = total; setScore(total); }
    const el = Math.floor((now - w.startedAt) / 1000);
    if (el !== secsRef.current) { secsRef.current = el; setSecs(el); }

    // live position to your mate
    if (isRace && wireRef.current && now - (w.lastPing || 0) > 140) {
      w.lastPing = now;
      wireRef.current.send('score', { x: Math.round(w.x) });
    }

    // did we clear it?
    if (isRace) {
      if (w.x >= RACE_TARGET) finishRace(true, total);
    } else {
      const g = chapter.goal;
      const done =
        g.kind === 'distance' ? m >= g.value
        : g.kind === 'coins' ? w.coins >= g.value
        : el >= g.value;
      if (done) win(total);
    }
  };

  const metresRef = useRef(0);
  const coinsRef = useRef(0);
  const scoreRef = useRef(0);
  const secsRef = useRef(0);

  // hand the loop the freshest physics every render
  stepRef.current = step;

  const die = (w, now, line) => {
    if (phaseRef.current !== 'playing') return;
    w.shakeUntil = now + 320;
    setEndLine(line);
    setP('lost');
    tapLight(); sfxPop();
    const total = scoreRef.current;
    if (user && total > 0) submitScore(user.id, 'rooftop', total).catch(() => {});
    saveBest(total);
    if (isRace) finishRace(false, total);
  };

  const saveBest = (total) => {
    setBest((b) => {
      if (total > b) { try { localStorage.setItem(BEST_KEY, String(total)); } catch (e) {} return total; }
      return b;
    });
  };

  const win = (total) => {
    if (phaseRef.current !== 'playing') return;
    setP('won');
    tapSuccess(); sfxSuccess();
    if (user) submitScore(user.id, 'rooftop', total).catch(() => {});
    saveBest(total);
    if (chapterIdx >= unlocked && chapterIdx + 1 < CHAPTERS.length) {
      const next = chapterIdx + 1;
      setUnlocked(next); saveProgress(next);
    }
  };

  const finishRace = (reached, total) => {
    if (raceRef.current === 'done') return;
    setRP('done');
    setP(reached ? 'won' : 'lost');
    if (wireRef.current) wireRef.current.send('finished', { reached, score: total, at: Date.now() });
    setRaceResult({ mineReached: reached, mineScore: total });
    if (user) submitScore(user.id, 'rooftop', total).catch(() => {});
  };

  /* settle the race once both sides have reported */
  useEffect(() => {
    if (!isRace || !raceResult || !peerDone) return;
    const iWon = raceResult.mineReached && !peerDone.reached ? true
      : !raceResult.mineReached && peerDone.reached ? false
      : raceResult.mineScore >= (peerDone.score || 0);
    setEndLine(iWon
      ? (ar ? 'كسبت السباق! 🏆' : 'You won the race! 🏆')
      : (ar ? 'صاحبك سبقك 😄' : 'Your mate beat you 😄'));
    if (isHost) {
      finishMatch(matchId, {
        hostScore: raceResult.mineScore,
        guestScore: peerDone.score || 0,
        winnerId: iWon ? (user && user.id) : (opponent && opponent.id) || null,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceResult, peerDone]);

  const startRun = () => {
    buildWorld();
    metresRef.current = 0; coinsRef.current = 0; scoreRef.current = 0; secsRef.current = 0;
    setMetres(0); setCoins(0); setScore(0); setSecs(0); setEndLine('');
    if (world.current) world.current.startedAt = performance.now();
    setP('playing');
    if (isRace) setRP('racing');
    tapMedium(); sfxPop();
  };

  /* ── controls ── */
  /* Two forgiving touches every good platformer has, and without which
     a run feels unfair: COYOTE TIME (a tap a moment after you've run off
     the edge still jumps) and a JUMP BUFFER (a tap just before you land
     fires the instant you touch down). You never lose to input timing —
     only to a jump you genuinely misjudged. */
  const jump = useCallback(() => {
    const w = world.current;
    if (!w || phaseRef.current !== 'playing') return;
    const now = performance.now();
    const coyote = w.onGround || (now - (w.leftGroundAt || 0) < COYOTE_MS && w.jumps === 0);
    if (coyote) { w.vy = JUMP_V; w.onGround = false; w.jumps = 1; w.leftGroundAt = 0; tapLight(); sfxPop(); }
    else if (w.jumps < 2) { w.vy = DOUBLE_V; w.jumps = 2; tapLight(); sfxPop(); }
    else { w.bufferedJumpAt = now; }   // remember it and fire it on landing
  }, []);

  const setSlide = useCallback((on) => {
    const w = world.current;
    if (!w || phaseRef.current !== 'playing') return;
    w.sliding = on && w.onGround;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const kd = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); jump(); }
      if (k === 'arrowdown' || k === 's') { e.preventDefault(); setSlide(true); }
    };
    const ku = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'arrowdown' || k === 's') setSlide(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [jump, setSlide]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const goal = chapter.goal;
  const goalNow = goal.kind === 'distance' ? metres : goal.kind === 'coins' ? coins : secs;
  const goalPct = Math.max(0, Math.min(1, goalNow / goal.value));

  const T = {
    play: ar ? 'يلا نجري ▶' : 'START THE RUN ▶',
    again: ar ? 'تاني ↻' : 'Run again ↻',
    next: ar ? 'الفصل اللي بعده →' : 'Next chapter →',
    board: ar ? '🏆 الترتيب العالمي' : '🏆 Global leaderboard',
    chapters: ar ? 'الفصول' : 'Chapters',
    best: ar ? 'أعلى' : 'Best',
    exit: ar ? 'خروج' : 'Exit',
    locked: ar ? 'مقفول' : 'Locked',
    goal: ar ? 'التحدي' : 'Challenge',
    ready: ar ? 'جاهز!' : "I'm ready!",
    waiting: ar ? 'مستني صاحبك…' : 'Waiting for your mate…',
    race: ar ? 'سباق' : 'Race',
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0C0718' }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FF2E88', fontSize: 14, fontWeight: '900', letterSpacing: 2 }}>ROOFTOP RUSH</Text>
            <Text style={{ color: '#20E3D2', fontSize: 11, marginTop: 2, fontWeight: '700' }}>
              {chapter.flag} {chapter.city}{isRace ? ' · ' + T.race : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800' }}>SCORE</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        {/* the world */}
        <Pressable
          onPressIn={() => { if (phase === 'playing') jump(); }}
          style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: '#160E2E', borderWidth: 1, borderColor: 'rgba(255,46,136,0.35)' }}
        >
          <View ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          {Platform.OS !== 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>Rooftop Rush runs in the browser 🏙️</Text>
            </View>
          ) : null}

          {/* live HUD */}
          {phase === 'playing' ? (
            <>
              <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginRight: 7 }}>
                    <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>🪙 {coins}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                    <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>{metres}m</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  {isRace ? null : (
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                      <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>⏱ {secs}s</Text>
                    </View>
                  )}
                </View>
                {/* challenge progress */}
                <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, height: 7, overflow: 'hidden' }}>
                  <View style={{ width: (isRace ? Math.min(1, metres * 10 / RACE_TARGET) : goalPct) * 100 + '%', height: '100%', backgroundColor: '#20E3D2' }} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', marginTop: 4 }}>
                  {isRace ? (ar ? 'خط النهاية' : 'To the finish line') : goalText(chapter, ar)}
                </Text>
              </View>

              {/* slide button — the ice chapters live on this */}
              <Pressable
                onPressIn={() => setSlide(true)}
                onPressOut={() => setSlide(false)}
                style={{ position: 'absolute', bottom: 14, left: 14 }}
              >
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(32,227,210,0.22)', borderWidth: 1, borderColor: 'rgba(32,227,210,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chevron-down" size={26} color="#20E3D2" />
                </View>
              </Pressable>
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 20, right: 18 }}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10.5, fontWeight: '800' }}>
                  {ar ? 'دوس في أي حتة تنطّ · مرتين = نطة مزدوجة' : 'Tap anywhere to jump · twice = double jump'}
                </Text>
              </View>
            </>
          ) : null}

          {/* race countdown */}
          {countdown != null ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 78, fontWeight: '900' }}>{countdown}</Text>
            </View>
          ) : null}

          {/* ── STORY / start ── */}
          {phase === 'story' ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 26 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(12,7,24,0.82)' }}>
              <Text style={{ color: '#20E3D2', fontSize: 11.5, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>
                {ar ? 'الفصل' : 'CHAPTER'} {chapterIdx + 1} / {CHAPTERS.length}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
                {chapter.flag} {chapter.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 22, textAlign: 'center', marginTop: 12 }}>
                {ar ? chapter.story : chapter.storyEn}
              </Text>

              <View style={{ alignSelf: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{T.goal.toUpperCase()}</Text>
                <Text style={{ color: '#FFD23F', fontSize: 14, fontWeight: '900', marginTop: 3 }}>{goalText(chapter, ar)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5, marginTop: 4 }}>
                  {ar ? 'اللي وراك: ' : 'On your tail: '}{ar ? chapter.chaserName : chapter.chaserNameEn}
                </Text>
              </View>

              {isRace ? (
                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  {meReady ? (
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800' }}>
                      {peerReady ? (ar ? 'يلا بينا!' : 'Here we go!') : T.waiting}
                    </Text>
                  ) : (
                    <Pressable onPress={readyUp}>
                      <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 42, paddingVertical: 15 }}>
                        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{T.ready}</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  <Pressable onPress={startRun} style={{ alignSelf: 'center', marginTop: 22 }}>
                    <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 42, paddingVertical: 15 }}>
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>{T.play}</Text>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
                    <Pressable onPress={() => { tapLight(); setP('picker'); }} style={{ marginHorizontal: 8 }}>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                        <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>🗺️ {T.chapters}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('rooftop').then(setBoard).catch(() => setBoard([])); }} style={{ marginHorizontal: 8 }}>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                        <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{T.board}</Text>
                      </View>
                    </Pressable>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, textAlign: 'center', marginTop: 12 }}>{T.best}: {best}</Text>
                </>
              )}
            </ScrollView>
          ) : null}

          {/* ── chapter picker ── */}
          {phase === 'picker' ? (
            <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 34 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(12,7,24,0.94)' }}>
              <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>🗺️ {T.chapters}</Text>
              {CHAPTERS.map((ch, i) => {
                const lock = i > unlocked;
                return (
                  <Pressable
                    key={ch.id}
                    onPress={() => { if (lock) return; tapLight(); setChapterIdx(i); setP('story'); }}
                    style={{ opacity: lock ? 0.45 : 1, marginBottom: 10 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: i === chapterIdx ? '#FF2E88' : 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 13 }}>
                      <Text style={{ fontSize: 26, marginRight: 12 }}>{ch.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{ch.city}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 2 }}>{goalText(ch, ar)}</Text>
                      </View>
                      {lock ? <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.6)" /> : <Ionicons name="play" size={16} color="#20E3D2" />}
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => { tapLight(); setP('story'); }} style={{ alignSelf: 'center', marginTop: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800' }}>{ar ? 'رجوع' : 'Back'}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {/* ── won / lost ── */}
          {phase === 'won' || phase === 'lost' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,7,24,0.88)', padding: 26 }}>
              <Text style={{ fontSize: 50 }}>{phase === 'won' ? '🏆' : '💥'}</Text>
              <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>
                {endLine || (phase === 'won'
                  ? (ar ? 'خلّصت الفصل! 🎉' : 'Chapter cleared! 🎉')
                  : (ar ? 'مسكوك!' : 'They got you!'))}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13.5, marginTop: 8 }}>
                {score} {ar ? 'نقطة' : 'points'} · {metres}m · 🪙 {coins}
              </Text>

              <View style={{ flexDirection: 'row', marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                {!isRace ? (
                  <Pressable onPress={startRun} style={{ margin: 5 }}>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{T.again}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {!isRace && phase === 'won' && chapterIdx + 1 < CHAPTERS.length ? (
                  <Pressable onPress={() => { tapLight(); setChapterIdx(chapterIdx + 1); setP('story'); }} style={{ margin: 5 }}>
                    <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{T.next}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => { tapLight(); onClose(); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>{T.exit}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* leaderboard */}
          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(12,7,24,0.95)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
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
        </Pressable>
      </View>
    </Modal>
  );
};
