import { getProfile, updateProfile } from './profiles';
import { SUPABASE_READY } from '../lib/supabase';

/* ─── SETTINGS THAT BELONG TO YOU, NOT TO THIS PHONE ──────────────────
   Preferences lived in this device's storage, which meant signing in
   somewhere else handed you a stranger's version of your own app: light
   mode again, message timer back to the default, every choice you had
   made quietly undone.

   Some settings genuinely belong to a device — whether this phone
   buzzes, whether it makes noise — and those stay where they are. Two
   don't:

     • the theme, because dark at midnight is about you, not about
       which phone is in your hand
     • how long your messages live, because that is a decision about
       your own conversations and it should follow you

   Both are columns on your profile row. `updateProfile` already drops a
   column the database doesn't have yet and carries on, so a project
   that hasn't run the latest SQL loses nothing — it keeps using the
   on-device copy until the column exists.

   Everything is read through a cache rather than the network, because
   these are wanted during render and a theme that arrives a second late
   is a flash of the wrong colour. They arrive once, after sign-in, and
   anyone who cares is told. */

export const DEFAULT_MESSAGE_TTL_HOURS = 48;

let cache = { theme: null, messageTtlHours: null };
let userId = null;
let loadedFor = null;
const listeners = new Set();

function emit() {
  const snap = { ...cache };
  listeners.forEach((l) => { try { l(snap); } catch (e) {} });
}

export function cachedAccountSettings() { return { ...cache }; }

/* Called by anything that has to react when they land — the theme, for
   one. Returns its own unsubscribe. */
export function subscribeAccountSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Pull them once per sign-in. Never throws: a settings read failing is
   not a reason for anything else to stop. */
export async function loadAccountSettings(id) {
  userId = id || null;
  if (!SUPABASE_READY || !id) return { ...cache };
  if (loadedFor === id) return { ...cache };
  loadedFor = id;
  try {
    const p = await getProfile(id);
    if (p) {
      cache = {
        theme: p.theme_pref || null,
        messageTtlHours: p.message_ttl_hours == null ? null : Number(p.message_ttl_hours),
      };
      emit();
    }
  } catch (e) { /* keep whatever we had */ }
  return { ...cache };
}

export function saveThemePref(pref) {
  cache.theme = pref;
  emit();
  if (!SUPABASE_READY || !userId) return;
  updateProfile(userId, { theme_pref: pref }).catch(() => {});
}

export function saveMessageTtl(hours) {
  cache.messageTtlHours = hours;
  emit();
  if (!SUPABASE_READY || !userId) return;
  updateProfile(userId, { message_ttl_hours: hours }).catch(() => {});
}

/* The window in force for a conversation: what that chat was explicitly
   set to, else your account default, else 48 hours. */
export function effectiveTtl(threadTtl) {
  if (threadTtl !== null && threadTtl !== undefined) return threadTtl;
  if (cache.messageTtlHours !== null && cache.messageTtlHours !== undefined) return cache.messageTtlHours;
  return DEFAULT_MESSAGE_TTL_HOURS;
}

/* Signing out must not leave the next person on this phone wearing the
   last one's settings. */
export function forgetAccountSettings() {
  cache = { theme: null, messageTtlHours: null };
  userId = null;
  loadedFor = null;
  emit();
}
