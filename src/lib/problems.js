import { supabase, SUPABASE_READY } from './supabase';

/* ─── EVERY PROBLEM REACHES THE STUDIO ────────────────────────────────
   Ayser: "أي مشكلة تجيلي إشعار في الستوديو، وماتبانش لليوزرز". Whatever
   fails on a phone — a refused query, a missing word, a screen that
   crashed — is sent once to report_problem (supabase/RUN_ME.sql,
   "PROBLEMS GO TO THE STUDIO"), where the same problem from many phones
   is one row and a new one notifies the owner. The person on the phone
   is shown a friendly sentence; never this.

   A dropped signal is not a bug in the app, so those are left out. */
const NOISE = /failed to fetch|load failed|networkerror|network request failed|timed? ?out|aborterror|the operation was aborted|offline|cancelled/i;
const sent = new Set();
let budget = 30;   // per session, so a loop can't flood

export function reportProblem(area, err, detail) {
  try {
    if (!SUPABASE_READY || budget <= 0) return;
    const msg = String((err && (err.message || err.error_description || err.error)) || err || '').slice(0, 300);
    if (!msg || NOISE.test(msg)) return;
    const key = area + '|' + msg;
    if (sent.has(key)) return;
    sent.add(key); budget -= 1;
    const code = err && (err.code || err.status) ? String(err.code || err.status).slice(0, 40) : null;
    const where = typeof window !== 'undefined' && window.location ? window.location.pathname + window.location.search : '';
    const extra = [detail, where, typeof navigator !== 'undefined' ? navigator.userAgent : ''].filter(Boolean).join(' · ').slice(0, 800);
    supabase.rpc('report_problem', { p_area: String(area || '?').slice(0, 40), p_message: msg, p_code: code, p_detail: extra }).then(() => {}, () => {});
  } catch (e) { /* reporting must never be the thing that breaks */ }
}

export const ownerProblems = async () => {
  const { data, error } = await supabase.rpc('owner_problems');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};
export const setProblem = (id, status) => supabase.rpc('owner_problem_set', { p_id: id, p_status: status });
