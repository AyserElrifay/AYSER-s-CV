import { supabase, SUPABASE_READY } from '../lib/supabase';
import { bardiTask } from './bardi';
// the table list (Together, in the first download) and the Studio's numbers ask through
// their own small files — tableSignals.js, traction.js — so this one stays with the LiveKit piece
export { tableSignals } from './tableSignals';

/* ── MOMENTS AT SCALE ── (RUN_ME.sql, "MOMENTS AT SCALE"). Every score,
   every official flag, every city count and every traction number is
   the server's; these only ask. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? null : data; } catch (e) { return null; }
};

export const vibeMatches = (ids) => (ids && ids.length ? rpc('vibe_matches', { p_users: ids.slice(0, 80) }) : Promise.resolve({}));
export const loungeSignals = () => rpc('lounge_signals');
export const hostStatus = () => rpc('host_status');
export const cityHubs = async () => { const r = await rpc('city_hubs_list'); return Array.isArray(r) ? r : []; };
export const tableProfile = (kind, id) => rpc('table_profile', { p_kind: kind, p_id: id });

/* three icebreakers written by Papyrus for who is at this table — from
   the table's profile in aggregate (languages, goals, hobbies; never a
   name). Null when Papyrus is not reachable: the card deck stands in. */
export async function tableIcebreakers(profile, lang) {
  if (!profile || !profile.ok) return null;
  const r = await bardiTask('icebreakers', JSON.stringify({ people: profile.people, learning: profile.learning, speaking: profile.speaking, goals: profile.goals, hobbies: profile.hobbies, countries: profile.countries }), lang);
  if (!r) return null;
  const lines = String(r).split('\n').map((s) => s.replace(/^[\s\-•*\d.)]+/, '').trim()).filter((s) => s.length > 8 && s.length < 220);
  return lines.length >= 2 ? lines.slice(0, 3) : null;
}
