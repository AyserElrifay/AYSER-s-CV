import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { requestUnlock } from '../lib/unlockBus';

/* Talk rooms: every rule (where, who, how long) is decided by the
   database — see "TALK ROOMS" in supabase/RUN_ME.sql. */
const rpc = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args));
    if (error) return { ok: false, reason: /fetch|network|load failed/i.test(error.message || '') ? 'offline' : 'server' };
    return data || { ok: false, reason: 'empty' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export const talkRoomsNear = () => rpc('talk_rooms_near');
export async function startTalkRoom({ title, minutes, radiusKm, area, country, venueId }) {
  const r = await rpc('talk_room_start', { p_title: title, p_minutes: minutes, p_radius_km: radiusKm, p_area: area || null, p_country: country || null, p_venue: venueId || null });
  if (r && r.reason === 'need_unlock') requestUnlock('big');
  return r;
}
export const joinTalkRoom = (id) => rpc('talk_room_join', { p_id: id });
export const leaveTalkRoom = (id) => rpc('talk_room_leave', { p_id: id });
export const talkBridge = (id) => rpc('talk_room_bridge', { p_id: id });
export const talkMeet = (id, inMinutes = 60) => rpc('talk_room_meet', { p_id: id, p_in_minutes: inMinutes });

/* the venue an organisation may host from, if this account owns one */
export async function myLiveVenue(userId) {
  if (!SUPABASE_READY || !userId) return null;
  try {
    const { data } = await withDeadline(supabase.from('venues').select('id, name').eq('owner_id', userId).eq('status', 'live').limit(1));
    return (data && data[0]) || null;
  } catch (e) { return null; }
}
