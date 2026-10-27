import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── THE MIDNIGHT TABLE · CHATS · THE ✦ ── (RUN_ME.sql, "FREEMIUM · THE
   MIDNIGHT TABLE · TABLE BUDDIES FROM THE QR"). Who is picked, who may
   Spark and who may write are the server's answers. */

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } };
const rpc = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(name, args); return error ? null : data; } catch (e) { return null; }
};

export const midnightTable = () => rpc('midnight_table', { p_tz: tz() });
export const midnightSpark = (key) => rpc('midnight_spark', { p_key: key, p_tz: tz() });
export const myChats = () => rpc('my_chats');

// who wears the ✦ (one gathered ask per screen: lib/premium.js)
export { premiumOf } from '../lib/premium';
