import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { COUNTRIES } from '../constants/mockData';

/* ─── لمّة · TALKING TO THE ROOM ──────────────────────────────────────
   Every function here ASKS. None of them tell.

   The split matters more than it looks. Realtime carries state DOWN to
   phones and nothing back up: a phone announcing "I scored 800" has
   nowhere to send it, because nothing subscribes to what phones say.
   Every change goes through a Postgres function that checks who you
   are and works the number out itself.

   So the worst a tampered client can do is ask for something it is not
   allowed, and be told no.                                            */

const rpc = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args));
    if (error) return { ok: false, reason: 'server', detail: error.message };
    return data || { ok: false, reason: 'empty' };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: (e && e.message) || '' };
  }
};

export const createRoom = (packId, mode = 'classic') =>
  rpc('lamma_create_room', { p_pack_id: packId, p_mode: mode });

export const joinRoom = (code) => rpc('lamma_join_room', { p_code: String(code || '').trim().toUpperCase() });

export const advance = (roomId) => rpc('lamma_advance', { p_room_id: roomId });

export const claimHost = (roomId) => rpc('lamma_claim_host', { p_room_id: roomId });

export const setConnected = (roomId, connected) =>
  rpc('lamma_set_connected', { p_room_id: roomId, p_connected: !!connected });

/* The tap. Sends how long you took and which tile — never a score, and
   never anything the server would have to take on trust. */
export const submitAnswer = (roomId, questionId, selectedIndex, elapsedMs) =>
  rpc('lamma_submit_answer', {
    p_room_id: roomId,
    p_question_id: questionId,
    p_selected_index: selectedIndex,
    p_elapsed_ms: Math.max(0, Math.round(elapsedMs || 0)),
  });

/* Refused until the deadline has genuinely passed, by the server's
   clock. Asking early gets you {ok:false, reason:'not_yet'} and no hint
   whatsoever about the answer. */
export const reveal = (roomId, questionId) =>
  rpc('lamma_reveal', { p_room_id: roomId, p_question_id: questionId });

/* Everything a phone that dropped out needs to rejoin exactly where the
   room is now — including whether it may still answer this question. */
export const sync = (roomId) => rpc('lamma_sync', { p_room_id: roomId });

/* Your face on your seat in this room — a small JPEG data URL, or null
   to take it off again. The server checks it is really a small JPEG and
   really yours; see supabase/schema_v22_lamma_faces.sql. */
export const setFace = (roomId, face) =>
  rpc('lamma_set_face', { p_room_id: roomId, p_face: face || null });

/* How many everyone got RIGHT, out of how many the pack asked. The
   score is about speed; this is about knowing. Counted by the server
   from what it recorded at the time, so it cannot be argued with. */
export const roomResults = (roomId) => rpc('lamma_room_results', { p_room_id: roomId });

/* Questions WITHOUT their answers. This view is the only way the app
   can read a question at all; correct_index is not a column in it. */
export async function fetchPackQuestions(packId) {
  if (!SUPABASE_READY) return [];
  const { data, error } = await withDeadline(
    supabase.from('lamma_questions_public').select('*').eq('pack_id', packId).order('order_index'),
  );
  if (error) throw error;
  return data || [];
}

/* ── THE PACKS THIS PLAYER CAN ACTUALLY PLAY ───────────────────────
   A pack belongs to a country, or to everybody. Somebody in Cairo gets
   the Egyptian packs and the worldwide ones; somebody in Bucharest gets
   the worldwide ones and, when they exist, theirs.

   Their own country comes FIRST, because that is the pack they will
   recognise and the one that makes them want to start a room. The
   worldwide packs sit under it — they are the ones a mixed room can
   play without anybody being locked out.

   Pass no country and you get everything, which is what the search and
   the pack builder want. */
/* A profile says where you live in WORDS — "Egypt" — and a pack is
   tagged with a code — 'EG'. Comparing those two directly is why Ayser
   opened لمّة in Cairo and saw three worldwide packs and not one
   Egyptian one: the filter asked the database for country = 'Egypt',
   which nothing is.

   So the name is translated to a code first. And the packs are no
   longer FILTERED by country at all — they are only SORTED by it.
   Filtering means one wrong lookup hides most of the game; sorting
   means the worst case is a shelf in a slightly odd order. Given a
   choice between those two failures, take the second one. */
const codeFor = (place) => {
  if (!place) return null;
  const s = String(place).trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();   // already a code
  const hit = COUNTRIES.find((c) => c.name.toLowerCase() === s.toLowerCase());
  return hit ? hit.code : null;
};

export async function fetchPacks(place) {
  if (!SUPABASE_READY) return [];
  const { data, error } = await withDeadline(
    supabase.from('game_packs').select('*')
      .order('is_official', { ascending: false })
      .limit(120),
  );
  if (error) throw error;
  const rows = data || [];
  const code = codeFor(place);
  if (!code) return rows;
  // yours first, then everybody else's
  return rows.slice().sort((a, b) => {
    const mine = (r) => (r.country === code ? 0 : 1);
    return mine(a) - mine(b);
  });
}

/* The title in the player's language, falling back rather than
   blanking — same rule as the questions themselves. */
export const packTitle = (pack, lang) => {
  if (!pack) return '';
  return (lang === 'ar' ? (pack.title_ar || pack.title_en) : (pack.title_en || pack.title_ar)) || '';
};

export async function fetchRoomPlayers(roomId) {
  if (!SUPABASE_READY) return [];
  const { data, error } = await withDeadline(
    supabase.from('room_players').select('*').eq('room_id', roomId).order('score', { ascending: false }),
  );
  if (error) throw error;
  return data || [];
}

/* ── LISTENING ─────────────────────────────────────────────────────
   One channel per room. The host broadcasts what it has just been TOLD
   by the server — never what it has decided — so the broadcast is a
   nudge to go and look, not a source of truth. Anything that matters is
   re-read through sync().

   Postgres changes are followed as well as broadcasts, so a phone that
   missed a nudge still sees the room move. Belt and braces, because the
   alternative is somebody staring at a question that ended a minute
   ago. */
export function subscribeRoom(roomId, handlers = {}) {
  if (!SUPABASE_READY || !roomId) return () => {};
  const ch = supabase.channel('lamma_' + roomId, { config: { broadcast: { self: false } } });

  ch.on('broadcast', { event: 'phase' }, ({ payload }) => {
    if (handlers.onPhase) handlers.onPhase(payload || {});
  });
  ch.on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: 'id=eq.' + roomId },
    (p) => { if (handlers.onRoom) handlers.onRoom(p.new || {}); });
  ch.on('postgres_changes',
    { event: '*', schema: 'public', table: 'room_players', filter: 'room_id=eq.' + roomId },
    () => { if (handlers.onPlayers) handlers.onPlayers(); });

  ch.subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (e) {} };
}

/* A nudge, not an instruction. Whatever a phone receives here it goes
   and verifies; this only exists so nobody waits for a poll. */
export function nudge(roomId, payload) {
  if (!SUPABASE_READY || !roomId) return;
  try {
    supabase.channel('lamma_' + roomId).send({ type: 'broadcast', event: 'phase', payload: payload || {} });
  } catch (e) { /* a missed nudge costs a second, not a game */ }
}
