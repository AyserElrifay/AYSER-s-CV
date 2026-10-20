import { supabase, SUPABASE_READY } from '../lib/supabase';
import { uploadCapture } from './social';

/* Group games, twin groups and one world (supabase/RUN_ME.sql, "GROUP
   GAMES", "TWIN GROUPS", "ONE WORLD"). Every rule lives on the server;
   these only ask. */

const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, reason: /does not exist|schema cache/i.test(error.message || '') ? 'setup' : 'err' };
    return data || { ok: false, reason: 'err' };
  } catch (e) {
    return { ok: false, reason: 'offline' };
  }
};

export const startGame = (squadId, kind, data, secret) => rpc('sgame_start', { p_squad: squadId, p_kind: kind, p_data: data || {}, p_secret: secret || null });
export const gameMove = (gameId, slot, move) => rpc('sgame_move', { p_game: gameId, p_slot: slot || '', p_move: move });
export const revealGame = (gameId) => rpc('sgame_reveal', { p_game: gameId });
export const gameState = (gameId) => rpc('sgame_state', { p_game: gameId });
export const groupStreak = (squadId) => rpc('squad_streak', { p_squad: squadId });
export const weMet = (squadId, on) => rpc('squad_met', { p_squad: squadId, p_on: !!on });

export const twinState = (squadId) => rpc('twin_state', { p_squad: squadId });
export const twinAsk = (squadId) => rpc('twin_ask', { p_squad: squadId });
export const twinCancel = (squadId) => rpc('twin_cancel', { p_squad: squadId });
export const twinPost = (squadId, body, photo) => rpc('twin_post', { p_squad: squadId, p_body: body || null, p_photo: photo || null });
export const twinRemove = (postId) => rpc('twin_remove', { p_post: postId });

/* the phone's own date, so "today's sky" is today where you are */
export const localDay = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const skyKey = () => 'sky-' + localDay();
export const dishKey = (d = new Date()) => 'dish-' + d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');

export const worldBoard = (key, limit) => rpc('world_board', { p_challenge: key, p_limit: limit || 60 });
export const worldEnter = (key, photo, body, city) => rpc('world_enter', { p_challenge: key, p_photo: photo, p_body: body || null, p_city: city || null });
export const worldLeave = (id) => rpc('world_leave', { p_id: id });
export const walkTotal = () => rpc('world_walk_total', {});
export const walkAdd = (km) => rpc('world_walk_add', { p_day: localDay(), p_km: km });

/* A photo from the phone, uploaded; the server only takes https links. */
export async function uploadPhoto(userId, uri) {
  const url = await uploadCapture(userId, uri, 'jpg', 'image/jpeg');
  if (!/^https:\/\//.test(url || '')) throw new Error('upload');
  return url;
}

/* Moves don't post messages, so the other phones in the chat are told
   on a broadcast channel to look again. It only ever says "look": the
   state itself always comes from the server. */
const chans = {};
export function onGroupPing(squadId, fn) {
  if (!SUPABASE_READY || !squadId) return () => {};
  let c = chans[squadId];
  if (!c) {
    const ch = supabase.channel('sgame_' + squadId, { config: { broadcast: { self: false } } });
    c = chans[squadId] = { ch, fns: new Set() };
    ch.on('broadcast', { event: 'look' }, (m) => c.fns.forEach((f) => f(m.payload && m.payload.game)));
    ch.subscribe();
  }
  c.fns.add(fn);
  return () => {
    c.fns.delete(fn);
    if (!c.fns.size) { try { supabase.removeChannel(c.ch); } catch (e) {} delete chans[squadId]; }
  };
}
export function pingGroup(squadId, gameId) {
  const c = chans[squadId];
  if (c) c.ch.send({ type: 'broadcast', event: 'look', payload: { game: gameId } }).catch(() => {});
}
