import { supabase } from '../lib/supabase';

/* Squad Pins — a padel match, five-a-side or a study table that somebody
   with three real Moments tables behind them drops on the map. Every rule
   (the three check-ins, the Thursday/Friday night block, one live pin,
   how many may join) lives in the database (RUN_ME.sql · SQUAD PINS);
   this file only asks. */

export const SQUAD_KINDS = {
  padel: { icon: 'tennisball-outline', en: 'Padel', ar: 'بادل', max: 3, mins: 90 },
  football: { icon: 'football-outline', en: '5v5 Football', ar: 'كورة خماسي', max: 9, mins: 90 },
  study: { icon: 'book-outline', en: 'Study / Work buddy', ar: 'مذاكرة / شغل', max: 3, mins: 180 },
};

export const SQUAD_UNLOCK = 3;

export async function myCheckins() {
  const { data, error } = await supabase.rpc('my_checkins');
  if (error) throw error;
  return Number(data) || 0;
}

export async function listSquadPins() {
  const { data, error } = await supabase.rpc('squad_pin_list');
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }));
}

export async function createSquadPin({ kind, need, lat, lng, place, startsAt }) {
  const { data, error } = await supabase.rpc('squad_pin_create', {
    p_kind: kind, p_need: need, p_lat: lat, p_lng: lng, p_place: place || null, p_starts_at: startsAt,
  });
  if (error) throw error;
  return data || {};
}

export async function joinSquadPin(id, on = true) {
  const { data, error } = await supabase.rpc('squad_pin_join', { p_id: id, p_on: on });
  if (error) throw error;
  return data || {};
}

export async function cancelSquadPin(id) {
  const { data, error } = await supabase.rpc('squad_pin_cancel', { p_id: id });
  if (error) throw error;
  return data || {};
}

/* "Need 2 more players · Tonight 9 PM" — never "1 going". */
export function squadLine(p, lang) {
  const ar = lang === 'ar';
  const left = Number(p.left) || 0;
  const who = p.kind === 'study' ? (left === 1 ? 'buddy' : 'buddies') : (left === 1 ? 'player' : 'players');
  const need = left > 0
    ? (ar ? `محتاجين ${left.toLocaleString('ar-EG')} كمان` : `Need ${left} more ${who}`)
    : (ar ? 'الفرقة كملت' : 'Squad complete');
  return need + ' · ' + squadWhen(p.starts_at, lang);
}

export function squadWhen(iso, lang) {
  const ar = lang === 'ar';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  let time = '';
  try { time = d.toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined }); } catch (e) { time = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
  const evening = d.getHours() >= 17;
  if (diff === 0) return (ar ? (evening ? 'الليلة ' : 'النهارده ') : (evening ? 'Tonight ' : 'Today ')) + time;
  if (diff === 1) return (ar ? 'بكرة ' : 'Tomorrow ') + time;
  let wd = '';
  try { wd = d.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'long' }); } catch (e) {}
  return wd + ' ' + time;
}

/* the client mirror of the server's Thursday/Friday 7 pm – midnight rule,
   only so the time picker can grey those slots out; the server decides */
export function hitsFlagship(start, mins) {
  const cairo = (x) => {
    try {
      const s = new Date(x).toLocaleString('en-US', { timeZone: 'Africa/Cairo', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' });
      const [wd, hm] = s.split(', ');
      const [h, m] = hm.split(':').map(Number);
      return { wd, mins: (h % 24) * 60 + m };
    } catch (e) { const d = new Date(x); return { wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], mins: d.getHours() * 60 + d.getMinutes() }; }
  };
  for (let t = new Date(start).getTime(); t < new Date(start).getTime() + mins * 60000; t += 15 * 60000) {
    const c = cairo(t);
    if ((c.wd === 'Thu' || c.wd === 'Fri') && c.mins >= 19 * 60) return true;
  }
  return false;
}
