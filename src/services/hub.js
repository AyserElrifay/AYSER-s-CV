import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── THE ORGANIZER HUB ── (RUN_ME.sql, "THE ORGANIZER HUB")
   Every rule is the server's; these only ask. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? null : data; } catch (e) { return null; }
};

export const myHosting = () => rpc('my_hosting');
export const hostRoster = (kind, id) => rpc('host_roster', { p_kind: kind, p_id: id });
export const hostCheckin = (kind, id, user, on) => rpc('host_checkin', { p_kind: kind, p_id: id, p_user: user, p_on: !!on });
export const hostImHere = (kind, id, lat, lng) => rpc('host_im_here', { p_kind: kind, p_id: id, p_lat: lat == null ? null : lat, p_lng: lng == null ? null : lng });
export const hostPingDone = (pingId) => rpc('host_ping_done', { p_id: pingId });
export const pingHost = (kind, id, reason, body) => rpc('ping_host', { p_kind: kind, p_id: id, p_reason: reason, p_body: body || null });
export const eventHostHere = (kind, id) => rpc('event_host_here', { p_kind: kind, p_id: id });
export const rateEvent = (kind, id, stars, note) => rpc('rate_event', { p_kind: kind, p_id: id, p_stars: stars, p_note: note || null });
export const myEventRating = (kind, id) => rpc('my_event_rating', { p_kind: kind, p_id: id });
export const myWallet = () => rpc('my_wallet');
export const ownerHostWallets = () => rpc('owner_host_wallets');
export const ownerHostRate = (egp) => rpc('owner_host_rate', { p_egp: egp == null || egp === '' ? null : Number(egp) });
export const ownerHostPayout = (host, amount, note) => rpc('owner_host_payout', { p_host: host, p_amount: Number(amount), p_note: note || null });
export const ownerAssignHost = (offer, user, on) => rpc('owner_assign_host', { p_offer: offer, p_user: user, p_on: on !== false });

/* where the phone is, once, for "I'm here" — never kept on the phone */
export const hereNow = () => new Promise((resolve) => {
  try {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  } catch (e) { resolve(null); }
});
export const ownerOfferPoint = (offer, lat, lng) => rpc('owner_offer_point', { p_offer: offer, p_lat: lat, p_lng: lng });
export const requestPayout = (instapay) => rpc('host_request_payout', { p_instapay: instapay });
export const ownerPayoutRequests = () => rpc('owner_payout_requests');
