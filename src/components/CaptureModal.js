import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, Image, TextInput, ScrollView, Platform, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../constants/theme';
import { SOUNDS, ME, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { createPost } from '../services/posts';
import { createStory } from '../services/stories';
import { uploadCapture, uploadMedia } from '../services/social';
import { compressImage, MAX_UPLOAD_BYTES } from '../lib/storage';
import { compressVideo, probeVideo, needsCompressing, REEL_MAX_SECONDS } from '../lib/videoCompress';
import { fetchTracks, incrementTrackUse, publishSound } from '../services/music';
/* Both called, neither imported — the same bug as the two sheets below,
   and on the same journey: markUsed runs when you post something you
   picked from your library, fetchTopics whenever a shot needs tag
   ideas. */
import { markUsed } from '../services/library';
import { fetchTopics } from '../services/topics';
import { MusicHubSheet } from './MusicHubSheet';
/* Both of these were rendered without ever being imported. Nothing
   catches that until the branch runs, so the app built clean, booted
   clean, and blew up the moment you opened the library or the effects
   drawer — "Can't find variable: MediaLibrarySheet". */
import { MediaLibrarySheet } from './MediaLibrarySheet';
import { EffectsSheet } from './EffectsSheet';
import { SoundTrimmer } from './SoundTrimmer';
import { clipUrl, parseClip, holdToClip, DEFAULT_LEN } from '../lib/soundClip';
import { loadFaceDetector, findFace, makeFaceTracker } from '../lib/faceDetect';
import { note } from '../lib/crashLog';
import { isOwner } from '../services/music';
import { LENSES, drawLens, placeOnFace } from './lensArt';
import { tapLight, tapMedium, tapSuccess, tapSelection } from '../utils/feedback';
import { getCurrentCoords } from '../utils/location';
import { sfxPop, sfxSuccess } from '../utils/sfx';
import { setupNotice } from '../lib/plumbing';

/* ─── THE CAPTURE SCREEN — easier than IG, TikTok and Snap combined ───
   One tap opens a LIVE viewfinder. Tap the shutter for a photo, hold it
   to record video (Snapchat-style), release to stop. Pick a sound from
   the rail at the bottom while you shoot (TikTok-style). Preview,
   caption, share — three taps total from feed to posted.

   Web: real camera via getUserMedia + MediaRecorder.
   Native: one tap into the system camera (expo-image-picker); the
   in-app viewfinder arrives with the expo-camera build. */

/* A reel runs up to three minutes. It used to stop at thirty seconds,
   which is not long enough to be a reel of anything. What keeps the
   file postable at that length is the re-encode in
   src/lib/videoCompress.js, not a short timer. */
const MAX_VIDEO_MS = 180000;

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
  /* The rest of a real filter tray. All of this is colour maths — no
     assets, nothing licensed, nothing to go wrong legally. */
  { id: 'sun',    label: 'Sun-kissed', emoji: '🌞', css: 'saturate(1.35) sepia(0.22) brightness(1.10) contrast(1.04)' },
  { id: 'golden', label: 'Golden hour', emoji: '🌇', css: 'sepia(0.34) saturate(1.45) brightness(1.06) hue-rotate(-8deg)' },
  { id: 'tan',    label: 'Bronze',    emoji: '🏝️', css: 'sepia(0.30) saturate(1.5) contrast(1.06) brightness(1.02)' },
  { id: 'film',   label: 'Film',      emoji: '📷', css: 'contrast(1.14) saturate(0.92) sepia(0.12) brightness(1.02)' },
  { id: 'vhs',    label: 'VHS',       emoji: '📼', css: 'saturate(1.6) contrast(0.92) hue-rotate(6deg) brightness(1.05)' },
  { id: 'mint',   label: 'Mint',      emoji: '🌿', css: 'hue-rotate(-24deg) saturate(1.25) brightness(1.05)' },
  { id: 'rose',   label: 'Rose',      emoji: '🌹', css: 'hue-rotate(12deg) saturate(1.35) brightness(1.06)' },
  { id: 'candy',  label: 'Candy',     emoji: '🍬', css: 'saturate(1.8) contrast(0.96) brightness(1.08)' },
  { id: 'moody',  label: 'Moody',     emoji: '🌫️', css: 'contrast(1.22) saturate(0.78) brightness(0.94)' },
  { id: 'night',  label: 'Night',     emoji: '🌙', css: 'brightness(0.86) contrast(1.18) saturate(1.1) hue-rotate(-14deg)' },
  { id: 'ice',    label: 'Ice',       emoji: '🧊', css: 'hue-rotate(-30deg) saturate(1.15) brightness(1.12) contrast(1.05)' },
  { id: 'faded',  label: 'Faded',     emoji: '🫧', css: 'saturate(0.7) brightness(1.12) contrast(0.9)' },
  { id: 'punch',  label: 'Punch',     emoji: '💥', css: 'saturate(1.9) contrast(1.24)' },
  { id: 'sepia',  label: 'Old photo', emoji: '🖼️', css: 'sepia(0.85) contrast(1.08) brightness(1.04)' },
  { id: 'invert', label: 'Flip',      emoji: '🔮', css: 'invert(1) hue-rotate(180deg)' },
];

/* EFFECTS — original overlays we draw ourselves (previewed live and
   really BAKED into the photo's pixels on share). */
const EFFECTS = [
  { id: 'none',     label: 'Clean',    emoji: '⬜' },
  { id: 'pixel',    label: 'Pixel',    emoji: '👾' },
  { id: 'arcade',   label: 'Arcade',   emoji: '🕹️' },
  { id: 'cartoon',  label: 'Cartoon',  emoji: '🎨' },
  { id: 'leak',     label: 'Light leak', emoji: '🌞' },
  { id: 'vignette', label: 'Vignette', emoji: '🕳️' },
  { id: 'grain',    label: 'Grain',    emoji: '🎞️' },
  { id: 'hearts',   label: 'Hearts',   emoji: '💕' },
  { id: 'confetti', label: 'Confetti', emoji: '🎉' },
  { id: 'snow',     label: 'Snow',     emoji: '❄️' },
  { id: 'stars',    label: 'Stars',    emoji: '✨' },
];
/* Effects that transform the WHOLE frame (not an overlay) — applied to the
   base pixels in bake + the video compositor. */
const FRAME_FX = { pixel: 1, cartoon: 1, arcade: 1 };
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
  { id: 'cursed', title: 'Your Cursed Future', emoji: '😂', rows: [
    { label: 'You\'ll marry', pool: ['a 70-year-old named Osama', 'your neighbour\'s goat', 'a guy who claps at landings', 'someone named after a vegetable', 'a haunted GPS', 'your 3rd-grade rival'] },
    { label: 'Your job', pool: ['professional napper', 'chicken life-coach', 'wedding hype-man', 'pigeon translator', 'full-time victim', 'sock inspector'] },
    { label: 'Your money', pool: ['5 EGP forever', 'rich in Monopoly cash', 'in debt to a camel', 'paid in vibes', 'owes the falafel guy'] },
    { label: 'Your fate', pool: ['famous for tripping', 'king of the memes', 'lives with 7 cats', 'trends for the wrong reason', 'becomes a cautionary tale'] },
  ] },
];

/* Same games, spoken in the player's language — Arabic, French, Spanish.
   The card art and spin are identical; only the words change. */
const REEL_GAMES_AR = [
  { id: 'love', title: 'علاقتك الجاية', emoji: '💘', rows: [
    { label: 'النوع', pool: ['توأم روح', 'حب هادي', 'علاقة مش واضحة', 'إعصار', 'صحاب الأول', 'عن بُعد', 'فرصة تانية'] },
    { label: 'طاقتهم', pool: ['فوضى حلوة', 'لطيف جداً', 'غامض', 'ثنائي قوي', 'مصدر أمان', 'كله ضحك', 'خجول وحنون'] },
    { label: 'هتتقابلوا', pool: ['في كافيه', 'في الجيم', 'في فرح', 'أونلاين', 'عن طريق صحاب', 'في السفر', 'في طابور قهوة'] },
    { label: 'إمتى', pool: ['بعد ٣ أسابيع', 'الصيف ده', 'بعد شهرين', 'السنة الجاية', 'لما تبطّل تدوّر'] },
  ] },
  { id: 'era', title: 'سنة ٢٠٢٦ بتاعتك', emoji: '✨', rows: [
    { label: 'عصرك', pool: ['البطل', 'حياة هادية', 'الشرير', 'تطوّر ولمعان', 'شفاء', 'شغل وطموح', 'نجم روك'] },
    { label: 'طاقتك', pool: ['مش مهتم', 'جذّاب', 'متوحش', 'زِن وهدوء', 'جريء', 'ذهبي'] },
    { label: 'أغنيتك', pool: ['هيت صيفي', 'أغنية حزينة', 'حماس', 'هدوء لو-فاي', 'أغنية أندردوج'] },
    { label: 'شهر الحظ', pool: ['مارس', 'يونيو', 'سبتمبر', 'ديسمبر', 'فبراير', 'أغسطس'] },
  ] },
  { id: 'villain', title: 'قصة تحوّلك للشر', emoji: '😈', rows: [
    { label: 'قالولك', pool: ['«اتغيّرت»', '«اهدا»', '«مش لدرجة كده»', '«انت زيادة»', '«كن واقعي»', '«يمكن بعدين»'] },
    { label: 'قوتك', pool: ['صمت بارد', 'ردّ العام', 'صفر ردود', 'عبقري نكاية', 'هالة لامبالاة'] },
    { label: 'حركتك', pool: ['سيبها متقرية', 'رمشة بطيئة', 'سكرين شوت واحتفظ', 'اختفي والمع', 'الإثباتات'] },
  ] },
  { id: 'trip', title: 'رحلتك الجاية', emoji: '✈️', rows: [
    { label: 'الوجهة', pool: ['طوكيو', 'المالديف', 'رحلة بالعربية', 'ليالي القاهرة', 'جبال الألب', 'بلد ساحلية', 'مكان جديد'] },
    { label: 'مع مين', pool: ['أعز صاحب', 'لوحدك وحر', 'الشلة كلها', '+١ مفاجأة', 'العيلة'] },
    { label: 'الجو', pool: ['فوضى', 'هادي وبطيء', 'مغامرة', 'فخامة', 'أساطير الميزانية'] },
    { label: 'إمتى', pool: ['الصيف ده', 'الشهر الجاي', 'الشتا', 'أقرب مما تتخيّل'] },
  ] },
  { id: 'aura', title: 'اقرا الأورا بتاعتك', emoji: '🔮', rows: [
    { label: 'اللون', pool: ['بنفسجي كهربي', 'دهبي دافي', 'أزرق بحري', 'وردي', 'أخضر غامق', 'فضي'] },
    { label: 'الطاقة', pool: ['عاصفة هادية', 'نار مضيّة', 'قوة صامتة', 'شرارة متوحشة', 'موجة لطيفة'] },
    { label: 'حيوانك', pool: ['ديب', 'قطة', 'بومة', 'دولفين', 'أسد', 'تعلب'] },
  ] },
  { id: 'compliment', title: 'مولّد المجاملات', emoji: '🌈', rows: [
    { label: '', pool: [
      'ابتسامتك بتصلّح أوحش يوم ☀️',
      'انت كوول من غير ما تحاول 😎',
      'الناس بتحس بأمان جمبك 🫶',
      'انت أذكى مما تعترف 🧠',
      'طاقتك بتعدّي للكل ⚡',
      'بتخلّي اليوم العادي حلو 🎈',
    ] },
  ] },
  { id: 'cursed', title: 'مستقبلك المقلوب', emoji: '😂', rows: [
    { label: 'هتتجوز', pool: ['راجل عنده ٧٠ سنة اسمه أسامة', 'معزة الجيران', 'واحد بيصفّق لما الطيارة تنزل', 'حد متسمّي على خضار', 'GPS مسكون', 'غريمك من ابتدائي'] },
    { label: 'شغلك', pool: ['نايم محترف', 'مدرّب حياة للفراخ', 'مشجّع أفراح', 'مترجم حمام', 'ضحية بدوام كامل', 'مفتّش شرابات'] },
    { label: 'فلوسك', pool: ['٥ جنيه للأبد', 'غني بفلوس المونوبولي', 'مديون لجمل', 'بيتدفعلك vibes', 'مديون لبتاع الفلافل'] },
    { label: 'مصيرك', pool: ['مشهور إنك بتقع', 'ملك الميمز', 'عايش مع ٧ قطط', 'بتتريند بالغلط', 'بقيت عبرة'] },
  ] },
];

