import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── WHO IS A MEMBER ── (RUN_ME.sql, "TWO TIERS")
   FREE · BASIC · Black, answered by the server. `gate` is whether the
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

/* the welcome offer a new Black gets once, for 24 hours (RUN_ME.sql,
   "Black IS 1300 A YEAR · AND A WELCOME OFFER, ONCE"): 30% off a first
   Level 1 workshop. The discount itself is taken off by journey_book. */
export async function myWelcomeOffer() {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc('my_welcome_offer'); return error ? null : data; } catch (e) { return null; }
}
export async function dismissWelcomeOffer() {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc('welcome_offer_dismiss'); return error ? null : data; } catch (e) { return null; }
}
