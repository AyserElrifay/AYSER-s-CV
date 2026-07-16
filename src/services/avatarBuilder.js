/* ── MOMENTS AVATAR · your cartoon persona on the live map ──────────
   Not a photo — a fully customizable cartoon character (skin tone,
   hair, hair color, outfit, outfit color, eyes, mood) that represents
   you on the map the way a real photo can't (privacy, and it's fun).
   Built on DiceBear's free, keyless "personas" style — we bring our
   own trait presets, our own purple/gold framing, and our own name
   for it ("Moments Avatar"), so this is our identity, not a clone of
   any other app's mascot system.

   The URL is generated client-side from stored trait choices; nothing
   is stored as a picture, just a small options string, so it's cheap
   to keep in the profiles table and instant to change. */

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

export const DEFAULT_DNA = {
  skinColor: SKIN_TONES[0],
  hair: 'curly',
  hairColor: HAIR_COLORS[0],
  clothing: 'rounded',
  clothingColor: CLOTHING_COLORS[0],
  eyes: 'happy',
  mouth: 'smile',
};

/* Profiles saved BEFORE the enum fix may hold invalid values — snap
   anything unknown back to a safe default so no avatar ever 400s. */
const VALID_HAIR = new Set(HAIR_STYLES.map((h) => h.id));
const VALID_BODY = new Set(CLOTHING_STYLES.map((c) => c.id));
const VALID_EYES = new Set(['glasses', 'happy', 'open', 'sleep', 'sunglasses', 'wink']);
const VALID_MOUTH = new Set(['bigSmile', 'frown', 'lips', 'smile', 'smirk', 'surprise']);

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
export function buildAvatarUrl(seed, dnaOrString) {
  const dna = typeof dnaOrString === 'string' ? parseDna(dnaOrString) : { ...DEFAULT_DNA, ...dnaOrString };
  const params = new URLSearchParams({
    seed: seed || 'moments',
    backgroundType: 'gradientLinear',
    backgroundColor: '7C3AED,F5B301',
    skinColor: dna.skinColor.replace('#', ''),
    hair: VALID_HAIR.has(dna.hair) ? dna.hair : 'curly',
    hairColor: dna.hairColor.replace('#', ''),
    body: VALID_BODY.has(dna.clothing) ? dna.clothing : 'rounded',
    clothingColor: dna.clothingColor.replace('#', ''),
    eyes: VALID_EYES.has(dna.eyes) ? dna.eyes : 'happy',
    mouth: VALID_MOUTH.has(dna.mouth) ? dna.mouth : 'smile',
  });
  return API + '?' + params.toString();
}
