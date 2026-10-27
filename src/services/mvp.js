import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── THE FINAL MVP ── (RUN_ME.sql, "THE FINAL MVP"): the week's Drops,
   the voted Language Circle and the month's quota. Every rule — who may
   claim, how many, when the café shows, when the circle opens — is the
   server's; the app only shows the answers. */
const rpc = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(name, args); return error ? null : data; } catch (e) { return null; }
};

export const dropsList = () => rpc('drops_list');
export const dropClaim = (id) => rpc('drop_claim', { p_id: id });
export const dropWait = (id, on) => rpc('drop_wait', { p_id: id, p_on: on !== false });
export const dropCancel = (id) => rpc('drop_cancel', { p_id: id });
export const myQuota = () => rpc('my_quota');
export const circleNow = (lang) => rpc('circle_now', { p_lang: lang || 'en' });
export const circleVote = (poll, slot) => rpc('circle_vote', { p_poll: poll, p_slot: slot });
export const circleEnter = (poll) => rpc('circle_enter', { p_poll: poll });

// the Studio (owner only, checked by the database)
export const ownerDrops = () => rpc('owner_drops');
export const ownerDropSave = (p) => rpc('owner_drop_save', { p });
