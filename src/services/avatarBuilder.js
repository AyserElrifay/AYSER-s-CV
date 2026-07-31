/* ── MOMENTS AVATAR · your cartoon persona ──────────────────────────
   Not a photo — a customizable character (skin, hair, eyes, outfit,
   mood) that represents you on the map, in chat and in the games.

   The art itself is OURS: services/avatarArt.js paints it on a canvas,
   so it needs no network, can't fail, stays crisp at any size, and the
   same code can draw you into a game or a sticker. The hosted image
   service below stays only as a fallback for builds with no canvas.

   Nothing is stored as a picture — just a small traits string in
   profiles.avatar_dna — so it's cheap to keep and instant to change. */

import { avatarToRoundDataUrl } from './avatarArt';
import { characterToDataUrl } from './characterArt';

const API = 'https://api.dicebear.com/9.x/personas/svg';

export const SKIN_TONES = ['#f2d3b1', '#e8b48c', '#d8a877', '#c68863', '#a56f4a', '#8d5a3b', '#6b4226'];
export const HAIR_COLORS = ['#2c1b18', '#4a3324', '#71491e', '#a56b2b', '#d4a017', '#e8c368', '#8b8b8b', '#e0e0e0', '#7c3aed', '#f43f5e'];
export const CLOTHING_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F5B301', '#F43F5E', '#111827', '#FFFFFF', '#EC4899'];

/* IMPORTANT: these ids must be EXACT DiceBear "personas" enum values —
   an invalid value makes the API return 400 and the avatar image
   breaks for everyone (that was the broken-📷 bug on the map). */
export const HAIR_STYLES = [
  { id: 'bald', label: 'Bald', emoji: '👤' },
  { id: 'buzzcut', label: 'Buzzcut', emoji: '💇‍♂️' },
  { id: 'cap', label: 'Cap', emoji: '🧢' },
  { id: 'beanie', label: 'Beanie', emoji: '🎿' },
  { id: 'curly', label: 'Curly', emoji: '🦱' },
  { id: 'curlyBun', label: 'Curly Bun', emoji: '💇' },
  { id: 'curlyHighTop', label: 'High Top', emoji: '🦱' },
  { id: 'bobCut', label: 'Bob Cut', emoji: '💁' },
  { id: 'bobBangs', label: 'Bob + Bangs', emoji: '👧' },
  { id: 'long', label: 'Long', emoji: '👩‍🦱' },
  { id: 'straightBun', label: 'Bun', emoji: '🎀' },
  { id: 'pigtails', label: 'Pigtails', emoji: '👧' },
  { id: 'fade', label: 'Fade', emoji: '💈' },
  { id: 'shortCombover', label: 'Combover', emoji: '💇‍♂️' },
  { id: 'sideShave', label: 'Side Shave', emoji: '🎸' },
  { id: 'mohawk', label: 'Mohawk', emoji: '🤘' },
];

/* personas dresses the body — these are its real outfit shapes. */
export const CLOTHING_STYLES = [
  { id: 'rounded', label: 'Tee', emoji: '👕' },
  { id: 'squared', label: 'Shirt', emoji: '👔' },
  { id: 'small', label: 'Fitted', emoji: '🎽' },
  { id: 'checkered', label: 'Checkered', emoji: '🏁' },
];

export const EYES = [
  { id: 'glasses', label: 'Glasses', emoji: '👓' },
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'open', label: 'Open', emoji: '👁️' },
  { id: 'sleep', label: 'Sleepy', emoji: '😴' },
  { id: 'sunglasses', label: 'Sunglasses', emoji: '🕶️' },
  { id: 'wink', label: 'Wink', emoji: '😉' },
];

export const MOUTHS = [
  { id: 'bigSmile', label: 'Big Smile', emoji: '😁' },
  { id: 'smile', label: 'Smile', emoji: '🙂' },
  { id: 'smirk', label: 'Smirk', emoji: '😏' },
  { id: 'surprise', label: 'Surprised', emoji: '😮' },
  { id: 'frown', label: 'Frown', emoji: '🙁' },
];

