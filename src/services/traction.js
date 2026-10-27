import { supabase, SUPABASE_READY } from '../lib/supabase';

/* the owner's traction numbers (RUN_ME.sql, traction_metrics) — counted by the database */
export const tractionMetrics = async () => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc('traction_metrics'); return error ? null : data; } catch (e) { return null; }
};
