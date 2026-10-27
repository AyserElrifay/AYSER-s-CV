import { Linking } from 'react-native';
import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── PAYMENTS · unified checkout across gateways ──────────────
   Frontend integration layer. Each gateway's hosted checkout needs a
   payment created with its SECRET key — that step MUST happen
   server-side (a Supabase Edge Function named 'create-checkout'), never
   in the app. startCheckout() calls that function, gets back a checkout
   URL, opens it, and records a pending row in `payments`. A gateway
   webhook (also server-side) flips the row to 'paid'.

   Until the Edge Function + keys are configured, startCheckout returns
   { configured:false } so the UI can show a clear "connect a gateway"
   state instead of failing silently. */

export const PAY_PROVIDERS = [
  { id: 'paymob',  name: 'Paymob',  emoji: '💳', region: 'Egypt & MENA', methods: 'Cards · Vodafone Cash · valU' },
  { id: 'moyasar', name: 'Moyasar', emoji: '🟢', region: 'Saudi & Gulf', methods: 'mada · Cards · Apple Pay' },
  { id: 'paytabs', name: 'PayTabs', emoji: '🔷', region: 'MENA-wide',    methods: 'Cards · local wallets' },
  { id: 'paddle',  name: 'Paddle',  emoji: '🌍', region: 'Worldwide',    methods: 'Cards · PayPal (merchant of record)' },
];

// Moments' platform commission on booking payments (10–20%, per the broker model)
export const PLATFORM_FEE = 0.15;

// open a hosted checkout (or a customer portal) in place of the app
const go = (url) => {
  if (typeof window !== 'undefined' && window.location) window.location.assign(url);
  else Linking.openURL(url).catch(() => {});
};

/* Venue boosts and the old venue booking asked the server to charge an
   amount the phone chose. That is gone: an amount comes from the
   database or not at all. They say "not connected" until they are
   rebuilt on bookings, the way payBooking below works. */
export async function startCheckout() {
  return { configured: false, reason: 'use_booking' };
}

/* ── PAY FOR A BOOKING ── the app names the booking; the server reads
   its price (supabase/functions/create-checkout) and opens Paymob. The
   booking turns 'paid' only when Paymob's signed webhook says so. */
export async function payBooking(bookingId) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', { body: { bookingId } });
    if (error) {
      const status = error.context && error.context.status;
      return { ok: false, reason: status === 503 ? 'not_configured' : status === 409 ? 'not_payable' : 'gateway' };
    }
    if (!data || !data.checkoutUrl) return { ok: false, reason: 'gateway' };
    go(data.checkoutUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'offline' };
  }
}

/* ── MOMENTS PLUS ── the app names the plan; the server reads the
   owner's price, and Paymob's signed webhook adds the days. */
/* The store's published checkout links (Lemon Squeezy → Products →
   Share), one per plan and period. Public by design — a link only opens
   the checkout; what anybody is given is decided by ls-webhook from what
   was really paid for, never by which button was pressed. A period whose
   link is not in yet answers "payments open very soon". */
const LS_BUY = {
  basic: { month: 'https://therealmoments.lemonsqueezy.com/checkout/buy/b837520d-74c4-4ca1-83a0-7dc8c9b65ef5', year: null },
  vip: { month: null, year: 'https://therealmoments.lemonsqueezy.com/checkout/buy/5e90c5a0-6cc8-480b-bc4c-54c8c9d23c5b' },
};

/* Moments+ or Black, monthly or yearly, through Lemon Squeezy.
   Somebody not yet subscribed goes straight to that plan's checkout link,
   carrying their account id (checkout[custom][user_id]) so the signed
   webhook knows whose membership it is. Somebody already subscribed goes
   through functions/ls-checkout: a change of tier moves their one
   subscription (never a second one), the same tier opens the portal. */
export async function buyTier(tier, member, period) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  const t = tier === 'vip' ? 'vip' : 'basic';
  if (!(member && member.manage)) {
    try {
      const { data } = await supabase.auth.getUser();
      const u = data && data.user;
      if (!u) return { ok: false, reason: 'signed_out' };
      const q = '?checkout[custom][user_id]=' + encodeURIComponent(u.id)
        + (u.email ? '&checkout[email]=' + encodeURIComponent(u.email) : '');
      const link = LS_BUY[t][period === 'year' ? 'year' : 'month'];
      if (!link) return { ok: false, reason: 'not_configured' };
      go(link + q);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'offline' };
    }
  }
  try {
    const { data, error } = await supabase.functions.invoke('ls-checkout', { body: { tier: t } });
    if (error) {
      const status = error.context && error.context.status;
      return { ok: false, reason: status === 503 ? 'not_configured' : 'gateway' };
    }
    if (data && data.changed) return { ok: true, changed: true };
    if (data && (data.checkoutUrl || data.portalUrl)) { go(data.checkoutUrl || data.portalUrl); return { ok: true }; }
    return { ok: false, reason: 'gateway' };
  } catch (e) {
    return { ok: false, reason: 'offline' };
  }
}

export async function buyPlus(plan) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  /* monthly is a real subscription through Lemon Squeezy (functions/ls-checkout);
     until its keys exist it answers 503 and the Paymob month below is used */
  if (plan === 'month') {
    try {
      const { data, error } = await supabase.functions.invoke('ls-checkout', { body: {} });
      if (!error && data && (data.checkoutUrl || data.portalUrl)) { go(data.checkoutUrl || data.portalUrl); return { ok: true }; }
    } catch (e) { /* fall through to Paymob */ }
  }
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan } });
    if (error) {
      const status = error.context && error.context.status;
      return { ok: false, reason: status === 503 ? 'not_configured' : status === 409 ? 'not_ready' : 'gateway' };
    }
    if (!data || !data.checkoutUrl) return { ok: false, reason: 'gateway' };
    go(data.checkoutUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'offline' };
  }
}
