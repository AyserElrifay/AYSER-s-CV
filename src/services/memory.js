import { supabase, SUPABASE_READY } from '../lib/supabase';
import { smallImage, dataBlob } from '../lib/storage';
import { uploadCapture } from './social';

/* ─── THE MEMORY BOOK ── (RUN_ME.sql, "THE MEMORY BOOK")
   Members keep every moment; everybody else pins five. The server
   decides both — these only ask. */

const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? null : data; } catch (e) { return null; }
};

export const memoryBook = () => rpc('memory_book');
export const myMemoryPins = () => rpc('my_memory_pins');
export const pinMoment = (id, on) => rpc('post_keep', { p_id: id, p_keep: !!on });
export const highlightMoment = (id, on) => rpc('post_highlight', { p_id: id, p_on: !!on });

/* someone's Highlights, for their profile (the read policy lets these through after the feed) */
export async function fetchHighlights(userId) {
  if (!SUPABASE_READY || !userId) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('id, type, media_url, thumb_url, caption, place, created_at')
    .eq('user_id', userId)
    .eq('highlight', true)
    .order('created_at', { ascending: false })
    .limit(24);
  return error ? [] : data || [];
}

/* ─── LIGHTER FOR GOOD ────────────────────────────────────────────────
   A kept photo is stored for years, so it is worth making small: about
   50–70 KB of WebP at 1080 pixels, which is under 60 MB for a thousand
   memories. Done on the phone, once per moment; the server moves the
   old file to the trash when the row points at the new one. */
const DONE = 'mm.memory.light.v1';
const LIGHT_BYTES = 90 * 1024;
const readDone = () => { try { return JSON.parse(localStorage.getItem(DONE) || '[]'); } catch (e) { return []; } };
const markDone = (id) => { try { const d = readDone(); d.push(id); localStorage.setItem(DONE, JSON.stringify(d.slice(-2000))); } catch (e) {} };
export const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(u || ''));

export async function makeLight(item, userId) {
  if (!item || !item.media_url || isVideoUrl(item.media_url) || readDone().indexOf(item.id) >= 0) return null;
  if (typeof window === 'undefined' || !window.document) return null;
  try {
    const blob = await (await fetch(item.media_url)).blob();
    if (blob.size <= LIGHT_BYTES) { markDone(item.id); return null; }
    const local = URL.createObjectURL(blob);
    const s = await smallImage(local, 1080, 0.6);
    URL.revokeObjectURL(local);
    if (!s.ext) { markDone(item.id); return null; }
    const out = /^data:/.test(s.uri) ? dataBlob(s.uri) : await (await fetch(s.uri)).blob();
    if (out.size >= blob.size) { markDone(item.id); return null; }
    const url = await uploadCapture(userId, s.uri, s.ext, s.type);
    if (!url || typeof url !== 'string') return null;
    const { error } = await supabase.from('posts').update({ media_url: url }).eq('id', item.id).eq('user_id', userId);
    if (error) return null;
    markDone(item.id);
    return url;
  } catch (e) { return null; }
}
