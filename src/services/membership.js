import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── WHO IS A MEMBER ── (RUN_ME.sql, "TWO TIERS")
   FREE · BASIC · VIP, answered by the server. `gate` is whether the
   gateway is on at all: until payments are switched on there is
   nothing to buy, so nobody is stopped. */
export async function myMembership() {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc('my_membership'); return error ? null : data; } catch (e) { return null; }
}

/* any screen can ask for the right door: 'vip' (messages, lounges,
   full profiles) or 'member' (the gateway) */
export const askUpgrade = (why) => {
  try { window.dispatchEvent(new CustomEvent('mm-need-plus', { detail: why || 'member' })); } catch (e) {}
};
