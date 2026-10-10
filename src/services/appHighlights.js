import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── WHAT A MOMENTS EVENING LOOKS LIKE ───────────────────────────────
   A real photo or video from a real evening, chosen by the owner in the
   Studio and live on Home only once he has confirmed that everyone who
   can be recognised in it agreed (highlight_add in RUN_ME.sql refuses
   it otherwise). */

export async function fetchHighlight() {
  if (!SUPABASE_READY) return null;
  try {
    const { data } = await supabase.from('app_highlights').select('id, media_url, kind, caption, live, created_at')
      .eq('live', true).order('created_at', { ascending: false }).limit(1);
    return (data && data[0]) || null;
  } catch (e) { return null; }
}

export async function fetchAllHighlights() {
  const { data, error } = await supabase.from('app_highlights').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addHighlight({ mediaUrl, kind, caption, everyoneAgreed }) {
  const { data, error } = await supabase.rpc('highlight_add', { p_media: mediaUrl, p_kind: kind, p_caption: caption || null, p_everyone_agreed: !!everyoneAgreed });
  if (error) throw error;
  if (!data || !data.ok) throw new Error((data && data.reason) || 'failed');
  return data;
}

export async function setHighlightLive(id, live) {
  const { error } = await supabase.rpc('highlight_set_live', { p_id: id, p_live: !!live });
  if (error) throw error;
}
