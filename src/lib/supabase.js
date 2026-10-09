import './urlPolyfill';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/* Same graceful-fallback pattern as src/utils/maps.js: when no Supabase
   credentials are configured the app runs in DEMO MODE — login succeeds
   locally and nothing is persisted. Add a .env (see .env.example) to
   switch to the real backend; no code changes needed. */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

const url = SUPABASE_URL;
const anonKey = SUPABASE_ANON_KEY;

export const SUPABASE_READY = !!(url && anonKey);

export const supabase = SUPABASE_READY
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/* ─── WHO IS SIGNED IN, WITHOUT ASKING THE NETWORK ────────────────────
   The client's own getSession() answers instantly while the login is
   fresh — but a login older than an hour has to be renewed first, and
   getSession waits for that renewal before it says anything. So every
   normal reopen of the app sat on the splash for a full round trip to
   the server just to learn who was holding the phone, which the phone
   already knew: it is written down in local storage.

   This reads it straight from there. The renewal still happens, in the
   background, and every query made in the meantime waits for it by
   itself — the client does that on its own. What changes is that the
   screen does not.

   A session with no user or no refresh token is not one we can use, so
   it reads as nobody. */
export function storedSessionNow() {
  try {
    if (!SUPABASE_READY || typeof localStorage === 'undefined') return null;
    const ref = String(url).replace(/^https?:\/\//, '').split('.')[0];
    const raw = localStorage.getItem('sb-' + ref + '-auth-token');
    const s = raw ? JSON.parse(raw) : null;
    return s && s.user && s.user.id && s.refresh_token ? s : null;
  } catch (e) { return null; }
}
