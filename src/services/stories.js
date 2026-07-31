import { supabase } from '../lib/supabase';

/* Real 24h stories — rows expire via the RLS policy (expires_at). */

export async function createStory(userId, { mediaUrl, caption, sound, sticker, place, lat, lng, closeOnly }) {
  let payload = {
    user_id: userId,
    media_url: mediaUrl,
    caption: caption || null,
    // where it happened — this is what puts the story on the map
    place: place || null,
    lat: lat != null ? lat : null,
    lng: lng != null ? lng : null,
    sound_title: sound ? sound.title : null,
    sound_artist: sound ? sound.artist : null,
    sound_url: sound ? sound.audio_url || null : null, // actually playable
    sticker_type: sticker ? sticker.type : null,        // 'poll' | 'question'
    sticker_data: sticker ? JSON.stringify(sticker.data) : null,
    // for the smaller circle only — enforced by the read policy, not here
    close_only: !!closeOnly,
  };
  // strip any column this DB doesn't have yet and retry — a missing
  // optional column must never block posting a story
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase
      .from('stories')
      .insert(payload)
      .select('*, user:profiles!stories_user_id_fkey(name, avatar_url)')
      .single();
    if (!error) return data;
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing[1])) {
      const next = { ...payload };
      delete next[missing[1]];
      payload = next;
      continue;
    }
    throw error;
  }
  throw new Error('Could not post your story — try again.');
}

