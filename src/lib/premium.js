import { useEffect, useState } from 'react';
import { supabase, SUPABASE_READY } from './supabase';

/* ── WHO WEARS THE ✦ ── (RUN_ME.sql, premium_of): a real Moments+ or
   Black membership, paid or gifted. Every name on a screen asks within
   the same moment, so the asks are gathered into one call, and each
   answer is remembered for the visit. */
const known = new Map();
let queue = new Set();
let timer = null;
let waiters = [];
const flush = async () => {
  const ask = [...queue]; queue = new Set(); timer = null;
  const done = waiters; waiters = [];
  if (ask.length && SUPABASE_READY) {
    try {
      const { data } = await supabase.rpc('premium_of', { p_ids: ask });
      const yes = new Set(Array.isArray(data) ? data : []);
      ask.forEach((i) => known.set(i, yes.has(i)));
    } catch (e) { /* no ✦ is the quiet answer */ }
  }
  done.forEach((fn) => fn());
};
export function premiumOf(ids) {
  // only real account ids: one sample id would fail the whole ask
  const list = (ids || []).filter((i) => typeof i === 'string' && /^[0-9a-f-]{36}$/i.test(i));
  list.forEach((i) => { if (!known.has(i)) queue.add(i); });
  const answer = () => { const out = {}; list.forEach((i) => { if (known.get(i)) out[i] = true; }); return out; };
  if (!queue.size) return Promise.resolve(answer());
  return new Promise((res) => { waiters.push(() => res(answer())); if (!timer) timer = setTimeout(flush, 40); });
}
export function usePremium(id) {
  const [on, setOn] = useState(() => !!(id && known.get(id)));
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    premiumOf([id]).then((r) => { if (alive) setOn(!!r[id]); });
    return () => { alive = false; };
  }, [id]);
  return on;
}
