import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, FlatList, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native';
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

/* The activity inbox — every star, laugh, comment and mate event on
   YOUR stuff, written by DB triggers so nothing is ever fabricated.
   Every row is TAPPABLE: it opens the exact thing it's about — the
   moment that got starred/laughed/commented, or the person for a mate
   event. */

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

export const NotificationsSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [loadErr, setLoadErr] = useState(null);

  // tap targets
  const [profileUser, setProfileUser] = useState(null); // actor's profile
  const [viewPost, setViewPost] = useState(null);        // a moment → PostCard
  const [reelView, setReelView] = useState(null);        // a reel → viewer
  const [commentsPost, setCommentsPost] = useState(null);
  const [opening, setOpening] = useState(null);          // notif id being opened

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

  const openNotif = async (n) => {
    // mate / call events → open the person who did it
    if (n.kind === 'mate_request' || n.kind === 'mate_accept' || n.kind === 'call') {
      tapSelection();
      setProfileUser({
        id: n.actor_id,
        name: (n.actor && n.actor.name) || 'Someone',
        avatar: (n.actor && n.actor.avatar_url) || AV_NEUTRAL,
        countryFlag: (n.actor && n.actor.country_flag) || null,
      });
      return;
    }
    // star / laugh / comment → open the moment it happened on
    if (n.post_id) {
      tapSelection();
      setOpening(n.id);
      try {
        const p = await fetchPost(n.post_id);
        const card = postToCard(p);
        if (p.type === 'reel' && p.media_url) setReelView({ reels: [card], index: 0 });
        else { setViewPost(card); if (n.kind === 'comment') setTimeout(() => setCommentsPost(card), 350); }
      } catch (e) {
        // the post may have been deleted — open the actor instead
        setProfileUser({ id: n.actor_id, name: (n.actor && n.actor.name) || 'Someone', avatar: (n.actor && n.actor.avatar_url) || AV_NEUTRAL, countryFlag: (n.actor && n.actor.country_flag) || null });
      } finally { setOpening(null); }
      return;
    }
    // no target → open the actor
    setProfileUser({ id: n.actor_id, name: (n.actor && n.actor.name) || 'Someone', avatar: (n.actor && n.actor.avatar_url) || AV_NEUTRAL, countryFlag: (n.actor && n.actor.country_flag) || null });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '75%', paddingBottom: insets.bottom + 12,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Micro>Activity 🔔</Micro>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

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
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item: n }) => (
              <View style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
                borderBottomWidth: 1, borderBottomColor: C.line,
                opacity: n.read ? 0.75 : 1,
              }}>
                {/* the whole left area is the tap target → opens the thing */}
                <Pressable onPress={() => openNotif(n)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View>
                    <Image source={{ uri: (n.actor && n.actor.avatar_url) || AV_NEUTRAL }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                    {!n.read ? <View style={{ position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, backgroundColor: C.purple, borderWidth: 2, borderColor: C.bg2 }} /> : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 11 }}>
                    <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>
                      <Text style={{ fontWeight: '900' }}>{(n.actor && n.actor.name) || 'Someone'}</Text>
                      {n.actor && n.actor.country_flag ? ' ' + n.actor.country_flag : ''}{' '}
                      <Text style={{ color: C.dim }}>{LINE[n.kind] || n.kind}</Text>
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

                <Text style={{ color: C.faint, fontSize: 11, marginLeft: 8 }}>{timeAgo(n.created_at)}</Text>
                {n.kind === 'mate_request' ? (
                  accepted[n.id] ? (
                    <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginLeft: 8 }}>
                      <Text style={{ color: C.green, fontSize: 11, fontWeight: '900' }}>Mates ✓</Text>
                    </View>
                  ) : (
                    <Pressable onPress={(e) => { if (e && e.stopPropagation) e.stopPropagation(); accept(n); }} style={{ marginLeft: 8 }}>
                      <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 }}>
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>Accept</Text>
                      </View>
                    </Pressable>
                  )
                ) : null}
              </View>
            )}
          />
        )}
      </View>

      {/* tap targets — open right on top of the sheet */}
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
