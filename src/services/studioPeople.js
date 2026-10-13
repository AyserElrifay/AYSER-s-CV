import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── STUDIO · PEOPLE ──────────────────────────────────────────────────
   Find somebody, see their posts and stories, take one down, hold the
   account until a one-to-one, close it, reopen it (RUN_ME.sql "STUDIO ·
   PEOPLE"). Every call is checked by the database (studio_can 'safety'). */
const act = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    return error ? { ok: false, reason: 'server', detail: error.message } : data;
  } catch (e) { return { ok: false, reason: 'offline' }; }
};
export async function findPeople(q) { const r = await act('studio_find_people', { q }); return Array.isArray(r) ? r : []; }
export async function personContent(id) { const r = await act('studio_person_content', { p_user: id }); return r && !r.reason ? r : { posts: [], stories: [] }; }
export const removeContent = (kind, id) => act('studio_remove_content', { p_kind: kind, p_id: id });
export const setStanding = (id, state) => act('studio_set_standing', { p_user: id, p_state: state });
