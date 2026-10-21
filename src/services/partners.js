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
/* the places where something looks wrong — owner only (owner_partner_flags) */
export const ownerPartnerFlags = async () => {
  if (!SUPABASE_READY) return [];
  try { const { data, error } = await supabase.rpc('owner_partner_flags'); return error || !Array.isArray(data) ? [] : data; } catch (e) { return []; }
};
export async function ownerPartnerApps() {
  const r = await act('owner_partner_apps');
  return Array.isArray(r) ? r : null;
}
export const ownerPartnerSet = (id, status, note) => act('owner_partner_set', { p_id: id, p_status: status, p_note: note || null });

/* an accepted partner's own page (RUN_ME.sql "ACCOUNT TYPES … ACCEPTED VENUES") */
export const myVenue = () => act('my_venue');
export const venueSave = (about, photos, price, currency) => act('venue_save', { p_about: about || null, p_photos: photos || [], p_price: price, p_currency: currency || null });

/* things a partner sells and delivers — bouquets first (RUN_ME.sql "ORDER IT THROUGH MOMENTS") */
export const orderItems = async (kind) => { const r = await act('order_items', { p_kind: kind || null }); return Array.isArray(r) ? r : []; };
export const orderPlace = (p) => act('order_place', { p });
export const myOrders = () => act('my_orders');
export const orderSetStatus = (id, status) => act('order_set_status', { p_id: id, p_status: status });
export const partnerItemSave = (it) => act('partner_item_save', { p_id: it.id || null, p_name: it.name, p_about: it.about || null, p_price: it.price, p_photo: it.photo || null, p_active: it.active !== false });
