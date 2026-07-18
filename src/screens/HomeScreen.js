import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { av, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { toggleVibe, toggleLaugh, toggleRepost, joinPost, fetchEngagement } from '../services/social';
import { getProfile } from '../services/profiles';
import { fetchMyPosts, deletePost, updatePost } from '../services/posts';
import { fetchActiveStories, fetchStoryById } from '../services/stories';
import { recordSignal } from '../services/algorithm';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxStar, sfxSuccess } from '../utils/sfx';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { useFeed, toCard } from '../hooks/useFeed';
import { fetchPost } from '../services/posts';
import { Platform } from 'react-native';
import { countUnread, subscribeNotifications } from '../services/notifications';
import { sfxNotify } from '../utils/sfx';
import {
  Glass, StoriesBar, PostCard, MagicFlowModal, ProfileModal,
  CommentsSheet, ComposeModal, SearchModal, StoryViewer, ReelsViewer,
  CaptureModal, NotificationsSheet, LikersSheet, ReportSheet,
} from '../components';
import { Modal } from 'react-native';
import { ProfileScreen } from './ProfileScreen';

/* ───────────────────── TAB 1 · HOME — THE ACTION FEED ──────────────── */

/* DB row → the shape StoryViewer/StoriesBar consume. Exported so a
   shared ?story= link renders identically to one from the rail. */
export const toStoryCard = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  user: {
    id: r.user_id,
    name: (r.user && r.user.name) || 'Explorer',
    avatar: (r.user && r.user.avatar_url) || AV_NEUTRAL,
    flag: (r.user && r.user.country_flag) || null,
  },
  media: r.media_url,
  caption: r.caption,
  sound: r.sound_title ? { title: r.sound_title, artist: r.sound_artist || '', emoji: '🎵', audio_url: r.sound_url || null } : null,
  stickerType: r.sticker_type || null,
  stickerData: r.sticker_data ? (() => { try { return JSON.parse(r.sticker_data); } catch (e) { return null; } })() : null,
});

