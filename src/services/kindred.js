import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { summarizeKindred } from '../lib/kindred';

/* ─── HOW MANY PEOPLE ARE LIKE YOU — COUNTED, NOT CLAIMED ─────────────
   Ayser: "خليه لما اختار preferences يقلي أنا شبه كام user حول العالم",
   with a competitor's screen beside it that said 102,192 travellers had
   things in common with a person who had been in the app for forty
   seconds.

   Ours counts rows. The people on Moments who picked the same vibe, the
   real flags they set, and how many of them set yours. If that is
   three people, the screen says three — see src/lib/kindred.js for the
   words, and for why a small true number beats a big invented one.

   One round trip for the list of flags, and an exact count with it, so
   a busy vibe is counted correctly beyond the rows we bother to read.
   Four seconds and it gives up, and the sign-up carries on without it:
   counting people is never a reason to keep somebody out of the app. */
export async function countKindred({ intent, myFlag, meId }) {
  if (!SUPABASE_READY || !intent) return null;
  let q = supabase
    .from('profiles')
    .select('country_flag', { count: 'exact' })
    .eq('intent', intent)
    .limit(2000);
  if (meId) q = q.neq('id', meId);
  const { data, count, error } = await withDeadline(q, 4000);
  if (error) throw error;
  const flags = (data || []).map((r) => r.country_flag).filter(Boolean);
  let sameHere = null;
  if (myFlag) {
    sameHere = flags.filter((f) => f === myFlag).length;
    /* more people than rows read: ask for that one number exactly
       rather than report the part of it we happened to see */
    if (typeof count === 'number' && count > (data || []).length) {
      let h = supabase.from('profiles').select('id', { count: 'exact', head: true })
        .eq('intent', intent).eq('country_flag', myFlag);
      if (meId) h = h.neq('id', meId);
      const r = await withDeadline(h, 4000);
      if (!r.error && typeof r.count === 'number') sameHere = r.count;
    }
  }
  return summarizeKindred({ total: typeof count === 'number' ? count : (data || []).length, flags, sameHere, myFlag });
}
