import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { toggleVibe, toggleLaugh, toggleRepost, joinPost, fetchEngagement } from '../services/social';
import { getProfile } from '../services/profiles';
import { fetchMyPosts, deletePost } from '../services/posts';
import { fetchActiveStories } from '../services/stories';
import { recordSignal } from '../services/algorithm';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxStar, sfxSuccess } from '../utils/sfx';
import { useAuth } from '../context/AuthContext';
import { useFeed, toCard } from '../hooks/useFeed';
import { fetchPost } from '../services/posts';
import { Platform } from 'react-native';
import { countUnread, subscribeNotifications } from '../services/notifications';
import { sfxNotify } from '../utils/sfx';
import {
  Glass, StoriesBar, PostCard, MagicFlowModal, ProfileModal,
  CommentsSheet, ComposeModal, SearchModal, StoryViewer, ReelsViewer,
  CaptureModal, NotificationsSheet,
} from '../components';
import { Modal } from 'react-native';
import { ProfileScreen } from './ProfileScreen';

/* ───────────────────── TAB 1 · HOME — THE ACTION FEED ──────────────── */

const headerBtn = {
  width: 38, height: 38, borderRadius: 19,
  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
  alignItems: 'center', justifyContent: 'center',
};

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts, refreshing, refresh, prependPost, removePost, loadError } = useFeed();
  const [joined, setJoined] = useState({});
  const [vibes, setVibes] = useState({});
  const [laughs, setLaughs] = useState({});
  const [laughCounts, setLaughCounts] = useState({});
  const [reposts, setReposts] = useState({});
  const [repostCounts, setRepostCounts] = useState({});
  // snapshot of what was already YOURS at load time, so the base counts
  // from the DB (which include you) aren't double-counted in the UI
  const initialEng = useRef({ myVibes: {}, myLaughs: {}, myReposts: {}, myJoins: {} });

  /* Restore EVERY reaction after every refresh — nothing resets:
     stars, laughs, reposts and joins all come back exactly as left. */
  useEffect(() => {
    if (!SUPABASE_READY || !user || !posts.length) return;
    fetchEngagement(user.id).then((e) => {
      initialEng.current = e;
      setVibes((v) => ({ ...e.myVibes, ...v }));
      setLaughs((l) => ({ ...e.myLaughs, ...l }));
      setReposts((r) => ({ ...e.myReposts, ...r }));
      setJoined((j) => ({ ...e.myJoins, ...j }));
      setLaughCounts(e.laughCounts);
      setRepostCounts(e.repostCounts);
    }).catch(() => {});
  }, [user, posts.length]);

  const onLaugh = (post) => {
    setLaughs((l) => ({ ...l, [post.id]: true }));
    if (SUPABASE_READY && user) toggleLaugh(post.id, user.id, true).catch(() => {});
  };

  const onRepost = (post) => {
    const next = !reposts[post.id];
    setReposts((r) => ({ ...r, [post.id]: next }));
    if (SUPABASE_READY && user) toggleRepost(post.id, user.id, next).catch(() => {});
  };
  const [myStories, setMyStories] = useState([]);
  const [myProfile, setMyProfile] = useState(null); // the real profiles row for the signed-in user
  const [myMomentsCount, setMyMomentsCount] = useState(0);
  const [magicPost, setMagicPost] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [composing, setComposing] = useState(null); // null | 'post' | 'reel' | 'story'
  const [searching, setSearching] = useState(false);
  const [storyIndex, setStoryIndex] = useState(null);
  const [reelStart, setReelStart] = useState(null);
  const [myProfileOpen, setMyProfileOpen] = useState(false); // one profile everywhere
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sharedPost, setSharedPost] = useState(null); // opened from a ?post= link
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  /* Share a moment OUT — one link your friends open anywhere. */
  const onShare = async (post) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const url = window.location.origin + window.location.pathname + '?post=' + post.id;
    const payload = { title: 'Moments', text: (post.caption || 'Check this moment ✨').slice(0, 120), url };
    try {
      if (navigator.share) { await navigator.share(payload); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied — send it anywhere 🔗');
    } catch (e) {
      showToast(url); // last resort: show it so it can be copied manually
    }
  };

  /* Open a moment shared IN — ?post=<id> lands right on the post. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !SUPABASE_READY) return;
    const id = new URLSearchParams(window.location.search).get('post');
    if (!id) return;
    fetchPost(id)
      .then((row) => setSharedPost(toCard(row)))
      .catch(() => showToast('That moment is gone or private'));
    // clean the URL so refreshes go back to the normal feed
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  /* Real notifications: load the unread count, then listen live —
     a new star/comment/mate event lands with the Moments chime. */
  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    countUnread(user.id).then(setUnread).catch(() => {});
    const unsub = subscribeNotifications(user.id, () => {
      setUnread((n) => n + 1);
      sfxNotify();
    });
    return unsub;
  }, [user]);

  // Stories are REAL only — yours + live 24h stories from the database.
  // The rail stays empty (just the + button) until someone actually posts.
  const [realStories, setRealStories] = useState([]);
  const stories = useMemo(
    () => [...myStories, ...realStories],
    [myStories, realStories]
  );
  const reels = useMemo(() => posts.filter((p) => p.type === 'reel'), [posts]);

  // refresh your header avatar when you come back from the profile
  useEffect(() => {
    if (!myProfileOpen && SUPABASE_READY && user) getProfile(user.id).then(setMyProfile).catch(() => {});
  }, [myProfileOpen, user]);

  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    getProfile(user.id).then(setMyProfile).catch(() => {});
    fetchMyPosts(user.id).then((rows) => setMyMomentsCount((rows || []).length)).catch(() => {});
    fetchActiveStories().then((rows) => setRealStories((rows || []).map((r) => ({
      user: { id: r.user_id, name: (r.user && r.user.name) || 'Explorer', avatar: (r.user && r.user.avatar_url) || av(60) },
      media: r.media_url,
      caption: r.caption,
      sound: r.sound_title ? { title: r.sound_title, artist: r.sound_artist || '', emoji: '🎵' } : null,
    })))).catch(() => {});
  }, [user, posts.length, myStories.length]);

  const onVibe = (post) => {
    const next = !vibes[post.id];
    setVibes((v) => ({ ...v, [post.id]: next })); // instant feedback
    if (next) { tapLight(); sfxStar(); recordSignal('vibe', post); } // buzz + sparkle + the algorithm learns
    if (SUPABASE_READY && user) {
      toggleVibe(post.id, user.id, next).catch(() => {});
    }
  };

  const openComments = (post) => {
    recordSignal('comment', post);
    setCommentsPost(post);
  };

  const openReel = (post) => {
    recordSignal('watch', post);
    const idx = Math.max(0, reels.findIndex((r) => r.id === post.id));
    setReelStart(idx);
  };

  /* Delete one of YOUR moments — instant in the UI, real in the DB. */
  const onDelete = (post) => {
    tapLight();
    removePost(post.id);
    if (SUPABASE_READY && user) deletePost(post.id, user.id).catch(() => {});
  };

  /* You, shaped like a profile card — tap your avatar to see it.
     Real mode reads your actual profiles row; nothing here is fabricated. */
  const me = {
    id: user ? user.id : 'me',
    name: (myProfile && myProfile.name) || (user && user.user_metadata && user.user_metadata.name) || 'You',
    handle: (myProfile && myProfile.handle && '@' + myProfile.handle) || (user && user.email ? '@' + user.email.split('@')[0] : '@you'),
    emoji: (myProfile && myProfile.emoji) || '🧿',
    avatar: (myProfile && myProfile.avatar_url) || av(5),
    verified: !!(myProfile && myProfile.verified),
    vouches: 0,
    vouchTag: 'New Explorer',
    intent: (myProfile && myProfile.intent) || 'Exploring 🧭',
    moments: SUPABASE_READY ? myMomentsCount : posts.filter((p) => p.user.name === 'You').length,
    mates: 0,
    campfires: 0,
    bio: (myProfile && myProfile.bio) || 'This is you. Share a moment, join a vibe, meet your people. ✨',
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        refreshing={refreshing}
        onRefresh={refresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 130, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', letterSpacing: 5 }}>MOMENTS</Text>
                <Text style={{ color: C.faint, fontSize: 11, marginTop: 2, letterSpacing: 0.4 }}>
                  Don&apos;t scroll it. Live it.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable testID="btn-notifs" onPress={() => { tapLight(); setNotifOpen(true); setUnread(0); }} style={[headerBtn, { marginRight: 10 }]}>
                  <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={17} color={unread ? C.purple : C.text} />
                  {unread ? (
                    <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.bg }}>
                      <Text style={{ color: '#FFF', fontSize: 9.5, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable testID="btn-search" onPress={() => setSearching(true)} style={[headerBtn, { marginRight: 10 }]}>
                  <Ionicons name="search" size={17} color={C.text} />
                </Pressable>
                <Pressable testID="btn-compose" onPress={() => setComposing('post')} style={[headerBtn, { marginRight: 10, backgroundColor: C.greenSoft, borderColor: 'rgba(16,185,129,0.4)' }]}>
                  <Ionicons name="add" size={20} color={C.green} />
                </Pressable>
                <Pressable testID="btn-profile" onPress={() => { tapLight(); setMyProfileOpen(true); }}>
                  <Image source={{ uri: me.avatar }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: C.purple }} />
                </Pressable>
              </View>
            </View>

            <StoriesBar
              stories={stories}
              onOpenStory={setStoryIndex}
              onAddStory={() => setComposing('story')}
            />

            {/* share box — your moment or your opinion, one tap away */}
            <Glass style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 18 }}>
              <Image source={{ uri: me.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              <Pressable
                testID="share-box"
                onPress={() => setComposing('post')}
                style={{
                  flex: 1, marginLeft: 10,
                  backgroundColor: C.bg, borderWidth: 1, borderColor: C.line,
                  borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16,
                }}
              >
                <Text style={{ color: C.faint, fontSize: 13.5 }}>What&apos;s your moment? ✨</Text>
              </Pressable>
              <Pressable testID="btn-new-reel" onPress={() => setComposing('reel')} hitSlop={8} style={{ marginLeft: 12 }}>
                <Ionicons name="videocam" size={22} color={C.coral} />
              </Pressable>
              <Pressable onPress={() => setComposing('post')} hitSlop={8} style={{ marginLeft: 12 }}>
                <Ionicons name="image" size={22} color={C.green} />
              </Pressable>
            </Glass>
          </View>
        }
        renderItem={({ item }) => {
          // base counts exclude YOU — your live toggle adds the +1 back
          const baseVibes = Math.max(0, (item.vibes || 0) - (initialEng.current.myVibes[item.id] ? 1 : 0));
          const baseLaughs = Math.max(0, (laughCounts[item.id] || 0) - (initialEng.current.myLaughs[item.id] ? 1 : 0));
          const baseReposts = Math.max(0, (repostCounts[item.id] || 0) - (initialEng.current.myReposts[item.id] ? 1 : 0));
          return (
            <PostCard
              post={{ ...item, vibes: baseVibes, laughs: baseLaughs, reposts: baseReposts }}
              joined={!!joined[item.id]}
              vibed={!!vibes[item.id]}
              laughed={!!laughs[item.id]}
              reposted={!!reposts[item.id]}
              onRepost={() => onRepost(item)}
              onLaugh={() => onLaugh(item)}
              isMine={(user && item.userId === user.id) || item.user.name === 'You'}
              onDelete={onDelete}
              onShare={onShare}
              onJoin={setMagicPost}
              onVibe={() => onVibe(item)}
              onComment={() => openComments(item)}
              onOpenProfile={setProfileUser}
              onOpenReel={openReel}
            />
          );
        }}
        ListEmptyComponent={
          SUPABASE_READY ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
              <Text style={{ fontSize: 34 }}>{loadError ? '📡' : '✨'}</Text>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>
                {loadError ? "Couldn't load moments" : 'No moments yet — be the first 👋'}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                {loadError || 'Share a photo, a thought, or an invitation — real people will see it here.'}
              </Text>
            </View>
          ) : null
        }
      />

      {magicPost ? (
        <MagicFlowModal
          post={magicPost}
          onClose={() => setMagicPost(null)}
          onComplete={(id) => {
            setJoined((j) => ({ ...j, [id]: true }));
            // a real membership row — your join survives refresh
            if (SUPABASE_READY && user) joinPost(id, user.id).catch(() => {});
            tapSuccess();
            sfxSuccess();
            recordSignal('join', magicPost);
            setMagicPost(null);
          }}
        />
      ) : null}
      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
      {/* Your avatar opens the ONE real profile — same as the SPACE tab */}
      <Modal visible={myProfileOpen} animationType="slide" onRequestClose={() => setMyProfileOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <Pressable onPress={() => setMyProfileOpen(false)} hitSlop={10} style={{ position: 'absolute', top: insets.top + 12, left: 14, zIndex: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <ProfileScreen />
        </View>
      </Modal>
      {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}
      {notifOpen ? <NotificationsSheet onClose={() => setNotifOpen(false)} /> : null}

      {/* a moment opened from a shared link — the full card, ready to vibe */}
      {sharedPost ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSharedPost(null)}>
          <Pressable onPress={() => setSharedPost(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 }}>
            <Pressable onPress={() => {}}>
              <PostCard
                post={sharedPost}
                joined={!!joined[sharedPost.id]}
                vibed={!!vibes[sharedPost.id]}
                laughed={!!laughs[sharedPost.id]}
                reposted={!!reposts[sharedPost.id]}
                onRepost={() => onRepost(sharedPost)}
                onLaugh={() => onLaugh(sharedPost)}
                isMine={!!(user && sharedPost.userId === user.id)}
                onDelete={(p) => { onDelete(p); setSharedPost(null); }}
                onShare={onShare}
                onJoin={setMagicPost}
                onVibe={() => onVibe(sharedPost)}
                onComment={() => openComments(sharedPost)}
                onOpenProfile={(u) => { setSharedPost(null); setProfileUser(u); }}
                onOpenReel={() => {}}
              />
            </Pressable>
            <Pressable onPress={() => setSharedPost(null)} style={{ alignSelf: 'center', marginTop: 6 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>Back to your feed ↓</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* tiny toast — link copied etc. */}
      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 120, left: 30, right: 30, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(17,24,39,0.92)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}>
            <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>{toast}</Text>
          </View>
        </View>
      ) : null}
      {composing === 'post' ? (
        <ComposeModal
          initialMode="post"
          onClose={() => setComposing(null)}
          onPosted={prependPost}
          onPostedStory={(s) => setMyStories((prev) => [s, ...prev])}
        />
      ) : null}
      {composing === 'story' || composing === 'reel' ? (
        /* the one-tap camera: live viewfinder, tap=photo, hold=video,
           sounds picked right on the capture screen */
        <CaptureModal
          initialMode={composing}
          onClose={() => setComposing(null)}
          onPosted={prependPost}
          onPostedStory={(s) => setMyStories((prev) => [s, ...prev])}
        />
      ) : null}
      {searching ? (
        <SearchModal
          onClose={() => setSearching(false)}
          onOpenProfile={(u) => { setSearching(false); setProfileUser(u); }}
        />
      ) : null}
      {storyIndex !== null ? (
        <StoryViewer stories={stories} startIndex={storyIndex} onClose={() => setStoryIndex(null)} />
      ) : null}
      {reelStart !== null ? (
        <ReelsViewer
          reels={reels}
          startIndex={reelStart}
          vibes={vibes}
          onVibe={onVibe}
          onComment={(p) => { setReelStart(null); openComments(p); }}
          onClose={() => setReelStart(null)}
        />
      ) : null}
    </View>
  );
};
