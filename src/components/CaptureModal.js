import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, Image, TextInput, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../constants/theme';
import { SOUNDS, ME, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../services/posts';
import { createStory } from '../services/stories';
import { uploadCapture, uploadMedia } from '../services/social';
import { compressImage } from '../lib/storage';
import { fetchTracks, incrementTrackUse } from '../services/music';
import { MusicHubSheet } from './MusicHubSheet';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* ─── THE CAPTURE SCREEN — easier than IG, TikTok and Snap combined ───
   One tap opens a LIVE viewfinder. Tap the shutter for a photo, hold it
   to record video (Snapchat-style), release to stop. Pick a sound from
   the rail at the bottom while you shoot (TikTok-style). Preview,
   caption, share — three taps total from feed to posted.

   Web: real camera via getUserMedia + MediaRecorder.
   Native: one tap into the system camera (expo-image-picker); the
   in-app viewfinder arrives with the expo-camera build. */

const MAX_VIDEO_MS = 30000;

/* Real filters — each is a CSS filter string applied LIVE in the
   viewfinder/preview and, for photos, actually BAKED into the pixels of
   the file we upload (not just a cosmetic overlay). */
const FILTERS = [
  { id: 'none',  label: 'Original', emoji: '🎞️', css: '' },
  { id: 'vivid', label: 'Vivid',    emoji: '🌈', css: 'saturate(1.55) contrast(1.08)' },
  { id: 'warm',  label: 'Warm',     emoji: '🌅', css: 'saturate(1.3) sepia(0.18) brightness(1.05)' },
  { id: 'cool',  label: 'Cool',     emoji: '❄️', css: 'saturate(1.2) hue-rotate(-14deg) brightness(1.03)' },
  { id: 'retro', label: 'Retro',    emoji: '📻', css: 'sepia(0.5) contrast(1.1) saturate(1.25)' },
  { id: 'bw',    label: 'B&W',      emoji: '🖤', css: 'grayscale(1) contrast(1.12)' },
  { id: 'dream', label: 'Dream',    emoji: '💭', css: 'saturate(1.3) brightness(1.12) blur(0.5px)' },
  { id: 'noir',  label: 'Noir',     emoji: '🎥', css: 'grayscale(1) brightness(0.9) contrast(1.4)' },
];

/* EFFECTS — original overlays we draw ourselves (previewed live and
   really BAKED into the photo's pixels on share). */
const EFFECTS = [
  { id: 'none',     label: 'Clean',    emoji: '⬜' },
  { id: 'leak',     label: 'Light leak', emoji: '🌞' },
  { id: 'vignette', label: 'Vignette', emoji: '🕳️' },
  { id: 'grain',    label: 'Grain',    emoji: '🎞️' },
  { id: 'hearts',   label: 'Hearts',   emoji: '💕' },
  { id: 'confetti', label: 'Confetti', emoji: '🎉' },
  { id: 'snow',     label: 'Snow',     emoji: '❄️' },
  { id: 'stars',    label: 'Stars',    emoji: '✨' },
];
const EFFECT_PARTICLES = { hearts: ['💖', '💕', '💗'], confetti: ['🎉', '🎊', '🟣', '🟡'], snow: ['❄️', '✻', '•'], stars: ['✨', '⭐', '✦'] };

/* GAME FILTERS — our own take on Snapchat's filter games: a roulette
   that lands on a random answer, and a question card that dares you to
   answer. All original questions; the result is baked onto the photo. */
const ROULETTE = ['😎 Legend', '🐢 Slow but sure', '🔥 On fire', '🧠 Big brain', '😴 Sleepy king', '🦁 Fearless', '🤡 Class clown', '🌟 Main character', '🍀 Lucky one', '🌪️ Chaos engine'];
const QUESTIONS = [
  'Describe today in one word 👇',
  'Who should text you first? 👀',
  'Your 3am snack of choice?',
  'One place you\'d teleport to right now 🌍',
  'The song stuck in your head 🎵',
  'Truth: last thing that made you laugh?',
  'Your superpower for 24 hours?',
  'Rate your day /10 — be honest',
  'Who do you miss right now? ❤️',
  'Your dream road-trip partner?',
];

/* ── REEL GAMES — TikTok-style randomiser filters, all original ──────
   Pick a game in the viewfinder; each row spins like a slot machine and
   locks on a random result. Because we composite the camera + overlay
   onto a canvas and record THAT, the reveal is really baked into the
   reel's pixels — not a fake preview. */
const REEL_GAMES = [
  { id: 'love', title: 'Your Next Relationship', emoji: '💘', rows: [
    { label: 'Type', pool: ['Soulmate', 'Slow burn', 'Situationship', 'Whirlwind', 'Friends-first', 'Long distance', 'Second chance'] },
    { label: 'Their vibe', pool: ['Chaotic good', 'Golden retriever', 'Mysterious', 'Power couple', 'Comfort person', 'All jokes', 'Soft & shy'] },
    { label: 'You meet', pool: ['At a café', 'At the gym', 'At a wedding', 'Online', 'Through friends', 'Abroad', 'In a coffee line'] },
    { label: 'When', pool: ['in 3 weeks', 'this summer', 'in 2 months', 'next year', 'when you stop looking'] },
  ] },
  { id: 'era', title: 'Your 2026 Era', emoji: '✨', rows: [
    { label: 'Era', pool: ['Main character', 'Soft life', 'Villain', 'Glow-up', 'Healing', 'Hustle', 'Rockstar'] },
    { label: 'Energy', pool: ['Unbothered', 'Magnetic', 'Feral', 'Zen', 'Bold', 'Golden'] },
    { label: 'Anthem', pool: ['a summer banger', 'a slow ballad', 'pure hype', 'lo-fi calm', 'an underdog track'] },
    { label: 'Lucky month', pool: ['March', 'June', 'September', 'December', 'February', 'August'] },
  ] },
  { id: 'villain', title: 'Your Villain Origin', emoji: '😈', rows: [
    { label: 'They said', pool: ['"You changed"', '"Calm down"', '"It\'s not deep"', '"You\'re too much"', '"Be realistic"', '"Maybe later"'] },
    { label: 'Your power', pool: ['Cold silence', 'The read of the year', 'Zero replies', 'Petty genius', 'Unbothered aura'] },
    { label: 'Signature move', pool: ['Leaving on read', 'The slow blink', 'Screenshot & save', 'Ghost & glow', 'The receipts'] },
  ] },
  { id: 'famous', title: 'If You Were Famous', emoji: '🎬', rows: [
    { label: 'Famous for', pool: ['A viral dance', 'Saving the day', 'A hit song', 'A wild interview', 'Being iconic', 'One legendary post'] },
    { label: 'Fanbase', pool: ['10M', '40M', 'a cult classic', 'the whole internet', '3 loyal legends'] },
    { label: 'Scandal', pool: ['None, you\'re perfect', 'A pizza topping take', 'Napping on set', 'Being too nice', 'Secret talent leaked'] },
    { label: 'Net worth', pool: ['$2M', '$50M', '$900', 'a yacht', 'emotional damage'] },
  ] },
  { id: 'stats', title: 'Main Character Stats', emoji: '🌟', rows: [
    { label: 'Charisma', pool: ['62', '78', '88', '94', '99', '100', '47'] },
    { label: 'Chaos', pool: ['12', '44', '67', '83', '95', '100'] },
    { label: 'Luck', pool: ['30', '55', '70', '85', '99'] },
    { label: 'Rizz', pool: ['low-key', 'mid', 'elite', 'godtier', 'unmatched', 'still loading'] },
  ] },
  { id: 'truth', title: 'Truth Bomb', emoji: '💣', rows: [
    { label: '', pool: [
      'You act tough but you\'re the softest 🧸',
      'Your comeback era is loading ⏳',
      'You\'re someone\'s favourite person 💛',
      'You overthink texts for 20 mins 📱',
      'You\'d survive a horror movie tbh 🔪',
      'You give great advice — take some 🫶',
      'A big yes is coming your way 🍀',
    ] },
  ] },
  { id: 'trip', title: 'Your Next Trip', emoji: '✈️', rows: [
    { label: 'Destination', pool: ['Tokyo', 'The Maldives', 'a road trip', 'Cairo nights', 'the Alps', 'a beach town', 'somewhere new'] },
    { label: 'With', pool: ['your best friend', 'solo & free', 'the whole crew', 'a surprise +1', 'family'] },
    { label: 'Vibe', pool: ['pure chaos', 'soft & slow', 'adventure', 'luxury', 'budget legends'] },
    { label: 'When', pool: ['this summer', 'next month', 'in the winter', 'sooner than you think'] },
  ] },
  { id: 'aura', title: 'Read My Aura', emoji: '🔮', rows: [
    { label: 'Colour', pool: ['Electric violet', 'Warm gold', 'Ocean blue', 'Rose pink', 'Deep green', 'Silver'] },
    { label: 'Energy', pool: ['Calm storm', 'Bright fire', 'Quiet strength', 'Wild spark', 'Gentle wave'] },
    { label: 'Spirit animal', pool: ['a wolf', 'a cat', 'an owl', 'a dolphin', 'a lion', 'a fox'] },
  ] },
  { id: 'compliment', title: 'Compliment Generator', emoji: '🌈', rows: [
    { label: '', pool: [
      'Your smile fixes bad days ☀️',
      'You\'re effortlessly cool 😎',
      'People feel safe around you 🫶',
      'You\'re smarter than you admit 🧠',
      'Your energy is contagious ⚡',
      'You make ordinary days fun 🎈',
    ] },
  ] },
];

// slot-machine timing (ms): each row locks in sequence
const REEL_LOCK_MS = 520, REEL_STEP_MS = 430, REEL_TAIL_MS = 340;
const reelTotal = (n) => REEL_LOCK_MS + n * REEL_STEP_MS + REEL_TAIL_MS;
const reelLockAt = (i) => REEL_LOCK_MS + i * REEL_STEP_MS;
/* One cell's current display: the final result once locked, else a fast
   cycle through the pool (elapsed=null ⇒ final/static). */
function reelCell(row, i, elapsed) {
  if (elapsed == null || elapsed >= reelLockAt(i)) return { text: row.result, locked: true };
  const pool = row.pool && row.pool.length ? row.pool : [row.result];
  return { text: pool[(Math.floor(elapsed / 60) + i * 3) % pool.length], locked: false };
}
const reelIsSingle = (g) => g && g.rows.length === 1 && !g.rows[0].label;

/* ── Canvas drawers (shared by photo-bake AND the video compositor) ── */
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawEffectsCanvas(ctx, w, h, effectId, particles) {
  if (effectId === 'vignette') {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (effectId === 'leak') {
    let g = ctx.createLinearGradient(0, 0, w * 0.7, h * 0.5);
    g.addColorStop(0, 'rgba(255,150,50,0.38)'); g.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createLinearGradient(w, h * 0.2, w * 0.4, h);
    g.addColorStop(0, 'rgba(255,80,120,0.28)'); g.addColorStop(1, 'rgba(255,80,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (effectId === 'grain') {
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (Math.random() * 0.09).toFixed(3) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  } else if (particles) {
    particles.forEach((p) => {
      ctx.font = Math.round(p.s * w * 0.055) + 'px sans-serif';
      ctx.fillText(p.c, p.x * w * 0.94, p.y * h * 0.94 + 20);
    });
  }
}
function drawSimpleCardCanvas(ctx, w, h, gameCard) {
  const fs = Math.round(w * 0.045);
  ctx.font = '700 ' + fs + 'px sans-serif';
  const label = (gameCard.kind === 'roulette' ? '🎲 ' : '❓ ') + gameCard.text;
  const tw = ctx.measureText(label).width;
  const pad = fs * 0.8;
  const bw = Math.min(w * 0.92, tw + pad * 2);
  const bx = (w - bw) / 2, by = h * 0.07, bh = fs * 2.1;
  ctx.fillStyle = 'rgba(10,6,25,0.72)';
  roundRectPath(ctx, bx, by, bw, bh, fs); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, by + bh / 2, bw - pad);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '); const lines = []; let line = '';
  words.forEach((word) => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}
function drawReelCardCanvas(ctx, w, h, game, elapsed) {
  const s = w / 1080;
  const single = reelIsSingle(game);
  const titleFs = Math.round(46 * s), rowFs = Math.round(40 * s), labelFs = Math.round(31 * s);
  const pad = Math.round(34 * s), rowH = Math.round(62 * s), gap = Math.round(20 * s);
  const panelW = Math.min(w * 0.9, Math.round(780 * s));
  const innerW = panelW - pad * 2;
  ctx.textBaseline = 'alphabetic';
  let bodyLines = [];
  if (single) { ctx.font = '800 ' + rowFs + 'px sans-serif'; bodyLines = wrapLines(ctx, game.rows[0].result, innerW); }
  const bodyH = single ? bodyLines.length * Math.round(rowFs * 1.28) : game.rows.length * rowH;
  const headerH = titleFs + gap;
  const panelH = pad * 2 + headerH + bodyH;
  const bx = (w - panelW) / 2, by = Math.round(h * 0.075);
  // panel
  ctx.fillStyle = 'rgba(12,8,28,0.82)';
  roundRectPath(ctx, bx, by, panelW, panelH, Math.round(30 * s)); ctx.fill();
  ctx.strokeStyle = 'rgba(245,179,1,0.55)'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
  // title
  ctx.fillStyle = '#FFD75E'; ctx.textAlign = 'center'; ctx.font = '900 ' + titleFs + 'px sans-serif';
  ctx.fillText(game.emoji + '  ' + game.title, w / 2, by + pad + titleFs * 0.82, innerW);
  // body
  if (single) {
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.font = '800 ' + rowFs + 'px sans-serif';
    const lh = Math.round(rowFs * 1.28);
    bodyLines.forEach((ln, i) => ctx.fillText(ln, w / 2, by + pad + headerH + i * lh + rowFs * 0.85, innerW));
  } else {
    game.rows.forEach((row, i) => {
      const cell = reelCell(row, i, elapsed);
      const ry = by + pad + headerH + i * rowH + rowFs * 0.85;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.60)'; ctx.font = '700 ' + labelFs + 'px sans-serif';
      ctx.fillText(row.label, bx + pad, ry);
      const lw = ctx.measureText(row.label).width;
      ctx.textAlign = 'right'; ctx.fillStyle = cell.locked ? '#FFFFFF' : 'rgba(255,255,255,0.62)';
      ctx.font = '900 ' + rowFs + 'px sans-serif';
      ctx.fillText(cell.text, bx + panelW - pad, ry, innerW - lw - Math.round(16 * s));
    });
  }
  ctx.textAlign = 'start';
}

export const CaptureModal = ({ initialMode = 'story', onClose, onPosted, onPostedStory, sendMode = false, sendToName, onMoment }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'story' | 'reel'
  const [sound, setSound] = useState(null);
  const [facing, setFacing] = useState('user');
  const [camError, setCamError] = useState(null);
  const [shot, setShot] = useState(null); // { uri, kind: 'photo'|'video', ext, contentType }
  const [recording, setRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);

  // ── effects + game filters (previewed live, baked on share) ──
  const [effectId, setEffectId] = useState('none');
  const [gameCard, setGameCard] = useState(null); // { kind:'roulette'|'question', text }
  const particlesRef = useRef(null); // stable random layout per effect pick
  const rollGame = (kind) => {
    tapLight(); sfxPop();
    if (gameCard && gameCard.kind === kind) { setGameCard(null); return; }
    const text = kind === 'roulette'
      ? ROULETTE[Math.floor(Math.random() * ROULETTE.length)]
      : QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    setGameCard({ kind, text });
  };
  const pickEffect = (id) => {
    tapLight(); sfxPop();
    setEffectId(id);
    const chars = EFFECT_PARTICLES[id];
    particlesRef.current = chars
      ? Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.9, c: chars[Math.floor(Math.random() * chars.length)] }))
      : null;
  };

  // ── reel games (randomiser filters, baked into the reel) ──
  const [reelGame, setReelGame] = useState(null); // { id, title, emoji, rows:[{label,pool,result}] }
  const [reelSpin, setReelSpin] = useState(null);  // on-screen spin clock (ms) · null = final
  const reelTimer = useRef(null);
  const animateReelSpin = (n) => {
    clearInterval(reelTimer.current);
    const total = reelTotal(n), t0 = Date.now();
    setReelSpin(0);
    reelTimer.current = setInterval(() => {
      const e = Date.now() - t0;
      if (e >= total) { clearInterval(reelTimer.current); setReelSpin(null); }
      else setReelSpin(e);
    }, 50);
  };
  const pickReelGame = (g) => {
    tapMedium(); sfxPop();
    const rows = g.rows.map((r) => ({ label: r.label, pool: r.pool, result: r.pool[Math.floor(Math.random() * r.pool.length)] }));
    setReelGame({ id: g.id, title: g.title, emoji: g.emoji, rows });
    setGameCard(null); // one game overlay at a time
    animateReelSpin(rows.length);
  };
  const clearReelGame = () => { tapLight(); clearInterval(reelTimer.current); setReelSpin(null); setReelGame(null); };

  // ── real filters + light edit (brightness / contrast / warmth) ──
  const [filterId, setFilterId] = useState('none');
  const [bright, setBright] = useState(1);    // 0.7 … 1.3
  const [contrast, setContrast] = useState(1); // 0.7 … 1.3
  const [warmth, setWarmth] = useState(0);     // -20 … 20 (deg hue toward warm)
  const [editOpen, setEditOpen] = useState(false);
  const cssFilter = (() => {
    const base = (FILTERS.find((f) => f.id === filterId) || {}).css || '';
    const edits = [];
    if (bright !== 1) edits.push('brightness(' + bright.toFixed(2) + ')');
    if (contrast !== 1) edits.push('contrast(' + contrast.toFixed(2) + ')');
    if (warmth !== 0) edits.push('sepia(' + Math.min(0.6, Math.abs(warmth) / 40).toFixed(2) + ')' + (warmth < 0 ? ' hue-rotate(180deg)' : ''));
    return [base, ...edits].filter(Boolean).join(' ') || 'none';
  })();
  const [realTracks, setRealTracks] = useState([]); // real playable Hub tracks

  // story-only interactive stickers — poll or ask-a-question
  const [stickerType, setStickerType] = useState(null); // null | 'poll' | 'question'
  const [pollQ, setPollQ] = useState('');
  const [pollA, setPollA] = useState('');
  const [pollB, setPollB] = useState('');
  const [askQ, setAskQ] = useState('');

  // Real mode: the rail shows REAL tracks (playable audio_url from the
  // Indie Hub) — never made-up artist names.
  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchTracks()
      .then((rows) => setRealTracks((rows || []).slice(0, 10).map((t) => ({
        id: t.id, title: t.title, artist: t.artist || t.genre_shape || 'indie', emoji: t.cover_emoji || '🎵',
        audio_url: t.audio_url, attribution: t.attribution || null, license: t.license || null,
      }))))
      .catch(() => {});
  }, []);

  const railSounds = SUPABASE_READY
    ? [...realTracks, { id: 'orig', title: 'Original sound', artist: 'Your recording', emoji: '🎤' }]
    : SOUNDS;

  /* ── hear a sound BEFORE you post it: picking a track with a real
     audio file starts a live preview; unpicking (or leaving) stops it ── */
  const previewRef = useRef(null);
  const chooseSound = (s, wasOn) => {
    tapLight(); sfxPop();
    if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
    if (wasOn) { setSound(null); return; }
    setSound(s);
    if (isWeb && s && s.audio_url) {
      try {
        const a = new window.Audio(s.audio_url);
        a.loop = true; a.volume = 0.85;
        a.play().catch(() => {});
        previewRef.current = a;
      } catch (e) {}
    }
  };
  useEffect(() => () => { if (previewRef.current) previewRef.current.pause(); }, []);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const holdTimer = useRef(null);
  const recTimer = useRef(null);
  const heldRef = useRef(false);
  const compCanvasRef = useRef(null); // offscreen canvas for game/effect video compositing
  const rafRef = useRef(null);        // compositor animation frame

  const isWeb = Platform.OS === 'web';

  /* ── live viewfinder (web) ── */
  const startStream = async (face) => {
    if (!isWeb) return;
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        // Phone-camera quality: ask for full sensor resolution (up to 4K)
        // and let the browser give us the best it can.
        video: {
          facingMode: face || facing,
          // 1080×1920 — Instagram-grade. 4K frames looked identical on a
          // phone but cost 4-8x the storage and upload time.
          width: { ideal: 1080, max: 1920 },
          height: { ideal: 1920, max: 1920 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCamError(null);
    } catch (e) {
      setCamError('Allow camera access to shoot 🎥');
    }
  };

  useEffect(() => {
    if (isWeb && !shot) startStream();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(recTimer.current);
      clearTimeout(holdTimer.current);
      clearInterval(reelTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  const flip = () => {
    tapLight();
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startStream(next);
  };

  /* ── photo: freeze the current frame ── */
  const takePhoto = () => {
    if (!videoRef.current) return;
    tapMedium(); sfxPop();
    const v = videoRef.current;
    // 1600px longest side — indistinguishable on a phone, ~6x smaller files.
    const MAXL = 1600;
    let w = v.videoWidth || 1080;
    let h = v.videoHeight || 1920;
    const scale = Math.min(1, MAXL / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(v, 0, 0, w, h);
    setShot({ uri: canvas.toDataURL('image/jpeg', 0.85), kind: 'photo', ext: 'jpg', contentType: 'image/jpeg' });
  };

  /* ── video: hold to record, release to stop ── */
  const startRecording = () => {
    if (!streamRef.current) return;
    tapMedium(); sfxPop();
    chunksRef.current = [];
    try {
      // With a game/effect on, record a COMPOSITE canvas (camera + overlay
      // drawn every frame) so the game — and its slot-machine reveal — is
      // baked into the reel's real pixels. Falls back to the raw stream if
      // the browser can't capture a canvas stream.
      let recStream = streamRef.current;
      let composite = false;
      const overlayActive = isWeb && (!!reelGame || !!gameCard || effectId !== 'none');
      const v = videoRef.current;
      if (overlayActive && v && (v.videoWidth || 0) > 0) {
        const canvas = compCanvasRef.current || document.createElement('canvas');
        compCanvasRef.current = canvas;
        if (canvas.captureStream) {
          const w = (canvas.width = v.videoWidth), h = (canvas.height = v.videoHeight);
          const ctx = canvas.getContext('2d');
          const filter = cssFilter && cssFilter !== 'none' ? cssFilter : 'none';
          const eff = effectId, parts = particlesRef.current, gc = gameCard, rg = reelGame;
          const t0 = performance.now();
          const draw = () => {
            try {
              if ('filter' in ctx) ctx.filter = filter;
              ctx.drawImage(v, 0, 0, w, h);
              if ('filter' in ctx) ctx.filter = 'none';
              drawEffectsCanvas(ctx, w, h, eff, parts);
              if (rg) drawReelCardCanvas(ctx, w, h, rg, performance.now() - t0);
              else if (gc) drawSimpleCardCanvas(ctx, w, h, gc);
            } catch (e) {}
            rafRef.current = requestAnimationFrame(draw);
          };
          draw();
          const cstream = canvas.captureStream(30);
          streamRef.current.getAudioTracks().forEach((t) => { try { cstream.addTrack(t); } catch (e) {} });
          recStream = cstream;
          composite = true;
          if (rg) animateReelSpin(rg.rows.length); // re-run on-screen reveal to match
        }
      }
      const mime = window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      // ~4.5 Mbps at 1080p — Instagram-grade quality; a full 30s clip is
      // ~17MB, so uploads fly even on mobile data and storage lasts 3x.
      const opts = { videoBitsPerSecond: 4500000 };
      if (mime) opts.mimeType = mime;
      const rec = new MediaRecorder(recStream, opts);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        // iPhone fix: Safari records video/mp4, NOT webm. Labelling the
        // blob with the recorder's REAL type (instead of hardcoding webm)
        // is what makes the preview play and the upload succeed on iOS.
        const actual = ((rec.mimeType || mime || 'video/mp4').split(';')[0]) || 'video/mp4';
        const ext = /mp4/.test(actual) ? 'mp4' : /quicktime/.test(actual) ? 'mov' : 'webm';
        const blob = new Blob(chunksRef.current, { type: actual });
        // the reel already carries the game in its pixels — don't re-bake
        setShot({ uri: URL.createObjectURL(blob), kind: 'video', ext, contentType: actual, baked: composite });
      };
      rec.start();
      setRecording(true);
      setRecMs(0);
      recTimer.current = setInterval(() => {
        setRecMs((ms) => {
          if (ms + 100 >= MAX_VIDEO_MS) stopRecording();
          return ms + 100;
        });
      }, 100);
    } catch (e) {
      setCamError('Video recording is not supported in this browser');
    }
  };

  const stopRecording = () => {
    clearInterval(recTimer.current);
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  /* ── the shutter: tap = photo, hold = video ── */
  const onShutterDown = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => { heldRef.current = true; startRecording(); }, 260);
  };
  const onShutterUp = () => {
    clearTimeout(holdTimer.current);
    if (heldRef.current) stopRecording();
    else takePhoto();
  };

  /* ── gallery: upload a photo or video from your library into a
     story/reel — with the full sound rail available in preview ── */
  const pickFromLibrary = async () => {
    try {
      // 9:16 crop for photos (native only — ignored for video and on web,
      // where no crop UI exists) so a gallery upload matches the story/reel shape
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsEditing: true, aspect: [9, 16] });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        const isVid = (a.type || '').startsWith('video') || /^video\//.test(a.mimeType || '');
        if (isVid && !(await videoFits(a.uri))) return; // too big → clear message, not 'Load failed'
        const mime = a.mimeType || (isVid ? 'video/mp4' : 'image/jpeg');
        const ext = (mime.split('/')[1] || (isVid ? 'mp4' : 'jpg')).replace('jpeg', 'jpg');
        setShot({ uri: a.uri, kind: isVid ? 'video' : 'photo', ext, contentType: mime });
      }
    } catch (e) { setCamError('Could not open your gallery'); }
  };

  /* A phone-gallery video can easily be 100-300MB (a 90s iPhone clip is) —
     way past the 50MB upload cap. Check the size the moment it's picked
     and say so plainly, instead of letting the upload die with Safari's
     cryptic 'Load failed'. */
  const videoFits = async (uri) => {
    if (!isWeb) return true;
    try {
      const blob = await (await fetch(uri)).blob();
      if (blob.size > 48 * 1024 * 1024) {
        setCamError('That video is ' + Math.round(blob.size / 1024 / 1024) + 'MB — the limit is ~45MB (about 30–40s of phone video). Trim it shorter and try again ✂️');
        return false;
      }
      return true;
    } catch (e) { return true; } // can't measure → let the upload try
  };

  /* ── long-form video: pick an existing file (works on web + native) ── */
  const pickVideoFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 900 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        if (!(await videoFits(a.uri))) return;
        const raw = (a.fileName || a.uri || 'video.mp4').split('?')[0];
        const ext = (raw.split('.').pop() || 'mp4').toLowerCase();
        setShot({ uri: a.uri, kind: 'video', ext: ext || 'mp4', contentType: a.mimeType || ('video/' + (ext || 'mp4')) });
      }
    } catch (e) { setCamError('Could not open your videos'); }
  };

  /* ── native: one tap into the system camera ── */
  const nativeShoot = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setCamError('Camera permission needed 🎥'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1, videoMaxDuration: 30, videoQuality: ImagePicker.UIImagePickerControllerQualityType && ImagePicker.UIImagePickerControllerQualityType.High });
    if (!result.canceled && result.assets && result.assets[0]) {
      const a = result.assets[0];
      const isVid = (a.type || '').startsWith('video');
      setShot({ uri: a.uri, kind: isVid ? 'video' : 'photo', ext: isVid ? 'mp4' : 'jpg', contentType: isVid ? 'video/mp4' : 'image/jpeg' });
    }
  };

  /* Bake the chosen filter into a photo's actual pixels (web) so the
     uploaded file really carries the look — honest, not a preview trick.
     Videos can't be re-encoded here, so their filter stays live-preview
     only and we upload the original. */
  const bakeFilter = (uri, filter) => new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.filter = filter;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) { resolve(uri); }
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    } catch (e) { resolve(uri); }
  });

  /* Bake filter + effects + game card into the photo in one pass —
     what you see in the preview is literally what gets uploaded. */
  const bakeAll = (uri) => new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = (canvas.width = img.naturalWidth || img.width);
          const h = (canvas.height = img.naturalHeight || img.height);
          const ctx = canvas.getContext('2d');
          ctx.filter = cssFilter && cssFilter !== 'none' ? cssFilter : 'none';
          ctx.drawImage(img, 0, 0, w, h);
          ctx.filter = 'none';
          drawEffectsCanvas(ctx, w, h, effectId, particlesRef.current);
          if (reelGame) drawReelCardCanvas(ctx, w, h, reelGame, null); // final result
          else if (gameCard) drawSimpleCardCanvas(ctx, w, h, gameCard);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) { resolve(uri); }
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    } catch (e) { resolve(uri); }
  });

  /* ── share ── */
  const share = async () => {
    if (!shot || busy) return;
    setBusy(true);
    // bake the look into the photo's real pixels before uploading
    let workingShot = shot;
    const needsBake = (cssFilter && cssFilter !== 'none') || effectId !== 'none' || !!gameCard || !!reelGame;
    if (isWeb && shot.kind === 'photo' && needsBake) {
      const baked = await bakeAll(shot.uri);
      workingShot = { ...shot, uri: baked, ext: 'jpg', contentType: 'image/jpeg' };
    } else if (isWeb && shot.kind === 'photo') {
      // gallery pictures arrive full-resolution — shrink to feed size
      // (invisible on a phone, ~6x fewer bytes stored & downloaded)
      const small = await compressImage(shot.uri, 1600, 0.85);
      workingShot = { ...shot, uri: small, ext: 'jpg', contentType: 'image/jpeg' };
    }
    try {
      // ── Moment mode: send the snap straight into a chat ──
      if (sendMode) {
        let mediaUrl = workingShot.uri;
        if (SUPABASE_READY && user) {
          mediaUrl = isWeb
            ? await uploadCapture(user.id, workingShot.uri, workingShot.ext, workingShot.contentType)
            : await uploadMedia(user.id, workingShot.uri);
        }
        onMoment && (await onMoment({
          mediaUrl,
          mediaKind: workingShot.kind === 'video' ? 'video' : 'photo',
          caption: caption.trim(),
          sound,
        }));
        tapSuccess(); sfxSuccess();
        onClose();
        return;
      }
      if (SUPABASE_READY && user) {
        const mediaUrl = isWeb
          ? await uploadCapture(user.id, workingShot.uri, workingShot.ext, workingShot.contentType)
          : await uploadMedia(user.id, workingShot.uri);
        if (mode === 'story') {
          const sticker = stickerType === 'poll' && pollQ.trim() && pollA.trim() && pollB.trim()
            ? { type: 'poll', data: { question: pollQ.trim(), options: [pollA.trim(), pollB.trim()] } }
            : stickerType === 'question' && askQ.trim()
            ? { type: 'question', data: { question: askQ.trim() } }
            : null;
          const row = await createStory(user.id, { mediaUrl, caption: caption.trim(), sound, sticker });
          if (sound && sound.audio_url) incrementTrackUse(sound.id);
          onPostedStory && onPostedStory({
            id: row.id, createdAt: row.created_at,
            user: { id: user.id, name: 'You', avatar: AV_NEUTRAL }, media: mediaUrl, sound, caption: caption.trim() || null,
            stickerType: sticker && sticker.type, stickerData: sticker && sticker.data,
          });
        } else if (mode === 'video') {
          const row = await createPost({ userId: user.id, type: 'vod', caption: caption.trim() || '🎬 Video', mediaUrl });
          onPosted && onPosted(row);
        } else {
          const row = await createPost({ userId: user.id, type: 'reel', caption: caption.trim() || '🎬', mediaUrl, sound });
          if (sound && sound.audio_url) incrementTrackUse(sound.id);
          onPosted && onPosted({
            id: row.id,
            user: { name: (row.user && row.user.name) || 'You', avatar: (row.user && row.user.avatar_url) || AV_NEUTRAL, verified: !!(row.user && row.user.verified) },
            type: 'reel', media: row.media_url, caption: row.caption,
            place: 'Right here', startsIn: 'Live now', coords: ME.coords,
            sound, vibes: 0, comments: 0, squad: 'New Vibe Squad',
          });
        }
      } else {
        // demo mode — local only
        if (mode === 'story') onPostedStory && onPostedStory({ user: { id: 'me', name: 'You', avatar: AV_NEUTRAL }, media: workingShot.uri, sound, caption: caption.trim() || null });
        else if (mode === 'video') onPosted && onPosted({ id: 'local-' + Date.now(), type: 'vod', media_url: workingShot.uri, caption: caption.trim() || '🎬 Video', user: { name: 'You', avatar_url: AV_NEUTRAL } });
        else onPosted && onPosted({ id: 'local-' + Date.now(), user: { name: 'You', avatar: AV_NEUTRAL, verified: false }, type: 'reel', media: workingShot.uri, caption: caption.trim() || '🎬', place: 'Right here', startsIn: 'Live now', coords: ME.coords, sound, vibes: 0, comments: 0, squad: 'New Vibe Squad' });
      }
      tapSuccess(); sfxSuccess();
      onClose();
    } catch (e) {
      // say WHY it failed — "failed" alone helps nobody
      const m = (e && e.message) || '';
      setCamError(
        /bucket/i.test(m)
          ? 'One step left: run the latest supabase/RUN_ME.sql — it creates the media storage bucket uploads need.'
          : /too large|exceed|maximum size|413/i.test(m)
          ? 'That video is too big — try a shorter clip (under ~45MB).'
          : /row-level security|policy|permission/i.test(m)
          ? 'Upload blocked by storage permissions — run the latest supabase/RUN_ME.sql to fix the media policies.'
          : /load failed|failed to fetch|network/i.test(m)
          ? 'The upload didn\'t reach the server — check your connection and tap share again (large videos need a steady signal).'
          : (m || 'Could not share — check your connection and try again')
      );
    } finally {
      setBusy(false);
    }
  };

  const recPct = Math.min(1, recMs / MAX_VIDEO_MS);

  /* TikTok-style sound rail — shown while shooting AND on the preview,
     so an uploaded gallery photo can get a song too. */
  const soundRail = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, marginBottom: 16 }}>
      <Pressable onPress={() => { tapLight(); setHubOpen(true); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,58,237,0.9)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 }}>
          <Text style={{ fontSize: 13 }}>🎧</Text>
          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginLeft: 5 }}>Music Hub</Text>
        </View>
      </Pressable>
      {railSounds.map((s) => {
        const on = sound && sound.id === s.id;
        return (
          <Pressable key={s.id} onPress={() => chooseSound(s, on)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 }}>
              <Text style={{ fontSize: 13 }}>{s.emoji}</Text>
              <Text style={{ color: on ? C.text : '#FFF', fontSize: 11.5, fontWeight: '800', marginLeft: 5 }} numberOfLines={1}>
                {s.title}
              </Text>
              {on ? <Ionicons name="checkmark" size={13} color={C.purple} style={{ marginLeft: 4 }} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* ── viewfinder / preview ── */}
        {shot ? (
          shot.kind === 'video' && isWeb ? (
            /* muted is required for iOS to autoplay the preview at all —
               without it Safari shows a black frame */
            <video src={shot.uri} autoPlay muted loop playsInline style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter }} />
          ) : isWeb ? (
            // raw <img> so the chosen filter shows LIVE in the preview
            <img src={shot.uri} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter }} alt="" />
          ) : (
            <Image source={{ uri: shot.uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          )
        ) : isWeb ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Pressable onPress={nativeShoot}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera" size={38} color="#FFF" />
                </View>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 12 }}>Tap to shoot</Text>
              </View>
            </Pressable>
            <Pressable onPress={pickFromLibrary} style={{ marginTop: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Ionicons name="images-outline" size={17} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', marginLeft: 7 }}>Upload from gallery</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* ── live preview of effects + game card (baked on share) ── */}
        {shot ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
            {effectId === 'vignette' && isWeb ? (
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 46%, rgba(0,0,0,0.55) 100%)' }} />
            ) : null}
            {effectId === 'leak' && isWeb ? (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,150,50,0.38) 0%, transparent 45%), linear-gradient(295deg, rgba(255,80,120,0.28) 0%, transparent 40%)' }} />
            ) : null}
            {effectId === 'grain' && isWeb ? (
              <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'repeating-radial-gradient(circle at 17% 32%, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px)' }} />
            ) : null}
            {particlesRef.current ? particlesRef.current.map((p, i) => (
              <Text key={i} style={{ position: 'absolute', left: (p.x * 94) + '%', top: (p.y * 94) + '%', fontSize: 14 + p.s * 14 }}>{p.c}</Text>
            )) : null}
            {gameCard ? (
              <View style={{ position: 'absolute', top: '7%', left: 0, right: 0, alignItems: 'center' }}>
                <View style={{ backgroundColor: 'rgba(10,6,25,0.72)', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11, maxWidth: '92%' }}>
                  <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '800', textAlign: 'center' }}>
                    {(gameCard.kind === 'roulette' ? '🎲 ' : '❓ ') + gameCard.text}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* reel-game card — live in the viewfinder & photo preview; a
            recorded reel already carries it in its pixels, so don't double it */}
        {reelGame && !(shot && shot.kind === 'video') ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: '8%', left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(12,8,28,0.82)', borderColor: 'rgba(245,179,1,0.55)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '88%', minWidth: '60%' }}>
              <Text style={{ color: '#FFD75E', fontSize: 15.5, fontWeight: '900', textAlign: 'center', marginBottom: reelIsSingle(reelGame) ? 2 : 8 }}>
                {reelGame.emoji + '  ' + reelGame.title}
              </Text>
              {reelGame.rows.map((row, i) => {
                const cell = reelCell(row, i, reelSpin);
                return reelIsSingle(reelGame) ? (
                  <Text key={i} style={{ color: '#FFF', fontSize: 15, fontWeight: '800', textAlign: 'center' }}>{cell.text}</Text>
                ) : (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12.5, fontWeight: '700', marginRight: 16 }}>{row.label}</Text>
                    <Text style={{ color: cell.locked ? '#FFF' : 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '900', flexShrink: 1, textAlign: 'right' }}>{cell.text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* recording border */}
        {recording ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 4, borderColor: C.coral }} />
        ) : null}

        {/* ── top bar ── */}
        <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); shot ? setShot(null) : onClose(); }} hitSlop={10}>
            <Ionicons name={shot ? 'arrow-back' : 'close'} size={30} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1 }} />
          {recording ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.9)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginRight: 6 }} />
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{(recMs / 1000).toFixed(1)}s</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {!shot && isWeb ? (
            <Pressable onPress={flip} hitSlop={10}>
              <Ionicons name="camera-reverse-outline" size={28} color="#FFF" />
            </Pressable>
          ) : <View style={{ width: 28 }} />}
        </View>

        {camError ? (
          <View style={{ position: 'absolute', top: insets.top + 60, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>{camError}</Text>
          </View>
        ) : null}

        {/* ── bottom controls ── */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 16 }}>
          {!shot ? (
            <>
              {/* reel games — pick one, it plays live on your face, and the
                  slot-machine reveal bakes right into the reel you record */}
              {isWeb ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <MaterialCommunityIcons name="gamepad-variant" size={15} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginLeft: 4 }}>Games</Text>
                  </View>
                  {reelGame ? (
                    <Pressable onPress={clearReelGame}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                        <Ionicons name="close" size={13} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginLeft: 4 }}>None</Text>
                      </View>
                    </Pressable>
                  ) : null}
                  {REEL_GAMES.map((g) => {
                    const on = reelGame && reelGame.id === g.id;
                    return (
                      <Pressable key={g.id} onPress={() => pickReelGame(g)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.gold : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? C.gold : 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                          <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                          <Text style={{ color: on ? '#241146' : '#FFF', fontSize: 11.5, fontWeight: '900', marginLeft: 5 }}>{on ? 'Re-spin' : g.title}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {/* pick a sound while you shoot */}
              {soundRail}

              {/* shutter row — gallery upload on the left, shutter center */}
              {isWeb ? (
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={() => { tapLight(); pickFromLibrary(); }} hitSlop={8} style={{ marginRight: 34 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="images-outline" size={22} color="#FFF" />
                      </View>
                    </Pressable>
                    <Pressable onPressIn={onShutterDown} onPressOut={onShutterUp} disabled={!!camError}>
                      <View style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: recording ? C.coral : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: recording ? 34 : 62, height: recording ? 34 : 62, borderRadius: recording ? 9 : 31, backgroundColor: recording ? C.coral : '#FFF' }} />
                      </View>
                    </Pressable>
                    <View style={{ width: 46, marginLeft: 34 }} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', marginTop: 10 }}>
                    Tap for photo · hold for video · 🖼️ upload
                  </Text>
                  {recording ? (
                    <View style={{ height: 4, width: 160, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: 160 * recPct, backgroundColor: C.coral }} />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* long-form: upload a full video (YouTube-style) */}
              {mode === 'video' ? (
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <Pressable onPress={() => { tapLight(); pickVideoFile(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}>
                      <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', marginLeft: 8 }}>Upload a video 📁</Text>
                    </View>
                  </Pressable>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 8 }}>Long-form · or hold the shutter to record</Text>
                </View>
              ) : null}

              {/* mode switch — hidden when sending a Moment into a chat */}
              {sendMode ? (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.9)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14 }}>🔥</Text>
                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900', marginLeft: 6 }}>
                      Moment{sendToName ? ' → ' + sendToName : ''}
                    </Text>
                  </View>
                </View>
              ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                {['story', 'reel', 'video'].map((m) => (
                  <Pressable key={m} onPress={() => { tapLight(); setMode(m); }} style={{ marginHorizontal: 12 }}>
                    <Text style={{ color: mode === m ? '#FFF' : 'rgba(255,255,255,0.5)', fontSize: 13.5, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      {m === 'story' ? '⭕ Story' : m === 'reel' ? '🎬 Reel' : '📺 Video'}
                    </Text>
                    {mode === m ? <View style={{ height: 3, borderRadius: 2, backgroundColor: C.gold, marginTop: 5 }} /> : null}
                  </Pressable>
                ))}
              </View>
              )}
            </>
          ) : (
            /* ── preview: filters · light edit · song rail · caption ── */
            <View>
              {/* real filters — tap to try, baked into the photo on send */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, marginBottom: 10 }}>
                <Pressable onPress={() => { tapLight(); setEditOpen((v) => !v); }}>
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginRight: 10, width: 58 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: editOpen ? '#FFF' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="options-outline" size={20} color={editOpen ? C.purple : '#FFF'} />
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800', marginTop: 4 }}>Edit</Text>
                  </View>
                </Pressable>
                {FILTERS.map((f) => {
                  const on = filterId === f.id;
                  return (
                    <Pressable key={f.id} onPress={() => { tapLight(); sfxPop(); setFilterId(f.id); }}>
                      <View style={{ alignItems: 'center', marginRight: 10, width: 58 }}>
                        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.16)', borderWidth: on ? 2 : 1, borderColor: on ? C.gold : 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 20 }}>{f.emoji}</Text>
                        </View>
                        <Text style={{ color: on ? C.gold : '#FFF', fontSize: 10, fontWeight: on ? '900' : '800', marginTop: 4 }} numberOfLines={1}>{f.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* effects + game filters — spin the roulette, dare a question */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, marginBottom: 10 }}>
                {[{ k: 'roulette', label: 'Roulette', emoji: '🎲' }, { k: 'question', label: 'Dare Q', emoji: '❓' }].map((g) => {
                  const on = gameCard && gameCard.kind === g.k;
                  return (
                    <Pressable key={g.k} onPress={() => rollGame(g.k)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.gold : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? C.gold : 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                        <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                        <Text style={{ color: on ? '#241146' : '#FFF', fontSize: 11.5, fontWeight: '900', marginLeft: 5 }}>{on ? 'Re-spin' : g.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {EFFECTS.map((e) => {
                  const on = effectId === e.id;
                  return (
                    <Pressable key={e.id} onPress={() => pickEffect(e.id)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                        <Text style={{ fontSize: 14 }}>{e.emoji}</Text>
                        <Text style={{ color: on ? C.text : '#FFF', fontSize: 11.5, fontWeight: '800', marginLeft: 5 }}>{e.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* light edit — brightness · contrast · warmth (real, baked) */}
              {editOpen ? (
                <View style={{ marginHorizontal: 14, marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', padding: 12 }}>
                  {[
                    { label: '☀️ Brightness', val: bright, set: setBright, min: 0.7, max: 1.3, step: 0.05 },
                    { label: '◐ Contrast', val: contrast, set: setContrast, min: 0.7, max: 1.3, step: 0.05 },
                    { label: '🔥 Warmth', val: warmth, set: setWarmth, min: -20, max: 20, step: 4 },
                  ].map((row) => (
                    <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', width: 110 }}>{row.label}</Text>
                      <Pressable onPress={() => { tapLight(); row.set(Math.max(row.min, Math.round((row.val - row.step) * 100) / 100)); }} hitSlop={8} style={{ width: 34, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="remove" size={16} color="#FFF" />
                      </Pressable>
                      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8, overflow: 'hidden' }}>
                        <View style={{ height: 4, backgroundColor: C.gold, width: (((row.val - row.min) / (row.max - row.min)) * 100) + '%' }} />
                      </View>
                      <Pressable onPress={() => { tapLight(); row.set(Math.min(row.max, Math.round((row.val + row.step) * 100) / 100)); }} hitSlop={8} style={{ width: 34, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="add" size={16} color="#FFF" />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable onPress={() => { tapLight(); setBright(1); setContrast(1); setWarmth(0); setFilterId('none'); }} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800' }}>Reset ↺</Text>
                  </Pressable>
                </View>
              ) : null}

              {mode !== 'video' ? soundRail : null}
              <View style={{ paddingHorizontal: 16 }}>
              {/* story-only: add a Poll or an Ask-me-anything sticker */}
              {mode === 'story' && !sendMode ? (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {[{ k: 'poll', label: '📊 Poll' }, { k: 'question', label: '❓ Ask' }].map((o) => {
                      const on = stickerType === o.k;
                      return (
                        <Pressable key={o.k} onPress={() => { tapLight(); setStickerType(on ? null : o.k); }} style={{ marginRight: 8 }}>
                          <View style={{ backgroundColor: on ? C.purple : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? C.purple : 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{o.label}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {stickerType === 'poll' ? (
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 12, marginTop: 10 }}>
                      <TextInput placeholder="Ask a question…" placeholderTextColor="rgba(255,255,255,0.55)" value={pollQ} onChangeText={setPollQ}
                        style={{ color: '#FFF', fontSize: 13.5, marginBottom: 8 }} />
                      <View style={{ flexDirection: 'row' }}>
                        <TextInput placeholder="Option A" placeholderTextColor="rgba(255,255,255,0.5)" value={pollA} onChangeText={setPollA}
                          style={{ flex: 1, color: '#FFF', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8 }} />
                        <TextInput placeholder="Option B" placeholderTextColor="rgba(255,255,255,0.5)" value={pollB} onChangeText={setPollB}
                          style={{ flex: 1, color: '#FFF', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }} />
                      </View>
                    </View>
                  ) : stickerType === 'question' ? (
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 12, marginTop: 10 }}>
                      <TextInput placeholder="Ask me anything…" placeholderTextColor="rgba(255,255,255,0.55)" value={askQ} onChangeText={setAskQ}
                        style={{ color: '#FFF', fontSize: 13.5 }} />
                    </View>
                  ) : null}
                </View>
              ) : null}
              {sound ? (
                <View style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ fontSize: 13 }}>{sound.emoji}</Text>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>♫ {sound.title} · {sound.artist}</Text>
                  </View>
                  {sound.attribution ? (
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9.5, marginTop: 3, marginLeft: 4 }} numberOfLines={1}>{sound.attribution}</Text>
                  ) : null}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 4, marginRight: 10 }}>
                  <TextInput
                    placeholder={sendMode ? 'Add a caption… (optional)' : mode === 'story' ? 'Say something… (optional)' : mode === 'video' ? 'Title your video…' : 'Caption your reel…'}
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    value={caption}
                    onChangeText={setCaption}
                    style={{ color: '#FFF', fontSize: 14 }}
                  />
                </View>
                <Pressable onPress={share} disabled={busy}>
                  <LinearGradient colors={[C.purple, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13, opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{busy ? 'Sending…' : sendMode ? 'Send Moment 🔥' : mode === 'story' ? 'Add to Story' : mode === 'video' ? 'Post Video' : 'Post Reel'}</Text>
                    {sendMode ? null : <MaterialCommunityIcons name="star-four-points" size={15} color={C.gold} style={{ marginLeft: 6 }} />}
                  </LinearGradient>
                </Pressable>
              </View>
              </View>
            </View>
          )}
        </View>

        {hubOpen ? <MusicHubSheet onPick={(t) => chooseSound(t, false)} onClose={() => setHubOpen(false)} /> : null}
      </View>
    </Modal>
  );
};
