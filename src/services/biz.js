import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* Businesses on Moments (supabase/RUN_ME.sql, "BUSINESSES ON MOMENTS").
   Every rule — who may change a place, the counter code, one visit a
   day — is on the server; these only ask. */
const rpc = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    if (error) return { ok: false, reason: /does not exist|schema cache/i.test(error.message || '') ? 'setup' : /fetch|network/i.test(error.message || '') ? 'offline' : 'err' };
    return data == null ? { ok: false, reason: 'err' } : data;
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export const myPlace = () => rpc('my_venue');
export const savePlace = (p) => rpc('biz_save', { p });
export const newCounterCode = () => rpc('biz_new_code');
export const placeStats = () => rpc('biz_stats');
export const requestsIn = async () => { const r = await rpc('biz_requests_in'); return Array.isArray(r) ? r : []; };
export const answerRequest = (id, status, reply) => rpc('biz_answer', { p_id: id, p_status: status, p_reply: reply || null });

export const directory = async (type, city) => { const r = await rpc('biz_directory', { p_type: type || null, p_city: city || null }); return Array.isArray(r) ? r : []; };
export const placePage = (id) => rpc('biz_page', { p_id: id });
export const checkIn = (id, code) => rpc('biz_checkin', { p_venue: id, p_code: code });
export const redeem = (id, code) => rpc('biz_redeem', { p_venue: id, p_code: code });
export const askPlace = (p) => rpc('biz_request', { p });
export const cancelAsk = (id) => rpc('biz_cancel', { p_id: id });
