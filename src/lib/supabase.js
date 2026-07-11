import 'react-native-url-polyfill/auto';
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
