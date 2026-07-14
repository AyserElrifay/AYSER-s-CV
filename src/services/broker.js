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
  getyourguide: { rate: '~8%', cashback: 8 },
  viator:   { rate: '~8%',   cashback: 8 },
  hostelworld: { rate: '~7%', cashback: 7 },
  travelpayouts: { rate: 'up to 7%', cashback: 6 },
  yango:    { rate: 'MENA affiliate', cashback: 4 },
  // Movie/TV streaming affiliate programs (worldwide)
  amazon:   { rate: 'Amazon Associates', cashback: 6 },
  appletv:  { rate: 'Apple Services', cashback: 5 },
  netflix:  { rate: 'referral', cashback: 4 },
  shahid:   { rate: 'MENA affiliate', cashback: 6 },
  disney:   { rate: 'Impact affiliate', cashback: 5 },
  youtube:  { rate: '—', cashback: 2 },
};

/* ── YOUR AFFILIATE IDs — the single place to activate earnings ────
   Open an account with each partner (see MONETIZATION.md for the exact
   links + steps), then paste the ID they give you here. From that
   moment every click carries your tag and the commission is yours.
   Until then links open the plain page — still logged in partner_clicks
   so you keep the proof of every referral you drove. */
export const AFFILIATE_TAGS = {
  amazon: '',        // Amazon Associates "Store ID", e.g. moments07-20 → &tag=…
  booking: '',       // Booking.com Partner "aid",     e.g. 2417739    → &aid=…
  travelpayouts: '', // Travelpayouts "marker",        e.g. 463490     → &marker=…
  getyourguide: '',  // GetYourGuide "partner_id"                      → &partner_id=…
  viator: '',        // Viator "pid" (via Travelpayouts/direct)        → &pid=…
  hostelworld: '',   // Hostelworld affiliate id (via Partnerize)      → &affiliate=…
  waffarha: '',      // Waffarha — ask partnerships for a ref code     → &ref=…
  groupon: '',       // Groupon via Rakuten/CJ — deep link id          → &utm_medium=afl&sid=…
  uber: '',          // Uber referral/invite code                      → &invite=…
  playtomic: '',     // Playtomic partner code (b2b@playtomic.io)      → &ref=…
  meetup: '',        // Meetup has no affiliate — tracked click only
  yango: '',         // Yango Play MENA affiliate id                   → &utm_source=…
  shahid: '',        // Shahid via ArabClicks — tracking id            → &utm_source=…
  appletv: '',       // Apple Services Performance Partners "at" token → &at=…
  netflix: '',       // Netflix has no open program — tracked click only
  disney: '',        // Disney+ via Impact.com — tracking id
  epidemicsound: '', // Epidemic Sound partner id (music licensing)
};

/* How each partner's tag is appended to the URL. Anything not listed
   falls back to a generic ?ref= parameter. */
const TAG_PARAM = {
  amazon: 'tag',
  booking: 'aid',
  travelpayouts: 'marker',
  getyourguide: 'partner_id',
  viator: 'pid',
  hostelworld: 'affiliate',
  waffarha: 'ref',
  uber: 'invite',
  playtomic: 'ref',
  appletv: 'at',
};

export function withAffiliate(partner, url) {
  const tag = AFFILIATE_TAGS[partner];
  if (!tag) return url;
  const param = TAG_PARAM[partner] || 'ref';
  return url + (url.includes('?') ? '&' : '?') + param + '=' + encodeURIComponent(tag);
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

/* Your referrals grouped by partner — the earnings dashboard's data.
   [{ partner: 'waffarha', clicks: 12, rate: '10–20%' }, …] best first. */
export async function fetchMyReferralBreakdown(userId) {
  const { data, error } = await supabase
    .from('partner_clicks')
    .select('partner')
    .eq('user_id', userId)
    .limit(1000);
  if (error) throw error;
  const byPartner = {};
  (data || []).forEach((r) => { byPartner[r.partner] = (byPartner[r.partner] || 0) + 1; });
  return Object.entries(byPartner)
    .map(([partner, clicks]) => ({
      partner,
      clicks,
      rate: (COMMISSION[partner] && COMMISSION[partner].rate) || '—',
      active: !!AFFILIATE_TAGS[partner],
    }))
    .sort((a, b) => b.clicks - a.clicks);
}
