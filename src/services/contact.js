import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── YOUR NUMBER, FOR THE TEAM ONLY ──────────────────────────────────
   Asked at sign-up (Ayser, November 2026: "إضافة رقم التليفون ده نكلّم
   الناس"). Saved privately (RUN_ME.sql set_my_phone): never on a profile;
   the team reads it in the Studio. If the account waits for an email to
   be confirmed, the number waits on this phone and is saved at the first
   sign-in. */
const KEY = 'mm.pendingPhone';
/* 010 1234 5678 / +20 10… / 0020 10… — anything a person would type for a mobile */
export const phoneOk = (s) => {
  const d = String(s || '').replace(/[^0-9+]/g, '');
  return /^01[0-9]{9}$/.test(d) || /^\+[0-9]{8,15}$/.test(d) || /^00[0-9]{8,15}$/.test(d);
};
export async function savePhone(phone) {
  if (!SUPABASE_READY || !phone) return false;
  try {
    const { data, error } = await supabase.rpc('set_my_phone', { p_phone: phone });
    if (!error && data && data.ok) { try { localStorage.removeItem(KEY); } catch (e) {} return true; }
  } catch (e) {}
  return false;
}
export const keepPhoneForLater = (phone) => { try { localStorage.setItem(KEY, phone); } catch (e) {} };
export const savePendingPhone = async () => { let p = null; try { p = localStorage.getItem(KEY); } catch (e) {} return p ? savePhone(p) : false; };
export const ownerContacts = async (q) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc('owner_contacts', { p_q: q || null }); return error ? null : data; } catch (e) { return null; }
};
