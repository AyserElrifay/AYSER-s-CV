import AsyncStorage from '@react-native-async-storage/async-storage';

/* ── ON-DEVICE PREFERENCES ────────────────────────────────────────
   Real, persisted settings. Hot paths (sound, haptics) read the
   module-level `flags` object synchronously; everything is saved to
   AsyncStorage so it survives restarts. Screens subscribe to react. */

const KEY = 'moments.settings.v1';

// Live object — sfx.js / feedback.js import this and read it directly.
export const flags = {
  sound: true,
  haptics: true,
  notifications: true,
};

let loaded = false;
const listeners = new Set();

function emit() {
  listeners.forEach((l) => { try { l({ ...flags }); } catch (e) {} });
}

export async function loadPrefs() {
  if (loaded) return { ...flags };
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) Object.assign(flags, JSON.parse(raw));
  } catch (e) { /* first run */ }
  emit();
  return { ...flags };
}

export function getPrefs() { return { ...flags }; }

export function setPref(key, value) {
  flags[key] = value;
  AsyncStorage.setItem(KEY, JSON.stringify(flags)).catch(() => {});
  emit();
}

export function subscribePrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Hydrate as soon as the module is first imported.
loadPrefs();
