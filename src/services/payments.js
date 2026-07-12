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

export async function startCheckout(provider, { amount, currency = 'EGP', kind = 'boost', refId, description }) {
  if (!SUPABASE_READY) return { configured: false, reason: 'demo' };
  try {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess && sess.session && sess.session.user;

    // Record the intent so it shows in the ledger immediately.
    if (user) {
      await supabase.from('payments').insert({
        user_id: user.id, kind, ref_id: refId || null, provider,
        amount, currency, commission: Number((amount * PLATFORM_FEE).toFixed(2)), status: 'pending',
      });
    }

    // Ask the server to create the real checkout (secret keys live there).
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { provider, amount, currency, kind, refId, description },
    });
    if (error || !data || !data.checkoutUrl) return { configured: false, reason: 'no-function' };

    Linking.openURL(data.checkoutUrl).catch(() => {});
    return { configured: true, checkoutUrl: data.checkoutUrl };
  } catch (e) {
    return { configured: false, reason: e.message };
  }
}
