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
  // Movie/TV streaming affiliate programs (worldwide)
  amazon:   { rate: 'Amazon Associates', cashback: 6 },
  appletv:  { rate: 'Apple Services', cashback: 5 },
  netflix:  { rate: 'referral', cashback: 4 },
  shahid:   { rate: 'MENA affiliate', cashback: 6 },
  disney:   { rate: 'Impact affiliate', cashback: 5 },
  youtube:  { rate: '—', cashback: 2 },
};

/* Your affiliate tags go here — each partner appends its own so the
   commission is credited to you. Fill these once approved; until then
   links open the plain provider page (still tracked in partner_clicks). */
export const AFFILIATE_TAGS = {
  amazon: '',   // e.g. 'moments-20'  → appended as &tag=moments-20
  // others use path-based affiliate links added when approved
};

export function withAffiliate(partner, url) {
  const tag = AFFILIATE_TAGS[partner];
  if (partner === 'amazon' && tag) {
    return url + (url.includes('?') ? '&' : '?') + 'tag=' + tag;
  }
  return url;
}

export async function openPartner(user, deal) {
  const url = withAffiliate(deal.partner, deal.url);
  // Log the referral first (that's the money trail), then open.
  if (SUPABASE_READY && user) {
    try {
      await supabase.from('partner_clicks').insert({
        user_id: user.id,
        partner: deal.partner,
        deal_id: deal.id,
        url,
      });
    } catch (e) {}
  }
  Linking.openURL(url).catch(() => {});
}

export async function countMyReferrals(userId) {
  const { count, error } = await supabase
    .from('partner_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}
