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
export const squadMakeLink = (squadId, days) => act('squad_make_link', { p_squad: squadId, p_days: days || 7 });
export const squadRevokeLinks = (squadId) => act('squad_revoke_links', { p_squad: squadId });
export const squadLinkInfo = (token) => act('squad_link_info', { p_token: token });
export const squadJoinLink = (token) => act('squad_join_link', { p_token: token });

/* the link itself: opens Moments, and also counts as your invite for
   whoever makes an account through it (src/lib/invite.js) */
export const chatLinkUrl = (token, myId) => appLink({ chat: token, invite: myId || null });
