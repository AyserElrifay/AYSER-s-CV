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
  CHAPTERS, makeTower, drawTowerScene, goalText, ledgeX,
  VW_WORLD, LEFT, RIGHT, FLOORS,
} from './towerArt';

/* ─── THE CLIMB · Wonders ─────────────────────────────────────────────
   Climb the inside of a tower, one ledge at a time, with the weather
   coming up underneath you. Six chapters, six real places, and a piece
   of each place to take away when you clear it.

   HOW IT PLAYS: hold your thumb where you want to be and the climber
   runs there; he bounces the moment he lands, and the faster he is
   moving the higher the bounce goes. Bounce off a side wall and you
   keep the speed. Clear two or more floors in one bounce and the combo
   starts counting — that is where the big scores live.

   Everything the game measures is real: a fixed virtual width so every
   screen plays the identical tower, a fixed seed per chapter so two
   people can compare the same climb, and one score row per run.      */

const BEST_KEY = 'mm_tower_best';
const PROGRESS_KEY = 'mm_tower_progress';
const CARDS_KEY = 'mm_tower_cards';      // the culture cards you've earned

// physics, in virtual px / second
const GRAVITY = 2000;
const JUMP_BASE = 690;
const JUMP_PER_SPEED = 0.48;   // running fast is what makes a big bounce
const JUMP_MAX = 1010;
const ACCEL = 1500;
const MAX_VX = 400;
const WALL_BOUNCE = 0.88;
const GROUND_MS = 90;          // the beat spent on a ledge before the bounce
const CRUMBLE_MS = 520;

const loadInt = (k) => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } };
const saveInt = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
const loadCards = () => {
  try { return JSON.parse(localStorage.getItem(CARDS_KEY) || '[]') || []; } catch (e) { return []; }
};
const saveCard = (id) => {
  try {
    const has = loadCards();
    if (has.indexOf(id) < 0) localStorage.setItem(CARDS_KEY, JSON.stringify(has.concat([id])));
  } catch (e) {}
};