const REEL_GAMES_FR = [
  { id: 'love', title: 'Ta prochaine relation', emoji: '💘', rows: [
    { label: 'Type', pool: ['Âme sœur', 'Feu doux', 'Situationship', 'Coup de foudre', 'Amis d\'abord', 'À distance', 'Seconde chance'] },
    { label: 'Son vibe', pool: ['Chaos adorable', 'Golden retriever', 'Mystérieux', 'Power couple', 'Réconfort', 'Que des blagues', 'Doux et timide'] },
    { label: 'Rencontre', pool: ['Dans un café', 'À la salle', 'À un mariage', 'En ligne', 'Via des amis', 'À l\'étranger', 'Dans la file'] },
    { label: 'Quand', pool: ['dans 3 semaines', 'cet été', 'dans 2 mois', 'l\'an prochain', 'quand tu arrêtes de chercher'] },
  ] },
  { id: 'era', title: 'Ton ère 2026', emoji: '✨', rows: [
    { label: 'Ère', pool: ['Personnage principal', 'Soft life', 'Vilain', 'Glow-up', 'Guérison', 'Ambition', 'Rockstar'] },
    { label: 'Énergie', pool: ['Imperturbable', 'Magnétique', 'Sauvage', 'Zen', 'Audacieux', 'Doré'] },
    { label: 'Hymne', pool: ['un tube d\'été', 'une ballade', 'du pur hype', 'lo-fi calme', 'un air d\'outsider'] },
    { label: 'Mois chance', pool: ['Mars', 'Juin', 'Septembre', 'Décembre', 'Février', 'Août'] },
  ] },
  { id: 'villain', title: 'Ton origine de méchant', emoji: '😈', rows: [
    { label: 'On t\'a dit', pool: ['« T\'as changé »', '« Calme-toi »', '« C\'est pas grave »', '« T\'en fais trop »', '« Sois réaliste »', '« Plus tard »'] },
    { label: 'Ton pouvoir', pool: ['Silence glacial', 'La réplique du siècle', 'Zéro réponse', 'Génie rancunier', 'Aura imperturbable'] },
    { label: 'Ton geste', pool: ['Laisser en vu', 'Le clignement lent', 'Screenshot & garde', 'Ghost & glow', 'Les preuves'] },
  ] },
  { id: 'trip', title: 'Ton prochain voyage', emoji: '✈️', rows: [
    { label: 'Destination', pool: ['Tokyo', 'Les Maldives', 'un road trip', 'Le Caire la nuit', 'les Alpes', 'un village côtier', 'l\'inconnu'] },
    { label: 'Avec', pool: ['ton meilleur ami', 'solo et libre', 'toute la bande', 'un +1 surprise', 'la famille'] },
    { label: 'Ambiance', pool: ['pur chaos', 'douce et lente', 'aventure', 'luxe', 'légendes du budget'] },
    { label: 'Quand', pool: ['cet été', 'le mois prochain', 'en hiver', 'plus tôt que tu crois'] },
  ] },
  { id: 'aura', title: 'Lis mon aura', emoji: '🔮', rows: [
    { label: 'Couleur', pool: ['Violet électrique', 'Or chaud', 'Bleu océan', 'Rose', 'Vert profond', 'Argent'] },
    { label: 'Énergie', pool: ['Tempête calme', 'Feu brillant', 'Force tranquille', 'Étincelle sauvage', 'Vague douce'] },
    { label: 'Animal', pool: ['un loup', 'un chat', 'un hibou', 'un dauphin', 'un lion', 'un renard'] },
  ] },
  { id: 'compliment', title: 'Générateur de compliments', emoji: '🌈', rows: [
    { label: '', pool: [
      'Ton sourire répare les mauvais jours ☀️',
      'Tu es cool sans effort 😎',
      'On se sent en sécurité avec toi 🫶',
      'Tu es plus malin que tu l\'admets 🧠',
      'Ton énergie est contagieuse ⚡',
      'Tu rends les jours ordinaires fun 🎈',
    ] },
  ] },
  { id: 'cursed', title: 'Ton futur maudit', emoji: '😂', rows: [
    { label: 'Tu épouseras', pool: ['un monsieur de 70 ans nommé Osama', 'la chèvre du voisin', 'un gars qui applaudit à l\'atterrissage', 'quelqu\'un nommé comme un légume', 'un GPS hanté', 'ton rival de CE2'] },
    { label: 'Ton métier', pool: ['sieste professionnelle', 'coach de vie pour poulets', 'ambianceur de mariages', 'traducteur de pigeons', 'victime à plein temps', 'inspecteur de chaussettes'] },
    { label: 'Ton argent', pool: ['5 EGP à vie', 'riche en Monopoly', 'endetté à un chameau', 'payé en vibes', 'doit au vendeur de falafel'] },
    { label: 'Ton destin', pool: ['célèbre pour tes chutes', 'roi des memes', 'vit avec 7 chats', 'buzz pour de mauvaises raisons', 'devient une légende ratée'] },
  ] },
];

const REEL_GAMES_ES = [
  { id: 'love', title: 'Tu próxima relación', emoji: '💘', rows: [
    { label: 'Tipo', pool: ['Alma gemela', 'Fuego lento', 'Situationship', 'Torbellino', 'Amigos primero', 'A distancia', 'Segunda oportunidad'] },
    { label: 'Su vibra', pool: ['Caos adorable', 'Golden retriever', 'Misterioso', 'Power couple', 'Refugio', 'Puro chiste', 'Dulce y tímido'] },
    { label: 'Se conocen', pool: ['En un café', 'En el gym', 'En una boda', 'En línea', 'Por amigos', 'En el extranjero', 'En la fila'] },
    { label: 'Cuándo', pool: ['en 3 semanas', 'este verano', 'en 2 meses', 'el próximo año', 'cuando dejes de buscar'] },
  ] },
  { id: 'era', title: 'Tu era 2026', emoji: '✨', rows: [
    { label: 'Era', pool: ['Protagonista', 'Soft life', 'Villano', 'Glow-up', 'Sanación', 'Ambición', 'Estrella de rock'] },
    { label: 'Energía', pool: ['Imperturbable', 'Magnética', 'Salvaje', 'Zen', 'Audaz', 'Dorada'] },
    { label: 'Himno', pool: ['un hit de verano', 'una balada', 'puro hype', 'lo-fi tranquilo', 'un tema de underdog'] },
    { label: 'Mes de suerte', pool: ['Marzo', 'Junio', 'Septiembre', 'Diciembre', 'Febrero', 'Agosto'] },
  ] },
  { id: 'villain', title: 'Tu origen de villano', emoji: '😈', rows: [
    { label: 'Te dijeron', pool: ['«Cambiaste»', '«Cálmate»', '«No es para tanto»', '«Eres demasiado»', '«Sé realista»', '«Quizá luego»'] },
    { label: 'Tu poder', pool: ['Silencio frío', 'La respuesta del año', 'Cero respuestas', 'Genio rencoroso', 'Aura imperturbable'] },
    { label: 'Tu jugada', pool: ['Dejar en visto', 'El parpadeo lento', 'Captura y guarda', 'Ghost & glow', 'Las pruebas'] },
  ] },
  { id: 'trip', title: 'Tu próximo viaje', emoji: '✈️', rows: [
    { label: 'Destino', pool: ['Tokio', 'Las Maldivas', 'un road trip', 'El Cairo de noche', 'los Alpes', 'un pueblo costero', 'lo desconocido'] },
    { label: 'Con', pool: ['tu mejor amigo', 'solo y libre', 'toda la banda', 'un +1 sorpresa', 'la familia'] },
    { label: 'Ambiente', pool: ['puro caos', 'suave y lento', 'aventura', 'lujo', 'leyendas del presupuesto'] },
    { label: 'Cuándo', pool: ['este verano', 'el próximo mes', 'en invierno', 'antes de lo que crees'] },
  ] },
  { id: 'aura', title: 'Lee mi aura', emoji: '🔮', rows: [
    { label: 'Color', pool: ['Violeta eléctrico', 'Oro cálido', 'Azul océano', 'Rosa', 'Verde profundo', 'Plata'] },
    { label: 'Energía', pool: ['Tormenta calma', 'Fuego brillante', 'Fuerza tranquila', 'Chispa salvaje', 'Ola suave'] },
    { label: 'Animal', pool: ['un lobo', 'un gato', 'un búho', 'un delfín', 'un león', 'un zorro'] },
  ] },
  { id: 'compliment', title: 'Generador de cumplidos', emoji: '🌈', rows: [
    { label: '', pool: [
      'Tu sonrisa arregla los días malos ☀️',
      'Eres cool sin esfuerzo 😎',
      'La gente se siente segura contigo 🫶',
      'Eres más listo de lo que admites 🧠',
      'Tu energía es contagiosa ⚡',
      'Haces divertidos los días normales 🎈',
    ] },
  ] },
  { id: 'cursed', title: 'Tu futuro maldito', emoji: '😂', rows: [
    { label: 'Te casarás con', pool: ['un señor de 70 años llamado Osama', 'la cabra del vecino', 'alguien que aplaude al aterrizar', 'alguien con nombre de verdura', 'un GPS embrujado', 'tu rival de primaria'] },
    { label: 'Tu trabajo', pool: ['dormir profesional', 'coach de pollos', 'animador de bodas', 'traductor de palomas', 'víctima a tiempo completo', 'inspector de calcetines'] },
    { label: 'Tu dinero', pool: ['5 EGP para siempre', 'rico en Monopoly', 'en deuda con un camello', 'pagado en vibes', 'le debes al de los falafel'] },
    { label: 'Tu destino', pool: ['famoso por tropezar', 'rey de los memes', 'vives con 7 gatos', 'viral por lo equivocado', 'te vuelves una advertencia'] },
  ] },
];

const REEL_GAMES_BY_LANG = { en: REEL_GAMES, ar: REEL_GAMES_AR, fr: REEL_GAMES_FR, es: REEL_GAMES_ES };

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
/* Turn the whole frame into pixel-art: downsample hard, then upscale with
   smoothing off so you get crisp blocky pixels (like the reference). */
function applyPixelate(ctx, w, h) {
  try {
    const blocks = 150; // pixels across — clean retro look
    const sw = blocks, sh = Math.max(1, Math.round(h * blocks / w));
    const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tmp, 0, 0, sw, sh, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  } catch (e) {}
}
/* A quick "cartoon" look with no AI: posterize the colours into flat bands
   and boost saturation, for a bold illustrated feel. */
function applyCartoon(ctx, w, h) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data, levels = 5, step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(Math.round(d[i] / step) * step);
      d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
      d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    }
    ctx.putImageData(img, 0, 0);
  } catch (e) {}
}
function applyFrameFx(ctx, w, h, effectId) {
  if (effectId === 'pixel' || effectId === 'arcade') applyPixelate(ctx, w, h);
  else if (effectId === 'cartoon') applyCartoon(ctx, w, h);
}

/* ── ARCADE ─────────────────────────────────────────────────────────
   The frame becomes a fighting game: two health bars, a round timer, a
   combo counter and a super meter that fills as the clip runs. Every
   line of it is drawn here in code — no sprite sheet, no borrowed
   game's art, nothing anybody can send us a letter about. */
