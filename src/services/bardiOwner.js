import { supabase } from '../lib/supabase';

/* Bardi Brain — owner controls Bardi's persona and teaches it from
   books/content, all from the Moments Studio portal. Every user's Bardi
   reads this and feeds it into the model, so the owner steers Bardi with
   zero code changes. Plus per-user memory so Bardi remembers each user
   from their OWN chats (private — never other people's conversations). */

/* ── owner: the tuning instructions ── */
export async function fetchBardiConfig() {
  try {
    const { data } = await supabase.from('bardi_config').select('instructions').eq('id', 1).maybeSingle();
    return (data && data.instructions) || '';
  } catch (e) { return ''; }
}
export async function saveBardiConfig(instructions) {
  const { error } = await supabase.from('bardi_config').upsert({ id: 1, instructions: instructions || '', updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ── owner: the "books" / knowledge Bardi learns from ── */
export async function fetchBardiKnowledge() {
  try {
    const { data } = await supabase.from('bardi_knowledge').select('*').order('created_at', { ascending: false });
    return data || [];
  } catch (e) { return []; }
}
export async function addBardiKnowledge({ title, content, sourceUrl }) {
  const { data, error } = await supabase
    .from('bardi_knowledge')
    .insert({ title: title || 'Untitled', content: content || '', source_url: sourceUrl || null })
    .select().single();
  if (error) throw error;
  return data;
}
export async function deleteBardiKnowledge(id) {
  const { error } = await supabase.from('bardi_knowledge').delete().eq('id', id);
  if (error) throw error;
}

/* ── per-user memory — Bardi remembering each user (their own chats) ── */
export async function fetchMyBardiMemory(userId) {
  if (!userId) return [];
  try {
    const { data } = await supabase.from('bardi_memory').select('note').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    return (data || []).map((r) => r.note);
  } catch (e) { return []; }
}
export async function addBardiMemory(userId, note) {
  if (!userId || !note) return;
  try { await supabase.from('bardi_memory').insert({ user_id: userId, note: String(note).slice(0, 400) }); } catch (e) { /* non-blocking */ }
}
/* Forget me — wipe everything Bardi has remembered about this user. */
export async function clearMyBardiMemory(userId) {
  if (!userId) return;
  const { error } = await supabase.from('bardi_memory').delete().eq('user_id', userId);
  if (error) throw error;
  invalidateBardiBrain();
}

/* Everything Bardi needs from the owner + this user, in one call — the
   client passes these to the model so the endpoint stays a pure
   pass-through (no server-side DB reads of anyone's data). Cached briefly
   so a chat doesn't refetch on every message. */
let _cache = null;
let _cacheAt = 0;
export async function loadBardiBrain(userId, includeMemory = true) {
  const now = Date.now();
  if (_cache && now - _cacheAt < 60000 && _cache._uid === userId && _cache._mem === includeMemory) return _cache;
  const [instructions, knowledge, memory] = await Promise.all([
    fetchBardiConfig(),
    fetchBardiKnowledge(),
    includeMemory ? fetchMyBardiMemory(userId) : Promise.resolve([]),
  ]);
  _cache = {
    _uid: userId,
    _mem: includeMemory,
    instructions,
    knowledge: (knowledge || []).map((k) => ({ title: k.title, content: k.content })),
    memory,
  };
  _cacheAt = now;
  return _cache;
}
export function invalidateBardiBrain() { _cache = null; }
