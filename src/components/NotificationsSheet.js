import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchMyNotifications, markAllRead } from '../services/notifications';
import { fetchPost } from '../services/posts';
import { acceptFromActor } from '../services/mates';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';
import { Micro } from './Micro';
import { PostCard } from './PostCard';
import { ReelsViewer } from './ReelsViewer';
import { ProfileModal } from './ProfileModal';
import { CommentsSheet } from './CommentsSheet';

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

const LINE = {
  vibe: '⭐ starred your moment',
  laugh: '😂 laughed at your moment',
  comment: '💬 commented',
  mate_request: '🤝 wants to be your mate',
  mate_accept: '🎉 accepted — you\'re mates now!',
  call: '📞 called you — call them back',
};

const FILTERS = [
  { k: 'all', label: 'All', kinds: null },
  { k: 'reactions', label: 'Reactions', kinds: ['vibe', 'laugh'] },
  { k: 'comments', label: 'Comments', kinds: ['comment'] },
  { k: 'mates', label: 'Mates', kinds: ['mate_request', 'mate_accept'] },
];

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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [loadErr, setLoadErr] = useState(null);
  const [filter, setFilter] = useState('all');

  // tap targets
  const [profileUser, setProfileUser] = useState(null);
  const [viewPost, setViewPost] = useState(null);
  const [reelView, setReelView] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [opening, setOpening] = useState(null);

  const load = useCallback(async () => {
    if (!SUPABASE_READY || !user) { setItems([]); return; }
    try {
      const rows = await fetchMyNotifications(user.id);
      setItems(rows);
      markAllRead(user.id).catch(() => {});
    } catch (e) {
      setItems([]);
      setLoadErr(/does not exist|schema cache/i.test(e.message || '')
        ? 'One step left: run supabase/RUN_ME.sql to turn on notifications.'
        : (e.message || 'Could not load activity'));
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
    place: p.place || 'Somewhere out there',
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
    if (n.kind === 'mate_request' || n.kind === 'mate_accept' || n.kind === 'call') {
      tapSelection(); setProfileUser(actorProfile(n)); return;
    }
    if (n.post_id) {
      tapSelection();
      setOpening(n.id);
      try {
        const p = await fetchPost(n.post_id);
        const card = postToCard(p);
        if (p.type === 'reel' && p.media_url) setReelView({ reels: [card], index: 0 });
        else { setViewPost(card); if (n.kind === 'comment') setTimeout(() => setCommentsPost(card), 350); }
      } catch (e) {
        setProfileUser(actorProfile(n));
      } finally { setOpening(null); }
      return;
    }
    setProfileUser(actorProfile(n));
  };

  // filter → group into time sections (Instagram layout)
  const activeKinds = (FILTERS.find((f) => f.k === filter) || {}).kinds;
  const filtered = (items || []).filter((n) => !activeKinds || activeKinds.includes(n.kind));
  const byBucket = {};
  filtered.forEach((n) => { const b = bucketOf(n.created_at); (byBucket[b] = byBucket[b] || []).push(n); });
  const sections = BUCKET_ORDER.filter((t) => byBucket[t]).map((t) => ({ title: t, data: byBucket[t] }));

  const Thumb = ({ n }) => {
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
  };

  const Row = ({ n }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, opacity: n.read ? 0.78 : 1 }}>
      <Pressable onPress={() => openNotif(n)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View>
          <Image source={{ uri: (n.actor && n.actor.avatar_url) || AV_NEUTRAL }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          {!n.read ? <View style={{ position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, backgroundColor: C.purple, borderWidth: 2, borderColor: C.bg2 }} /> : null}
        </View>
        <View style={{ flex: 1, marginLeft: 11 }}>
          <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>
            <Text style={{ fontWeight: '900' }}>{(n.actor && n.actor.name) || 'Someone'}</Text>
            {n.actor && n.actor.country_flag ? ' ' + n.actor.country_flag : ''}{' '}
            <Text style={{ color: C.dim }}>{LINE[n.kind] || n.kind}</Text>
            {'  '}<Text style={{ color: C.faint, fontSize: 11.5 }}>{timeAgo(n.created_at)}</Text>
          </Text>
          {n.kind === 'comment' && n.body ? (
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>“{n.body}”</Text>
          ) : null}
          {n.post && n.post.caption ? (
            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>on: {n.post.caption}</Text>
          ) : null}
        </View>
        {opening === n.id ? <ActivityIndicator size="small" color={C.purple} style={{ marginLeft: 6 }} /> : null}
      </Pressable>

      {n.kind === 'mate_request' ? (
        accepted[n.id] ? (
          <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginLeft: 10 }}>
            <Text style={{ color: C.green, fontSize: 11.5, fontWeight: '900' }}>Mates ✓</Text>
          </View>
        ) : (
          <Pressable onPress={(e) => { if (e && e.stopPropagation) e.stopPropagation(); accept(n); }} style={{ marginLeft: 10 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 8 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>Accept</Text>
            </View>
          </Pressable>
        )
      ) : (
        <Thumb n={n} />
      )}
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '80%', paddingBottom: insets.bottom + 12,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Micro>Activity 🔔</Micro>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        {/* filter chips — Instagram style */}
        {items && items.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }}>
            {FILTERS.map((f) => {
              const on = filter === f.k;
              return (
                <Pressable key={f.k} onPress={() => { tapLight(); setFilter(f.k); }} style={{ marginRight: 8 }}>
                  <View style={{ backgroundColor: on ? C.purple : C.glassHi, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 }}>
                    <Text style={{ color: on ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800' }}>{f.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {items === null ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Loading…</Text>
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
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Nothing here in this filter</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
            {sections.map((s) => (
              <View key={s.title}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 14, marginBottom: 2 }}>{s.title}</Text>
                {s.data.map((n) => <Row key={n.id} n={n} />)}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* tap targets */}
      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}

      {viewPost ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setViewPost(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Pressable onPress={() => setViewPost(null)} hitSlop={10} style={{ position: 'absolute', top: insets.top + 12, left: 14, zIndex: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
            <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 14, paddingBottom: 40 }}>
              <PostCard
                post={viewPost}
                onComment={() => setCommentsPost(viewPost)}
                onOpenProfile={() => {}}
                onOpenReel={() => {}}
                onVibe={() => {}}
                onLaugh={() => {}}
                onRemoveLaugh={() => {}}
                onRepost={() => {}}
                onShare={() => {}}
                onJoin={() => {}}
                onOpenLikers={() => {}}
                onOpenLaughers={() => {}}
              />
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      {reelView ? (
        <ReelsViewer
          reels={reelView.reels}
          startIndex={reelView.index}
          vibes={{}}
          onVibe={() => {}}
          onComment={(item) => setCommentsPost(item)}
          onClose={() => setReelView(null)}
        />
      ) : null}

      {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}
    </Modal>
  );
};
