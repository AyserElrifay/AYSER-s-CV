import { Linking } from 'react-native';
import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── THE BROKER LAYER ─────────────────────────────────────────
   Moments sits in the middle of every booking: we log the referral,
   open the partner, and the click log is the proof used to claim the
   commission from each partner's affiliate program. Users earn
   $MOMENT cashback on tracked clicks, so both sides win.

   Commission rates are per-partner (what each program actually pays);
   payouts land in the owner's Stripe account once the affiliate
   accounts are approved. */

export const COMMISSION = {
  waffarha: { rate: '10–20%', cashback: 15 },
  booking:  { rate: '4–6%',  cashback: 10 },
  groupon:  { rate: '~10%',  cashback: 10 },
  playtomic:{ rate: 'per booking', cashback: 8 },
  airbnb:   { rate: '~3%',   cashback: 8 },
  uber:     { rate: 'per ride', cashback: 5 },
  meetup:   { rate: '—',     cashback: 5 },
};

export async function openPartner(user, deal) {
  // Log the referral first (that's the money trail), then open.
  if (SUPABASE_READY && user) {
    try {
      await supabase.from('partner_clicks').insert({
        user_id: user.id,
        partner: deal.partner,
        deal_id: deal.id,
        url: deal.url,
      });
    } catch (e) {}
  }
  Linking.openURL(deal.url).catch(() => {});
}

export async function countMyReferrals(userId) {
  const { count, error } = await supabase
    .from('partner_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}
