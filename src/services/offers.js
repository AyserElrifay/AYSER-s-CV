import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { publicMedia } from '../lib/publicMedia';

/* ─── TRIPS, DEALS AND STAYS ──────────────────────────────────────────
   Everything here is priced, counted and decided by the database
   (RUN_ME.sql "BOOKINGS"). The app shows offers and asks for a
   booking; it never sends a price. */

const call = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    return error ? null : data;
  } catch (e) { return null; }
};
const act = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    if (error) return { ok: false, reason: /fetch|network/i.test(error.message || '') ? 'offline' : 'server', detail: error.message };
    return data || { ok: false, reason: 'empty' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

/* a photo is either a full address or one of our own files in
   public/media ("media/welcome-dahab.jpg") */
export const photoUrl = (p) => (!p ? null : /^https?:|^data:|^blob:/.test(p) ? p : publicMedia(String(p).replace(/^\/?media\//, '')));

export const listOffers = async (kind, country) => { const r = await call('list_offers', { p_kind: kind || null, p_country: country || null }); return Array.isArray(r) ? r : []; };
export const bookOffer = (offerId, qty, mode, note) => act('book_offer', { p_offer: offerId, p_qty: qty, p_mode: mode, p_note: note || null });
export const cancelBooking = (id) => act('cancel_booking', { p_id: id });
export const restoreBooking = (id) => act('restore_booking', { p_id: id });
export const myBookings = async () => { const r = await call('my_bookings'); return Array.isArray(r) ? r : []; };
export const myPlus = () => call('my_plus');
export const bookingPhotoOk = (id, ok) => act('booking_set_photo_ok', { p_id: id, p_ok: !!ok });

/* the Studio's side — refused by the database for anybody but the owner */
export const ownerOffers = async () => { const r = await call('owner_offers'); return Array.isArray(r) ? r : null; };
export const offerSave = (p) => act('offer_save', { p });
export const offerSetStatus = (id, status) => act('offer_set_status', { p_id: id, p_status: status });
export const ownerBookings = async (offerId) => { const r = await call('owner_bookings', { p_offer: offerId }); return Array.isArray(r) ? r : []; };
export const ownerMarkBooking = (id, status) => act('owner_mark_booking', { p_id: id, p_status: status });
export const ownerSetSetting = (key, value) => act('owner_set_setting', { p_key: key, p_value: value });
export async function appSettings() {
  if (!SUPABASE_READY) return {};
  try {
    const { data } = await withDeadline(supabase.from('app_settings').select('key, value'));
    const out = {}; (data || []).forEach((r) => { out[r.key] = r.value; }); return out;
  } catch (e) { return {}; }
}

/* "2,800 EGP" in the reader's own digits */
export const money = (n, cur, lang) => {
  const v = Number(n) || 0;
  let s = String(v);
  try { s = v.toLocaleString(lang === 'ar' ? 'ar-EG' : lang || 'en', { maximumFractionDigits: 2 }); } catch (e) {}
  const c = String(cur || 'EGP').toUpperCase();
  return c === 'USD' ? '$' + s : c === 'EUR' ? '€' + s : s + ' ' + (lang === 'ar' && c === 'EGP' ? 'ج.م' : c);
};
export const offerSetVideo = (id, video) => act('offer_set_video', { p_id: id, p_video: video || null });

/* "I want to go" on a coming-soon trip — one row per person; the
   database counts and, when the trip opens, tells everybody who asked */
export const offerWant = (id, on) => act('offer_want', { p_offer: id, p_on: on !== false });
export const offerSetDuration = (id, hours) => act('offer_set_duration', { p_id: id, p_hours: hours == null || !isFinite(hours) ? null : hours });
