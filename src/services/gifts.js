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
