import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchMyNotifications, markAllRead, clearMyNotifications, pruneOldNotifications } from '../services/notifications';
import { fetchPost } from '../services/posts';
import { acceptFromActor } from '../services/mates';
import { toggleVibe, toggleLaugh, toggleRepost, fetchEngagement } from '../services/social';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess, sfxStar, sfxLaugh } from '../utils/sfx';
import { sharePost } from '../utils/share';
import { PostCard } from './PostCard';
import { useStable } from '../hooks/useStable';
import { setupNotice } from '../lib/plumbing';

/* Fetched when it is opened, not when the app starts. */
import { lazyOverlay } from '../lib/lazyScreen';
import { readMatch } from '../lib/bardi';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { PushRow } from './PushRow';
import { goToTab } from '../lib/mapBus';
import { groupNotifs, namesLine } from '../lib/notifGroups';
const GoNowSheet = lazyOverlay(() => import('./GoNowSheet').then((m) => ({ default: m.GoNowSheet })));
const CommentsSheet = lazyOverlay(() => import('./CommentsSheet').then((m) => ({ default: m.CommentsSheet })));
const ReelsViewer = lazyOverlay(() => import('./ReelsViewer').then((m) => ({ default: m.ReelsViewer })));
const LikersSheet = lazyOverlay(() => import('./LikersSheet').then((m) => ({ default: m.LikersSheet })));
const ProfileModal = lazyOverlay(() => import('./ProfileModal').then((m) => ({ default: m.ProfileModal })));
const KitchenSheet = lazyOverlay(() => import('./KitchenSheet').then((m) => ({ default: m.KitchenSheet })));
const GreenSheet = lazyOverlay(() => import('./green/GreenSheet').then((m) => ({ default: m.GreenSheet })));

/* The activity inbox — every star, laugh, comment and mate event on YOUR
   stuff, written by DB triggers so nothing is ever fabricated. Laid out
   like Instagram: filter chips up top, split into time sections (Today /
   Yesterday / This week / …), a post thumbnail on the right, and every
   row taps through to the exact thing it's about. */

const timeAgo = (ts) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(ts)) / 60000));
  if (m < 60) return m + 'm';
  if (m < 48 * 60) return Math.round(m / 60) + 'h';
  return Math.round(m / (60 * 24)) + 'd';
};


const FILTERS = [
  { k: 'all', label: 'nt_f_all', kinds: null },
  { k: 'people', label: 'nt_f_people', kinds: ['mate_request', 'mate_accept', 'message', 'call'] },
  { k: 'moments', label: 'nt_f_moments', kinds: ['vibe', 'laugh', 'repost', 'tag', 'comment'] },
];

/* the verb, in the reader's language, with no emoji: one per kind, and
   a plural for the kinds that merge several people into one line */
const verbOf = (t, kind, many) => {
  const k = 'nt_v_' + kind + (many ? '_many' : '');
  const v = t(k);
  return v && v !== k ? v : t('nt_v_' + kind);
};

const isVideo = (u) => typeof u === 'string' && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);

/* Which Instagram-style time section a notification falls into. */
function bucketOf(ts) {
  const d = new Date(ts).getTime();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d >= startToday) return 'Today';
  if (d >= startToday - 86400000) return 'Yesterday';
  if (d >= startToday - 7 * 86400000) return 'This week';
  if (d >= startToday - 30 * 86400000) return 'This month';
  return 'Earlier';
}
const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];

