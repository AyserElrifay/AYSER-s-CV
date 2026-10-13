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
    if (typeof window !== 'undefined' && window.location) window.location.assign(data.checkoutUrl);
    else Linking.openURL(data.checkoutUrl).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'offline' };
  }
}

/* ── MOMENTS PLUS ── the app names the plan; the server reads the
   owner's price, and Paymob's signed webhook adds the days. */
export async function buyPlus(plan) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan } });
    if (error) {
      const status = error.context && error.context.status;
      return { ok: false, reason: status === 503 ? 'not_configured' : status === 409 ? 'not_ready' : 'gateway' };
    }
    if (!data || !data.checkoutUrl) return { ok: false, reason: 'gateway' };
    if (typeof window !== 'undefined' && window.location) window.location.assign(data.checkoutUrl);
    else Linking.openURL(data.checkoutUrl).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'offline' };
  }
}
