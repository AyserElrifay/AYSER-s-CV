import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { isBizDemo } from '../lib/bizLink';

/* ─── THE DEMO (…/?business=demo) ── sample data kept in memory: every
   name says it is a sample, and nothing is saved or sent. */
const DAY = 86400000;
const demoPlace = {
  id: '00000000-0000-4000-8000-00000000d3e0', name: 'Your café (demo)', biz_type: 'cafe', listed: false,
  country: 'EG', city: 'Cairo', address: '', staff_code: '4821', photos: [], details: {}, about: '', updated_at: 'demo',
};
const demoStats = {
  ok: true, today: 3, week: 17, month: 52, people: 41, back: 9, rewards: 2, free_left: 0, fee: 20, month_bill: 40,
  recent: [1, 2, 3, 4].map((i) => ({ name: 'Sample guest ' + i, avatar: null, visits: 5 - i, at: new Date(Date.now() - i * DAY / 3).toISOString() })),
};
const demoReqs = [
  { id: 'd1', kind: 'table', status: 'new', name: 'Sample guest 5', people: 6, from: 'Fri 8:00 pm', to: null, note: 'A birthday — a quiet corner if you have one.' },
  { id: 'd2', kind: 'table', status: 'accepted', name: 'Sample guest 6', people: 4, from: 'Thu 6:30 pm', to: null, note: '', reply: 'See you then!' },
];
const demoRpc = (name, args) => {
  if (name === 'my_venue') return { ...demoPlace };
  if (name === 'biz_save') { Object.assign(demoPlace, args.p, { updated_at: 'demo' + Date.now() }); return { ok: true }; }
  if (name === 'biz_new_code') { demoPlace.staff_code = String(1000 + Math.floor(Math.random() * 9000)); return { ok: true, code: demoPlace.staff_code }; }
  if (name === 'biz_stats') return demoStats;
  if (name === 'biz_requests_in') return demoReqs.map((q) => ({ ...q }));
  if (name === 'biz_answer') { const q = demoReqs.find((x) => x.id === args.p_id); if (q) { q.status = args.p_status; q.reply = args.p_reply; } return { ok: true }; }
  if (name === 'biz_live_token') return { ok: true, token: Math.floor(Date.now() / 60000).toString(16).slice(-8).padStart(8, '0'), seconds: 60 - new Date().getSeconds() };
  return { ok: false, reason: 'demo' };
};

/* Businesses on Moments (supabase/RUN_ME.sql, "BUSINESSES ON MOMENTS").
   Every rule — who may change a place, the counter code, one visit a
   day — is on the server; these only ask. */
const rpc = async (name, args) => {
  if (isBizDemo()) return demoRpc(name, args || {});
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    if (error) return { ok: false, reason: /does not exist|schema cache/i.test(error.message || '') ? 'setup' : /fetch|network/i.test(error.message || '') ? 'offline' : 'err' };
    return data == null ? { ok: false, reason: 'err' } : data;
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export const myPlace = () => rpc('my_venue');
export const savePlace = (p) => rpc('biz_save', { p });
export const newCounterCode = () => rpc('biz_new_code');
export const placeStats = () => rpc('biz_stats');
export const requestsIn = async () => { const r = await rpc('biz_requests_in'); return Array.isArray(r) ? r : []; };
export const answerRequest = (id, status, reply) => rpc('biz_answer', { p_id: id, p_status: status, p_reply: reply || null });

export const directory = async (type, city) => { const r = await rpc('biz_directory', { p_type: type || null, p_city: city || null }); return Array.isArray(r) ? r : []; };
export const placePage = (id) => rpc('biz_page', { p_id: id });
export const liveToken = () => rpc('biz_live_token');
export const checkIn = (id, code) => rpc('biz_checkin', { p_venue: id, p_code: code });
export const redeem = (id, code) => rpc('biz_redeem', { p_venue: id, p_code: code });
export const askPlace = (p) => rpc('biz_request', { p });
export const cancelAsk = (id) => rpc('biz_cancel', { p_id: id });