export const NotificationsSheet = ({ onClose }) => {
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [loadErr, setLoadErr] = useState(null);
  const [filter, setFilter] = useState('all');

  // tap targets
  const [profileUser, setProfileUser] = useState(null);
  const [greenOpen, setGreenOpen] = useState(false);   // a green invite, tapped
  const [goNowFrom, setGoNowFrom] = useState(null);    // Bardi's "make it a hangout"
  const [foodTab, setFoodTab] = useState(null);       // a food notification, tapped
  const [viewPost, setViewPost] = useState(null);
  const [reelView, setReelView] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [opening, setOpening] = useState(null);
  const [likersPost, setLikersPost] = useState(null);
  const [likersKind, setLikersKind] = useState('star');
  const [toast, setToast] = useState(null);

  /* Reactions on the opened moment are REAL — the same writes the feed
     makes, so a star here shows up everywhere and survives a refresh. */
  const [clearing, setClearing] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [vibed, setVibed] = useState(false);
  const [laughed, setLaughed] = useState(false);
  const [reposted, setReposted] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const load = useCallback(async () => {
    if (!SUPABASE_READY || !user) { setItems([]); return; }
    try {
      const rows = await fetchMyNotifications(user.id);
      setItems(rows);
      markAllRead(user.id).catch(() => {});
      // housekeeping, once per open: a week-old notification is storage,
      // not news
      pruneOldNotifications(user.id);
    } catch (e) {
      setItems([]);
      setLoadErr(/does not exist|schema cache/i.test(e.message || '')
        ? setupNotice('One step left: run supabase/RUN_ME.sql to turn on notifications.')
        : 'Could not load activity');
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const accept = async (n) => {
    tapSuccess(); sfxSuccess();
    setAccepted((a) => ({ ...a, [n.id]: true }));
    try { await acceptFromActor(n.actor_id, user.id); } catch (e) {}
  };

  const postToCard = (p) => ({
    id: p.id,
    userId: p.user_id,
    user: {
      id: p.user_id,
      name: (p.user && p.user.name) || (user && user.user_metadata && user.user_metadata.name) || 'You',
      avatar: (p.user && p.user.avatar_url) || AV_NEUTRAL,
      verified: !!(p.user && p.user.verified),
      flag: (p.user && p.user.country_flag) || null,
    },
    type: p.type || 'post',
    media: p.media_url || null,
    textBg: p.text_bg || null,
    caption: p.caption || '',
    place: p.place || null,
    startsIn: '',
    vibes: p.vibes || 0,
    comments: p.comments || 0,
    laughs: 0, reposts: 0,
    sound: p.sound_title ? { title: p.sound_title, artist: p.sound_artist || '', emoji: '🎵', audio_url: p.sound_url || null } : null,
  });

  const actorProfile = (n) => ({
    id: n.actor_id,
    name: (n.actor && n.actor.name) || 'Someone',
    avatar: (n.actor && n.actor.avatar_url) || AV_NEUTRAL,
    countryFlag: (n.actor && n.actor.country_flag) || null,
  });

  const openNotif = async (n) => {
    /* an invitation opens the week it is in, where Join is one tap */
    if (n.kind === 'green_invite') { tapSelection(); setGreenOpen(true); return; }
    if (n.kind === 'plan_soon') { tapSelection(); onClose(); goToTab('TOGETHER'); return; }
    if (n.kind === 'message') { tapSelection(); onClose(); goToTab('CHATS'); return; }
    if (n.kind === 'bardi_match') { const m = readMatch(n.body); if (m) { tapSelection(); setGoNowFrom(m); } return; }
    if (n.kind === 'food_order') { tapSelection(); setFoodTab('kitchen'); return; }
    if (n.kind === 'food_status') { tapSelection(); setFoodTab('orders'); return; }
    if (n.kind === 'mate_request' || n.kind === 'mate_accept' || n.kind === 'call') {
      tapSelection(); setProfileUser(actorProfile(n)); return;
    }
    if (n.post_id) {
      tapSelection();
      setOpening(n.id);
      try {
        const p = await fetchPost(n.post_id);
        const card = postToCard(p);
        // carry YOUR existing reactions in, so the moment opens showing
        // the truth (already starred stays starred) instead of a blank slate
        if (SUPABASE_READY && user) {
          try {
            const e = await fetchEngagement(user.id);
            setVibed(!!e.myVibes[card.id]);
            setLaughed(!!e.myLaughs[card.id]);
            setReposted(!!e.myReposts[card.id]);
          } catch (err) { setVibed(false); setLaughed(false); setReposted(false); }
        }
        if (p.type === 'reel' && p.media_url) setReelView({ reels: [card], index: 0 });
        else { setViewPost(card); if (n.kind === 'comment') setTimeout(() => setCommentsPost(card), 350); }
      } catch (e) {
        setProfileUser(actorProfile(n));
      } finally { setOpening(null); }
      return;
    }
    setProfileUser(actorProfile(n));
  };

  /* ── real reactions on the opened moment ── */
  const doVibe = () => {
    const next = !vibed;
    setVibed(next);
    if (next) sfxStar();
    if (SUPABASE_READY && user && viewPost) toggleVibe(viewPost.id, user.id, next).catch(() => {});
  };
  const doLaugh = () => {
    setLaughed(true); sfxLaugh();
    if (SUPABASE_READY && user && viewPost) toggleLaugh(viewPost.id, user.id, true).catch(() => {});
  };
  const doRemoveLaugh = () => {
    setLaughed(false);
    if (SUPABASE_READY && user && viewPost) toggleLaugh(viewPost.id, user.id, false).catch(() => {});
  };
  const doRepost = () => {
    const next = !reposted;
    setReposted(next); tapLight();
    if (SUPABASE_READY && user && viewPost) toggleRepost(viewPost.id, user.id, next).catch(() => {});
  };
  const doShare = async (p) => {
    const res = await sharePost(p || viewPost);
    if (res === 'copied') showToast('Link copied — send it anywhere 🔗');
    else if (res && res.url) showToast(res.url);
  };

  // filter → group into time sections (Instagram layout)
  const activeKinds = (FILTERS.find((f) => f.k === filter) || {}).kinds;
  const filtered = (items || []).filter((n) => !activeKinds || activeKinds.includes(n.kind));
  const byBucket = {};
  filtered.forEach((n) => { const b = bucketOf(n.created_at); (byBucket[b] = byBucket[b] || []).push(n); });
  // one line per thing that happened, inside each section (lib/notifGroups.js)
  const sections = BUCKET_ORDER.filter((b) => byBucket[b]).map((b) => ({ title: b, data: groupNotifs(byBucket[b]) }));
  const words = { someone: t('nt_someone'), and: t('nt_and'), others: t('nt_and_others') };

  const Thumb = useStable(({ n }) => {
    const url = n.post && n.post.media_url;
    if (!url) return null;
    return (
      <Pressable onPress={() => openNotif(n)} style={{ marginLeft: 10 }}>
        {isVideo(url) ? (
          <View style={{ width: 44, height: 44, borderRadius: 7, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={16} color={C.dim} />
          </View>
        ) : (
          <Image source={{ uri: url }} style={{ width: 44, height: 44, borderRadius: 7 }} />
        )}
      </Pressable>
    );
  });

  const Row = useStable(({ n, g }) => n.kind === 'xp_award' ? (
    /* points for showing up — the score, and what it was for */
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', opacity: n.read ? 0.78 : 1 }}>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', width: 64 }}>{'+' + (parseInt(String(n.body || '').split('|')[0], 10) || 0)}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{t('xp_award_line')}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>{String(n.body || '').split('|').slice(1).join('|') + ' · ' + timeAgo(n.created_at)}</Text>
      </View>
    </View>
  ) : n.kind === 'plan_soon' ? (
    /* your plan, an hour before: a reminder, not a person */
    <Pressable onPress={() => openNotif(n)} accessibilityRole="button" style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, opacity: n.read ? 0.78 : 1 }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{timeAgo(n.created_at)}</Text>
      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', lineHeight: 20, marginTop: 4 }}>
        {'⏰ ' + t('push_plan_soon').replace('{title}', String(n.body || '').split('|').slice(1).join('|'))}
      </Text>
    </Pressable>
  ) : n.kind === 'bardi_match' ? (() => {
    /* Bardi: no face, no name in bold — one quiet line and one button */
    const m = readMatch(n.body);
    if (!m) return null;
    return (
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, opacity: n.read ? 0.78 : 1 }}>
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>BARDI · {timeAgo(n.created_at)}</Text>
        <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 20, marginTop: 4 }}>
          {m.focus
            ? t(m.venue ? 'bardi_focus_at' : 'bardi_focus').replace('{n}', String(m.count)).replace('{what}', t('bd_kind_' + m.what).toLowerCase()).replace('{venue}', m.venue || '')
            : t('bardi_match').replace('{n}', String(m.count)).replace('{what}', m.what)}
        </Text>
        <Pressable onPress={() => openNotif(n)} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{t('bardi_make_hangout')} ›</Text>
        </Pressable>
      </View>
    );
  })() : (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Pressable onPress={() => openNotif(n)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 46, height: 46 }}>
          {(g && g.actors.length > 1) ? (
            <>
              <Image source={{ uri: g.actors[1].avatar_url || AV_NEUTRAL }} style={{ position: 'absolute', top: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: C.glassHi }} />
              <Image source={{ uri: g.actors[0].avatar_url || AV_NEUTRAL }} style={{ position: 'absolute', bottom: 0, left: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.bg2, backgroundColor: C.glassHi }} />
            </>
          ) : (
            <Image source={{ uri: (n.actor && n.actor.avatar_url) || AV_NEUTRAL }} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.glassHi }} />
          )}
          {!(g ? g.read : n.read) ? <View style={{ position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: C.purple, borderWidth: 2, borderColor: C.bg2 }} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 20 }} numberOfLines={3}>
            <Text style={{ fontWeight: '800' }}>{g ? namesLine(g.actors, words) : (n.kind === 'safety' && n.body !== 'report' && n.body !== 'coach') ? 'Moments' : ((n.actor && n.actor.name) || words.someone)}</Text>
            {' '}<Text style={{ color: C.dim }}>{verbOf(t, n.kind, g && g.actors.length > 1)}</Text>
            {'  '}<Text style={{ color: C.faint, fontSize: 12 }}>{timeAgo(n.created_at)}</Text>
          </Text>
          {(n.kind === 'green_invite' || n.kind === 'food_order' || n.kind === 'food_status' || n.kind === 'venue_decision') && n.body ? (
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>{n.body === 'host_ok' || n.body === 'host_no' ? t('notif_' + n.body) : n.body}</Text>
          ) : null}
          {n.kind === 'safety' && n.body ? (
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginTop: 2 }} numberOfLines={3}>{t('notif_safety_' + n.body)}</Text>
          ) : null}
          {n.kind === 'comment' && n.body ? (
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>“{n.body}”</Text>
          ) : null}
        </View>
        {opening === n.id ? <ActivityIndicator size="small" color={C.purple} style={{ marginLeft: 6 }} /> : null}
      </Pressable>

      {n.kind === 'mate_request' ? (
        accepted[n.id] ? (
          <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '800', marginLeft: 10 }}>{t('nt_mates')}</Text>
        ) : (
          <Pressable onPress={(e) => { if (e && e.stopPropagation) e.stopPropagation(); accept(n); }} style={{ marginLeft: 10 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800' }}>{t('accept')}</Text>
            </View>
          </Pressable>
        )
      ) : (
        <Thumb n={n} />
      )}
    </View>
  ));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '80%', paddingBottom: insets.bottom + 12,
      }}>
        {/* the bar is the panel's own child, so dragging it moves the whole
            sheet (SheetHandle moves its parent) — inside a wrapper it
            dragged only itself and the sheet looked stuck */}
        <SheetHandle onClose={onClose} />
        <View style={{ paddingHorizontal: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{t('notifications')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Clear asks twice: it sat next to the close button, and one
                slip wiped everything */}
            {items && items.length ? (
              <Pressable
                onPress={async () => {
                  if (clearing) return;
                  if (!clearArmed) { tapLight(); setClearArmed(true); setTimeout(() => setClearArmed(false), 3000); return; }
                  tapLight();
                  setClearArmed(false);
                  setClearing(true);
                  const had = items.length;
                  setItems([]);                       // gone from the screen at once
                  try { await clearMyNotifications(user.id); showToast('Cleared ' + had); }
                  catch (e) { load(); showToast('Could not clear — try again'); }
                  finally { setClearing(false); }
                }}
                accessibilityRole="button"
                style={{ paddingHorizontal: 12, paddingVertical: 10, marginRight: 6 }}
              >
                <Text style={{ color: clearArmed ? C.coral : C.dim, fontSize: 13.5, fontWeight: '700' }}>{clearing ? '…' : clearArmed ? t('nt_clear_sure') : t('nt_clear')}</Text>
              </Pressable>
            ) : null}
            {/* a real target: 40 pt round, not an 18 pt glyph — on the web
                hitSlop does not widen anything, so the old ✕ was a dot */}
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
        </View>

        {/* on the phone too, with the app closed */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}><PushRow compact /></View>

        {/* filter chips — Instagram style */}
        {items && items.length ? (
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, minHeight: 46 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, alignItems: 'center' }}>
            {FILTERS.map((f) => {
              const on = filter === f.k;
              return (
                <Pressable key={f.k} onPress={() => { tapLight(); setFilter(f.k); }} style={{ marginRight: 8 }}>
                  <View style={{ backgroundColor: on ? C.text : C.glassHi, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 }}>
                    <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{t(f.label)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {items === null ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>{t('loading')}</Text>
        ) : items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 34 }}>🔔</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 10 }}>
              {loadErr ? 'Almost there' : 'No activity yet'}
            </Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              {loadErr || 'When people star, laugh at or comment on your moments — or mate up with you — it lands here instantly.'}
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>{t('nt_empty_filter')}</Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
            {sections.map((s) => (
              <View key={s.title}>
                <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 16, marginBottom: 2 }}>{t('nt_b_' + s.title.toLowerCase().replace(' ', '_')).toUpperCase()}</Text>
                {s.data.map((grp) => <Row key={grp.key} n={grp.n} g={grp} />)}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* tap targets */}
      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
      {greenOpen ? <GreenSheet onClose={() => setGreenOpen(false)} /> : null}
      {goNowFrom ? (
        <GoNowSheet initialKind={goNowFrom.kind}
          initialTitle={goNowFrom.focus ? t('bardi_session_title') + (goNowFrom.venue ? ' · ' + goNowFrom.venue : '') : goNowFrom.what}
          initialPlace={goNowFrom.venue || ''}
          onClose={() => setGoNowFrom(null)} />
      ) : null}
      {foodTab ? <KitchenSheet startTab={foodTab} onClose={() => setFoodTab(null)} /> : null}

      {viewPost ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setViewPost(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Pressable onPress={() => setViewPost(null)} hitSlop={10} style={{ position: 'absolute', top: insets.top + 12, left: 14, zIndex: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 14, paddingBottom: 40 }}>
              <PostCard
                post={viewPost}
                vibed={vibed}
                laughed={laughed}
                reposted={reposted}
                onComment={() => setCommentsPost(viewPost)}
                onOpenProfile={() => setProfileUser({
                  id: viewPost.userId,
                  name: viewPost.user.name,
                  avatar: viewPost.user.avatar,
                  countryFlag: viewPost.user.flag,
                })}
                onOpenReel={() => setReelView({ reels: [viewPost], index: 0 })}
                onVibe={doVibe}
                onLaugh={doLaugh}
                onRemoveLaugh={doRemoveLaugh}
                onRepost={doRepost}
                onShare={doShare}
                onJoin={() => {}}
                onOpenLikers={(p) => { setLikersKind('star'); setLikersPost(p || viewPost); }}
                onOpenLaughers={(p) => { setLikersKind('laugh'); setLikersPost(p || viewPost); }}
              />
            </ScrollView>

            {toast ? (
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' }}>
                <View style={{ backgroundColor: C.text, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}>
                  <Text style={{ color: C.bg, fontSize: 12.5, fontWeight: '800' }} numberOfLines={2}>{toast}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Modal>
      ) : null}

      {likersPost ? (
        <LikersSheet post={likersPost} kind={likersKind} onClose={() => setLikersPost(null)} />
      ) : null}

      {reelView ? (
        <ReelsViewer
          reels={reelView.reels}
          startIndex={reelView.index}
          vibes={reelView.reels[0] ? { [reelView.reels[0].id]: vibed } : {}}
          onVibe={(item) => {
            const id = (item && item.id) || (reelView.reels[0] && reelView.reels[0].id);
            if (!id) return;
            const next = !vibed;
            setVibed(next);
            if (next) sfxStar();
            if (SUPABASE_READY && user) toggleVibe(id, user.id, next).catch(() => {});
          }}
          onComment={(item) => setCommentsPost(item)}
          onClose={() => setReelView(null)}
          onDeleted={() => setReelView(null)}
        />
      ) : null}

      {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}
    </Modal>
  );
};
