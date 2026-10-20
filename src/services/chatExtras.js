import { supabase, SUPABASE_READY } from '../lib/supabase';

/* Opening moves and reactions (supabase/RUN_ME.sql, "CHAT · OPENING
   MOVES AND REACTIONS"). The server decides who may react to what. */
const rpc = async (fn, args, empty) => {
  if (!SUPABASE_READY) return empty;
  try { const { data, error } = await supabase.rpc(fn, args); return error ? empty : (data == null ? empty : data); } catch (e) { return empty; }
};
export const openingMovesOf = (userId) => rpc('opening_moves_of', { p_user: userId }, []);
export const setOpeningMoves = (moves) => rpc('set_opening_moves', { p_moves: moves }, { ok: false });
export const react = (msgId, emoji) => rpc('react', { p_msg: msgId, p_emoji: emoji }, { ok: false });
export const reactionsFor = (ids) => rpc('reactions_for', { p_ids: ids }, {});
export const REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '🙏'];
