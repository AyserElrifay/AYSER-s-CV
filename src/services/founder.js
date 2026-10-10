import { supabase } from '../lib/supabase';

/* ─── A WELCOME FROM THE FOUNDER ──────────────────────────────────────
   Ayser: "اعمل message مني كfounder لأي يوزر جديد". One real direct
   message from his own account, in the reader's language — the words
   and the "only new accounts, only once" rule live in the database
   (founder_welcome in RUN_ME.sql). The phone only asks, once per
   account, and says which language it speaks. A reply goes to Ayser. */

const KEY = 'moments.founderWelcome.';
const DONE = new Set(['already', 'not_new', 'self', 'no_founder']);

/* the language the app is in (LanguageContext keeps it under this key),
   or the phone's own */
const langNow = () => {
  try { const v = localStorage.getItem('moments.lang'); if (v) return v.slice(0, 5).toLowerCase(); } catch (e) {}
  try { return String(navigator.language || 'en').slice(0, 2).toLowerCase(); } catch (e) { return 'en'; }
};

export async function askFounderWelcome(userId) {
  if (!userId) return null;
  try { if (localStorage.getItem(KEY + userId) === '1') return null; } catch (e) {}
  const { data, error } = await supabase.rpc('founder_welcome', { p_lang: langNow() });
  /* not switched on yet, or no signal: ask again next time */
  if (error || !data) return null;
  if (data.ok || DONE.has(data.reason)) {
    try { localStorage.setItem(KEY + userId, '1'); } catch (e) {}
  }
  return data;
}