export async function fetchActiveStories() {
  const { data, error } = await supabase
    .from('stories')
    .select('*, user:profiles!stories_user_id_fkey(id, name, avatar_url, country_flag)')
    .gt('expires_at', new Date().toISOString()) // 24h stories, really
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

/* One person's live stories — powers tapping someone's photo to watch
   what they've posted, and the ring that tells you there's something
   there. Empty when they have nothing live, so no ring is shown. */
export async function fetchUserStories(userId) {
  const { data, error } = await supabase
    .from('stories')
    .select('*, user:profiles!stories_user_id_fkey(id, name, avatar_url, country_flag)')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(40);
  if (error) throw error;
  return data || [];
}

/* ── Story comments ──────────────────────────────────────────────
   Saved, so they're still there next time the story is opened, and
   visible to everyone watching. The owner can switch them off, and
   the database enforces that — not just the button. */
export async function fetchStoryComments(storyId) {
  const { data, error } = await supabase
    .from('story_comments')
    .select('id, user_id, body, created_at, user:profiles!story_comments_user_id_fkey(name, avatar_url, country_flag)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function addStoryComment(storyId, userId, body) {
  const { data, error } = await supabase
    .from('story_comments')
    .insert({ story_id: storyId, user_id: userId, body: String(body).trim().slice(0, 300) })
    .select('id, user_id, body, created_at, user:profiles!story_comments_user_id_fkey(name, avatar_url, country_flag)')
    .single();
  if (error) throw error;
  return data;
}

/* Your own comment — or, if it's your story, anyone's on it. */
export async function deleteStoryComment(commentId) {
  const { error } = await supabase.from('story_comments').delete().eq('id', commentId);
  if (error) throw error;
}

/* The owner turning comments on/off for one of their stories. */
export async function setStoryComments(storyId, userId, off) {
  const { error } = await supabase
    .from('stories')
    .update({ comments_off: !!off })
    .eq('id', storyId)
    .eq('user_id', userId);
  if (error) throw error;
}

/* Live stories that were shared WITH a location — the map layer.
   A story only lasts 24h, so these pins come and go on their own. */
export async function fetchStoryPins(limit = 80) {
  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, media_url, caption, place, lat, lng, created_at, user:profiles!stories_user_id_fkey(name, avatar_url, country_flag)')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* Storage hygiene — expired stories don't just hide, they're GONE:
   a security-definer RPC deletes your expired rows and returns their
   media URLs, then we remove the actual files from storage so they stop
   costing space. Every user cleans up after themselves on app open. */
export async function sweepMyExpiredStories() {
  try {
    const { data } = await supabase.rpc('sweep_my_expired_stories');
    const paths = (data || [])
      .map((u) => {
        const m = /object\/public\/media\/(.+?)(\?|$)/.exec(String(u || ''));
        return m ? decodeURIComponent(m[1]) : null;
      })
      .filter(Boolean);
    if (paths.length) await supabase.storage.from('media').remove(paths);
  } catch (e) { /* table/function not there yet — never block the feed */ }
}

/* A single story by id — powers ?story=<id> shared links. */
export async function fetchStoryById(storyId) {
  const { data, error } = await supabase
    .from('stories')
    .select('*, user:profiles!stories_user_id_fkey(id, name, avatar_url, country_flag)')
    .eq('id', storyId)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (error) throw error;
  return data;
}

/* Delete YOUR OWN story (RLS blocks anyone else's). */
/* Pass a userId to delete your own; pass null and the database
   decides — which it will only allow for the account that runs
   Moments, because a report system nobody can act on is decoration. */
export async function deleteStory(storyId, userId) {
  let q = supabase.from('stories').delete().eq('id', storyId);
  if (userId) q = q.eq('user_id', userId);
  const { error } = await q;
  if (error) throw error;
}

/* ── Poll sticker — real votes, real counts ── */
export async function castPollVote(storyId, userId, choice) {
  const { error } = await supabase
    .from('story_poll_votes')
    .upsert({ story_id: storyId, user_id: userId, choice }, { onConflict: 'story_id,user_id' });
  if (error) throw error;
}

/* ── Real "who watched" — recorded once per viewer, never for your own
   story. Fail-soft: on a not-yet-migrated DB this just quietly no-ops,
   it must never block watching a story. ── */
export async function recordStoryView(storyId, viewerId) {
  if (!storyId || !viewerId) return;
  try {
    await supabase.from('story_views').upsert(
      { story_id: storyId, viewer_id: viewerId, viewed_at: new Date().toISOString() },
      { onConflict: 'story_id,viewer_id' }
    );
  } catch (e) { /* pre-migration or offline — never block playback */ }
}

/* Owner-only: everyone who watched, newest first, with their reaction
   (if any) attached — RLS only lets the story's own owner see this. */
export async function fetchStoryViewers(storyId) {
  const [{ data: views, error: e1 }, { data: reactions }] = await Promise.all([
    supabase
      .from('story_views')
      .select('viewer_id, viewed_at, viewer:profiles!story_views_viewer_id_fkey(id, name, avatar_url, country_flag)')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false }),
    supabase.from('story_reactions').select('user_id, emoji').eq('story_id', storyId),
  ]);
  if (e1) throw e1;
  const byUser = new Map((reactions || []).map((r) => [r.user_id, r.emoji]));
  return (views || []).map((v) => ({ ...v, emoji: byUser.get(v.viewer_id) || null }));
}

/* Tap-emoji reaction ("sticker") — one per viewer per story; tapping a
   different emoji just replaces your last one. */
export async function reactToStory(storyId, userId, emoji) {
  const { error } = await supabase
    .from('story_reactions')
    .upsert({ story_id: storyId, user_id: userId, emoji, created_at: new Date().toISOString() }, { onConflict: 'story_id,user_id' });
  if (error) throw error;
}

export async function fetchMyStoryReaction(storyId, userId) {
  try {
    const { data } = await supabase.from('story_reactions').select('emoji').eq('story_id', storyId).eq('user_id', userId).maybeSingle();
    return data ? data.emoji : null;
  } catch (e) { return null; }
}

export async function fetchPollResults(storyId, myUserId) {
  const { data, error } = await supabase
    .from('story_poll_votes')
    .select('user_id, choice')
    .eq('story_id', storyId);
  if (error) throw error;
  const counts = [0, 0];
  let mine = null;
  (data || []).forEach((r) => {
    counts[r.choice] = (counts[r.choice] || 0) + 1;
    if (r.user_id === myUserId) mine = r.choice;
  });
  return { counts, mine, total: counts[0] + counts[1] };
}
