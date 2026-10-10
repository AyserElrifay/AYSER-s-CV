import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/storage';

/* ─── LICENSED GUIDES AND VERIFIED HOSTS ──────────────────────────────
   A tour guide shows their tourism licence card; anybody else who hosts
   activities shows a national ID. Both add a live selfie and sign that
   they run their activities, not Moments. The owner checks by eye in
   the Studio. The documents go to a PRIVATE bucket ('verification')
   in the person's own folder — nobody but them and the owner can open
   them — and are deleted once the owner has decided (host_decide in
   RUN_ME.sql). What is public is only the badge and real numbers. */

export const HOST_TERMS_VERSION = 'host-2026-10';

async function putPrivate(userId, file, label) {
  const small = await compressImage(URL.createObjectURL(file), 1600, 0.85);
  const blob = await (await fetch(small)).blob();
  const path = userId + '/' + Date.now() + '-' + label + '.jpg';
  const { error } = await supabase.storage.from('verification').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function applyAsHost(userId, { role, docFile, selfieFile, langs, areas, since, about }) {
  const doc = await putPrivate(userId, docFile, role === 'guide' ? 'licence' : 'id');
  const selfie = await putPrivate(userId, selfieFile, 'selfie');
  const { data, error } = await supabase.rpc('host_apply', {
    p_role: role, p_doc: doc, p_selfie: selfie,
    p_langs: langs || [], p_areas: areas || [],
    p_since: since ? parseInt(since, 10) : null, p_about: about || null,
    p_terms_version: HOST_TERMS_VERSION,
  });
  if (error) {
    // the request never landed: do not leave the documents behind
    try { await supabase.storage.from('verification').remove([doc, selfie]); } catch (e) {}
    throw error;
  }
  return data || { ok: false };
}

/* your own request: 'pending' | 'approved' | 'rejected' | null, and as what */
export async function myHostRequest(userId) {
  try {
    const { data } = await supabase.from('verification_requests').select('status, role').eq('user_id', userId).maybeSingle();
    return data && (data.role === 'guide' || data.role === 'host') ? data : null;
  } catch (e) { return null; }
}

export async function fetchHostStats(userId) {
  const { data, error } = await supabase.rpc('host_stats', { p_user: userId });
  if (error) return null;
  return data;
}

/* ── the owner's side ── */
export async function fetchPendingHosts() {
  const { data, error } = await supabase.rpc('hosts_pending');
  if (error) throw error;
  return data || [];
}

/* a short-lived link to look at a document — never a public address */
export async function documentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('verification').createSignedUrl(path, 600);
  return error ? null : data && data.signedUrl;
}

export async function decideHost(userId, approve) {
  const { data, error } = await supabase.rpc('host_decide', { p_user: userId, p_approve: !!approve });
  if (error) throw error;
  /* decided: the card, the ID and the selfie are not needed any more */
  const paths = [data && data.doc_path, data && data.selfie_path].filter(Boolean);
  if (paths.length) { try { await supabase.storage.from('verification').remove(paths); } catch (e) {} }
  return data;
}
