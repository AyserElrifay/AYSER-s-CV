import { Platform } from 'react-native';
import { flags } from '../services/prefs';

/* ── HOW THINGS FEEL ─────────────────────────────────────────────────
   Tactile feedback, kept subtle and never blocking. Every call is safe
   to make from anywhere: if the device can't do it, nothing happens.

   Three different machines are hiding behind these four functions.

   Native builds get expo-haptics — the real Taptic Engine, exactly the
   weights Apple defines.

   Android browsers get `navigator.vibrate`, with durations chosen to
   land near Apple's: a selection tick is barely there, an impact is
   short and firm, and a success is a double beat rather than one long
   buzz. A long buzz is what makes web vibration feel cheap.

   iPhone browsers get neither. Safari has never shipped
   `navigator.vibrate` and shows no sign of doing so. What it does have,
   since iOS 17.4, is a switch control that fires a real system haptic
   when it flips — so we keep one off-screen and flip it. That is a
   workaround riding on someone else's implementation detail, and it may
   stop working one day; when it does, this quietly goes back to doing
   nothing, which is exactly what it did before. */

let Haptics = null;
try {
  if (Platform.OS !== 'web') Haptics = require('expo-haptics');
} catch (e) { Haptics = null; }

const on = () => flags.haptics;
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

const isIos = () => {
  if (!isWeb || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
};

/* The off-screen switch. Built once, on the first haptic asked for, so
   a page that never buzzes never grows an extra element. */
let taptic = null;
function iosTick() {
  if (typeof document === 'undefined') return;
  try {
    if (!taptic) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');          // iOS 17.4+ — the haptic bit
      label.appendChild(input);
      document.body.appendChild(label);
      taptic = input;
    }
    taptic.checked = !taptic.checked;
    taptic.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (e) { /* no haptics here, and that's fine */ }
}

/* Android and desktop. Durations are deliberately short — anything past
   about 35ms stops reading as a tap and starts reading as a buzz. */
function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) { navigator.vibrate(pattern); return true; }
  } catch (e) {}
  return false;
}

function webFeedback(pattern) {
  if (!isWeb) return;
  if (isIos()) { iosTick(); return; }
  buzz(pattern);
}

export const tapSelection = () => {
  if (!on()) return;
  if (isWeb) return webFeedback(8);
  try { Haptics && Haptics.selectionAsync(); } catch (e) {}
};

export const tapLight = () => {
  if (!on()) return;
  if (isWeb) return webFeedback(12);
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

export const tapMedium = () => {
  if (!on()) return;
  if (isWeb) return webFeedback(20);
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
};

export const tapHeavy = () => {
  if (!on()) return;
  if (isWeb) return webFeedback(30);
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) {}
};

/* Two beats, not one long one — the difference between "done" and
   "something is wrong". */
export const tapSuccess = () => {
  if (!on()) return;
  if (isWeb) return webFeedback([12, 60, 24]);
  try { Haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
};

export const tapWarning = () => {
  if (!on()) return;
  if (isWeb) return webFeedback([20, 80, 20]);
  try { Haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (e) {}
};

export const tapError = () => {
  if (!on()) return;
  if (isWeb) return webFeedback([30, 50, 30, 50, 30]);
  try { Haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
};
