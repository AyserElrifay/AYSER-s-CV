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
          width: { ideal: 2160, max: 3840 },
          height: { ideal: 3840, max: 3840 },
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
    // Very high quality: keep the full sensor frame (cap at 4K longest side).
    const MAXL = 3840;
    let w = v.videoWidth || 1080;
    let h = v.videoHeight || 1920;
    const scale = Math.min(1, MAXL / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(v, 0, 0, w, h);
    setShot({ uri: canvas.toDataURL('image/jpeg', 0.95), kind: 'photo', ext: 'jpg', contentType: 'image/jpeg' });
  };

  /* ── video: hold to record, release to stop ── */
  const startRecording = () => {
    if (!streamRef.current) return;
    tapMedium(); sfxPop();
    chunksRef.current = [];
    try {
      const mime = window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      // ~12 Mbps — phone-camera-grade video, crisp on any screen.
      const opts = { videoBitsPerSecond: 12000000 };
      if (mime) opts.mimeType = mime;
      const rec = new MediaRecorder(streamRef.current, opts);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setShot({ uri: URL.createObjectURL(blob), kind: 'video', ext: 'webm', contentType: 'video/webm' });
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        const isVid = (a.type || '').startsWith('video') || /^video\//.test(a.mimeType || '');
        const mime = a.mimeType || (isVid ? 'video/mp4' : 'image/jpeg');
        const ext = (mime.split('/')[1] || (isVid ? 'mp4' : 'jpg')).replace('jpeg', 'jpg');
        setShot({ uri: a.uri, kind: isVid ? 'video' : 'photo', ext, contentType: mime });
      }
    } catch (e) { setCamError('Could not open your gallery'); }
  };

  /* ── long-form video: pick an existing file (works on web + native) ── */
  const pickVideoFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 900 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
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
          resolve(canvas.toDataURL('image/jpeg', 0.95));
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
          // effects
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
          } else if (particlesRef.current) {
            particlesRef.current.forEach((p) => {
              ctx.font = Math.round(p.s * w * 0.055) + 'px sans-serif';
              ctx.fillText(p.c, p.x * w * 0.94, p.y * h * 0.94 + 20);
            });
          }
          // game card
          if (gameCard) {
            const fs = Math.round(w * 0.045);
            ctx.font = '700 ' + fs + 'px sans-serif';
            const label = (gameCard.kind === 'roulette' ? '🎲 ' : '❓ ') + gameCard.text;
            const tw = ctx.measureText(label).width;
            const pad = fs * 0.8;
            const bw = Math.min(w * 0.92, tw + pad * 2);
            const bx = (w - bw) / 2, by = h * 0.07, bh = fs * 2.1;
            ctx.fillStyle = 'rgba(10,6,25,0.72)';
            if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, fs); ctx.fill(); }
            else ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, w / 2, by + bh / 2, bw - pad);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
          }
          resolve(canvas.toDataURL('image/jpeg', 0.95));
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
    const needsBake = (cssFilter && cssFilter !== 'none') || effectId !== 'none' || !!gameCard;
    if (isWeb && shot.kind === 'photo' && needsBake) {
      const baked = await bakeAll(shot.uri);
      workingShot = { ...shot, uri: baked };
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
      setCamError(e.message || 'Could not share — try again');
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
            <video src={shot.uri} autoPlay loop playsInline style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter }} />
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
