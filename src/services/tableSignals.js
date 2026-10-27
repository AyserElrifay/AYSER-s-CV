import { supabase, SUPABASE_READY } from '../lib/supabase';

/* official tables and my Vibe Match with the people going (RUN_ME.sql, table_signals) */
export const tableSignals = async (ids) => {
  if (!SUPABASE_READY || !ids || !ids.length) return {};
  try { const { data, error } = await supabase.rpc('table_signals', { p_ids: ids.slice(0, 80) }); return error ? {} : data || {}; } catch (e) { return {}; }
};
