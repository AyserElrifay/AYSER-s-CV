import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── THE DAILY LOOP ON THE SERVER ────────────────────────────────────
   RUN_ME.sql, "THE DAILY LOOP · MOMENTS LEVELS 1–4 · THE GLOBAL TRACK".
   The level is counted from real check-ins there, never here. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? { ok: false, reason: 'err' } : data; } catch (e) { return { ok: false, reason: 'err' }; }
};

export const myMomentsLevel = () => rpc('my_moments_level');
export const globalApply = (kind) => rpc('global_apply', { p_kind: kind });
export const studioGlobalList = () => rpc('studio_global_list');
export const studioGlobalContacted = (user, kind) => rpc('studio_global_contacted', { p_user: user, p_kind: kind });

/* the header's chat badge: messages to you since you last opened Chats */
const SEEN = 'mm.chats.seen';
export const markChatsSeen = () => { try { localStorage.setItem(SEEN, new Date().toISOString()); } catch (e) {} };
export const chatUnread = async () => {
  let since = null;
  try { since = localStorage.getItem(SEEN); } catch (e) {}
  const n = await rpc('chat_unread', { p_since: since });
  return typeof n === 'number' ? n : 0;
};
