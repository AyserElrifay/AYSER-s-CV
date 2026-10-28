import { supabase, SUPABASE_READY } from '../lib/supabase';
import { earnBonus } from '../lib/feedGate';
import { isBizDemo } from '../lib/bizLink';

/* ── THE MOMENTS PASSPORT ── (RUN_ME.sql, "THE MOMENTS PASSPORT").
   The QR's signature, its 30-second life, one stamp per table, the pass
   and the vouchers are all the server's; these only ask. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? { ok: false, reason: 'err' } : data; } catch (e) { return { ok: false, reason: 'err' }; }
};

export const myPassport = () => rpc('my_passport');
/* a stamp is a real check-in: +30 minutes on today's feed (src/lib/feedGate.js) */
export const stampClaim = (code) => rpc('stamp_claim', { p_code: code }).then((r) => { if (r && r.ok) earnBonus('checkin'); return r; });
// the business demo (…/?business=demo): a sample QR and sample guests, nothing sent anywhere
const demoQr = () => ({ ok: true, title: 'Sample · English café table', code: 'g.00000000-0000-4000-8000-0000000000d1.' + Math.floor(Date.now() / 30000) + '.sampledemo00',
  seconds: 30 - (Math.floor(Date.now() / 1000) % 30), stamped: 3,
  going: ['Sample guest 1', 'Sample guest 2', 'Sample guest 3', 'Sample guest 4', 'Sample guest 5'].map((name, i) => ({ id: 'd' + i, name, avatar_url: null, stamped: i < 3 })) });
export const eventQr = (kind, id) => (isBizDemo() ? Promise.resolve(demoQr()) : rpc('event_qr', { p_kind: kind, p_id: id }));
export const hostStamp = (kind, id, user, on) => (isBizDemo() ? Promise.resolve({ ok: true }) : rpc('host_stamp', { p_kind: kind, p_id: id, p_user: user, p_on: on !== false }));
export const setDmOpen = (on) => rpc('set_dm_open', { p_on: !!on });
export const myLevel2Offer = () => rpc('my_level2_offer');

// a table QR is a link: …/?stamp=<code>. The phone's own camera opens it straight into Moments
export const stampLink = (code) => {
  let base = 'https://therealmoments.com/';
  try { if (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin)) base = window.location.origin + window.location.pathname; } catch (e) {}
  return base + '?stamp=' + encodeURIComponent(code);
};
// what a scanned QR holds: the link, or the bare code
export const codeOf = (text) => {
  const s = String(text || '').trim();
  const m = s.match(/[?&]stamp=([^&#]+)/);
  const c = m ? decodeURIComponent(m[1]) : s;
  return /^[go]\.[0-9a-f-]{36}\.\d+\.[0-9a-f]{12}$/i.test(c) ? c : null;
};
