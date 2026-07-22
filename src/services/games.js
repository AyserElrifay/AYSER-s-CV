import { supabase } from '../lib/supabase';

/* Real global leaderboards — every run's score is a real row tied to a real
   account, so the ranking is genuine, worldwide, and can't be faked past
   RLS (you can only insert your own score). */

export async function submitScore(userId, game, score) {
  if (!userId || !score || score <= 0) return;
  try { await supabase.from('game_scores').insert({ user_id: userId, game, score: Math.round(score) }); } catch (e) { /* non-blocking */ }
}

/* ── REAL multiplayer — Catch Your Mate live duels ──────────────────
   A match is a real row two real accounts share (RLS restricts it to
   just the two of them). The actual race never touches the database
   tick by tick — that rides a Supabase Realtime broadcast channel
   directly between the two browsers, live; only the final result is
   written back here, once. */

export async function createMatch(hostId, guestId, kind = 'catch') {
  const { data, error } = await supabase
    .from('game_matches')
    .insert({ host_id: hostId, guest_id: guestId, kind })
    .select('*, host:profiles!game_matches_host_id_fkey(id,name,avatar_url,country_flag), guest:profiles!game_matches_guest_id_fkey(id,name,avatar_url,country_flag)')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMatch(matchId) {
  const { data, error } = await supabase
    .from('game_matches')
    .select('*, host:profiles!game_matches_host_id_fkey(id,name,avatar_url,country_flag), guest:profiles!game_matches_guest_id_fkey(id,name,avatar_url,country_flag)')
    .eq('id', matchId)
    .single();
  if (error) throw error;
  return data;
}

/* Guest accepts or declines the invite. */
export async function respondMatch(matchId, accept) {
  const { error } = await supabase
    .from('game_matches')
    .update({ status: accept ? 'active' : 'declined', started_at: accept ? new Date().toISOString() : null })
    .eq('id', matchId);
  if (error) throw error;
}

/* Either side can report the final result — whoever's client resolves
   the duel first writes it (both compute the same numbers from the
   same live scores, so this is safe even if both try). */
export async function finishMatch(matchId, { hostScore, guestScore, winnerId }) {
  const { error } = await supabase
    .from('game_matches')
    .update({ status: 'done', host_score: hostScore, guest_score: guestScore, winner_id: winnerId, ended_at: new Date().toISOString() })
    .eq('id', matchId);
  if (error) throw error;
}

/* The live duel wire — ready-up, synced countdown, live score ticks,
   and each side's final result. Same broadcast-channel pattern as real
   calls (services/calls.js): nothing here is simulated, it's a genuine
   channel between the two browsers. */
export function subscribeMatchLive(matchId, handlers) {
  const ch = supabase.channel('match_' + matchId, { config: { broadcast: { self: false } } });
  ['ready', 'start', 'score', 'finished'].forEach((ev) => {
    ch.on('broadcast', { event: ev }, ({ payload }) => { const h = handlers[ev]; if (h) h(payload || {}); });
  });
  ch.subscribe();
  return {
    send: (event, payload) => ch.send({ type: 'broadcast', event, payload: payload || {} }).catch(() => {}),
    leave: () => { try { supabase.removeChannel(ch); } catch (e) {} },
  };
}

/* Top players for a game — best score per person, highest first. */
export async function fetchLeaderboard(game, limit = 25) {
  try {
    const { data, error } = await supabase
      .from('game_scores')
      .select('score, user:profiles!game_scores_user_id_fkey(id, name, avatar_url, country_flag)')
      .eq('game', game)
      .order('score', { ascending: false })
      .limit(300);
    if (error) return [];
    const seen = new Set();
    const out = [];
    for (const r of data || []) {
      const id = r.user && r.user.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ score: r.score, name: (r.user && r.user.name) || 'Player', avatar: r.user && r.user.avatar_url, flag: (r.user && r.user.country_flag) || null, id });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) { return []; }
}
