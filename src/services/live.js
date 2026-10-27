import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ── LIVE ACTIVITIES · BUDDIES · DAILY MOMENT · LOUNGES ──
   (RUN_ME.sql, "LIVE ACTIVITIES · EARNED CONNECTIONS · PLUS FOR
   NETWORKING"). Every rule — who is at the table, whose turn it is,
   when Connect is open, who may write to whom, who may enter a lounge —
   is the database's. These only ask, and a "plus" answer opens the
   paywall the same way everywhere. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args || {}); return error ? null : data; } catch (e) { return null; }
};
export const needPlus = (r, why) => {
  if (r && r.ok === false && r.reason === 'plus') {
    try { window.dispatchEvent(new CustomEvent('mm-need-plus', { detail: why || 'join' })); } catch (e) {}
    return true;
  }
  return false;
};

// at the table
export const eventExtras = (kind, id) => rpc('event_extras', { p_kind: kind, p_id: id });
export const eventCheckin = (kind, id) => rpc('event_checkin', { p_kind: kind, p_id: id });
export const activityGet = (kind, id) => rpc('activity_get', { p_kind: kind, p_id: id });
export const activityDeal = (kind, id, cat) => rpc('activity_deal', { p_kind: kind, p_id: id, p_cat: cat });
export const activitySpin = (kind, id) => rpc('activity_spin', { p_kind: kind, p_id: id });
export const activityPair = (kind, id) => rpc('activity_pair', { p_kind: kind, p_id: id });
export const activityTruth = (kind, id) => rpc('activity_truth', { p_kind: kind, p_id: id });
export const activityPoll = (kind, id) => rpc('activity_poll', { p_kind: kind, p_id: id });
export const truthsSubmit = (kind, id, s, lie) => rpc('truths_submit', { p_kind: kind, p_id: id, p_s1: s[0], p_s2: s[1], p_s3: s[2], p_lie: lie });
export const truthCard = (truthId) => rpc('truth_card', { p_truth: truthId });
export const truthVote = (truthId, pick) => rpc('truth_vote', { p_truth: truthId, p_pick: pick });
export const pollResult = (kind, id, poll) => rpc('poll_result', { p_kind: kind, p_id: id, p_poll: poll });
export const pollVote = (kind, id, poll, target) => rpc('poll_vote', { p_kind: kind, p_id: id, p_poll: poll, p_target: target });

// after
export const keepInTouch = (kind, id) => rpc('keep_in_touch', { p_kind: kind, p_id: id });
export const buddyTap = (kind, id, to, on) => rpc('buddy_tap', { p_kind: kind, p_id: id, p_to: to, p_on: on });
export const vibeGive = (kind, id, to, badge, on) => rpc('vibe_give', { p_kind: kind, p_id: id, p_to: to, p_badge: badge, p_on: on });
export const passport = (userId) => rpc('passport', { p_user: userId || null });

// buddies and the few private messages there are
export const myBuddies = () => rpc('my_buddies');
export const buddyRemove = (other) => rpc('buddy_remove', { p_other: other });
export const buddyThread = (other) => rpc('buddy_thread', { p_other: other });
export const buddyPing = (to, kind, id) => rpc('buddy_ping', { p_to: to, p_kind: kind, p_id: id });
export const myNextEvents = () => rpc('my_next_events');
export const dmState = (thread) => rpc('dm_state', { p_thread: thread });
export const dmOpen = async ({ to, answerId, card, body }) => {
  const r = await rpc('dm_open', { p_to: to, p_answer: answerId || null, p_card: card == null ? null : card, p_body: body });
  needPlus(r, 'chat');
  return r;
};

// every day
export const dailyMoment = () => rpc('daily_moment');
export const dailyAnswer = (choice, body) => rpc('daily_moment_answer', { p_choice: choice == null ? null : choice, p_body: body || null });
export const dailyReact = (answerId, emoji) => rpc('daily_moment_react', { p_answer: answerId, p_emoji: emoji || null });

// the lounges
export const loungesList = () => rpc('lounges_list');
export const loungeJoin = async (id) => { const r = await rpc('lounge_join', { p_id: id }); needPlus(r, 'lounge'); return r; };
export const loungeLeave = (id) => rpc('lounge_leave', { p_id: id });
export const loungeRoom = (id) => rpc('lounge_room', { p_id: id });
export const loungeSay = (id, body) => rpc('lounge_say', { p_id: id, p_body: body });
export const myConversations = () => rpc('my_conversations');
