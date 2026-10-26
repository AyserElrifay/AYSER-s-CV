import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── THE EVENT PAGE'S SERVER ── (RUN_ME.sql, "NO ENDLESS CHAT")
   Every rule — who may see a room, when its chat opens and goes quiet,
   who may join a workshop's call, who may end it — is the database's.
   These only ask. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? null : data; } catch (e) { return null; }
};

export const eventRoom = (kind, id) => rpc('event_room', { p_kind: kind, p_id: id });
export const eventPin = (kind, id, text) => rpc('event_pin', { p_kind: kind, p_id: id, p_text: text || null });
export const classRoomJoin = (offerId) => rpc('class_room_join', { p_offer: offerId });
export const classRoomLeave = (offerId) => rpc('class_room_leave', { p_offer: offerId });
export const classRoomEnd = (offerId) => rpc('class_room_end', { p_offer: offerId });
export const classRoomState = (offerId) => rpc('class_room_state', { p_offer: offerId });