export const TowerClimb = ({ onClose }) => {
  const { user } = useAuth();
  const ar = gamesAr();
  const myDna = React.useMemo(() => parseDna(user && user.avatar_dna), [user && user.avatar_dna]);

  const [chapterIdx, setChapterIdx] = useState(() => Math.min(CHAPTERS.length - 1, loadInt(PROGRESS_KEY)));
  const [unlocked, setUnlocked] = useState(() => Math.min(CHAPTERS.length - 1, loadInt(PROGRESS_KEY)));
  const [phase, setPhase] = useState('story');   // story | playing | won | lost | picker | card
  const [floors, setFloors] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [combo, setCombo] = useState(0);
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
  const scaleRef = useRef(1);

  const floorsRef = useRef(0);
  const tokensRef = useRef(0);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);

  const chapter = CHAPTERS[chapterIdx];
  const setP = (p) => { phaseRef.current = p; setPhase(p); };

  /* ── a fresh tower ── */
  const buildWorld = useCallback(() => {
    const level = makeTower(90210 + chapterIdx * 131, chapterIdx);
    world.current = {
      level,
      x: VW_WORLD / 2, y: 0, vx: 0, vy: 0,
      aim: null,                 // where the thumb is, in world x
      onGround: true, groundUntil: 0, groundLedge: level.ledges[0],
      floor: 0, topFloor: 0, lastLanded: 0,
      combo: 0, maxCombo: 0, tokens: 0, score: 0,
      // the weather starts well below the ground floor and never stops
      risingY: 420, riseSpeed: chapter.rising.speed,
      particles: [], startedAt: 0, phase: 0, shakeUntil: 0,
    };
    // ledges are reused between runs, so clear anything the last run broke
    level.ledges.forEach((l) => { l.gone = false; l.crumbleAt = 0; });
    level.tokens.forEach((t) => { t.got = false; });
  }, [chapterIdx, chapter.rising.speed]);

  useEffect(() => { buildWorld(); }, [buildWorld]);

  /* ── the canvas ─────────────────────────────────────────────────
     One canvas, created once, scaled so the virtual width always fills
     the box. The loop is never rebuilt, so it can never end up calling
     an older copy of the physics. */
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
      scaleRef.current = s;
      const VH = cssH / s;                     // the world height that fits
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);

      const w = world.current;
      if (!w) return;
      if (phaseRef.current === 'playing' && stepRef.current) stepRef.current(w, dt, now, VH);

      /* The camera only ever rises. Letting it fall back down with the
         player turns a bad bounce into a lost screen of context. */
      const want = w.y - VH * 0.62;
      if (w.camY == null || want < w.camY) w.camY = want;
      let camY = w.camY;
      if (now < w.shakeUntil) camY += (Math.random() - 0.5) * 5;

      drawTowerScene(ctx, VW_WORLD, VH, camY, w.level, now, {
        particles: w.particles,
        risingY: w.risingY,
      });

      // you, mid-bounce
      const squash = w.onGround && now < w.groundUntil ? 1 : 0;
      ctx.save();
      if (squash) { ctx.translate(w.x, w.y - camY); ctx.scale(1.12, 0.88); ctx.translate(-w.x, -(w.y - camY)); }
      drawRunner(ctx, w.x, w.y - camY, {
        phase: w.phase,
        airborne: !w.onGround,
        flip: w.vx < -12,
        dna: dnaRef.current,
      });
      ctx.restore();

      // the combo, shown on the climber rather than in a corner
      if (w.combo >= 2) {
        ctx.save();
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now * 0.012);
        ctx.fillStyle = '#FFD23F';
        ctx.font = '900 17px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('×' + w.combo, w.x, w.y - camY - 66);
        ctx.restore();
      }
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { host.removeChild(canvas); } catch (e) {}
    };
  }, []);

  /* ── steering ───────────────────────────────────────────────────
     Hold anywhere and the climber runs to your thumb. Nothing to aim
     at, nothing to press, and it works the same for a left hand.   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const host = hostRef.current;
    if (!host || !host.addEventListener) return undefined;
    // without this the browser reads a steering drag as a page scroll
    if (host.style) host.style.touchAction = 'none';

    const toWorld = (clientX) => {
      const rect = host.getBoundingClientRect();
      return (clientX - rect.left) / (scaleRef.current || 1);
    };
    const set = (e) => {
      const w = world.current;
      if (!w || phaseRef.current !== 'playing') return;
      const p = e.touches && e.touches.length ? e.touches[0] : e;
      w.aim = Math.max(LEFT, Math.min(RIGHT, toWorld(p.clientX)));
      if (e.cancelable) e.preventDefault();
    };
    const clear = () => { const w = world.current; if (w) w.aim = null; };

    host.addEventListener('pointerdown', set);
    host.addEventListener('pointermove', set);
    host.addEventListener('pointerup', clear);
    host.addEventListener('pointercancel', clear);
    host.addEventListener('pointerleave', clear);
    return () => {
      host.removeEventListener('pointerdown', set);
      host.removeEventListener('pointermove', set);
      host.removeEventListener('pointerup', clear);
      host.removeEventListener('pointercancel', clear);
      host.removeEventListener('pointerleave', clear);
    };
  }, []);

  // and the keyboard, for anyone playing at a desk
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const kd = (e) => {
      const w = world.current;
      if (!w || phaseRef.current !== 'playing') return;
      const k = (e.key || '').toLowerCase();
      if (k === 'arrowleft' || k === 'a') { w.aim = LEFT; e.preventDefault(); }
      if (k === 'arrowright' || k === 'd') { w.aim = RIGHT; e.preventDefault(); }
    };
    const ku = (e) => {
      const w = world.current;
      const k = (e.key || '').toLowerCase();
      if (w && (k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd')) w.aim = null;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const burst = (w, x, y, col, n) => {
    for (let i = 0; i < n; i++) {
      w.particles.push({
        x, y, r: 1.4 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 120,
        life: 1, col,
      });
    }
  };

  /* ── one step of the climb ── */
  const step = (w, dt, now, VH) => {
    const lv = w.level;

    // run toward the thumb; let go and you keep what you built
    if (w.aim != null) {
      const dir = w.aim - w.x;
      if (Math.abs(dir) > 3) w.vx += Math.sign(dir) * ACCEL * dt;
      else w.vx *= 0.86;
    } else if (w.onGround) {
      w.vx *= Math.pow(w.groundLedge && w.groundLedge.kind === 'slick' ? 0.995 : 0.94, dt * 60);
    }
    w.vx = Math.max(-MAX_VX, Math.min(MAX_VX, w.vx));
    w.x += w.vx * dt;
    w.phase += dt * (w.onGround ? 12 : 6);

    // the side walls hand your speed back to you
    if (w.x < LEFT) { w.x = LEFT; w.vx = Math.abs(w.vx) * WALL_BOUNCE; tapLight(); }
    if (w.x > RIGHT) { w.x = RIGHT; w.vx = -Math.abs(w.vx) * WALL_BOUNCE; tapLight(); }

    // the bounce beat, then gravity again
    if (w.onGround && now >= w.groundUntil) {
      const power = Math.min(JUMP_MAX, JUMP_BASE + Math.abs(w.vx) * JUMP_PER_SPEED);
      w.vy = -power * (w.groundLedge && w.groundLedge.kind === 'slick' ? 0.9 : 1);
      w.onGround = false;
      w.groundLedge = null;
    }
    if (!w.onGround) {
      const prevY = w.y;
      w.vy += GRAVITY * dt;
      w.y += w.vy * dt;

      /* Swept landing. Falling at full speed between two frames can move
         you further than a ledge is thick, and checking only where you
         ARE would drop you straight through it. */
      if (w.vy > 0) {
        for (const l of lv.ledges) {
          if (l.gone) continue;
          const lx = ledgeX(l, now);
          if (w.x < lx - 4 || w.x > lx + l.w + 4) continue;
          if (prevY <= l.y + 2 && w.y >= l.y - 2) {
            w.y = l.y; w.vy = 0; w.onGround = true;
            w.groundUntil = now + GROUND_MS;
            w.groundLedge = l;
            if (l.kind === 'crumble' && !l.crumbleAt) l.crumbleAt = now;
            burst(w, w.x, w.y, 'rgba(255,255,255,0.7)', 5);

            /* THE COMBO: two or more floors cleared in a single bounce.
               Landing back on the same floor or below breaks it, so a
               big score is a run of brave jumps, not a safe one. */
            const gain = l.floor - w.lastLanded;
            /* One sound per bounce forever wears a player down, so the
               landing only speaks when the landing meant something. */
            if (gain >= 1) sfxPop();
            if (gain >= 2) {
              w.combo += 1;
              w.maxCombo = Math.max(w.maxCombo, w.combo);
              w.score += gain * gain * 5 * Math.max(1, w.combo);
              if (w.combo >= 2) { sfxStar(); tapLight(); }
            } else if (gain <= 0) {
              w.combo = 0;
            }
            w.lastLanded = l.floor;
            if (l.floor > w.topFloor) {
              w.score += (l.floor - w.topFloor) * 10;
              w.topFloor = l.floor;
            }
            w.floor = l.floor;
            break;
          }
        }
      }
    }

    // a ledge you stood on too long stops holding you
    for (const l of lv.ledges) {
      if (l.crumbleAt && !l.gone && now - l.crumbleAt > CRUMBLE_MS) {
        l.gone = true;
        if (w.groundLedge === l) { w.onGround = false; w.groundLedge = null; }
        burst(w, ledgeX(l, now) + l.w / 2, l.y, 'rgba(0,0,0,0.4)', 8);
      }
    }

    // tokens
    for (const it of lv.tokens) {
      if (it.got) continue;
      if (Math.abs(it.x - w.x) < 26 && Math.abs(it.y - (w.y - 24)) < 34) {
        it.got = true;
        w.tokens += 1;
        w.score += 30 * Math.max(1, w.combo);
        sfxStar();
        burst(w, it.x, it.y, '#FFD23F', 9);
      }
    }

    /* The weather rises the whole time and gets faster, and it is never
       allowed to fall a long way behind — a climber who is quick still
       has it in the corner of their eye. */
    w.riseSpeed += 1.6 * dt;
    w.risingY -= w.riseSpeed * dt;
    w.risingY = Math.min(w.risingY, w.y + VH * 0.95);

    if (w.y > w.risingY) {
      return lose(w, now, ar
        ? (chapter.rising.labelAr + ' لحقتك!')
        : (chapter.rising.label + ' caught you!'));
    }

    // particles
    for (let i = w.particles.length - 1; i >= 0; i--) {
      const p = w.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 380 * dt;
      p.life -= dt * 1.7;
      if (p.life <= 0) w.particles.splice(i, 1);
    }

    // publish to React only when a number actually changed
    if (w.topFloor !== floorsRef.current) { floorsRef.current = w.topFloor; setFloors(w.topFloor); }
    if (w.tokens !== tokensRef.current) { tokensRef.current = w.tokens; setTokens(w.tokens); }
    if (w.combo !== comboRef.current) { comboRef.current = w.combo; setCombo(w.combo); }
    if (w.score !== scoreRef.current) { scoreRef.current = w.score; setScore(w.score); }

    // cleared it?
    const g = chapter.goal;
    const done = g.kind === 'floors' ? w.topFloor >= g.value
      : g.kind === 'tokens' ? w.tokens >= g.value
      : w.maxCombo >= g.value;
    if (done) win(w.score);
    else if (w.topFloor >= FLOORS - 1) win(w.score);
  };

  stepRef.current = step;
  dnaRef.current = myDna;

  const keepBest = (total) => {
    setBest((b) => { if (total > b) { saveInt(BEST_KEY, total); return total; } return b; });
  };

  const lose = (w, now, line) => {
    if (phaseRef.current !== 'playing') return;
    w.shakeUntil = now + 320;
    setEndLine(line);
    setP('lost');
    tapLight(); sfxPop();
    const total = scoreRef.current;
    if (user && total > 0) submitScore(user.id, 'tower', total).catch(() => {});
    keepBest(total);
  };

  const win = (total) => {
    if (phaseRef.current !== 'playing') return;
    setP('card');
    setEndLine('');
    tapSuccess(); sfxSuccess();
    if (user && total > 0) submitScore(user.id, 'tower', total).catch(() => {});
    keepBest(total);
    saveCard(chapter.place.id);
    setCards(loadCards());
    if (chapterIdx >= unlocked && chapterIdx + 1 < CHAPTERS.length) {
      setUnlocked(chapterIdx + 1);
      saveInt(PROGRESS_KEY, chapterIdx + 1);
    }
  };

  const startRun = () => {
    buildWorld();
    floorsRef.current = 0; tokensRef.current = 0; comboRef.current = 0; scoreRef.current = 0;
    setFloors(0); setTokens(0); setCombo(0); setScore(0); setEndLine('');
    if (world.current) world.current.startedAt = performance.now();
    setP('playing');
    tapMedium(); sfxPop();
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const place = chapter.place;
  const g = chapter.goal;
  const goalNow = g.kind === 'floors' ? floors : g.kind === 'tokens' ? tokens : combo;
  const goalPct = Math.max(0, Math.min(1, goalNow / g.value));

  const T = {
    play: ar ? 'يلا نطلع ▲' : 'START THE CLIMB ▲',
    again: ar ? 'تاني ↻' : 'Climb again ↻',
    next: ar ? 'المكان اللي بعده →' : 'Next place →',
    board: ar ? '🏆 الترتيب العالمي' : '🏆 Global leaderboard',
    places: ar ? 'الأماكن' : 'Places',
    best: ar ? 'أعلى' : 'Best',
    exit: ar ? 'خروج' : 'Exit',
    goal: ar ? 'التحدي' : 'Challenge',
    how: ar ? 'امسك بصباعك فين ما تحب تروح · بينط لوحده لما ينزل · السرعة = نطة أعلى'
      : 'Hold where you want to go · he bounces on landing · speed = a higher bounce',
    card: ar ? 'كارت المكان' : 'Culture card',
    fact: ar ? 'حاجة تستاهل تتعرف' : 'Worth knowing',
    custom: ar ? 'عادة من هناك' : 'A custom from there',
    got: ar ? 'كسبت الكارت' : 'Card earned',
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: place.deep }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FF2E88', fontSize: 14, fontWeight: '900', letterSpacing: 2 }}>THE CLIMB</Text>
            <Text style={{ color: place.accent, fontSize: 11, marginTop: 2, fontWeight: '700' }}>
              {place.flag} {ar ? place.cityAr : place.city} · {ar ? place.siteAr : place.site}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800' }}>SCORE</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        {/* the tower */}
        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: place.deep, borderWidth: 1, borderColor: 'rgba(255,46,136,0.35)' }}>
          <View ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          {Platform.OS !== 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>The Climb runs in the browser 🧗</Text>
            </View>
          ) : null}

          {/* live HUD */}
          {phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginRight: 7 }}>
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>▲ {floors}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>✦ {tokens}</Text>
                </View>
                <View style={{ flex: 1 }} />
                {combo >= 2 ? (
                  <View style={{ backgroundColor: 'rgba(255,210,63,0.9)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                    <Text style={{ color: '#2A1A00', fontSize: 11.5, fontWeight: '900' }}>COMBO ×{combo}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, height: 7, overflow: 'hidden' }}>
                <View style={{ width: goalPct * 100 + '%', height: '100%', backgroundColor: place.accent }} />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', marginTop: 4 }}>
                {goalText(chapter, ar)}
              </Text>
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
                {ar ? 'المكان' : 'PLACE'} {chapterIdx + 1} / {CHAPTERS.length}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
                {place.flag} {ar ? place.siteAr : place.site}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, textAlign: 'center', marginTop: 3 }}>
                {ar ? place.cityAr + ' · ' + place.countryAr : place.city + ' · ' + place.country}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 22, textAlign: 'center', marginTop: 14 }}>
                {ar ? place.factAr : place.fact}
              </Text>

              <View style={{ alignSelf: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{T.goal.toUpperCase()}</Text>
                <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900', marginTop: 3 }}>{goalText(chapter, ar)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5, marginTop: 4 }}>
                  {(ar ? 'اللي طالع من تحتك: ' : 'Rising underneath you: ') + (ar ? chapter.rising.labelAr : chapter.rising.label)}
                </Text>
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
                <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('tower').then(setBoard).catch(() => setBoard([])); }} style={{ marginHorizontal: 8 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{T.board}</Text>
                  </View>
                </Pressable>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, textAlign: 'center', marginTop: 12 }}>{T.best}: {best}</Text>
            </ScrollView>
          ) : null}

          {/* ── the places ── */}
          {phase === 'picker' ? (
            <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 34 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,6,20,0.95)' }}>
              <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>🗺️ {T.places}</Text>
              {CHAPTERS.map((ch, i) => {
                const lock = i > unlocked;
                const has = cards.indexOf(ch.place.id) >= 0;
                return (
                  <Pressable
                    key={ch.id}
                    onPress={() => { if (lock) return; tapLight(); setChapterIdx(i); setP('story'); }}
                    style={{ opacity: lock ? 0.45 : 1, marginBottom: 10 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: i === chapterIdx ? '#FF2E88' : 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 13 }}>
                      <Text style={{ fontSize: 26, marginRight: 12 }}>{ch.place.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{ar ? ch.place.siteAr : ch.place.site}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 2 }}>{goalText(ch, ar)}</Text>
                      </View>
                      {has ? <Text style={{ fontSize: 15, marginRight: 8 }}>🎴</Text> : null}
                      {lock ? <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.6)" /> : <Ionicons name="play" size={16} color={ch.place.accent} />}
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => { tapLight(); setP('story'); }} style={{ alignSelf: 'center', marginTop: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800' }}>{ar ? 'رجوع' : 'Back'}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {/* ── the reward: the culture card ── */}
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
                {score} {ar ? 'نقطة' : 'points'} · ▲ {floors} · ✦ {tokens}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pressable onPress={startRun} style={{ margin: 5 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{T.again}</Text>
                  </View>
                </Pressable>
                {chapterIdx + 1 < CHAPTERS.length ? (
                  <Pressable onPress={() => { tapLight(); setChapterIdx(chapterIdx + 1); setP('story'); }} style={{ margin: 5 }}>
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

          {/* ── caught ── */}
          {phase === 'lost' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,6,20,0.88)', padding: 26 }}>
              <Text style={{ fontSize: 50 }}>🌊</Text>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{endLine}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13.5, marginTop: 8 }}>
                {score} {ar ? 'نقطة' : 'points'} · ▲ {floors} · ✦ {tokens}
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

          {/* leaderboard */}
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
