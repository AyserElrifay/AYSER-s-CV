import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── THE FINAL MVP ── (RUN_ME.sql, "THE FINAL MVP"): the week's Drops,
   the voted Language Circle and the month's quota. Every rule — who may
   claim, how many, when the café shows, when the circle opens — is the
   server's; the app only shows the answers. */
const rpc = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(name, args); return error ? null : data; } catch (e) { return null; }
};

export const dropsList = () => rpc('drops_list');
export const dropClaim = (id) => rpc('drop_claim', { p_id: id });
export const dropWait = (id, on) => rpc('drop_wait', { p_id: id, p_on: on !== false });
export const dropCancel = (id) => rpc('drop_cancel', { p_id: id });
// a trip is applied for, not booked (RUN_ME.sql, "ROAM IS MEMBERS-ONLY")
export const tripWithdraw = (id) => rpc('trip_withdraw', { p_id: id });
export const ownerDropLevel = (id, level) => rpc('owner_drop_level', { p_id: id, p_level: level ? Number(level) : null });
export const ownerTripApplications = () => rpc('owner_trip_applications');
export const ownerTripDecide = (offer, user, select) => rpc('owner_trip_decide', { p_offer: offer, p_user: user, p_select: !!select });
export const myQuota = () => rpc('my_quota');
export const circleNow = (lang) => rpc('circle_now', { p_lang: lang || 'en' });
export const circleVote = (poll, slot) => rpc('circle_vote', { p_poll: poll, p_slot: slot });
export const circleEnter = (poll) => rpc('circle_enter', { p_poll: poll });

// the Studio (owner only, checked by the database)
export const ownerDrops = () => rpc('owner_drops');
export const ownerDropSave = (p) => rpc('owner_drop_save', { p });

/* ── THE SAFETY CHECK (RUN_ME.sql, "FOUR PILLARS · SAFETY CHECK") ──
   One photo — a live selfie or an ID / university card — into the
   private 'verification' bucket, in the person's own folder. The Studio
   decides, and the photo is deleted then (zero storage). */
export const mySafety = () => rpc('my_safety');
export async function sendSafetyCheck(kind, blob, handle) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data } = await supabase.auth.getUser();
    const u = data && data.user;
    if (!u) return { ok: false, reason: 'signed_out' };
    const path = u.id + '/safety-' + Date.now() + '.jpg';
    const up = await supabase.storage.from('verification').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) return { ok: false, reason: 'upload' };
    const r = await rpc('safety_submit', { p_kind: kind, p_path: path, p_handle: handle || null });
    if (!(r && r.ok)) { await supabase.storage.from('verification').remove([path]).catch(() => {}); }
    return r || { ok: false, reason: 'server' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
}
// the Studio
export const safetyList = () => rpc('studio_safety_list');
export async function safetyPhotoUrl(path) {
  try { const { data } = await supabase.storage.from('verification').createSignedUrl(path, 300); return data && data.signedUrl; } catch (e) { return null; }
}
export async function safetyDecide(userId, ok) {
  const r = await rpc('studio_safety_decide', { p_user: userId, p_ok: !!ok });
  // the decision is made: the photo goes now
  if (r && r.ok && r.delete_path) { try { await supabase.storage.from('verification').remove([r.delete_path]); } catch (e) {} }
  return r;
}
