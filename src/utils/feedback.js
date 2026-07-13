import { Platform } from 'react-native';
import { flags } from '../services/prefs';

/* Tactile + audio feedback, kept subtle and never blocking.
   expo-haptics is native-only; on web (and if it's unavailable) every
   call is a no-op, so screens can fire feedback freely. Respects the
   Settings → Haptics toggle (prefs.flags.haptics). */

let Haptics = null;
try {
  if (Platform.OS !== 'web') Haptics = require('expo-haptics');
} catch (e) { Haptics = null; }

const on = () => flags.haptics;

export const tapLight = () => {
  if (!on()) return;
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

export const tapMedium = () => {
  if (!on()) return;
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
};

export const tapSuccess = () => {
  if (!on()) return;
  try { Haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
};

export const tapSelection = () => {
  if (!on()) return;
  try { Haptics && Haptics.selectionAsync(); } catch (e) {}
};