const headerBtn = {
  width: 38, height: 38, borderRadius: 19,
  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
  alignItems: 'center', justifyContent: 'center',
};

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();
  const { posts, refreshing, refresh, prependPost, removePost, patchPost, loadError } = useFeed();
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
  // long-press to take your laugh back — the reaction actually disappears
  const onRemoveLaugh = (post) => {
    setLaughs((l) => { const n = { ...l }; delete n[post.id]; return n; });
    if (SUPABASE_READY && user) toggleLaugh(post.id, user.id, false).catch(() => {});
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
  const [sharedStory, setSharedStory] = useState(null); // opened from a ?story= link
  const [likersPost, setLikersPost] = useState(null); // "who reacted to this"
  const [likersKind, setLikersKind] = useState('star'); // 'star' | 'laugh'
  const openLikers = (post, kind) => { setLikersKind(kind); setLikersPost(post); };
  const [reportPost, setReportPost] = useState(null); // a moment being reported
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
      showToast(t('link_copied'));
    } catch (e) {
      showToast(url); // last resort: show it so it can be copied manually
    }
  };

  /* Open a moment or a story shared IN — ?post=<id> / ?story=<id>. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !SUPABASE_READY) return;
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    const storyId = params.get('story');
    if (postId) {
      fetchPost(postId)
        .then((row) => setSharedPost(toCard(row)))
        .catch(() => showToast(t('moment_gone')));
    }
    if (storyId) {
      fetchStoryById(storyId)
        .then((row) => setSharedStory(toStoryCard(row)))
        .catch(() => showToast(t('story_gone')));
    }
    if (postId || storyId) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  /* Share a story OUT — same link pattern as posts. */
  const onShareStory = async (story) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const url = window.location.origin + window.location.pathname + '?story=' + story.id;
    const payload = { title: 'Moments', text: (story.caption || 'Check this story ✨').slice(0, 120), url };
    try {
      if (navigator.share) { await navigator.share(payload); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('link_copied'));
    } catch (e) {
      showToast(url);
    }
  };

  /* A story you deleted disappears from every list it might be in. */
  const onStoryDeleted = (storyId) => {
    setMyStories((s) => s.filter((x) => x.id !== storyId));
    setRealStories((s) => s.filter((x) => x.id !== storyId));
    if (sharedStory && sharedStory.id === storyId) setSharedStory(null);
  };

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
    fetchActiveStories().then((rows) => setRealStories((rows || []).map(toStoryCard))).catch(() => {});
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

  /* Edit one of YOUR moments' caption — saved to the DB, reflected live. */
  const onEditPost = async (post, caption) => {
    tapLight();
    patchPost(post.id, { caption });
    if (SUPABASE_READY && user) await updatePost(post.id, user.id, { caption });
  };

  /* You, shaped like a profile card — tap your avatar to see it.
     Real mode reads your actual profiles row; nothing here is fabricated. */
  const me = {
    id: user ? user.id : 'me',
    name: (myProfile && myProfile.name) || (user && user.user_metadata && user.user_metadata.name) || 'You',
    handle: (myProfile && myProfile.handle && '@' + myProfile.handle) || (user && user.email ? '@' + user.email.split('@')[0] : '@you'),
    emoji: (myProfile && myProfile.emoji) || '🧿',
    avatar: (myProfile && myProfile.avatar_url) || AV_NEUTRAL,
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
                  {t('brand_tagline')}
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
                <Text style={{ color: C.faint, fontSize: 13.5 }}>{t('whats_your_moment')}</Text>
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
              onRemoveLaugh={() => onRemoveLaugh(item)}
              isMine={(user && item.userId === user.id) || item.user.name === 'You'}
              onDelete={onDelete}
              onEdit={onEditPost}
              onShare={onShare}
              onJoin={setMagicPost}
              onVibe={() => onVibe(item)}
              onComment={() => openComments(item)}
              onOpenProfile={setProfileUser}
              onOpenReel={openReel}
              onOpenLikers={(p) => openLikers(p, 'star')}
              onOpenLaughers={(p) => openLikers(p, 'laugh')}
              onReport={setReportPost}
            />
          );
        }}
        ListEmptyComponent={
          SUPABASE_READY ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
              <Text style={{ fontSize: 34 }}>{loadError ? '📡' : '✨'}</Text>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>
                {loadError ? t('couldnt_load_moments') : t('no_moments_yet')}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                {loadError || t('share_first_moment_hint')}
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
      {likersPost ? <LikersSheet post={likersPost} kind={likersKind} onClose={() => setLikersPost(null)} /> : null}
      {reportPost ? <ReportSheet contentType="post" contentId={reportPost.id} contentLabel="moment" onClose={() => setReportPost(null)} /> : null}

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
                onRemoveLaugh={() => onRemoveLaugh(sharedPost)}
                isMine={!!(user && sharedPost.userId === user.id)}
                onDelete={(p) => { onDelete(p); setSharedPost(null); }}
                onShare={onShare}
                onJoin={setMagicPost}
                onVibe={() => onVibe(sharedPost)}
                onComment={() => openComments(sharedPost)}
                onOpenProfile={(u) => { setSharedPost(null); setProfileUser(u); }}
                onOpenReel={() => {}}
                onOpenLikers={(p) => openLikers(p, 'star')}
                onOpenLaughers={(p) => openLikers(p, 'laugh')}
                onReport={setReportPost}
              />
            </Pressable>
            <Pressable onPress={() => setSharedPost(null)} style={{ alignSelf: 'center', marginTop: 6 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{t('back')} ↓</Text>
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
        <StoryViewer
          stories={stories}
          startIndex={storyIndex}
          onClose={() => setStoryIndex(null)}
          onShare={onShareStory}
          onDeleted={onStoryDeleted}
        />
      ) : null}
      {sharedStory ? (
        <StoryViewer
          stories={[sharedStory]}
          startIndex={0}
          onClose={() => setSharedStory(null)}
          onShare={onShareStory}
          onDeleted={(id) => { onStoryDeleted(id); setSharedStory(null); }}
        />
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