function drawArcadeHud(ctx, w, h, t) {
  const el = (t || 0) / 1000;
  const s = w / 1080;                       // one scale for the whole HUD
  const px = (n) => n * s;
  const pixelFont = '900 ' + Math.round(px(38)) + 'px "Courier New", monospace';

  const bar = (x, y, bw, bh, frac, colA, colB, flip) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - px(3), y - px(3), bw + px(6), bh + px(6));
    ctx.fillStyle = '#2A2A3A';
    ctx.fillRect(x, y, bw, bh);
    const fw = Math.max(0, Math.min(1, frac)) * bw;
    const g = ctx.createLinearGradient(x, y, x, y + bh);
    g.addColorStop(0, colA); g.addColorStop(1, colB);
    ctx.fillStyle = g;
    ctx.fillRect(flip ? x + bw - fw : x, y, fw, bh);
    // the blocky segment lines that make it read as 16-bit
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + (bw / 10) * i - px(1), y, px(2), bh);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = px(3);
    ctx.strokeRect(x, y, bw, bh);
  };

  // health: yours drains slowly, theirs faster — a fight you're winning
  const mine = Math.max(0.12, 1 - el * 0.035);
  const theirs = Math.max(0.05, 1 - el * 0.06);
  const bw = w * 0.36, bh = px(30), top = h * 0.055;
  bar(w * 0.05, top, bw, bh, mine, '#7CF35B', '#2F9E2A', false);
  bar(w - w * 0.05 - bw, top, bw, bh, theirs, '#FF7A5B', '#C4331A', true);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = pixelFont;
  // VS, in the middle, with the round timer under it
  ctx.lineWidth = px(8); ctx.lineJoin = 'round';
  ctx.strokeStyle = '#101024'; ctx.fillStyle = '#FFD23F';
  ctx.strokeText('VS', w / 2, top + bh / 2);
  ctx.fillText('VS', w / 2, top + bh / 2);

  const left = Math.max(0, 60 - Math.floor(el));
  ctx.font = '900 ' + Math.round(px(52)) + 'px "Courier New", monospace';
  ctx.strokeText(String(left).padStart(2, '0'), w / 2, top + bh + px(46));
  ctx.fillStyle = left <= 10 ? '#FF4D4D' : '#FFFFFF';
  ctx.fillText(String(left).padStart(2, '0'), w / 2, top + bh + px(46));

  // player names, small, under their own bars
  ctx.font = '900 ' + Math.round(px(24)) + 'px "Courier New", monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('YOU', w * 0.05, top + bh + px(26));
  ctx.textAlign = 'right';
  ctx.fillText('RIVAL', w - w * 0.05, top + bh + px(26));

  // combo counter, bottom left, ticking up while the clip runs
  const combo = 1 + Math.floor(el * 1.6);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = '900 ' + Math.round(px(44)) + 'px "Courier New", monospace';
  const pulse = 1 + 0.06 * Math.sin(el * 9);
  ctx.save();
  ctx.translate(w * 0.06, h * 0.88);
  ctx.scale(pulse, pulse);
  ctx.lineWidth = px(7); ctx.strokeStyle = '#101024';
  ctx.strokeText('COMBO x' + combo, 0, 0);
  ctx.fillStyle = '#FFD23F';
  ctx.fillText('COMBO x' + combo, 0, 0);
  ctx.restore();

  // super meter, bottom, filling up
  const sw = w * 0.62, sx = (w - sw) / 2, sy = h * 0.93, sh = px(22);
  const fill = Math.min(1, (el % 8) / 8);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(sx - px(3), sy - px(3), sw + px(6), sh + px(6));
  ctx.fillStyle = '#241A3A';
  ctx.fillRect(sx, sy, sw, sh);
  const sg = ctx.createLinearGradient(sx, sy, sx + sw, sy);
  sg.addColorStop(0, '#7C3AED'); sg.addColorStop(0.5, '#38BDF8'); sg.addColorStop(1, '#FFD23F');
  ctx.fillStyle = sg;
  ctx.fillRect(sx, sy, sw * fill, sh);
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = px(3);
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.textAlign = 'center';
  ctx.font = '900 ' + Math.round(px(20)) + 'px "Courier New", monospace';
  ctx.fillStyle = fill > 0.98 ? '#FFD23F' : '#FFFFFF';
  ctx.fillText(fill > 0.98 ? 'SUPER READY!' : 'SUPER', w / 2, sy - px(10));

  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

function drawEffectsCanvas(ctx, w, h, effectId, particles, t) {
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
  } else if (effectId === 'arcade') {
    drawArcadeHud(ctx, w, h, t);
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
/* A subtle, TikTok-style watermark baked into the reel's pixels. It's
   small and low-contrast so it never bothers the viewer, but it alternates
   between the bottom corners every few seconds so a crop can't remove it —
   and because it's in the pixels, it survives download & re-share. */
function drawWatermark(ctx, w, h, handle, elapsed) {
  const s = w / 1080;
  const fs = Math.round(30 * s), margin = Math.round(40 * s);
  ctx.save();
  ctx.globalAlpha = 0.68;
  ctx.font = '800 ' + fs + 'px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.round(6 * s);
  const label = '✦ moments' + (handle ? '   ' + handle : '');
  const tw = ctx.measureText(label).width;
  const phase = Math.floor((elapsed || 0) / 4000) % 2; // swap corners every 4s
  const x = phase === 0 ? margin : Math.max(margin, w - tw - margin);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, x, h - margin, w - margin * 2);
  ctx.restore();
}

function drawReelCardCanvas(ctx, w, h, game, elapsed) {
  const s = w / 1080;
  const single = reelIsSingle(game);
  // Bigger, cleaner, centred — easy to read at a glance (TikTok-style).
  const titleFs = Math.round(50 * s), valueFs = Math.round(46 * s), labelFs = Math.round(28 * s);
  const pad = Math.round(38 * s), rowH = Math.round(96 * s), gapTitle = Math.round(30 * s);
  const panelW = Math.min(w * 0.92, Math.round(820 * s));
  const innerW = panelW - pad * 2;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  let bodyLines = [];
  if (single) { ctx.font = '800 ' + valueFs + 'px sans-serif'; bodyLines = wrapLines(ctx, game.rows[0].result, innerW); }
  const bodyH = single ? bodyLines.length * Math.round(valueFs * 1.3) : game.rows.length * rowH;
  const headerH = titleFs + gapTitle;
  const panelH = pad * 2 + headerH + bodyH;
  const bx = (w - panelW) / 2, by = Math.round(h * 0.07);
  // clean soft card — no busy border
  ctx.fillStyle = 'rgba(8,6,20,0.55)';
  roundRectPath(ctx, bx, by, panelW, panelH, Math.round(40 * s)); ctx.fill();
  // shadow keeps text legible on any footage
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.round(9 * s); ctx.shadowOffsetY = Math.round(1 * s);
  // title
  ctx.fillStyle = '#FFFFFF'; ctx.font = '900 ' + titleFs + 'px sans-serif';
  ctx.fillText(game.emoji + '  ' + game.title, w / 2, by + pad + titleFs * 0.82, innerW);
  if (single) {
    ctx.fillStyle = '#FFFFFF'; ctx.font = '800 ' + valueFs + 'px sans-serif';
    const lh = Math.round(valueFs * 1.3);
    bodyLines.forEach((ln, i) => ctx.fillText(ln, w / 2, by + pad + headerH + i * lh + valueFs * 0.85, innerW));
  } else {
    game.rows.forEach((row, i) => {
      const cell = reelCell(row, i, elapsed);
      const top = by + pad + headerH + i * rowH;
      ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.font = '700 ' + labelFs + 'px sans-serif';
      ctx.fillText(row.label, w / 2, top + labelFs, innerW);
      ctx.fillStyle = cell.locked ? '#FFFFFF' : 'rgba(255,255,255,0.75)';
      ctx.font = '900 ' + valueFs + 'px sans-serif';
      ctx.fillText(cell.text, w / 2, top + labelFs + Math.round(valueFs * 1.05), innerW);
    });
  }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.textAlign = 'start';
}

/* The lens you can see and move. It is its own canvas over the
   viewfinder, redrawn each frame, so what is on screen is produced by
   exactly the same code that bakes it into the file — there is no
   "preview version" that can drift from the real one. */
const LensLayer = ({ lens, onMove, frame, fit }) => {
  const ref = React.useRef(null);
  const lensRef = React.useRef(lens);
  lensRef.current = lens;
  /* THE OVERLAY IS THE FRAME. Its canvas is the camera frame's own size
     and it is fitted over the video with the very same object-fit, so a
     position in frame coordinates lands in the same place on screen as
     it will in the file. Sizing the canvas to its CSS box instead — as
     this did — meant the preview and the posted picture were two
     different pictures. */
  const fw = (frame && frame.w) || 1280;
  const fh = (frame && frame.h) || 720;
  const frameRef = React.useRef({ w: fw, h: fh });
  frameRef.current = { w: fw, h: fh };

  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    let raf = null;
    const loop = () => {
      const cv = ref.current;
      if (cv) {
        const { w, h } = frameRef.current;
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        drawLens(ctx, w, h, lensRef.current, performance.now());
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []);

  /* Dragging happens in screen pixels and has to come back as frame
     coordinates. This is the same fit the browser is applying to the
     video, run backwards. */
  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e) => {
        const cv = ref.current;
        if (!cv || !cv.getBoundingClientRect) return;
        const r = cv.getBoundingClientRect();
        const { w: fW, h: fH } = frameRef.current;
        if (!r.width || !r.height || !fW || !fH) return;
        const k = fit === 'contain'
          ? Math.min(r.width / fW, r.height / fH)
          : Math.max(r.width / fW, r.height / fH);
        const drawnW = fW * k, drawnH = fH * k;
        const left = r.left + (r.width - drawnW) / 2;
        const top = r.top + (r.height - drawnH) / 2;
        onMove(
          Math.max(0.02, Math.min(0.98, (e.nativeEvent.pageX - left) / drawnW)),
          Math.max(0.02, Math.min(0.98, (e.nativeEvent.pageY - top) / drawnH))
        );
      },
    })
  ).current;

  if (Platform.OS !== 'web') return null;
  /* objectFit matching the video is what makes the overlay and the
     picture the same geometry. Without it the canvas would stretch to
     the box and every horizontal position would drift by the crop. */
  return (
    <View {...pan.panHandlers} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <canvas
        ref={ref}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: fit === 'contain' ? 'contain' : 'cover' }}
      />
    </View>
  );
};

/* The arcade HUD, live over the viewfinder. Same painter as the bake,
   so the fight you see is the fight that ends up in the file. */
