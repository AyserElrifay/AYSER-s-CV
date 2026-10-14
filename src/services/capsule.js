import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── TIME CAPSULE ────────────────────────────────────────────────────
   Notes on a plan or a trip, sealed for their recipient until it ends —
   by the database (RUN_ME.sql "TIME CAPSULE"), not by the app hiding
   them. kind is 'plan' (a gathering) or 'trip' (an offer). */

const call = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    return error ? null : data;
  } catch (e) { return null; }
};

export const capsuleView = (kind, id) => call('capsule_view', { p_kind: kind, p_id: id });
export const capsuleSend = async (kind, id, to, body) => (await call('capsule_send', { p_kind: kind, p_id: id, p_to: to, p_body: body })) || { ok: false, reason: 'offline' };
export const capsuleOpenNow = (kind, id) => call('capsule_open_now', { p_kind: kind, p_id: id });
export const capsuleMarkRead = (id) => call('capsule_mark_read', { p_id: id });
export const myCapsules = async () => { const r = await call('my_capsules'); return Array.isArray(r) ? r : []; };
export const memoryBook = (kind, id) => call('my_memory_book', { p_kind: kind, p_id: id });
