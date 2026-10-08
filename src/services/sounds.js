import { supabase } from '../lib/supabase';
import { soundOfPost } from '../lib/sound';

/* ─── THE VIDEOS MADE WITH ONE SOUND ──────────────────────────────────
   The list that makes a sound a thing rather than a label: the video it
   came from, and everything anybody built on it.

   It is one query on one indexed column, because "made with this
   sound" is a fact stored on the post and not a guess based on two
   titles matching. */

const COLS = '*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)';

const flat = (rows) => (rows || []).map((r) => ({
  ...r,
  vibes: (r.vibe_rows && r.vibe_rows[0] && r.vibe_rows[0].count) || 0,
  comments: (r.comment_rows && r.comment_rows[0] && r.comment_rows[0].count) || 0,
}));

export async function fetchSoundOrigin(postId) {
  if (!postId) return null;
  const { data, error } = await supabase.from('posts').select(COLS).eq('id', postId).limit(1);
  if (error) return null;
  return flat(data)[0] || null;
}

export async function fetchMadeWith(postId, limit = 40) {
  if (!postId) return [];
  const { data, error } = await supabase
    .from('posts').select(COLS)
    .eq('sound_post_id', postId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return flat(data);
}

/* Turning reuse off is a person changing their mind about their own
   recording, so it is their row and the database says so — the update
   carries the user id and the policy does the rest. */
export async function setSoundReuse(postId, userId, on) {
  const { error } = await supabase
    .from('posts').update({ sound_reuse: !!on })
    .eq('id', postId).eq('user_id', userId);
  if (error) throw error;
}

/* Everything the sound sheet needs, in one call. */
export async function fetchSound(postId) {
  const origin = await fetchSoundOrigin(postId);
  if (!origin) return null;
  return {
    origin,
    sound: soundOfPost(origin),
    made: await fetchMadeWith(postId),
  };
}