const ArcadeLayer = ({ startRef }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    startRef.current = performance.now();
    let raf = null;
    const loop = () => {
      const cv = ref.current;
      if (cv) {
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        drawArcadeHud(ctx, w, h, performance.now() - startRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [startRef]);
  if (Platform.OS !== 'web') return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </View>
  );
};

export const CaptureModal = ({ initialMode = 'story', onClose, onPosted, onPostedStory, sendMode = false, sendToName, onMoment }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lang } = useLang();
  const reelGames = REEL_GAMES_BY_LANG[lang] || REEL_GAMES; // games in the app's language
  const [mode, setMode] = useState(initialMode); // 'story' | 'reel'
  const [sound, setSound] = useState(null);
  const [facing, setFacing] = useState('user');
  // 'fill' frames it edge-to-edge (some of the sides get cropped);
  // 'wide' shows the WHOLE camera view with nothing cut off.
  const [fit, setFit] = useState('fill');
  // Share it ON THE MAP: when this is on, the story/moment is pinned
  // where you actually are, so friends see it happening there.
  const [onMap, setOnMap] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);
  const [placeName, setPlaceName] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);

  const toggleOnMap = async () => {
    tapLight();
    if (onMap) { setOnMap(false); setMapCoords(null); return; }
    setGpsBusy(true);
    const c = await getCurrentCoords();
    setGpsBusy(false);
    if (!c) { setCamError('Turn on location to put this on the map 📍'); return; }
    setMapCoords(c);
    setOnMap(true);
  };
  const [camError, setCamError] = useState(null);
  /* The camera frame's own size. Everything about a lens is measured in
     it, so the preview and the posted file are the same picture. */
  const [frameSize, setFrameSize] = useState({ w: 1280, h: 720 });
  // 0–1 while a big clip is being re-encoded, null when it isn't
  const [shrink, setShrink] = useState(null);
  const shrinkAbort = React.useRef(null);
  const [shot, setShot] = useState(null); // { uri, kind: 'photo'|'video', ext, contentType }
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);   // hands-free, tap to stop
  const [recMs, setRecMs] = useState(0);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  // real bytes-sent, so "Sending…" can say how far it has got instead
  // of sitting there looking identical to a stalled upload
  const [upPct, setUpPct] = useState(0);
  const [hubOpen, setHubOpen] = useState(false);

  // ── effects + game filters (previewed live, baked on share) ──
  const [effectId, setEffectId] = useState('none');
  const arcadeStartRef = React.useRef(0);   // when this round started, so the bake matches the preview
  /* The viewfinder is a camera again: the lens carousel sits by the
     shutter, everything else lives on the right-hand rail or in the
     drawer you pull up. Nothing stacks over your own face. */

  const [libraryOpen, setLibraryOpen] = useState(false);   // pick something already uploaded
  const [closeOnly, setCloseOnly] = useState(false);        // just the smaller circle
  const [effectsOpen, setEffectsOpen] = useState(false);   // the whole drawer, pulled up
  /* Where it happened and what it's about — asked once, after the shot,
     which is the only moment you actually know both. Five tags is the
     ceiling: past that it stops being a subject and starts being spam. */
  const [tags, setTags] = useState([]);
  const [tagText, setTagText] = useState('');
  const [tagIdeas, setTagIdeas] = useState([]);

  /* iOS SOMETIMES THROWS THE PAGE AWAY.
     Opening the photo picker hands the phone to another app, and Safari
     is free to drop this tab while it's gone — you come back and the
     camera, the caption and the tags you'd chosen are simply not there
     any more. We can't stop that, so we survive it: what you'd written
     is kept for the length of the session and put back when the screen
     reopens. */
  const DRAFT_KEY = 'mm_capture_draft';
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (!isWeb || draftLoaded.current || sendMode) return;
    draftLoaded.current = true;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d.mode !== initialMode) return;
      if (d.caption) setCaption(d.caption);
      if (Array.isArray(d.tags)) setTags(d.tags.slice(0, 5));
      if (d.placeName) setPlaceName(d.placeName);
    } catch (e) {}
  }, [sendMode, initialMode]);

  useEffect(() => {
    if (!isWeb || sendMode) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        mode: initialMode, caption, tags, placeName, at: Date.now(),
      }));
    } catch (e) {}
  }, [caption, tags, placeName, initialMode, sendMode]);

  const clearDraft = () => { try { if (isWeb) window.sessionStorage.removeItem(DRAFT_KEY); } catch (e) {} };
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
  /* Which single panel is open under the picture, if any. Null is the
     normal state and the whole point — see the preview block below. */
  const [panel, setPanel] = useState(null);
  // the lens circles over the viewfinder — closed until you ask
  const [lensRailOpen, setLensRailOpen] = useState(false);

  // ── swipe the viewfinder to flip through filters, live (Snap-style) ──
  const [filterFlash, setFilterFlash] = useState(null);
  const filterIdRef = useRef('none');
  const flashTimer = useRef(null);
  useEffect(() => { filterIdRef.current = filterId; }, [filterId]);
  const cycleFilter = (dir) => {
    const idx = FILTERS.findIndex((f) => f.id === filterIdRef.current);
    const nf = FILTERS[(idx + dir + FILTERS.length) % FILTERS.length];
    tapLight(); sfxPop();
    setFilterId(nf.id);
    setFilterFlash(nf.emoji + '  ' + nf.label);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFilterFlash(null), 900);
  };
  const cycleFilterRef = useRef(cycleFilter);
  cycleFilterRef.current = cycleFilter;
  const swipe = useRef(PanResponder.create({
    // only claim clear horizontal drags, so taps & vertical scrolls pass through
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 22 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onPanResponderRelease: (e, g) => { if (Math.abs(g.dx) >= 45) cycleFilterRef.current(g.dx < 0 ? 1 : -1); },
  })).current;
  useEffect(() => () => clearTimeout(flashTimer.current), []);

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
    /* A story is about fifteen seconds long, so fifteen seconds of the
       song is what it gets — from the top until you say otherwise. The
       scissors on the chip moves that window anywhere in the track. */
    const picked = s && s.audio_url && !parseClip(s.audio_url)
      ? { ...s, audio_url: clipUrl(s.audio_url, 0, DEFAULT_LEN) }
      : s;
    setSound(picked);
    if (isWeb && picked && picked.audio_url) {
      try {
        const a = new window.Audio(picked.audio_url);
        a.loop = true; a.volume = 0.85;
        a.play().catch(() => {});
        holdToClip(a);
        previewRef.current = a;
      } catch (e) {}
    }
  };

  /* Which part of it. Opened from the chosen chip. */
  const [trimming, setTrimming] = useState(null);
  const openTrim = (s) => {
    tapLight();
    if (previewRef.current) { try { previewRef.current.pause(); } catch (e) {} previewRef.current = null; }
    setTrimming(s);
  };
  useEffect(() => () => { if (previewRef.current) previewRef.current.pause(); }, []);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const holdTimer = useRef(null);
  const recTimer = useRef(null);
  const heldRef = useRef(false);
  const lockRef = useRef(false);          // recording hands-free
  const lockCleanup = useRef(null);
  const pendingStopRef = useRef(false);
  const startYRef = useRef(0);
  const compCanvasRef = useRef(null); // offscreen canvas for game/effect video compositing
  const rafRef = useRef(null);        // compositor animation frame

  const isWeb = Platform.OS === 'web';

  /* Safari/WebKit — including every browser on iPhone and iPad, since
     they are all WebKit underneath — encodes a canvas.captureStream()
     as an all-black video. The recording succeeds, the file is the
     right size, and every single frame is black. Camera tracks record
     fine, so on WebKit we record the camera directly and skip the
     compositor: no baked watermark or game overlay there, but a reel
     you can actually watch. */
  const isWebKit = isWeb && typeof navigator !== 'undefined' && (() => {
    const ua = navigator.userAgent || '';
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return true;           // iOS Chrome/Firefox/Edge = WebKit too
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ reports itself as a Mac; touch points give it away
    if (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;
    return /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
  })();

  /* ── live viewfinder (web) ── */
  const startStream = async (face) => {
    if (!isWeb) return;
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      /* THE ZOOM: phone sensors are landscape. Asking for a PORTRAIT
         frame (1080×1920) makes the browser crop the sensor down to
         that shape, which is exactly the "everything is zoomed in"
         look. Asking for the sensor's own landscape shape gives the
         full field of view, and we frame it ourselves after. */
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: face || facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;

      /* Some browsers keep a digital zoom from the last app that used
         the camera — put it back to 1× (widest) when it's adjustable. */
      try {
        const track = stream.getVideoTracks()[0];
        const caps = track && track.getCapabilities ? track.getCapabilities() : null;
        if (caps && caps.zoom && caps.zoom.min != null) {
          await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
        }
      } catch (e) { /* not adjustable on this device — the wide request already helps */ }

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
      // a lock listener must never outlive the screen that armed it
      if (lockCleanup.current) { lockCleanup.current(); lockCleanup.current = null; }
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
    // Keep the phone camera's real resolution (up to a 2160px long side) so
    // photos look native-sharp; q0.92 keeps them crisp at a sane file size.
    const MAXL = 2160;
    let w = v.videoWidth || 1080;
    let h = v.videoHeight || 1920;
    const scale = Math.min(1, MAXL / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const pctx = canvas.getContext('2d');
    /* THE MIRROR. A selfie preview is flipped, so the person frames the
       shot against a mirrored picture — and the file was being written
       un-mirrored, which is a different photo from the one they took.
       Anything drawn on top is positioned against what they saw, so the
       flip belongs to the video and stops there. */
    if (facing === 'user') { pctx.save(); pctx.translate(w, 0); pctx.scale(-1, 1); }
    pctx.drawImage(v, 0, 0, w, h);
    if (facing === 'user') pctx.restore();
    setShot({ uri: canvas.toDataURL('image/jpeg', 0.92), kind: 'photo', ext: 'jpg', contentType: 'image/jpeg' });
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
      // Always composite on web so EVERY in-app reel carries our baked
      // watermark (plus any game/effect). Falls back to the raw stream only
      // if the browser can't capture a canvas stream.
      const v = videoRef.current;
      if (isWeb && !isWebKit && v && (v.videoWidth || 0) > 0) {
        const canvas = compCanvasRef.current || document.createElement('canvas');
        compCanvasRef.current = canvas;
        if (canvas.captureStream) {
          const w = (canvas.width = v.videoWidth), h = (canvas.height = v.videoHeight);
          const ctx = canvas.getContext('2d');
          const filter = cssFilter && cssFilter !== 'none' ? cssFilter : 'none';
          const eff = effectId, parts = particlesRef.current, gc = gameCard, rg = reelGame;
          const mark = (user && user.user_metadata && user.user_metadata.name)
            ? '@' + String(user.user_metadata.name).replace(/\s+/g, '').toLowerCase().slice(0, 18) : '';
          const t0 = performance.now();
          const mirror = facing === 'user';
          const draw = () => {
            try {
              if ('filter' in ctx) ctx.filter = filter;
              // the flip belongs to the picture, not to what sits on it
              if (mirror) { ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); }
              ctx.drawImage(v, 0, 0, w, h);
              if (mirror) ctx.restore();
              if ('filter' in ctx) ctx.filter = 'none';
              if (eff === 'pixel' || eff === 'arcade') applyPixelate(ctx, w, h); // cheap per-frame; cartoon is photo-only (per-frame read is too heavy)
              drawEffectsCanvas(ctx, w, h, eff, parts, performance.now() - t0);
              drawLens(ctx, w, h, lensRef.current, performance.now() - t0);
              if (rg) drawReelCardCanvas(ctx, w, h, rg, performance.now() - t0);
              else if (gc) drawSimpleCardCanvas(ctx, w, h, gc);
              drawWatermark(ctx, w, h, mark, performance.now() - t0);
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
      /* 4.5 Mbps at 1080p is broadcast quality and roughly 34 MB a
         minute — past what the storage bucket accepts in one file, and
         a long upload on mobile data for a difference nobody can see on
         a phone screen.

         Now that a reel can run the full three minutes, the bitrate has
         to be chosen so that the longest possible recording still fits
         without needing a second pass: 1.8 Mbps is about 40MB for three
         minutes, and still sharp on a phone. A shorter clip is simply a
         smaller file. */
      const opts = { videoBitsPerSecond: 1800000 };
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
        const uri = URL.createObjectURL(blob);
        /* Hold on to the Blob. Safari cannot reliably fetch() its own
           blob: URL back — that is what produced "the upload didn't
           reach the server" on a perfectly good connection — so the
           uploader gets the file itself rather than a link to it. */
        setShot({ uri, blob, bytes: blob.size, kind: 'video', ext, contentType: actual, baked: composite });
        if (!blob.size) {
          setClipWarn('The recording came out empty — nothing was captured. Try again, and hold the button a little longer 🎥');
          return;
        }
        probeClip(uri);
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

  /* Look at the clip we just got before anyone posts it. A recording
     that came out entirely black used to sail through: it had the right
     size and the right duration, so nothing complained until it was
     already on someone's profile. Sampling one real frame is the only
     way to know. This warns, it never blocks — a genuinely dark night
     clip is still the user's to post. */
  const [uploadRaw, setUploadRaw] = useState(null);   // owner-only: the real error
  /* A lens is placed, not tracked. Browsers cannot follow a face on a
     phone without shipping a model, so you drag it where you want it
     and it stays — which also means it never slides off your chin
     halfway through a recording. */
  const [lens, setLens] = useState(null);   // { id, x, y, s } in 0..1 of the frame

  /* ── THE LENS FINDS YOUR FACE ──────────────────────────────────────
     A lens you have to drag onto your own head is a sticker. This
     watches the viewfinder and puts it where your face actually is,
     following you as you move — see src/lib/faceDetect.js for why it's
     a 234KB cascade and not a 6MB model.

     Two rules it follows:

     Detection is not free (about 40–80ms a pass), so it runs a few
     times a second rather than every frame, and the tracker eases
     between readings. Easing is also what stops a hat shivering on
     your head — raw readings jitter by a pixel or two every time.

     And the moment you drag it yourself, tracking stops. You have said
     where you want it, and an app that argues with your thumb is worse
     than one that never helped. Picking a lens again starts it over. */
  const [faceTracking, setFaceTracking] = useState(true);
  const trackerRef = useRef(null);
  const lensKindRef = useRef(null);

  useEffect(() => {
    if (!isWeb || !lens || !faceTracking) return undefined;
    let stopped = false;
    let timer = null;
    if (!trackerRef.current) trackerRef.current = makeFaceTracker({ ease: 0.35, holdMs: 800 });

    (async () => {
      const ok = await loadFaceDetector();
      if (!ok || stopped) return;          // no cascade → the drag still works
      const tick = () => {
        if (stopped) return;
        const el = videoRef.current;
        if (el && el.videoWidth) {
          const raw = findFace(el);
          const f = trackerRef.current.push(raw);
          if (f) {
            /* The frame is mirrored for the front camera, so what the
               detector calls left is the person's right — flip it or
               the lens lands on the wrong side of the face. */
            const seen = { ...f, x: facing === 'user' ? 1 - f.x : f.x };
            /* Where it goes and how big it is are properties of the
               artwork, so they live with it — see placeOnFace in
               lensArt.js. Treating every wearable the same is what hung
               a beard above somebody's head. */
            if (el.videoWidth && el.videoHeight) {
              setFrameSize((f) => (f.w === el.videoWidth && f.h === el.videoHeight ? f : { w: el.videoWidth, h: el.videoHeight }));
            }
            setLens((cur) => {
              if (!cur) return cur;
              const placed = placeOnFace(cur.id, seen);
              return placed ? { ...cur, ...placed } : cur;
            });
          }
        }
        timer = setTimeout(tick, 140);
      };
      tick();
    })();

    return () => { stopped = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens && lens.id, faceTracking, facing, isWeb]);
  const lensRef = React.useRef(null);
  lensRef.current = lens;
  const [clipWarn, setClipWarn] = useState(null);
  const [firstFrame, setFirstFrame] = useState(null);   // a real frame from the clip
  const [playErr, setPlayErr] = useState(null);         // why the preview won't play
  const [videoOk, setVideoOk] = useState(false);        // it really decoded a frame
  const [diag, setDiag] = useState(null);               // owner-only facts
  const [probeDone, setProbeDone] = useState(false);    // the frame check has finished
  const previewOkRef = useRef(false);   // the preview got the clip open — no second element needed
  /* ── ONE VIDEO ELEMENT AT A TIME ──────────────────────────────────
     This used to build its own <video> and load the clip into it while
     the preview was loading the very same blob. On iOS that is a fight
     only one of them can win, and the probe won: Ayser's diagnostics
     read `probe: 480x854` — the file decoded perfectly — next to
     `video: 0x0 ready=0` for the preview beside it. A black screen
     caused entirely by us asking twice.

     So the probe waits. The preview is already mounted, already has the
     clip, and already tells us when it has loaded — so it does the
     measuring, and this only builds an element of its own if the
     preview never manages it, by which time nothing is competing. */
  const probeFromElement = (el) => {
    if (!el || !el.videoWidth) return;
    try {
      const w = el.videoWidth, h = el.videoHeight;
      setDiag((d) => ({ ...(d || {}), pw: w, ph: h }));
      const c = document.createElement('canvas');
      c.width = 64; c.height = Math.max(1, Math.round((h / w) * 64));
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(el, 0, 0, c.width, c.height);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      let peak = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > peak) peak = d[i];
        if (d[i + 1] > peak) peak = d[i + 1];
        if (d[i + 2] > peak) peak = d[i + 2];
      }
      if (peak >= 10) {
        const big = document.createElement('canvas');
        big.width = Math.min(720, w); big.height = Math.round(big.width * (h / w));
        big.getContext('2d').drawImage(el, 0, 0, big.width, big.height);
        try { setFirstFrame(big.toDataURL('image/jpeg', 0.82)); } catch (e) {}
      }
      setDiag((d2) => ({ ...(d2 || {}), peak }));
      setProbeDone(true);
      setClipWarn(peak < 10 ? 'This clip came out completely black. Record it again — and check the camera isn\'t covered 🎥' : null);
    } catch (e) { setProbeDone(true); }
  };

  const probeClip = (uri) => {
    setClipWarn(null); setFirstFrame(null); setPlayErr(null); setVideoOk(false); setDiag(null); setProbeDone(false);
    previewOkRef.current = false;
    if (!isWeb || !uri) return;
    let done = false;
    /* Give the preview a clear run at it first. Only if it hasn't
       managed after four seconds do we load a second copy ourselves. */
    setTimeout(() => {
      if (done || previewOkRef.current) return;
      startFallbackProbe(uri);
    }, 4000);
    const startFallbackProbe = (u) => {
    const el = document.createElement('video');
    el.muted = true; el.playsInline = true; el.preload = 'auto'; el.src = u;
    const finish = (msg) => { if (!done) { done = true; setProbeDone(true); setClipWarn(msg); try { el.src = ''; } catch (e) {} } };
    const grab = () => {
      try {
        const w = el.videoWidth, h = el.videoHeight;
        setDiag((d) => ({ ...(d || {}), pw: w, ph: h }));
        if (!w || !h) return finish('This clip has no picture — try recording it again.');
        const c = document.createElement('canvas');
        c.width = 64; c.height = Math.max(1, Math.round((h / w) * 64));
        const cx = c.getContext('2d');
        cx.drawImage(el, 0, 0, c.width, c.height);
        const d = cx.getImageData(0, 0, c.width, c.height).data;
        let peak = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > peak) peak = d[i];
          if (d[i + 1] > peak) peak = d[i + 1];
          if (d[i + 2] > peak) peak = d[i + 2];
        }
        /* Keep the frame. If the browser then refuses to play the clip
           back — which is a different failure from a bad recording —
           this still shows the person their own shot instead of a
           black rectangle, and it tells the two failures apart:
           a picture here with a black preview means playback, a black
           picture means the recording. */
        if (peak >= 10) {
          const big = document.createElement('canvas');
          big.width = Math.min(720, w); big.height = Math.round(big.width * (h / w));
          big.getContext('2d').drawImage(el, 0, 0, big.width, big.height);
          try { setFirstFrame(big.toDataURL('image/jpeg', 0.82)); } catch (e) {}
        }
        setDiag((d) => ({ ...(d || {}), peak }));
        finish(peak < 10 ? 'This clip came out completely black. Record it again — and check the camera isn\'t covered 🎥' : null);
      } catch (e) { finish(null); } // cross-origin frame we can't read: say nothing
    };
    el.onloadeddata = () => { try { el.currentTime = Math.min(0.25, (el.duration || 1) / 4); } catch (e) { grab(); } };
    el.onseeked = grab;
    el.onerror = () => finish('This video won\'t play here — try a different clip or record a new one.');
    /* If six seconds pass and we learned nothing, say that — a silent
       give-up is what left a black rectangle with no explanation. */
    setTimeout(() => finish(done ? null : 'This clip didn’t open in the browser. It may still post fine — or record a new one to be sure.'), 6000);
    };
  };

  const stopRecording = () => {
    clearInterval(recTimer.current);
    setRecording(false);
    lockRef.current = false;
    setLocked(false);
    detachLock();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  /* ── SLIDE UP TO LOCK ──────────────────────────────────────────────
     A reel can run three minutes now, and holding a finger on the glass
     for three minutes is not something anybody would do. So the shutter
     works the way every voice note does: hold to start, slide your
     thumb up to lock it hands-free, then tap once to stop. Holding it
     the whole way still works exactly as before, for a short clip. */
  const detachLock = () => {
    if (lockCleanup.current) { lockCleanup.current(); lockCleanup.current = null; }
  };

  const armLock = () => {
    if (typeof window === 'undefined') return;
    const move = (ev) => {
      const y = ev.touches && ev.touches.length ? ev.touches[0].clientY : ev.clientY;
      if (typeof y !== 'number') return;
      if (startYRef.current - y > 60) {
        lockRef.current = true;
        setLocked(true);
        tapMedium();
        detachLock();
      }
    };
    const off = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('touchmove', move);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    lockCleanup.current = off;
  };

  /* ── the shutter: tap = photo, hold = video, slide up = hands-free ── */
  const onShutterDown = (e) => {
    heldRef.current = false;
    if (isWebKit) return;                 // iPhone: video goes through the camera app
    if (lockRef.current) { pendingStopRef.current = true; return; }   // locked: this tap ends it
    const ne = e && e.nativeEvent;
    startYRef.current = (ne && (ne.pageY != null ? ne.pageY : ne.locationY)) || 0;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      startRecording();
      armLock();
    }, 260);
  };
  const onShutterUp = () => {
    clearTimeout(holdTimer.current);
    if (pendingStopRef.current) { pendingStopRef.current = false; stopRecording(); return; }
    detachLock();
    if (lockRef.current) return;          // recording hands-free — nothing to do
    if (heldRef.current) stopRecording();
    else takePhoto();
  };

  /* On the web we ask for the file directly instead of going through
     the picker's blob: URL. Safari cannot reliably fetch its own blob
     URLs back — that is what made a large reel refuse to upload at all
     — and a real File measures and uploads without any of that. */
  const pickFromDisk = (accept, capture) => new Promise((resolve) => {
    if (!isWeb || typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // `capture` opens the phone's own camera instead of its library
    if (capture) input.setAttribute('capture', capture === true ? 'user' : capture);
    input.onchange = () => resolve((input.files && input.files[0]) || null);
    input.click();
  });

  /* ── VIDEO ON IPHONE ────────────────────────────────────────────────
     Safari's own recorder hands back a file Safari itself cannot play:
     4.8 MB on disk, 0×0 on screen, readyState 0 — which is exactly why
     reels came out black and would not post. That is a browser defect
     we cannot patch from here, so on WebKit we stop asking it to
     record and hand the job to the camera app, which produces an
     ordinary video that plays and uploads everywhere.

     The cost is honest: a lens or a filter can't be burned into a clip
     the phone records for us. A working reel beats a filtered black
     rectangle, and photos keep every effect. */
  const recordWithPhone = async () => {
    try {
      const file = await pickFromDisk('video/*', 'environment');
      if (!file) return;
      const fit = await fitVideo(file);
      if (!fit) return;
      const mime = fit.contentType || file.type || 'video/mp4';
      const ext = fit.ext || (String(file.name || '').split('.').pop() || 'mp4').toLowerCase();
      const uri = fit.uri === file ? URL.createObjectURL(file) : (typeof fit.uri === 'string' ? fit.uri : URL.createObjectURL(fit.blob || file));
      setShot({ uri, blob: fit.blob || file, bytes: (fit.blob || file).size, kind: 'video', ext, contentType: mime });
      probeClip(uri);
    } catch (e) {
      setCamError('Could not open the camera — try the gallery button.');
    }
  };

  /* The rooms that already exist, offered as chips — a tag somebody can
     tap is a tag that leads somewhere, instead of a guess at spelling. */
  useEffect(() => {
    if (!shot || tagIdeas.length || !SUPABASE_READY) return;
    fetchTopics().then((rows) => {
      setTagIdeas((rows || []).slice()
        .sort((a, b) => (b.moments || 0) - (a.moments || 0))
        .slice(0, 14)
        .map((t) => t.tag));
    }).catch(() => {});
  }, [shot, tagIdeas.length]);

  const addTag = (raw) => {
    const clean = String(raw || '').trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!clean) return;
    const tag = '#' + clean;
    setTags((list) => (list.length >= 5 || list.some((t) => t.toLowerCase() === tag.toLowerCase()) ? list : list.concat(tag)));
    setTagText('');
    tapLight();
  };
  const dropTag = (tag) => { tapLight(); setTags((list) => list.filter((t) => t !== tag)); };

  /* The caption that actually gets posted: what you wrote, plus any tag
     you picked that isn't already in it. */
  const finalCaption = () => {
    const base = caption.trim();
    const extra = tags.filter((t) => !new RegExp('(^|\\s)' + t + '(\\s|$)', 'i').test(base));
    return (base + (extra.length ? (base ? ' ' : '') + extra.join(' ') : '')).trim();
  };

  /* Something already in your library: it is on the server already, so
     there is nothing left to upload when you post. `remote` tells the
     share step to use the URL as it stands instead of sending the same
     bytes up a second time. */
  const useFromLibrary = (row) => {
    setLibraryOpen(false);
    if (!row || !row.url) return;
    const isVid = row.kind === 'video';
    setShot({
      uri: row.url,
      blob: null,
      remote: true,
      libraryId: row.id,
      bytes: row.bytes || null,
      kind: isVid ? 'video' : 'photo',
      ext: isVid ? 'mp4' : 'jpg',
      contentType: isVid ? 'video/mp4' : 'image/jpeg',
    });
    if (isVid) probeClip(row.url);
  };

  /* ── gallery: upload a photo or video from your library into a
     story/reel — with the full sound rail available in preview ── */
  const pickFromLibrary = async () => {
    try {
      if (isWeb) {
        const file = await pickFromDisk('video/*,image/*');
        if (!file) return;
        const isVid = /^video\//.test(file.type || '');
        let fit = { blob: file };
        if (isVid) { fit = await fitVideo(file); if (!fit) return; }
        const body = fit.blob || file;
        const mime = fit.contentType || file.type || (isVid ? 'video/mp4' : 'image/jpeg');
        const ext = fit.ext || (file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase();
        const uri = URL.createObjectURL(body);
        // keep the File: it uploads without Safari ever fetching a blob URL
        setShot({ uri, blob: body, bytes: body.size, kind: isVid ? 'video' : 'photo', ext, contentType: mime });
        if (isVid) probeClip(uri);
        return;
      }
      // 9:16 crop for photos (native only — ignored for video and on web,
      // where no crop UI exists) so a gallery upload matches the story/reel shape
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsEditing: true, aspect: [9, 16] });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        const isVid = (a.type || '').startsWith('video') || /^video\//.test(a.mimeType || '');
        if (isVid && !(await fitVideo(a.uri))) return; // too big → clear message, not 'Load failed'
        const mime = a.mimeType || (isVid ? 'video/mp4' : 'image/jpeg');
        const ext = (mime.split('/')[1] || (isVid ? 'mp4' : 'jpg')).replace('jpeg', 'jpg');
        setShot({ uri: a.uri, kind: isVid ? 'video' : 'photo', ext, contentType: mime });
        if (isVid) probeClip(a.uri);
      }
    } catch (e) { setCamError('Could not open your gallery'); }
  };

  /* A phone-gallery video can easily be 100-300MB (a 90s iPhone clip is) —
     way past the 50MB upload cap. Check the size the moment it's picked
     and say so plainly, instead of letting the upload die with Safari's
     cryptic 'Load failed'. */
  /* ── A CLIP THAT IS TOO BIG GETS SHRUNK, NOT REFUSED ─────────────
     This used to measure the file and send you away to trim it
     yourself. Now it re-encodes: same picture at a sane size, sound
     carried over, cut to the three minutes a reel is allowed. Returns
     what should actually be posted — the smaller file when we managed
     it, the original when we could not, and null when it genuinely
     cannot go (in which case the reason is already on screen).
     See src/lib/videoCompress.js. */
  const fitVideo = async (fileOrUri, meta) => {
    if (!isWeb) return { uri: fileOrUri };
    let blob = null;
    try {
      blob = (fileOrUri && typeof fileOrUri !== 'string') ? fileOrUri : await (await fetch(fileOrUri)).blob();
    } catch (e) { return { uri: fileOrUri }; }   // can't measure → let the upload try

    const info = await probeVideo(blob);
    const seconds = info && info.seconds;
    if (!needsCompressing(blob.size, seconds)) return { uri: fileOrUri, blob, seconds };

    setShrink(0);
    setCamError(null);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    shrinkAbort.current = ctrl;
    let small = null;
    try {
      small = await compressVideo(blob, { onProgress: setShrink, signal: ctrl && ctrl.signal });
    } finally {
      // the overlay covers the whole screen — it must never be left up
      setShrink(null);
      shrinkAbort.current = null;
    }
    if (ctrl && ctrl.signal.aborted) return null;
    if (small) {
      note('video-compressed', { from: small.from, to: small.to, seconds: Math.round(small.seconds) });
      return {
        uri: URL.createObjectURL(small.blob), blob: small.blob, bytes: small.blob.size,
        ext: small.ext, contentType: small.contentType, seconds: small.seconds,
      };
    }
    if (seconds && seconds > REEL_MAX_SECONDS + 0.5) {
      setCamError('That clip is ' + Math.round(seconds / 60) + ' minutes and this browser cannot cut it. A reel goes up to 3 — trim it in Photos and try again ✂️');
      return null;
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      setCamError('That clip is ' + Math.round(blob.size / 1048576) + 'MB and this browser cannot shrink it. Trim it in Photos and try again ✂️');
      return null;
    }
    return { uri: fileOrUri, blob, seconds };
  };

  /* ── long-form video: pick an existing file (works on web + native) ── */
  const pickVideoFile = async () => {
    if (isWeb) {
      try {
        const file = await pickFromDisk('video/*');
        if (!file) return;
        const fit = await fitVideo(file);
        if (!fit) return;
        const body = fit.blob || file;
        const ext = fit.ext || (file.name.split('.').pop() || 'mp4').toLowerCase();
        const uri = URL.createObjectURL(body);
        setShot({ uri, blob: body, bytes: body.size, kind: 'video', ext, contentType: fit.contentType || file.type || 'video/mp4' });
        probeClip(uri);
      } catch (e) { setCamError('Could not open your videos'); }
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 900 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        if (!(await fitVideo(a.uri))) return;
        const raw = (a.fileName || a.uri || 'video.mp4').split('?')[0];
        const ext = (raw.split('.').pop() || 'mp4').toLowerCase();
        setShot({ uri: a.uri, kind: 'video', ext: ext || 'mp4', contentType: a.mimeType || ('video/' + (ext || 'mp4')) });
        probeClip(a.uri);
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
          applyFrameFx(ctx, w, h, effectId); // pixel / cartoon transform the whole photo
          drawEffectsCanvas(ctx, w, h, effectId, particlesRef.current, arcadeStartRef.current ? performance.now() - arcadeStartRef.current : 0);
          drawLens(ctx, w, h, lensRef.current, performance.now());
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
    setUpPct(0);
    // bake the look into the photo's real pixels before uploading
    let workingShot = shot;
    const needsBake = (cssFilter && cssFilter !== 'none') || effectId !== 'none' || !!gameCard || !!reelGame || !!lens;
    // already in your library → already uploaded; posting is instant
    const alreadyUp = !!shot.remote && !(shot.kind === 'photo' && needsBake);
    if (isWeb && shot.kind === 'photo' && needsBake) {
      const baked = await bakeAll(shot.uri);
      workingShot = { ...shot, uri: baked, blob: null, ext: 'jpg', contentType: 'image/jpeg' };
    } else if (isWeb && shot.kind === 'photo') {
      // gallery pictures arrive full-resolution — shrink to feed size
      // (invisible on a phone, ~6x fewer bytes stored & downloaded)
      const small = await compressImage(shot.uri, 1600, 0.85);
      workingShot = { ...shot, uri: small, blob: null, ext: 'jpg', contentType: 'image/jpeg' };
    }
    try {
      // ── Moment mode: send the snap straight into a chat ──
      if (sendMode) {
        let mediaUrl = workingShot.uri;
        if (SUPABASE_READY && user && !alreadyUp) {
          mediaUrl = isWeb
            ? await uploadCapture(user.id, workingShot.blob || workingShot.uri, workingShot.ext, workingShot.contentType, { onProgress: (l, t) => setUpPct(t ? l / t : 0) })
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
        /* A posted video with no still is a blank tile in the grid —
           which is what a reel looked like on the profile. The frame we
           already pulled out for the preview is exactly the right
           picture, so it goes up with the clip. Best effort: no still
           is a worse grid, not a failed post. */
        let thumbUrl = null;
        const mediaUrl = alreadyUp
          ? workingShot.uri
          : isWeb
            ? await uploadCapture(user.id, workingShot.blob || workingShot.uri, workingShot.ext, workingShot.contentType, { onProgress: (l, t) => setUpPct(t ? l / t : 0) })
            : await uploadMedia(user.id, workingShot.uri);
        if (isWeb && workingShot.kind === 'video' && firstFrame) {
          try {
            thumbUrl = await uploadCapture(user.id, firstFrame, 'jpg', 'image/jpeg');
          } catch (e) { thumbUrl = null; }   // a missing still is not a failed post
        }
        if (alreadyUp && shot.libraryId) markUsed(shot.libraryId);
        /* Everything you shoot lands in your library too, so the clip
           you just posted can be posted again somewhere else without
           uploading it a second time. */
        else if (mediaUrl) {
          supabase.from('media_library')
            .insert({ user_id: user.id, url: mediaUrl, kind: workingShot.kind === 'video' ? 'video' : 'photo', bytes: workingShot.bytes || null })
            .then(() => {}, () => {});
        }
        if (mode === 'story') {
          const sticker = stickerType === 'poll' && pollQ.trim() && pollA.trim() && pollB.trim()
            ? { type: 'poll', data: { question: pollQ.trim(), options: [pollA.trim(), pollB.trim()] } }
            : stickerType === 'question' && askQ.trim()
            ? { type: 'question', data: { question: askQ.trim() } }
            : null;
          const row = await createStory(user.id, {
            mediaUrl, caption: finalCaption(), sound, sticker, closeOnly,
            place: onMap ? (placeName.trim() || 'Right here') : null,
            lat: onMap && mapCoords ? mapCoords.latitude : null,
            lng: onMap && mapCoords ? mapCoords.longitude : null,
          });
          if (sound && sound.audio_url) { incrementTrackUse(sound.id); publishSound(sound.id); }
          onPostedStory && onPostedStory({
            id: row.id, createdAt: row.created_at,
            user: { id: user.id, name: 'You', avatar: AV_NEUTRAL }, media: mediaUrl, sound, caption: caption.trim() || null,
            stickerType: sticker && sticker.type, stickerData: sticker && sticker.data,
          });
        } else if (mode === 'video') {
          const row = await createPost({
            userId: user.id, type: 'vod', caption: finalCaption() || '🎬 Video', mediaUrl, thumbUrl,
            place: onMap ? (placeName.trim() || 'Right here') : null,
            lat: onMap && mapCoords ? mapCoords.latitude : null,
            lng: onMap && mapCoords ? mapCoords.longitude : null,
          });
          onPosted && onPosted(row);
        } else {
          const row = await createPost({
            userId: user.id, type: 'reel', caption: finalCaption() || '🎬', mediaUrl, sound, thumbUrl,
            place: onMap ? (placeName.trim() || 'Right here') : null,
            lat: onMap && mapCoords ? mapCoords.latitude : null,
            lng: onMap && mapCoords ? mapCoords.longitude : null,
          });
          if (sound && sound.audio_url) { incrementTrackUse(sound.id); publishSound(sound.id); }
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
      clearDraft();
      onClose();
    } catch (e) {
      // say WHY it failed — "failed" alone helps nobody. Kept too, so
      // the reason survives being dismissed (src/lib/crashLog.js).
      note('upload', e, mode + ' · ' + (workingShot && workingShot.kind));
      const m = (e && e.message) || '';
      setCamError(
        /bucket/i.test(m)
          ? setupNotice('One step left: run the latest supabase/RUN_ME.sql — it creates the media storage bucket uploads need.')
          : /too large|exceed|maximum size|413/i.test(m)
          ? 'That video is over the 48MB the server accepts in one file — trim it shorter and try again.'
          : /row-level security|policy|permission/i.test(m)
          ? setupNotice('Upload blocked by storage permissions — run the latest supabase/RUN_ME.sql to fix the media policies.')
          : /load failed|failed to fetch|network/i.test(m)
          ? 'The upload didn\'t reach the server — check your connection and tap share again (large videos need a steady signal).'
          : (m || 'Could not share — check your connection and try again')
      );
      /* The friendly sentence above hides the only thing that can
         actually diagnose this. The owner gets the real words. */
      if (isOwner(user)) setUploadRaw(m || String(e));
    } finally {
      setBusy(false);
    }
  };

  const recPct = Math.min(1, recMs / MAX_VIDEO_MS);

  /* TikTok-style sound rail — shown while shooting AND on the preview,
     so an uploaded gallery photo can get a song too. */
  /* Listen before you commit. Choosing a sound for a reel used to be a
     guess from a title — now each chip has its own play button and the
     track previews right there, without being attached to anything. */
  const soundPreviewRef = React.useRef(null);
  const [previewId, setPreviewId] = useState(null);

  const togglePreview = (s) => {
    if (!isWeb || !s || !s.audio_url) return;
    tapLight();
    let a = soundPreviewRef.current;
    if (!a) { a = soundPreviewRef.current = new Audio(); a.onended = () => setPreviewId(null); }
    if (previewId === s.id) { a.pause(); setPreviewId(null); return; }
    a.src = s.audio_url;
    a.currentTime = 0;
    a.play().then(() => setPreviewId(s.id)).catch(() => setPreviewId(null));
  };

  // never leave a preview singing after the sheet closes
  useEffect(() => () => { if (soundPreviewRef.current) { try { soundPreviewRef.current.pause(); } catch (e) {} } }, []);

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
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.35)', borderRadius: 999, paddingLeft: 6, paddingRight: 12, paddingVertical: 6, marginRight: 8 }}>
            {/* hear it first */}
            <Pressable onPress={() => togglePreview(s)} hitSlop={8} style={{ marginRight: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={previewId === s.id ? 'pause' : 'play'}
                  size={12}
                  color={on ? C.purple : '#FFF'}
                  style={{ marginLeft: previewId === s.id ? 0 : 1 }}
                />
              </View>
            </Pressable>
            <Pressable onPress={() => chooseSound(s, on)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 13 }}>{s.emoji}</Text>
              <Text style={{ color: on ? C.text : '#FFF', fontSize: 11.5, fontWeight: '800', marginLeft: 5 }} numberOfLines={1}>
                {s.title}
              </Text>
              {on ? <Ionicons name="checkmark" size={13} color={C.purple} style={{ marginLeft: 4 }} /> : null}
            </Pressable>
            {/* which fifteen seconds — only worth offering on a track
                with a real file behind it */}
            {on && s.audio_url ? (
              <Pressable onPress={() => openTrim(sound || s)} hitSlop={8} style={{ marginLeft: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cut-outline" size={13} color={C.purple} />
                  <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900', marginLeft: 3 }}>
                    {(() => { const cl = parseClip(sound && sound.audio_url); return (cl && cl.len ? Math.round(cl.len) : DEFAULT_LEN) + 's'; })()}
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
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
            /* If the browser won't paint the clip, stop asking it to and
               show the frame we pulled out of the file instead. A still
               of your own shot beats a black rectangle, and the clip
               still uploads and plays for everyone else — Safari's
               refusal to preview a freshly recorded MP4 is a preview
               problem, not a file problem. */
            !videoOk && firstFrame && (playErr || probeDone) ? (
              <img src={firstFrame} alt="" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter }} />
            ) : (
            <video
              src={shot.uri}
              poster={firstFrame || undefined}
              autoPlay muted loop playsInline controls={false}
              ref={(el) => {
                if (!el || el.__wired) return;
                el.__wired = true;
                // iOS wants muted set as a property, and a nudge, before
                // it will start a blob on its own
                el.muted = true;
                el.play().catch((e) => setPlayErr((e && e.name) || 'blocked'));
                el.onloadeddata = () => {
                  if (el.videoWidth > 0) { setVideoOk(true); previewOkRef.current = true; }
                  // the clip's own shape, for the lens overlay
                  if (el.videoWidth && el.videoHeight) {
                    setFrameSize((f) => (f.w === el.videoWidth && f.h === el.videoHeight ? f : { w: el.videoWidth, h: el.videoHeight }));
                  }
                  setDiag((d) => ({ ...(d || {}), vw: el.videoWidth, vh: el.videoHeight, ready: el.readyState }));
                  /* The preview has the clip open, so it does the
                     measuring — nothing else needs to load a second
                     copy and fight it for the decoder. */
                  try { el.currentTime = Math.min(0.25, (el.duration || 1) / 4); } catch (e) { probeFromElement(el); }
                };
                el.onseeked = () => probeFromElement(el);
                el.onerror = () => {
                  const c = el.error && el.error.code;
                  setPlayErr(c === 4 ? 'format' : c === 3 ? 'decode' : c === 2 ? 'network' : 'unknown');
                };
                // it can be "playing" and still never paint; check for real
                setTimeout(() => {
                  setDiag((d) => ({ ...(d || {}), vw: el.videoWidth, vh: el.videoHeight, ready: el.readyState, paused: el.paused }));
                  if (el.videoWidth > 0 && el.readyState >= 2) setVideoOk(true);
                  else setPlayErr((e) => e || 'no-paint');
                }, 1800);
              }}
              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter }}
            />
            )
          ) : isWeb ? (
            /* raw <img> so the chosen filter shows LIVE in the preview.
               A picture off the camera roll can be any shape at all, and
               the lens overlay is fitted to whatever it is told the
               frame is — so the picture says so itself. Left to the
               camera's shape, a 4:3 photo would wear its lens in the
               wrong place and the file would disagree again. */
            <img
              src={shot.uri}
              onLoad={(e) => {
                const el = e && e.currentTarget;
                const w = el && (el.naturalWidth || el.width);
                const h = el && (el.naturalHeight || el.height);
                if (w && h) setFrameSize((f) => (f.w === w && f.h === h ? f : { w, h }));
              }}
              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: cssFilter }}
              alt=""
            />
          ) : (
            <Image source={{ uri: shot.uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          )
        ) : isWeb ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            /* The frame's real shape, the moment the camera reports it.
               Everything a lens knows is measured in this, so it must
               not wait for anything else to notice. */
            onLoadedMetadata={(e) => {
              const el = e && e.currentTarget;
              if (el && el.videoWidth && el.videoHeight) {
                setFrameSize((f) => (f.w === el.videoWidth && f.h === el.videoHeight ? f : { w: el.videoWidth, h: el.videoHeight }));
              }
            }}
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: fit === 'wide' ? 'contain' : 'cover', filter: cssFilter, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
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
          <View pointerEvents="none" style={{ position: 'absolute', top: '7%', left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(8,6,20,0.55)', borderRadius: 26, paddingHorizontal: 22, paddingVertical: 18, maxWidth: '90%', minWidth: '62%' }}>
              <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', textAlign: 'center', marginBottom: reelIsSingle(reelGame) ? 6 : 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>
                {reelGame.emoji + '  ' + reelGame.title}
              </Text>
              {reelGame.rows.map((row, i) => {
                const cell = reelCell(row, i, reelSpin);
                return reelIsSingle(reelGame) ? (
                  <Text key={i} style={{ color: '#FFF', fontSize: 19, fontWeight: '800', textAlign: 'center', lineHeight: 26, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>{cell.text}</Text>
                ) : (
                  <View key={i} style={{ alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12.5, fontWeight: '700', marginBottom: 1 }}>{row.label}</Text>
                    <Text style={{ color: cell.locked ? '#FFF' : 'rgba(255,255,255,0.75)', fontSize: 20, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>{cell.text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* swipe layer — drag left/right across the viewfinder to change the
            filter live. Sits under the controls (they're rendered after), and
            only claims horizontal drags so taps & the shutter still work. */}
        {!shot && isWeb ? (
          <View {...swipe.panHandlers} style={{ position: 'absolute', top: 90, bottom: 200, left: 0, right: 0 }} />
        ) : null}
        {filterFlash && !shot ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: '44%', left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(8,6,20,0.6)', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{filterFlash}</Text>
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
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>
                {recMs < 60000
                  ? (recMs / 1000).toFixed(1) + 's'
                  : Math.floor(recMs / 60000) + ':' + String(Math.floor((recMs % 60000) / 1000)).padStart(2, '0')}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <View style={{ width: 28 }} />
        </View>

        {/* THE RIGHT-HAND RAIL — flip, frame, music, effects, games.
            One column of round buttons down the edge, out of the way of
            your own face, the way a camera app does it. */}
        {!shot && isWeb ? (
          <View style={{ position: 'absolute', right: 12, top: insets.top + 64, alignItems: 'center' }}>
            {[
              { k: 'flip', icon: 'camera-reverse-outline', on: false, press: flip },
              { k: 'fit', icon: 'scan-outline', on: fit === 'wide', press: () => { tapLight(); setFit((f) => (f === 'wide' ? 'fill' : 'wide')); } },
              { k: 'sound', icon: 'musical-notes-outline', on: !!sound, press: () => { tapLight(); setHubOpen(true); } },
              { k: 'fx', icon: 'sparkles-outline', on: !!lens || (filterId && filterId !== 'none') || effectId !== 'none', press: () => { tapLight(); setEffectsOpen(true); } },
              { k: 'games', icon: 'game-controller-outline', on: !!reelGame, press: () => { tapLight(); setEffectsOpen(true); } },
            ].map((b) => (
              <Pressable key={b.k} onPress={b.press} hitSlop={8} style={{ marginBottom: 12 }}>
                <View style={{
                  width: 42, height: 42, borderRadius: 21,
                  backgroundColor: b.on ? C.purple : 'rgba(0,0,0,0.42)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={b.icon} size={19} color="#FFF" />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {camError ? (
          <View style={{ position: 'absolute', top: insets.top + 60, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>{camError}</Text>
          </View>
        ) : null}

        {/* Re-encoding a long clip runs at real speed, so silence here
            would read as a freeze. Say what is happening and how far in
            it is. */}
        {shrink != null ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(8,4,18,0.88)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 }}>
            <Text style={{ fontSize: 40 }}>🗜️</Text>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
              Making it smaller so it fits
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
              Same clip, same sound — a fraction of the size. This runs at
              real speed, so a long video takes about as long as it is.
            </Text>
            <View style={{ marginTop: 18, width: '100%', maxWidth: 280, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <View style={{ width: Math.max(3, Math.round(shrink * 100)) + '%', height: '100%', backgroundColor: '#20E3D2' }} />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '900', marginTop: 9 }}>{Math.round(shrink * 100)}%</Text>
            <Pressable
              onPress={() => { tapLight(); if (shrinkAbort.current) { try { shrinkAbort.current.abort(); } catch (e) {} } }}
              style={{ marginTop: 20 }}
            >
              <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 10 }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* The browser has the clip but won't play it. The frame above is
            real, so the recording is fine and posting it is safe — this
            just explains why it isn't moving. */}
        {playErr && !clipWarn && shot && shot.kind === 'video' ? (
          <View style={{ position: 'absolute', top: insets.top + 60, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 14, padding: 13 }}>
            <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700', textAlign: 'center', lineHeight: 18 }}>
              {firstFrame
                ? 'Safari won\u2019t play this clip back here (' + playErr + '), but your shot is fine — the frame above is really it. Posting works.'
                : 'This clip won\u2019t play in the browser (' + playErr + '). Try recording a new one.'}
            </Text>
          </View>
        ) : null}

        {/* the lens, live over the viewfinder — drag it, pinch the
            slider to size it. What you see here is exactly what gets
            baked, because both call the same draw function. */}
        {lens ? (
          <LensLayer
            lens={lens}
            frame={frameSize}
            /* the shot previews are always cover; only the live
               viewfinder honours wide mode, and the overlay has to be
               fitted the same way as whatever is underneath it */
            fit={shot ? 'cover' : (fit === 'wide' ? 'contain' : 'cover')}
            onMove={(x, y) => {
              // your thumb wins — the app stops moving it from here
              if (faceTracking) setFaceTracking(false);
              setLens((l) => (l ? { ...l, x, y } : l));
            }}
          />
        ) : null}

        {/* the arcade round, live. The blocky pixels are added when the
            frame is baked; the HUD is live so you can pose to it. */}
        {effectId === 'arcade' && isWeb ? <ArcadeLayer startRef={arcadeStartRef} /> : null}

        {/* Owner only — the facts, so a black preview can be diagnosed
            from one screenshot instead of another round of guessing.
            No normal user ever sees this. */}
        {isOwner(user) && shot && shot.kind === 'video' ? (
          <View style={{ position: 'absolute', top: insets.top + 56, left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.88)', borderRadius: 10, padding: 9, zIndex: 40 }}>
            <Text style={{ color: '#7CF', fontSize: 10.5, fontWeight: '700', lineHeight: 15 }}>
              {'webkit=' + (isWebKit ? 'Y' : 'N') +
               '  baked=' + (shot.baked ? 'Y' : 'N') +
               '  ' + (shot.contentType || '?') + '.' + (shot.ext || '?') + '\n' +
               'bytes=' + (shot.bytes != null ? shot.bytes : '—') +
               '  blobHeld=' + (shot.blob ? 'Y' : 'N') + '\n' +
               'probe: ' + (diag && diag.pw ? diag.pw + 'x' + diag.ph : '—') +
               '  peak=' + (diag && diag.peak != null ? diag.peak : '—') +
               '  frame=' + (firstFrame ? 'Y' : 'N') + '\n' +
               'video: ' + (diag && diag.vw != null ? diag.vw + 'x' + diag.vh : '—') +
               '  ready=' + (diag && diag.ready != null ? diag.ready : '—') +
               '  paused=' + (diag && diag.paused != null ? String(diag.paused) : '—') + '\n' +
               'ok=' + (videoOk ? 'Y' : 'N') + '  err=' + (playErr || 'none') + '  done=' + (probeDone ? 'Y' : 'N')}
            </Text>
          </View>
        ) : null}

        {uploadRaw && isOwner(user) ? (
          <View style={{ position: 'absolute', top: insets.top + 150, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 10, padding: 10, zIndex: 45 }}>
            <Text style={{ color: '#FCA5A5', fontSize: 10.5, fontWeight: '700', lineHeight: 15 }}>{uploadRaw}</Text>
          </View>
        ) : null}

        {/* the clip itself is wrong — say so here, before it's posted */}
        {clipWarn && shot ? (
          <View style={{ position: 'absolute', top: insets.top + 60, left: 24, right: 24, backgroundColor: 'rgba(220,38,38,0.92)', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 19 }}>{clipWarn}</Text>
          </View>
        ) : null}

        {/* ── bottom controls ── */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 16 }}>
          {!shot ? (
            <>
              {/* THE LENS CAROUSEL — always there, right of the shutter,
                  the way a camera does it. Swipe it, tap one, wear it.
                  The ✨ at the end opens the whole drawer. */}
              {/* ── LENSES, WHEN YOU WANT THEM ────────────────────
                  Fourteen lens circles and five category tabs used to
                  sit permanently over the viewfinder, which is most of
                  what made this screen feel like a control panel rather
                  than a camera. They live behind the smiley now: the
                  default screen is the picture and the shutter, and the
                  lenses are one tap away when you actually want one. */}
              {lensRailOpen ? (
              <>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, alignItems: 'center', marginBottom: 8 }}
              >
                <Pressable onPress={() => { tapLight(); setLens(null); }}>
                  <View style={{ alignItems: 'center', marginRight: 10, opacity: lens ? 0.5 : 1 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 2, borderColor: lens ? 'transparent' : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={18} color="#FFF" />
                    </View>
                  </View>
                </Pressable>
                {LENSES.map((l) => {
                  const on = lens && lens.id === l.id;
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => {
                        tapMedium(); sfxPop();
                        lensKindRef.current = l.kind; if (trackerRef.current) trackerRef.current.reset(); setFaceTracking(true); setLens(on ? null : { id: l.id, x: 0.5, y: l.kind === 'wear' ? 0.45 : 0.5, s: 0.30 });
                      }}
                    >
                      <View style={{ alignItems: 'center', marginRight: 10 }}>
                        <View style={{
                          width: on ? 62 : 52, height: on ? 62 : 52, borderRadius: 31,
                          backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.14)',
                          borderWidth: 2, borderColor: on ? C.gold : 'rgba(255,255,255,0.3)',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: on ? 26 : 22 }}>{l.emoji}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => { tapLight(); setEffectsOpen(true); }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="sparkles" size={20} color="#FFF" />
                  </View>
                </Pressable>
              </ScrollView>

              {/* No size stepper. There is exactly one right size for a
                  lens on a given face and the app knows it now — a
                  minus and a plus were only ever there because it
                  didn't. */}

              </>
              ) : null}

              {/* the strip under it, like a camera's category row */}
              {lensRailOpen ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', marginBottom: 10 }}>
                <Pressable onPress={() => { tapLight(); setEffectsOpen(true); }} style={{ marginRight: 14 }}>
                  <Ionicons name="game-controller-outline" size={20} color="#FFF" />
                </Pressable>
                {[
                  { k: 'you', label: 'For You' },
                  { k: 'faces', label: 'Faces' },
                  { k: 'colour', label: 'Colour' },
                  { k: 'fun', label: 'Fun' },
                  { k: 'games', label: 'Games' },
                ].map((t) => (
                  <Pressable key={t.k} onPress={() => { tapLight(); setEffectsOpen(true); }}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.k === 'you' ? 'rgba(0,0,0,0.5)' : 'transparent' }}>
                      <Text style={{ color: t.k === 'you' ? '#FFF' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: t.k === 'you' ? '900' : '700' }}>{t.label}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              ) : null}

              {/* One tap to the lenses, and one tap back. This is the
                  only thing standing between the viewfinder and the
                  whole effects drawer. */}
              <Pressable onPress={() => { tapLight(); setLensRailOpen((v) => !v); }} style={{ alignSelf: 'center', marginBottom: 10 }}>
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: lensRailOpen ? '#FFF' : 'rgba(0,0,0,0.45)',
                  borderWidth: 1, borderColor: lensRailOpen ? '#FFF' : 'rgba(255,255,255,0.45)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={lensRailOpen ? 'chevron-down' : 'happy-outline'} size={22} color={lensRailOpen ? '#111' : '#FFF'} />
                  {lens && !lensRailOpen ? (
                    <View style={{ position: 'absolute', top: 4, right: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: C.gold, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)' }} />
                  ) : null}
                </View>
              </Pressable>

              {/* what you're wearing right now, in one line */}
              {sound ? (
                <Pressable onPress={() => { tapLight(); setHubOpen(true); }} style={{ alignSelf: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Ionicons name="musical-notes" size={13} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800', marginLeft: 6 }} numberOfLines={1}>
                      {sound.title}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {/* shutter row — gallery upload on the left, shutter center */}
              {isWeb ? (
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={() => { tapLight(); setLibraryOpen(true); }} hitSlop={8} style={{ marginRight: 34 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="albums-outline" size={22} color="#FFF" />
                      </View>
                    </Pressable>
                    <Pressable onPressIn={onShutterDown} onPressOut={onShutterUp} disabled={!!camError}>
                      <View style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: recording ? C.coral : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: recording ? 34 : 62, height: recording ? 34 : 62, borderRadius: recording ? 9 : 31, backgroundColor: recording ? C.coral : '#FFF' }} />
                        {locked ? (
                          <View style={{ position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: C.coral, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>🔒</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                    {isWebKit ? (
                      <Pressable onPress={() => { tapLight(); recordWithPhone(); }} hitSlop={8} style={{ marginLeft: 34 }}>
                        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="videocam" size={22} color="#FFF" />
                        </View>
                      </Pressable>
                    ) : (
                      <View style={{ width: 46, marginLeft: 34 }} />
                    )}
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', marginTop: 10 }}>
                    {isWebKit
                      ? 'Tap for photo · 🎥 for video · 📚 your library'
                      : recording
                        ? (locked ? '🔒 Hands-free — tap to stop' : 'Slide up to lock 🔒 · up to 3 minutes')
                        : 'Tap for photo · hold for video · 📚 your library'}
                  </Text>
                  {isWebKit ? (
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, marginTop: 5, textAlign: 'center', paddingHorizontal: 24, lineHeight: 15 }}>
                      Video records in your camera app — Safari's own recorder makes a file it can't play back.
                    </Text>
                  ) : null}
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
            /* ── preview ──────────────────────────────────────────────
               Everything used to be open at once: a strip of filters, a
               strip of songs, stickers, five hashtag chips, a map
               toggle, a caption and a button — a wall you had to read
               before you could post a photo of your coffee.

               Now the picture is the screen. Four small round buttons
               say what else is possible, one panel opens at a time, and
               nothing is open to begin with. A button carries a dot
               when there is something in it, so nothing you set is
               hidden from you. ── */
            <View>
              {/* real filters — tap to try, baked into the photo on send */}
              {panel === 'looks' ? (
              <>
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
              </>
              ) : null}

              {panel === 'looks' && editOpen ? (
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

              {mode !== 'video' && panel === 'sound' ? soundRail : null}
              {/* ── the tool rail ─────────────────────────────────
                  Four buttons instead of four open drawers. The dot
                  means there is something in there already, so a
                  closed panel never hides a choice you made. */}
              {!sendMode ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                  {[
                    { k: 'looks', icon: 'color-wand-outline', label: 'Looks', set: filterId !== 'none' || effectId !== 'none' || !!lens },
                    { k: 'sound', icon: 'musical-notes-outline', label: 'Sound', set: !!sound },
                    { k: 'tags', icon: 'pricetag-outline', label: 'Tags', set: tags.length > 0 },
                    { k: 'place', icon: 'location-outline', label: 'Place', set: !!onMap },
                  ].map((b) => {
                    const open = panel === b.k;
                    return (
                      <Pressable
                        key={b.k}
                        onPress={() => { tapLight(); setPanel(open ? null : b.k); }}
                        style={{ alignItems: 'center', marginHorizontal: 12 }}
                      >
                        <View style={{
                          width: 48, height: 48, borderRadius: 24,
                          backgroundColor: open ? '#FFF' : 'rgba(255,255,255,0.16)',
                          borderWidth: 1, borderColor: open ? '#FFF' : 'rgba(255,255,255,0.35)',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name={b.icon} size={21} color={open ? '#111' : '#FFF'} />
                          {b.set && !open ? (
                            <View style={{ position: 'absolute', top: 5, right: 5, width: 9, height: 9, borderRadius: 5, backgroundColor: C.gold, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)' }} />
                          ) : null}
                        </View>
                        <Text style={{ color: open ? '#FFF' : 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '800', marginTop: 5 }}>{b.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={{ paddingHorizontal: 16 }}>
              {/* story-only: add a Poll or an Ask-me-anything sticker */}
              {mode === 'story' && !sendMode && panel === 'tags' ? (
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
              {/* WHAT IT'S ABOUT — up to five tags. The chips are rooms
                  that already exist, so a tapped tag lands somewhere
                  instead of being a guess at spelling. */}
              {!sendMode && panel === 'tags' ? (
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Ionicons name="pricetag-outline" size={13} color="rgba(255,255,255,0.75)" />
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5, fontWeight: '800', marginLeft: 6 }}>
                      Hashtags · {tags.length}/5
                    </Text>
                  </View>

                  {tags.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                      {tags.map((t) => (
                        <Pressable key={t} onPress={() => dropTag(t)}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginRight: 6, marginBottom: 6 }}>
                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t}</Text>
                            <Ionicons name="close" size={12} color="#FFF" style={{ marginLeft: 5 }} />
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {tags.length < 5 ? (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 10 }}>
                        {tagIdeas.filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase())).map((t) => (
                          <Pressable key={t} onPress={() => addTag(t)}>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginRight: 6 }}>
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{t}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, marginTop: 7 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '900' }}>#</Text>
                        <TextInput
                          placeholder="your own tag"
                          placeholderTextColor="rgba(255,255,255,0.45)"
                          value={tagText}
                          onChangeText={setTagText}
                          onSubmitEditing={() => addTag(tagText)}
                          returnKeyType="done"
                          autoCapitalize="none"
                          style={{ flex: 1, color: '#FFF', fontSize: 13, paddingVertical: Platform.OS === 'ios' ? 9 : 4, marginLeft: 4 }}
                        />
                        {tagText.trim() ? (
                          <Pressable onPress={() => addTag(tagText)} hitSlop={8}>
                            <Text style={{ color: C.gold, fontSize: 12.5, fontWeight: '900' }}>Add</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              {/* Put it on the map — where it happened, like a pin you
                  drop. Off by default: your location is never shared
                  unless you switch this on for that post. */}
              {!sendMode && panel === 'place' ? (
                <View style={{ marginBottom: 10 }}>
                  <Pressable onPress={toggleOnMap} style={{ alignSelf: 'flex-start' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: onMap ? C.purple : 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: onMap ? C.purple : 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
                      <Ionicons name={gpsBusy ? 'hourglass-outline' : onMap ? 'location' : 'location-outline'} size={14} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900', marginLeft: 6 }}>
                        {gpsBusy ? 'Finding you…' : onMap ? 'On the map ✓' : 'Add to the map'}
                      </Text>
                    </View>
                  </Pressable>
                  {onMap ? (
                    <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 2 }}>
                      <TextInput
                        placeholder="Name this spot (optional)"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={placeName}
                        onChangeText={setPlaceName}
                        style={{ color: '#FFF', fontSize: 13 }}
                      />
                    </View>
                  ) : null}

                  {/* Just the smaller circle. The green ring is the
                      signal everyone already reads as "not everyone",
                      and the restriction is enforced by the read policy
                      on the table — not by us hiding the story. */}
                  {mode === 'story' ? (
                    <Pressable onPress={() => { tapSelection(); setCloseOnly((v) => !v); }} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: closeOnly ? C.green : 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: closeOnly ? C.green : 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
                        <Ionicons name={closeOnly ? 'star' : 'star-outline'} size={14} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900', marginLeft: 6 }}>
                          {closeOnly ? 'Close Friends only ✓' : 'Close Friends only'}
                        </Text>
                      </View>
                    </Pressable>
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
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>
                      {busy
                        ? (upPct > 0 ? 'Sending… ' + Math.round(upPct * 100) + '%' : 'Sending…')
                        : sendMode ? 'Send Moment 🔥' : mode === 'story' ? 'Add to Story' : mode === 'video' ? 'Post Video' : 'Post Reel'}
                    </Text>
                    {sendMode ? null : <MaterialCommunityIcons name="star-four-points" size={15} color={C.gold} style={{ marginLeft: 6 }} />}
                  </LinearGradient>
                </Pressable>
              </View>
              </View>
            </View>
          )}
        </View>

        {hubOpen ? <MusicHubSheet onPick={(t) => chooseSound(t, false)} onClose={() => setHubOpen(false)} /> : null}
        {trimming ? (
          <SoundTrimmer
            sound={trimming}
            onDone={(s) => { setSound(s); setTrimming(null); }}
            onClose={() => setTrimming(null)}
          />
        ) : null}

        {/* everything you've already uploaded — pick one and posting is
            instant, because the file is already up there */}
        {libraryOpen ? (
          <MediaLibrarySheet inline onPick={useFromLibrary} onClose={() => setLibraryOpen(false)} />
        ) : null}

        {/* the whole drawer: lenses, looks, overlays and games */}
        {effectsOpen ? (
          <EffectsSheet
            inline
            lenses={LENSES}
            filters={FILTERS}
            effects={EFFECTS}
            games={reelGames}
            lensId={lens && lens.id}
            filterId={filterId}
            effectId={effectId}
            gameId={reelGame && reelGame.id}
            onPickLens={(l) => { sfxPop(); lensKindRef.current = l.kind; if (trackerRef.current) trackerRef.current.reset(); setFaceTracking(true); setLens({ id: l.id, x: 0.5, y: l.kind === 'wear' ? 0.45 : 0.5, s: 0.30 }); setEffectsOpen(false); }}
            onPickFilter={(f) => { setFilterId(f.id); setEffectsOpen(false); }}
            onPickEffect={(e) => { pickEffect(e.id); setEffectsOpen(false); }}
            onPickGame={(g) => { pickReelGame(g); setEffectsOpen(false); }}
            onClear={() => { setLens(null); setFilterId('none'); pickEffect('none'); clearReelGame(); }}
            onClose={() => setEffectsOpen(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
};
