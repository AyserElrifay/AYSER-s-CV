import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── PAYING FOR A MEMBERSHIP ─────────────────────────────────────────
   Ayser, October 2026: Lemon Squeezy refused Egypt. On the web a member
   pays by InstaPay to the handle below, sends the transfer's screenshot,
   and the owner approves it in the Studio (RUN_ME.sql, "INSTAPAY"); the
   screenshot is deleted the moment it is decided, like the safety check.

   In the phone apps, when they come, the stores' own purchase is
   required — that is where RevenueCat goes: nativeCheckout below is the
   one place to wire it (its SDK and keys are not in this project yet,
   so it says so rather than pretending). */
export const INSTAPAY = { handle: 'ayserelrifay1@instapay', qr: 'instapay-qr.jpg' };

const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? { ok: false, reason: 'err' } : data; } catch (e) { return { ok: false, reason: 'err' }; }
};

export async function sendTransfer({ tier, period, blob, type, ref, amount }) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data } = await supabase.auth.getUser();
    const u = data && data.user;
    if (!u) return { ok: false, reason: 'signed_out' };
    const ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg';
    const path = u.id + '/pay-' + Date.now() + '.' + ext;
    const up = await supabase.storage.from('verification').upload(path, blob, { contentType: type || 'image/jpeg', upsert: false });
    if (up.error) return { ok: false, reason: 'upload' };
    const r = await rpc('pay_submit', { p_tier: tier, p_period: period, p_path: path, p_ref: ref || null, p_amount: amount || null });
    if (!(r && r.ok)) { await supabase.storage.from('verification').remove([path]).catch(() => {}); }
    return r || { ok: false, reason: 'server' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
}
export const myPayment = () => rpc('my_payment');

// the Studio (owner only, checked on the server)
export const ownerPayList = () => rpc('owner_pay_list');
export async function payProofUrl(path) {
  try { const { data } = await supabase.storage.from('verification').createSignedUrl(path, 300); return data && data.signedUrl; } catch (e) { return null; }
}
export async function ownerPayDecide(id, approve) {
  const r = await rpc('owner_pay_decide', { p_id: id, p_approve: !!approve });
  if (r && r.ok && r.delete_path) { try { await supabase.storage.from('verification').remove([r.delete_path]); } catch (e) {} }
  return r;
}

// the phone apps' store purchase (RevenueCat) — not connected yet
export async function nativeCheckout() { return { ok: false, reason: 'not_configured' }; }
