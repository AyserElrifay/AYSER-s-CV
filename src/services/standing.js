import { supabase } from '../lib/supabase';

/* ─── REPORT, BLOCK, STRIKES ──────────────────────────────────────────
   One button in a chat. Confirmed, the server does three things at
   once (report_harassment in RUN_ME.sql): blocks the person for you,
   copies their last five messages in that chat into the report, and
   tells the Moments team. Then Bardi reads those five (the
   safety-review function) so the worst reach a person first.

   A strike is only ever given by a person in the Studio. One strike:
   no messages, posts or plans until a session with a Moments life
   coach. Two: the account is closed. That is enforced by the database,
   not by these screens. */

export const REPORT_KINDS = ['threat', 'harassment', 'sexual', 'hate', 'other'];

export async function reportInChat({ userId, dmThreadId, squadId, reason }) {
  const { data, error } = await supabase.rpc('report_harassment', {
    p_user: userId, p_dm: dmThreadId || null, p_squad: squadId || null, p_reason: reason,
  });
  if (error) throw error;
  if (!data || !data.ok) throw new Error((data && data.reason) || 'report_failed');
  /* Bardi's reading — on its own, never holding the reporter up */
  if (data.id && !data.again) {
    supabase.functions.invoke('safety-review', { body: { report_id: data.id } }).catch(() => {});
  }
  return data;
}

export async function blockPerson(meId, otherId) {
  const { error } = await supabase.from('user_blocks').insert({ blocker_id: meId, blocked_id: otherId });
  if (error && error.code !== '23505') throw error;   // already blocked is fine
  return true;
}

export async function unblockPerson(meId, otherId) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', meId).eq('blocked_id', otherId);
  if (error) throw error;
  return true;
}

export async function fetchMyBlocks(meId) {
  try {
    const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', meId);
    return new Set((data || []).map((r) => r.blocked_id));
  } catch (e) { return new Set(); }
}

/* your own standing: { strikes, state: null | 'coach' | 'closed', coach_asked_at } */
export async function myStanding(meId) {
  try {
    const { data, error } = await supabase.from('safety_standing').select('strikes, state, coach_asked_at').eq('user_id', meId).maybeSingle();
    if (error) return null;
    return data || null;
  } catch (e) { return null; }
}

export async function askForCoach() {
  const { data, error } = await supabase.rpc('safety_ask_coach');
  if (error) throw error;
  return data;
}

/* ── the Studio ── */
export async function fetchSafetyQueue() {
  const { data, error } = await supabase.rpc('safety_queue');
  if (error) throw error;
  return { reports: (data && data.reports) || [], coach: (data && data.coach) || [] };
}
export async function decideReport(id, strike) {
  const { data, error } = await supabase.rpc('safety_decide', { p_id: id, p_strike: !!strike });
  if (error) throw error;
  return data;
}
export async function coachDone(userId) {
  const { data, error } = await supabase.rpc('safety_coach_done', { p_user: userId });
  if (error) throw error;
  return data;
}

/* what the database said when it refused, in words a person can use */
export const safetyRefusal = (e) => {
  const m = String((e && e.message) || '');
  if (/safety_closed/.test(m)) return 'closed';
  if (/safety_coach/.test(m)) return 'coach';
  if (/\bblocked\b/.test(m)) return 'blocked';
  return null;
};
