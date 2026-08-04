import { supabase } from '../lib/supabase';
import { uploadMediaSmart } from '../lib/storage';

/* ── YOUR LIBRARY ───────────────────────────────────────────────────
   Upload once, post whenever. The worst moment to send a 40 MB clip up
   is the moment you want to post it: you stand there watching a bar,
   and a bad minute of signal takes the caption with it. So the wait
   moves to a time nobody is waiting — you add things when you have
   signal, and posting later costs nothing because the file is already
   up there.

   It is yours alone. The read policy on the table is your own rows, so
   nobody can browse anybody else's library. */

export async function fetchLibrary(userId, limit = 60) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('media_library')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

/* Push a file up and remember it. Returns the row, so the picker can
   show it immediately without a round trip. */
export async function addToLibrary(userId, fileOrUri, { ext, contentType, bytes, onProgress, signal } = {}) {
  if (!userId || !fileOrUri) throw new Error('Nothing to add.');
  const kind = /^video\//.test(contentType || '') ? 'video' : 'photo';
  // onProgress/signal let the picker show real movement and back out —
  // a spinner with nothing behind it is what made a stalled upload look
  // identical to a working one
  const url = await uploadMediaSmart(
    userId,
    fileOrUri,
    ext || (kind === 'video' ? 'mp4' : 'jpg'),
    contentType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    { onProgress, signal }
  );
  const { data, error } = await supabase
    .from('media_library')
    .insert({ user_id: userId, url, kind, bytes: bytes || null })
    .select('*')
    .single();
  if (error) {
    // the file is up even if the row failed — hand back something usable
    return { id: 'local-' + Date.now(), user_id: userId, url, kind, bytes: bytes || null, created_at: new Date().toISOString() };
  }
  return data;
}

/* Quietly remember that something in here was posted — it's how the
   picker can show "used 3 times" instead of a wall of identical dates. */
export async function markUsed(id) {
  if (!id || String(id).startsWith('local-')) return;
  try {
    const { data } = await supabase.from('media_library').select('used_count').eq('id', id).single();
    const n = ((data && data.used_count) || 0) + 1;
    await supabase.from('media_library').update({ used_count: n }).eq('id', id);
  } catch (e) { /* not worth bothering anyone about */ }
}

/* Take something out of your library. The file itself stays where any
   post that already used it can still find it — removing a picture
   from your shelf shouldn't blank a moment you posted last week. */
export async function removeFromLibrary(id, userId) {
  const { error } = await supabase.from('media_library').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
