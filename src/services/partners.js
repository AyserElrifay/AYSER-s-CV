import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── PARTNERS ─────────────────────────────────────────────────────────
   A place or an experience applying to be on Moments (RUN_ME.sql
   "PARTNERS"). Anyone may apply, signed in or not; only the Studio
   reads the applications. */
const act = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    if (error) return { ok: false, reason: /fetch|network/i.test(error.message || '') ? 'offline' : 'server' };
    return data || { ok: false, reason: 'empty' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export const partnerApply = (p) => act('partner_apply', { p });
export async function ownerPartnerApps() {
  const r = await act('owner_partner_apps');
  return Array.isArray(r) ? r : null;
}
export const ownerPartnerSet = (id, status, note) => act('owner_partner_set', { p_id: id, p_status: status, p_note: note || null });

/* an accepted partner's own page (RUN_ME.sql "ACCOUNT TYPES … ACCEPTED VENUES") */
export const myVenue = () => act('my_venue');
export const venueSave = (about, photos, price, currency) => act('venue_save', { p_about: about || null, p_photos: photos || [], p_price: price, p_currency: currency || null });
