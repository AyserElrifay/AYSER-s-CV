import { supabase } from '../lib/supabase';

/* Real global leaderboards — every run's score is a real row tied to a real
   account, so the ranking is genuine, worldwide, and can't be faked past
   RLS (you can only insert your own score). */

export async function submitScore(userId, game, score) {
  if (!userId || !score || score <= 0) return;
  try { await supabase.from('game_scores').insert({ user_id: userId, game, score: Math.round(score) }); } catch (e) { /* non-blocking */ }
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
