import { supabase, SUPABASE_READY } from '../lib/supabase';
import { smallImage, uploadMediaSmart } from '../lib/storage';

/* ─── THE 3-PHOTO CARD AND THE BLURRED SEATS ──────────────────────────
   RUN_ME.sql, "THE 3-PHOTO CARD". The server decides who sees what: a
   stranger at your table gets only the tiny blurred copies until you
   have both scanned the table's QR. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args); return error ? { ok: false, reason: 'error' } : data; } catch (e) { return { ok: false, reason: 'error' }; }
};

export const myCard = () => rpc('my_card');
export const saveCard = (photos, blurs, prompts) => rpc('profile_card_save', { p_photos: photos, p_blurs: blurs, p_prompts: prompts });
export const tableSeats = (kind, id) => rpc('table_seats', { p_kind: kind, p_id: id });
export const seatCard = (kind, id, uid) => rpc('seat_card', { p_kind: kind, p_id: id, p_user: uid });
export const sparksDeck = (kind, id) => rpc('table_sparks_deck', { p_kind: kind, p_id: id });
export const sendTableSpark = (kind, id, to) => rpc('table_spark', { p_kind: kind, p_id: id, p_to: to });

/* any screen can ask for the card (App.js CardGate) */
export const askCard = () => { try { window.dispatchEvent(new CustomEvent('mm-need-card')); } catch (e) {} };

/* one photo: the card's copy (WebP, 800px, 80 KB at most) and a 24-pixel blurred
   copy — the only one a stranger is ever sent. Both get names nobody can
   guess (src/lib/storage.js). */
export async function uploadCardPhoto(userId, uri) {
  const big = await smallImage(uri, 800, 0.72);
  const tiny = await smallImage(uri, 24, 0.5);
  // never the real photo in place of the blurred one: if it could not be made small, stop
  if (!tiny.ext || tiny.uri === uri) throw new Error('could not make the blurred copy');
  const [photo, blur] = await Promise.all([
    uploadMediaSmart(userId, big.uri, big.ext || 'jpg', big.type || 'image/jpeg', { squeeze: 'card' }),   // 800px, 80 KB at most
    uploadMediaSmart(userId, tiny.uri, tiny.ext || 'jpg', tiny.type || 'image/jpeg'),
  ]);
  return { photo, blur };
}
