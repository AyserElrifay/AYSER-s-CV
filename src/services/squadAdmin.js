import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { appLink } from '../utils/share';

/* ─── RUNNING A GROUP CHAT ─────────────────────────────────────────────
   Roles (owner · admin · moderator · member) and invite links are the
   database's (RUN_ME.sql "GROUP CHATS · ADMINS, MODERATORS AND INVITE
   LINKS"). Every call here is refused there when the caller's role does
   not allow it; the screen only hides what would be refused anyway. */
const act = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    if (error) return { ok: false, reason: /fetch|network/i.test(error.message || '') ? 'offline' : 'server', detail: error.message };
    return data || { ok: false, reason: 'empty' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export const RANK = { owner: 4, admin: 3, moderator: 2, member: 1 };
export const rankOf = (r) => RANK[r] || 0;

export const squadPeople = (squadId) => act('squad_people', { p_squad: squadId });
export const squadSetRole = (squadId, userId, role) => act('squad_set_role', { p_squad: squadId, p_user: userId, p_role: role });
export const squadRemove = (squadId, userId) => act('squad_remove', { p_squad: squadId, p_user: userId });
export const squadInvite = (squadId, userId) => act('squad_invite', { p_squad: squadId, p_user: userId });
export const squadDeleteMessage = (messageId) => act('squad_delete_message', { p_message: messageId });
export const squadRename = (squadId, name) => act('squad_rename', { p_squad: squadId, p_name: name });
export const squadSetPhoto = (squadId, url) => act('squad_set_photo', { p_squad: squadId, p_url: url || null });
export const squadMakeLink = (squadId, days) => act('squad_make_link', { p_squad: squadId, p_days: days || 7 });
export const squadRevokeLinks = (squadId) => act('squad_revoke_links', { p_squad: squadId });
export const squadLinkInfo = (token) => act('squad_link_info', { p_token: token });
export const squadJoinLink = (token) => act('squad_join_link', { p_token: token });

/* the link itself: opens Moments, and also counts as your invite for
   whoever makes an account through it (src/lib/invite.js) */
export const chatLinkUrl = (token, myId) => appLink({ chat: token, invite: myId || null });

/* ── CIRCLES · a group tied to a place, public ones listed nearby ── */
export const createCircle = ({ name, about, lat, lng, place, isPublic }) =>
  act('create_circle', { p_name: name, p_about: about || null, p_lat: lat, p_lng: lng, p_place: place || null, p_public: isPublic !== false });
export const joinCircle = (squadId) => act('join_circle', { p_squad: squadId });
export const squadSetAbout = (squadId, about, pinned) => act('squad_set_about', { p_squad: squadId, p_about: about, p_pinned: pinned });
export async function circlesNear(lat, lng) {
  if (lat == null || lng == null) return [];
  const r = await act('circles_near', { p_lat: lat, p_lng: lng });
  return Array.isArray(r) ? r : [];
}
/* where you last really were (LeafletMap keeps it), for "near you" */
export function lastFix() {
  try { const v = JSON.parse(localStorage.getItem('moments.lastFix') || 'null'); return v && Number.isFinite(v.lat) ? v : null; } catch (e) { return null; }
}

/* ── CIRCLES BY TOPIC · friends, self-development, languages ── */
export async function topicCircles(topic, at) {
  const r = await act('topic_circles', { p_topic: topic, p_lat: at ? at.lat : null, p_lng: at ? at.lng : null });
  return Array.isArray(r) ? r : [];
}
export const createTopicCircle = (topic, name, about, at) =>
  act('create_topic_circle', { p_topic: topic, p_name: name, p_about: about || null, p_lat: at ? at.lat : null, p_lng: at ? at.lng : null });