export const NOSES = [
  { id: 'mediumRound', label: 'Round', emoji: '👃' },
  { id: 'smallRound', label: 'Small', emoji: '🙂' },
  { id: 'wrinkles', label: 'Wrinkled', emoji: '😤' },
];

export const FACIAL_HAIR = [
  { id: '', label: 'None', emoji: '🚫' },
  { id: 'shadow', label: 'Shadow', emoji: '🕶️' },
  { id: 'soulPatch', label: 'Soul Patch', emoji: '🎷' },
  { id: 'goatee', label: 'Goatee', emoji: '🐐' },
  { id: 'pyramid', label: 'Pyramid', emoji: '🔺' },
  { id: 'walrus', label: 'Moustache', emoji: '🥸' },
  { id: 'beardMustache', label: 'Full Beard', emoji: '🧔' },
];

/* ── HERITAGE OUTFITS — our own identity layer ─────────────────────
   Each heritage wraps the character in a themed frame: a background
   gradient in that civilization's colours + an emblem badge drawn by
   the app next to the avatar (profile ring, map pin, game). All
   original — colours + Unicode emblems, no copied artwork. */
export const HERITAGES = [
  { id: '', label: 'Classic', emblem: '✦', bg: '7C3AED,F5B301' },
  { id: 'pharaonic', label: 'Pharaonic', emblem: '𓂀', bg: 'F5B301,1D4ED8' },
  { id: 'greek', label: 'Greek', emblem: '🏛️', bg: 'E8ECF4,2563EB' },
  { id: 'japanese', label: 'Japanese', emblem: '🏯', bg: 'E11D48,FDF2F2' },
  { id: 'andalusi', label: 'Andalusi', emblem: '🕌', bg: '0F766E,F5B301' },
  { id: 'nubian', label: 'Nubian', emblem: '🪘', bg: 'D97706,7C2D12' },
  { id: 'bedouin', label: 'Bedouin', emblem: '🏜️', bg: 'E7C67A,3F2A14' },
  { id: 'viking', label: 'Viking', emblem: '⚔️', bg: '64748B,0B1B33' },
  { id: 'maya', label: 'Maya', emblem: '🗿', bg: '16A34A,854D0E' },
];
export const heritageOf = (id) => HERITAGES.find((h) => h.id === (id || '')) || HERITAGES[0];

/* Quick start presets — pick who you are, then fine-tune everything. */
export const GENDER_PRESETS = [
  { id: 'boy', label: 'Boy', emoji: '👦', dna: { hair: 'buzzcut', mouth: 'smile', facialHair: '' } },
  { id: 'girl', label: 'Girl', emoji: '👧', dna: { hair: 'long', mouth: 'bigSmile', facialHair: '' } },
];

export const DEFAULT_DNA = {
  skinColor: SKIN_TONES[0],
  hair: 'curly',
  hairColor: HAIR_COLORS[0],
  clothing: 'rounded',
  clothingColor: CLOTHING_COLORS[0],
  eyes: 'happy',
  mouth: 'smile',
  nose: 'mediumRound',
  facialHair: '',
  heritage: '',
};

/* Profiles saved BEFORE the enum fix may hold invalid values — snap
   anything unknown back to a safe default so no avatar ever 400s. */
const VALID_HAIR = new Set(HAIR_STYLES.map((h) => h.id));
const VALID_BODY = new Set(CLOTHING_STYLES.map((c) => c.id));
const VALID_EYES = new Set(['glasses', 'happy', 'open', 'sleep', 'sunglasses', 'wink']);
const VALID_MOUTH = new Set(['bigSmile', 'frown', 'lips', 'smile', 'smirk', 'surprise']);
const VALID_NOSE = new Set(NOSES.map((n) => n.id));
const VALID_FHAIR = new Set(FACIAL_HAIR.map((f) => f.id).filter(Boolean));

/* Serialize/parse to a compact string so it fits in one text column
   (profiles.avatar_dna): "skinColor=..,hair=..,hairColor=.." */
