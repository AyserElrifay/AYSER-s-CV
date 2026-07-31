import { supabase } from '../lib/supabase';

/* ── HIGHLIGHTS ─────────────────────────────────────────────────────
   A story is gone in a day. A highlight is the one you decided to
   keep, sitting on your profile for as long as you want it there.

   The picture's address is copied into the highlight rather than
   pointed at the story row — so when the story expires tonight, the
   highlight is still a highlight tomorrow. */

export async function fetchHighlights(userId) {
  const { data, error } = await supabase
    .from('highlights')
    .select('*, items:highlight_items(id, media_url, caption, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return [];
  return (data || []).map((h) => ({
    ...h,
    items: (h.items || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));
}

export async function createHighlight(userId, title, items) {
  const list = (items || []).filter((i) => i && i.media_url);
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: userId,
      title: String(title || 'Highlight').trim().slice(0, 40) || 'Highlight',
      cover_url: list.length ? list[0].media_url : null,
    })
    .select('*')
    .single();
  if (error) throw error;
  if (list.length) {
    const { error: e2 } = await supabase.from('highlight_items').insert(
      list.map((i) => ({ highlight_id: data.id, media_url: i.media_url, caption: i.caption || null })),
    );
    if (e2) throw e2;
  }
  return data;
}

export async function addToHighlight(highlightId, items) {
  const list = (items || []).filter((i) => i && i.media_url);
  if (!list.length) return;
  const { error } = await supabase.from('highlight_items').insert(
    list.map((i) => ({ highlight_id: highlightId, media_url: i.media_url, caption: i.caption || null })),
  );
  if (error) throw error;
}

export async function renameHighlight(highlightId, userId, title) {
  const { error } = await supabase
    .from('highlights')
    .update({ title: String(title || 'Highlight').trim().slice(0, 40) || 'Highlight' })
    .eq('id', highlightId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteHighlight(highlightId, userId) {
  const { error } = await supabase
    .from('highlights').delete().eq('id', highlightId).eq('user_id', userId);
  if (error) throw error;
}

export async function removeHighlightItem(itemId) {
  const { error } = await supabase.from('highlight_items').delete().eq('id', itemId);
  if (error) throw error;
}

/* Everything of yours that could go into a highlight: your live
   stories first (that's what a highlight is for), then the photos from
   your own moments — so a fresh account with no story up right now
   isn't stuck with an empty picker. */
export async function fetchHighlightCandidates(userId) {
  const out = [];
  try {
    const { data } = await supabase
      .from('stories')
      .select('id, media_url, caption, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    (data || []).forEach((s) => {
      if (s.media_url) out.push({ key: 'story-' + s.id, media_url: s.media_url, caption: s.caption, from: 'story' });
    });
  } catch (e) {}
  try {
    const { data } = await supabase
      .from('posts')
      .select('id, media_url, caption, created_at')
      .eq('user_id', userId)
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(40);
    (data || []).forEach((p) => {
      if (p.media_url) out.push({ key: 'post-' + p.id, media_url: p.media_url, caption: p.caption, from: 'moment' });
    });
  } catch (e) {}
  return out;
}
