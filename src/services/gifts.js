import { supabase, SUPABASE_READY } from '../lib/supabase';

/* the owner gives Moments+ or Moments Black for a few months (RUN_ME.sql,
   "GIFTED MEMBERSHIPS") — owner only, checked by the database */
const rpc = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(name, args); return error ? null : data; } catch (e) { return null; }
};
export const giftMembership = (userId, tier, days) => rpc('owner_gift_membership', { p_user: userId, p_tier: tier, p_days: days });
export const endGift = (userId) => rpc('owner_gift_end', { p_user: userId });
export const giftList = () => rpc('owner_gift_list');

/* ── promo codes and everybody, filtered (RUN_ME.sql, "THE OWNER'S
   MEMBERS DESK") ── */
export const promoSave = (p) => rpc('owner_promo_save', { p });
export const promoList = () => rpc('owner_promo_list');
export const promoOff = (code) => rpc('owner_promo_off', { p_code: code });
export const members = (filter, q, offset) => rpc('owner_members', { p_filter: filter, p_q: q || '', p_offset: offset || 0 });
// a member types a code in the app: free days come straight in
export const promoRedeem = (code) => rpc('promo_redeem', { p_code: code });

/* functions/owner-billing: a % code made in Lemon Squeezy too; a
   subscription stopped from renewing */
const billing = async (body) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await supabase.functions.invoke('owner-billing', { body });
    if (error) { const st = error.context && error.context.status; return { ok: false, reason: st === 503 ? 'not_configured' : st === 403 ? 'not_owner' : 'gateway' }; }
    return data || { ok: false, reason: 'gateway' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};
export const promoToCheckout = (code) => billing({ action: 'discount', code });
export const stopRenewing = (userId) => billing({ action: 'cancel', user: userId });
