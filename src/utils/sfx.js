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

/* Bright rising sparkle — the Star reaction. */
export function sfxStar() {
  tone(660, 0, 0.14, 'triangle', 0.12);
  tone(990, 0.05, 0.16, 'triangle', 0.11);
  tone(1320, 0.1, 0.18, 'sine', 0.09);
}

/* Two-tone ding — notifications. */
export function sfxNotify() {
  tone(880, 0, 0.16, 'sine', 0.12);
  tone(1174, 0.12, 0.22, 'sine', 0.1);
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