export function serializeDna(dna) {
  return Object.entries({ ...DEFAULT_DNA, ...dna })
    .map(([k, v]) => k + '=' + encodeURIComponent(v))
    .join(',');
}

export function parseDna(str) {
  const dna = { ...DEFAULT_DNA };
  if (!str) return dna;
  str.split(',').forEach((pair) => {
    const [k, v] = pair.split('=');
    if (k && v && k in DEFAULT_DNA) dna[k] = decodeURIComponent(v);
  });
  return dna;
}

/* seed = a stable id (the user's uuid) so the avatar looks the same
   every time for the same person, only changing when they edit it. */
/* ── Our own avatar, drawn by us ──────────────────────────────────
   Every avatar in the app comes through here, so this one switch
   means the whole app uses the character WE paint (services/
   avatarArt.js) instead of a third-party image service: no network
   round-trip, nothing to 400, crisp at any size, and the exact same
   art can be drawn into a game or a sticker.

   Results are cached per (seed + traits) because this runs inside
   render paths — drawing the same face twice would be waste. Native
   builds (no canvas) still fall back to the hosted image below. */
const drawnCache = new Map();

/* The same person, standing — what the map shows. Cached like the
   round one, because a map redraw shouldn't repaint every character.
   `turn` is part of the key so a character facing left and the same
   character facing right are two different pictures, not one. */
const standingCache = new Map();
export function buildStandingUrl(seed, dnaOrString, turn) {
  try {
    if (typeof document === 'undefined') return null;
    if (!dnaOrString) return null;                 // no character built yet
    const key = String(seed || 'moments') + '|' + (turn || 0) + '|' + (typeof dnaOrString === 'string' ? dnaOrString : JSON.stringify(dnaOrString));
    const hit = standingCache.get(key);
    if (hit) return hit;
    const url = characterToDataUrl(dnaOrString, 140, { turn: turn || 0 });
    if (url) {
      if (standingCache.size > 200) standingCache.clear();
      standingCache.set(key, url);
      return url;
    }
  } catch (e) {}
  return null;
}

export function buildAvatarUrl(seed, dnaOrString) {
  try {
    if (typeof document !== 'undefined') {
      const key = String(seed || 'moments') + '|' + (typeof dnaOrString === 'string' ? dnaOrString : JSON.stringify(dnaOrString || ''));
      const hit = drawnCache.get(key);
      if (hit) return hit;
      const url = avatarToRoundDataUrl(dnaOrString, 256);
      if (url) {
        if (drawnCache.size > 300) drawnCache.clear(); // keep it bounded
        drawnCache.set(key, url);
        return url;
      }
    }
  } catch (e) { /* fall through to the hosted version */ }
  return hostedAvatarUrl(seed, dnaOrString);
}

function hostedAvatarUrl(seed, dnaOrString) {
  const dna = typeof dnaOrString === 'string' ? parseDna(dnaOrString) : { ...DEFAULT_DNA, ...dnaOrString };
  const heritage = heritageOf(dna.heritage);
  const params = new URLSearchParams({
    seed: seed || 'moments',
    backgroundType: 'gradientLinear',
    backgroundColor: heritage.bg, // the heritage wraps you in its colours
    skinColor: dna.skinColor.replace('#', ''),
    hair: VALID_HAIR.has(dna.hair) ? dna.hair : 'curly',
    hairColor: dna.hairColor.replace('#', ''),
    body: VALID_BODY.has(dna.clothing) ? dna.clothing : 'rounded',
    clothingColor: dna.clothingColor.replace('#', ''),
    eyes: VALID_EYES.has(dna.eyes) ? dna.eyes : 'happy',
    mouth: VALID_MOUTH.has(dna.mouth) ? dna.mouth : 'smile',
    nose: VALID_NOSE.has(dna.nose) ? dna.nose : 'mediumRound',
  });
  if (VALID_FHAIR.has(dna.facialHair)) {
    params.set('facialHair', dna.facialHair);
    params.set('facialHairProbability', '100');
  } else {
    params.set('facialHairProbability', '0');
  }
  return API + '?' + params.toString();
}
