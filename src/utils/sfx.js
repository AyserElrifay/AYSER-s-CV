import { Platform } from 'react-native';

/* Tiny synthesized sound effects — no audio files to bundle.
   On web we use the Web Audio API to shape short, pleasant blips.
   On native this is a no-op (haptics carry the feedback there);
   expo-av can be layered in later without touching call sites. */

let ctx = null;
function audio() {
  if (Platform.OS !== 'web') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) { return null; }
}

/* A single shaped tone. */
function tone(freq, start, dur, type, peak) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak || 0.14, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* ── The Moments sound identity ──────────────────────────────────
   The star sings solfège: the first tap plays Mi, and each quick
   tap after that walks up the scale (Fa, Sol, La, Si, Do…) — tap a
   feed and you're playing a melody. Idle for a moment and it resets
   back to Mi. Capped at the octave so it stays sweet, never shrill. */
const SCALE = [659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, 1174.7, 1318.5]; // Mi..Mi'
let scaleStep = 0;
let lastStarAt = 0;

export function sfxStar() {
  const now = Date.now();
  if (now - lastStarAt > 2500) scaleStep = 0; // fresh melody after a pause
  lastStarAt = now;
  const f = SCALE[Math.min(scaleStep, SCALE.length - 1)];
  scaleStep = Math.min(scaleStep + 1, SCALE.length - 1);
  tone(f, 0, 0.16, 'triangle', 0.12);
  tone(f * 2, 0.03, 0.12, 'sine', 0.05); // airy octave shimmer
}

/* Notifications land on a soft Major 7th chord (C·E·G·B), rolled
   like a harp so it feels like good news, not an alarm. */
export function sfxNotify() {
  tone(523.25, 0, 0.5, 'sine', 0.09);   // C
  tone(659.25, 0.05, 0.5, 'sine', 0.08); // E
  tone(783.99, 0.1, 0.5, 'sine', 0.08);  // G
  tone(987.77, 0.15, 0.6, 'sine', 0.07); // B — the sparkle on top
}

/* The laugh — Sol·Sol·Sol staccato, paced like a real giggle. */
export function sfxLaugh() {
  tone(783.99, 0, 0.07, 'triangle', 0.11);
  tone(783.99, 0.11, 0.07, 'triangle', 0.1);
  tone(783.99, 0.22, 0.08, 'triangle', 0.09);
}

/* Held / kept tapping? The laugh grows into a staccato Major 6th
   (C+A) burst — the belly-laugh version. */
export function sfxLaughBig() {
  for (let i = 0; i < 4; i++) {
    tone(523.25, i * 0.09, 0.06, 'triangle', 0.1);
    tone(880.0, i * 0.09 + 0.01, 0.06, 'triangle', 0.09);
  }
}

/* Warm confirmation chord — join / share success. */
export function sfxSuccess() {
  tone(523, 0, 0.2, 'sine', 0.11);
  tone(659, 0.04, 0.22, 'sine', 0.1);
  tone(784, 0.08, 0.28, 'sine', 0.09);
}

/* Soft tick — message sent / selection. */
export function sfxPop() {
  tone(440, 0, 0.09, 'square', 0.06);
}
