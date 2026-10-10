import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── THE STUDIO TEAM ─────────────────────────────────────────────────
   Team members sign in with a username and a password the owner chose.
   Behind the username is a sign-in address on a reserved domain that
   can never receive mail (see supabase/functions/team-admin), so on the
   sign-in screen a name with no "@" is turned into that address.
   Which tabs a member sees is decided by the server (studio_can). */

export { TEAM_DOMAIN, signInAddress } from '../lib/teamAddress';
export const TEAM_ROLES = [
  { k: 'safety', label: 'Safety', sub: 'Reported chats, strikes, coach sessions, content reports' },
  { k: 'verify', label: 'Verify', sub: 'Tour guides and hosts, their documents' },
  { k: 'all', label: 'All', sub: 'Both of the above' },
];

/* what this person may open: { owner, role, username } — or null */
export async function myStudio() {
  if (!SUPABASE_READY) return null;
  try {
    const { data, error } = await supabase.rpc('my_studio');
    if (error || !data) return null;
    return data.identity || data.owner || data.role ? data : null;
  } catch (e) { return null; }
}

export async function fetchTeam() {
  const { data, error } = await supabase.rpc('team_list');
  if (error) throw error;
  return data || [];
}

export async function teamAction(action, payload) {
  const { data, error } = await supabase.functions.invoke('team-admin', { body: { action, ...(payload || {}) } });
  if (error) {
    let code = null;
    try { code = (await error.context.json()).error; } catch (e) {}
    throw new Error(code || 'failed');
  }
  return data;
}

/* "I am here" — every minute while the Studio is open (studio_ping) */
export async function studioPing() {
  try { await supabase.rpc('studio_ping'); } catch (e) {}
}

/* the owner's view: { online: [{ name, role, seen_at }], log: [{ who, action, detail, at }] } */
export async function studioActivity() {
  const { data, error } = await supabase.rpc('studio_activity');
  if (error) throw error;
  return { online: (data && data.online) || [], log: (data && data.log) || [] };
}
