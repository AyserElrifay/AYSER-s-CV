import { Platform } from 'react-native';

/* Tactile + audio feedback, kept subtle and never blocking.
   expo-haptics is native-only; on web (and if it's unavailable) every
   call is a no-op, so screens can fire feedback freely. */

let Haptics = null;
try {
  if (Platform.OS !== 'web') Haptics = require('expo-haptics');
} catch (e) { Haptics = null; }

export const tapLight = () => {
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

export const tapMedium = () => {
  try { Haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
};

export const tapSuccess = () => {
  try { Haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
};

export const tapSelection = () => {
  try { Haptics && Haptics.selectionAsync(); } catch (e) {}
};
