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

export const HAIR_STYLES = [
  { id: 'bald', label: 'Bald', emoji: '👤' },
  { id: 'bun', label: 'Bun', emoji: '💇' },
  { id: 'buzzcut', label: 'Buzzcut', emoji: '💇‍♂️' },
  { id: 'curly', label: 'Curly', emoji: '🦱' },
  { id: 'curlyHigh', label: 'Curly High', emoji: '🦱' },
  { id: 'fro', label: 'Afro', emoji: '🦱' },
  { id: 'longAfro', label: 'Long Afro', emoji: '🦱' },
  { id: 'longCurly', label: 'Long Curly', emoji: '👩‍🦱' },
  { id: 'mediumStraight', label: 'Medium Straight', emoji: '💁' },
  { id: 'shaggy', label: 'Shaggy', emoji: '🧑' },
  { id: 'shortCurly', label: 'Short Curly', emoji: '🧑‍🦱' },
  { id: 'sidePart', label: 'Side Part', emoji: '💇‍♂️' },
  { id: 'wavy', label: 'Wavy', emoji: '🌊' },
  { id: 'mohawk', label: 'Mohawk', emoji: '🎸' },
];

export const CLOTHING_STYLES = [
  { id: 'buttonShirt', label: 'Button Shirt', emoji: '👔' },
  { id: 'collared', label: 'Collared', emoji: '🥼' },
  { id: 'hoodie', label: 'Hoodie', emoji: '🧥' },
  { id: 'shirt', label: 'Shirt', emoji: '👕' },
  { id: 'vNeck', label: 'V-Neck', emoji: '👚' },
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
  hair: 'shortCurly',
  hairColor: HAIR_COLORS[0],
  clothing: 'shirt',
  clothingColor: CLOTHING_COLORS[0],
  eyes: 'happy',
  mouth: 'smile',
};

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
    hair: dna.hair,
    hairColor: dna.hairColor.replace('#', ''),
    clothing: dna.clothing,
    clothingColor: dna.clothingColor.replace('#', ''),
    eyes: dna.eyes,
    mouth: dna.mouth,
  });
  return API + '?' + params.toString();
}
