/* Supabase project config for Moments.
   The anon (public) key is SAFE to ship in the client — it only grants
   what your Row-Level Security policies allow, which is the whole point
   of the anon role. This is exactly how every Supabase web app works.

   Env vars win when present (local .env / CI), otherwise these baked-in
   values are used so the deployed web build is fully live. NEVER put the
   service_role key here — that one is a secret and stays server-side. */

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dvddiyztpyyuultndzso.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''; // ← paste the anon public key here to go live
