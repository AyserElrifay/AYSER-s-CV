/* ─── OFFLINE FIRST ───────────────────────────────────────────────────
   On a metro platform, in a basement café, on a roaming SIM that ran
   out: the app still opens (public/sw.js keeps the code), still shows
   what you last saw (remember / recall below), and "I'm coming" still
   counts — it waits here, in the outbox, and goes the moment the phone
   is back online.

   Two rules keep it honest:
   · what is shown from memory is the last real answer, never a guess,
     and the screen says it is offline;
   · an action waits only while the network is the problem. If the
     server answers no, the outbox drops it — it does not retry a "no".

   Pure enough to check without a browser:

       node scripts/check-offline.mjs
*/

const PREFIX = 'moments.off.';
const OUTBOX = 'moments.outbox';
export const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

let store = null;
const ls = () => {
  if (store) return store;
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) {}
  return null;
};
/* the check script hands in a plain object instead of localStorage */
export function setOfflineStore(s) { store = s; }

export function isOffline() {
  try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch (e) { return false; }
}

const subs = new Set();
let wired = false;
function wire() {
  if (wired || typeof window === 'undefined' || !window.addEventListener) return;
  wired = true;
  const tell = () => subs.forEach((fn) => { try { fn(!isOffline()); } catch (e) {} });
  window.addEventListener('online', tell);
  window.addEventListener('offline', tell);
}
/* fn(online) whenever the phone goes on or off line */
export function onConnectivity(fn) { wire(); subs.add(fn); return () => subs.delete(fn); }

/* ── the last real answer ── */
export function remember(key, data, now = Date.now()) {
  const s = ls(); if (!s) return;
  try { s.setItem(PREFIX + key, JSON.stringify({ at: now, data })); } catch (e) { /* full: just don't keep it */ }
}
export function recall(key, now = Date.now()) {
  const s = ls(); if (!s) return null;
  try {
    const v = JSON.parse(s.getItem(PREFIX + key) || 'null');
    if (!v || typeof v.at !== 'number' || now - v.at > MAX_AGE_MS) return null;
    return v.data;
  } catch (e) { return null; }
}

/* ── the outbox ── one entry per thing: tapping Join, then Not going,
   while offline leaves only the last word, which is what was meant. */
const readBox = () => {
  const s = ls(); if (!s) return [];
  try { const v = JSON.parse(s.getItem(OUTBOX) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
};
const writeBox = (list) => {
  const s = ls(); if (!s) return;
  try { if (list.length) s.setItem(OUTBOX, JSON.stringify(list)); else s.removeItem(OUTBOX); } catch (e) {}
};
const boxSubs = new Set();
const boxChanged = () => { const n = readBox().length; boxSubs.forEach((fn) => { try { fn(n); } catch (e) {} }); };
export function onOutbox(fn) { boxSubs.add(fn); return () => boxSubs.delete(fn); }

export function enqueue(action, now = Date.now()) {
  if (!action || !action.kind || action.id == null) return;
  const list = readBox().filter((a) => !(a.kind === action.kind && a.id === action.id));
  list.push({ ...action, at: now });
  writeBox(list);
  boxChanged();
}
export function pending(kind) { return readBox().filter((a) => !kind || a.kind === kind); }

/* Send what waited. run(action) resolves to 'sent', 'refused' or
   'network'; only 'network' stays in the box. */
let flushing = false;
export async function flush(run) {
  if (flushing || isOffline()) return { sent: 0, left: readBox().length };
  flushing = true;
  let sent = 0;
  try {
    for (const a of readBox()) {
      let r = 'network';
      try { r = await run(a); } catch (e) { r = 'network'; }
      if (r === 'network') break;              // still no way through: keep the rest, in order
      writeBox(readBox().filter((x) => !(x.kind === a.kind && x.id === a.id && x.at === a.at)));
      if (r === 'sent') sent += 1;
    }
  } finally { flushing = false; boxChanged(); }
  return { sent, left: readBox().length };
}

/* A list from the server, with what is still waiting in the outbox laid
   over it — so a plan joined offline reads "Going" after a reload too. */
export function withPendingJoins(rows) {
  const waits = pending('join');
  if (!waits.length || !Array.isArray(rows)) return rows;
  return rows.map((g) => {
    const w = waits.find((a) => a.id === g.id);
    if (!w || !!g.im_going === !!w.going) return g;
    return { ...g, im_going: !!w.going, going: Math.max(0, (Number(g.going) || 0) + (w.going ? 1 : -1)) };
  });
}
