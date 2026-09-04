import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../constants/theme';
import { av, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { toggleVibe, toggleLaugh, toggleRepost, joinPost, fetchEngagement } from '../services/social';
import { getProfile } from '../services/profiles';
import { fetchMyPosts, deletePost, updatePost } from '../services/posts';
import { fetchActiveStories, fetchStoryById, sweepMyExpiredStories } from '../services/stories';
import { recordSignal } from '../services/algorithm';
import { useSwipeToCamera } from '../hooks/useSwipeToCamera';
import { tapLight, tapSuccess, tapMedium, tapCelebrate } from '../utils/feedback';
import { sfxStar, sfxSuccess } from '../utils/sfx';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { useFeed, toCard } from '../hooks/useFeed';
import { fetchPost } from '../services/posts';
import { Platform } from 'react-native';
import { countUnread, subscribeNotifications } from '../services/notifications';
import { sfxNotify } from '../utils/sfx';
import { Glass } from '../components/Glass';
import { PostCard } from '../components/PostCard';
import { StoriesBar } from '../components/StoriesBar';
import { Wordmark } from '../components/Wordmark';
import { Modal } from 'react-native';
import { lazyOverlay } from '../lib/lazyScreen';

/* ─── THE FEED FIRST, THE REST WHEN YOU REACH FOR IT ─────────────────
   Everything below opens over the feed and none of it is on screen
   when you arrive: the camera, Discover and its five games, the story
   viewer, your own profile page. All of it used to be in the first
   download, so opening the app meant waiting for the camera you had
   not asked for.

   They stay ordinary components after this line: written and rendered
   exactly as before, and each one brings itself over the network the
   first time it is opened. */
const BardiSheet = lazyOverlay(() => import('../components/BardiSheet').then((m) => ({ default: m.BardiSheet })));
/* What there is to join — campfires, invitations and groups in one
   place. Opened, not loaded with the feed. */
/* A shared group link has to open the group. GroupPage is a Modal, so
   it can live here as well as in Search. */
const GroupPage = lazyOverlay(() => import('../components/GroupPage').then((mod) => ({ default: mod.GroupPage })));
const WhatsOnSheet = lazyOverlay(() => import('../components/WhatsOnSheet').then((mod) => ({ default: mod.WhatsOnSheet })));
const CaptureModal = lazyOverlay(() => import('../components/CaptureModal').then((m) => ({ default: m.CaptureModal })));
const CommentsSheet = lazyOverlay(() => import('../components/CommentsSheet').then((m) => ({ default: m.CommentsSheet })));
const ComposeModal = lazyOverlay(() => import('../components/ComposeModal').then((m) => ({ default: m.ComposeModal })));
const LikersSheet = lazyOverlay(() => import('../components/LikersSheet').then((m) => ({ default: m.LikersSheet })));
const MagicFlowModal = lazyOverlay(() => import('../components/MagicFlowModal').then((m) => ({ default: m.MagicFlowModal })));
const NotificationsSheet = lazyOverlay(() => import('../components/NotificationsSheet').then((m) => ({ default: m.NotificationsSheet })));
const ProfileModal = lazyOverlay(() => import('../components/ProfileModal').then((m) => ({ default: m.ProfileModal })));
const ReelsViewer = lazyOverlay(() => import('../components/ReelsViewer').then((m) => ({ default: m.ReelsViewer })));
const ReportSheet = lazyOverlay(() => import('../components/ReportSheet').then((m) => ({ default: m.ReportSheet })));
const SearchModal = lazyOverlay(() => import('../components/SearchModal').then((m) => ({ default: m.SearchModal })));
const StoryViewer = lazyOverlay(() => import('../components/StoryViewer').then((m) => ({ default: m.StoryViewer })));
const TopicsSheet = lazyOverlay(() => import('../components/TopicsSheet').then((m) => ({ default: m.TopicsSheet })));
const ProfileScreen = lazyOverlay(() => import('./ProfileScreen').then((m) => ({ default: m.ProfileScreen })));

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
  commentsOff: !!r.comments_off,
  stickerType: r.sticker_type || null,
  stickerData: r.sticker_data ? (() => { try { return JSON.parse(r.sticker_data); } catch (e) { return null; } })() : null,
});

/* ─── A STYLE THAT READS THE THEME IT IS DRAWN IN ─────────────────────
   This was a plain object, built once when the file was first loaded —
   which is before anybody has said whether they are in dark mode. It
   captured the light theme's colours and kept them for the rest of the
   session, so in dark mode the bell and the search button stayed white
   circles, with white icons on top of them. Invisible, and blinding.

   C is a live object the theme rewrites in place, so anything that
   reads it has to read it at the moment of drawing, not at import. A
   function does that; a constant cannot. */
const headerBtn = () => ({
  width: 38, height: 38, borderRadius: 19,
  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
  alignItems: 'center', justifyContent: 'center',
});

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, rtl } = useLang();
  const { posts, refreshing, refresh, prependPost, removePost, patchPost, loadError, settled } = useFeed();
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

  /* A repost now actually does something: the moment goes out again
     under your name — into your mates' feeds and onto your profile —
     and the person who made it hears about it. */
  const onRepost = (post) => {
    const next = !reposts[post.id];
    setReposts((r) => ({ ...r, [post.id]: next }));
    showToast(next ? 'Reposted — it\'s out under your name now 🔁' : 'Repost taken back');
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
  const [bardiOpen, setBardiOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sharedPost, setSharedPost] = useState(null); // opened from a ?post= link
  const [sharedStory, setSharedStory] = useState(null); // opened from a ?story= link
  const [likersPost, setLikersPost] = useState(null); // "who reacted to this"
  const [likersKind, setLikersKind] = useState('star'); // 'star' | 'laugh'
  const openLikers = (post, kind) => { setLikersKind(kind); setLikersPost(post); };
  const [topicsOpen, setTopicsOpen] = useState(false);   // the rooms a moment can belong to
  const [composeTag, setComposeTag] = useState('');      // opened from a topic → tag is prefilled
  const [openTag, setOpenTag] = useState(null);          // a hashtag somebody tapped in a caption
  const [reportPost, setReportPost] = useState(null); // a moment being reported
  const [toast, setToast] = useState(null);
  /* The one place that answers "what can I join?" — see
     components/WhatsOnSheet.js for why it had to exist at all. */
  const [whatsOn, setWhatsOn] = useState(false);
  const [sharedGroup, setSharedGroup] = useState(null);   // {id, postId} from a ?group= link

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

  /* If iOS threw the tab away while the photo picker was open, the
     camera was mid-thought when it went. What you'd written is still in
     the session, so put the screen back rather than making you start
     again. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('mm_capture_draft');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || !d.mode || Date.now() - (d.at || 0) > 30 * 60 * 1000) {
        window.sessionStorage.removeItem('mm_capture_draft');
        return;
      }
      if (d.mode === 'story' || d.mode === 'reel') setComposing(d.mode);
    } catch (e) {}
  }, []);

  /* Open a moment, a story or a profile shared IN —
     ?post=<id> / ?story=<id> / ?u=<user id>. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !SUPABASE_READY) return;
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    const storyId = params.get('story');
    const userId = params.get('u');
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
    if (userId) {
      getProfile(userId)
        .then((p) => p && setProfileUser({
          id: p.id,
          name: p.name || 'Someone',
          avatar: p.avatar_url || AV_NEUTRAL,
          countryFlag: p.country_flag || null,
          intent: p.intent || null,
          bio: p.bio || '',
        }))
        .catch(() => showToast(t('profile_gone')));
    }
    /* ── A GROUP SOMEBODY SENT YOU ────────────────────────────────
       ?group=<id>, optionally &gp=<post id> so the link lands on the
       post they meant rather than at the top of the wall. No fetch
       here: GroupPage loads the group itself and shows its own error
       if the group is gone, which is one place that can be wrong
       instead of two. */
    const groupId = params.get('group');
    const gPost = params.get('gp');
    if (groupId) setSharedGroup({ id: groupId, postId: gPost || null });

    if (postId || storyId || userId || groupId) window.history.replaceState({}, '', window.location.pathname);
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
    /* Not every notification is the same size. Somebody accepting you
       is the moment the app exists for, and it was landing with the
       identical flat chime as a like — so it now arrives in the hand,
       with the one haptic that rises. A star still just ticks. */
    const unsub = subscribeNotifications(user.id, (n) => {
      setUnread((c) => c + 1);
      sfxNotify();
      const kind = n && n.kind;
      if (kind === 'mate_accept') tapCelebrate();
      else if (kind === 'mate_request') tapMedium();
      else tapLight();
    });
    return unsub;
  }, [user]);

  // Stories are REAL only — yours + live 24h stories from the database.
  // The rail stays empty (just the + button) until someone actually posts.
  const [realStories, setRealStories] = useState([]);
  // Your own story must show as ONE "You" ring — never twice. The DB
  // (realStories) already includes your story, so the optimistic copy in
  // myStories would double it up. Dedupe by id, collapse all of your own
  // stories into a single "You" entry (DB version preferred for the real
  // avatar), and put it first — everyone else keeps their own ring.
  /* One ring per PERSON, not per story. Everyone's stories are gathered
     under them — post three and friends still see a single ring that
     plays all three — and yours comes first as "You". Newest last inside
     each person, so their reel plays oldest → newest like everywhere. */
  const storyGroups = useMemo(() => {
    const meId = user && user.id;
    const seen = new Set();
    const byUser = new Map();
    for (const s of [...realStories, ...myStories]) {
      if (!s || !s.user || seen.has(s.id)) continue;
      seen.add(s.id);
      const isMine = meId ? s.user.id === meId : s.user.name === 'You';
      const key = isMine ? 'me' : (s.user.id || s.user.name);
      const entry = byUser.get(key);
      const person = isMine ? { ...s.user, name: 'You' } : s.user;
      if (entry) entry.items.push(s);
      else byUser.set(key, { key, mine: isMine, user: person, items: [s] });
    }
    const groups = [...byUser.values()];
    groups.forEach((g) => g.items.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
    groups.sort((a, b) => (a.mine === b.mine ? 0 : a.mine ? -1 : 1));
    return groups;
  }, [realStories, myStories, user]);

  // the rail shows the newest frame of each person as their ring
  const stories = useMemo(
    () => storyGroups.map((g) => ({ ...g.items[g.items.length - 1], user: g.user, count: g.items.length })),
    [storyGroups]
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
    sweepMyExpiredStories(); // storage hygiene: your expired stories get truly deleted
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
    // never your email — see the note in ProfileScreen
    handle: (myProfile && myProfile.handle) ? '@' + myProfile.handle : null,
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

  /* Instagram's gesture: drag in from the left edge of the feed and the
     camera is already open. It only fires from the first 60px and only
     when the movement is clearly sideways, so it never fights a scroll
     or a swipe on a card. */
  const edgeSwipe = useSwipeToCamera({
    direction: 'right',
    fromRight: rtl,
    onTrigger: () => setComposing('story'),
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }} {...edgeSwipe}>
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
                <Wordmark height={46} style={{ marginLeft: -4, marginBottom: -2 }} />
                <Text style={{ color: C.faint, fontSize: 11, marginTop: 2, letterSpacing: 0.4 }}>
                  {t('brand_tagline')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable testID="btn-bardi" onPress={() => { tapLight(); setBardiOpen(true); }} style={{ marginRight: 10 }}>
                  <Image source={require('../assets/brand/bardi.png')} style={{ width: 38, height: 38, borderRadius: 12 }} />
                </Pressable>
                <Pressable testID="btn-notifs" onPress={() => { tapLight(); setNotifOpen(true); setUnread(0); }} style={[headerBtn(), { marginRight: 10 }]}>
                  <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={17} color={unread ? C.purple : C.text} />
                  {unread ? (
                    <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.bg }}>
                      <Text style={{ color: '#FFF', fontSize: 9.5, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable testID="btn-search" onPress={() => setSearching(true)} style={[headerBtn(), { marginRight: 10 }]}>
                  <Ionicons name="search" size={17} color={C.text} />
                </Pressable>
                <Pressable testID="btn-compose" onPress={() => setComposing('post')} style={[headerBtn(), { marginRight: 10, backgroundColor: C.greenSoft, borderColor: 'rgba(16,185,129,0.4)' }]}>
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

            {/* ── WHAT THERE IS TO JOIN ──────────────────────────────
                Campfires were on the map, invitations were buried in
                this feed under whatever was posted this morning, and
                groups were inside the search modal. Three places, one
                question. This is the question, in the one place people
                actually look. */}
            <Pressable onPress={() => { tapLight(); setWhatsOn(true); }} style={{ marginTop: 12 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
              }}>
                <Text style={{ fontSize: 19, marginEnd: 10 }}>🎟️</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{t('wo_open')}</Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>{t('wo_sub')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </View>
            </Pressable>
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
              onOpenTag={(tag) => setOpenTag(tag)}
              onOpenLikers={(p) => openLikers(p, 'star')}
              onOpenLaughers={(p) => openLikers(p, 'laugh')}
              onReport={setReportPost}
            />
          );
        }}
        ListEmptyComponent={
          /* Still loading and nothing has arrived yet: show the shape of
             the feed, not the words "no moments yet". Those words are a
             statement of fact, and until the first load has answered we
             do not have the fact — so three quiet placeholder cards hold
             the space instead of telling the person their feed is empty
             when it might be a second from filling. */
          SUPABASE_READY && !settled && !loadError ? (
            <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{
                  backgroundColor: C.glass, borderRadius: 18, padding: 14, marginBottom: 14,
                  borderWidth: 1, borderColor: C.line, opacity: 1 - i * 0.22,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.line }} />
                    <View style={{ marginStart: 10, flex: 1 }}>
                      <View style={{ width: '45%', height: 11, borderRadius: 6, backgroundColor: C.line }} />
                      <View style={{ width: '28%', height: 9, borderRadius: 6, backgroundColor: C.line, marginTop: 6 }} />
                    </View>
                  </View>
                  <View style={{ height: 150, borderRadius: 12, backgroundColor: C.line, marginTop: 12 }} />
                </View>
              ))}
            </View>
          ) : SUPABASE_READY ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
              <Text style={{ fontSize: 34 }}>{loadError ? '📡' : '✨'}</Text>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>
                {loadError ? t('couldnt_load_moments') : t('no_moments_yet')}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                {loadError
                  ? t(loadError === 'setup' ? 'load_err_setup'
                    : loadError === 'permission' ? 'load_err_permission'
                    : 'load_err_offline')
                  : t('share_first_moment_hint')}
              </Text>
            </View>
          ) : null
        }
      />

      {/* ── EVERYTHING BELOW ARRIVES WHEN IT IS OPENED ────────────── */}
      {sharedGroup ? (
        <GroupPage
          groupId={sharedGroup.id}
          focusPostId={sharedGroup.postId}
          onClose={() => setSharedGroup(null)}
        />
      ) : null}

      {whatsOn ? (
        <WhatsOnSheet
          /* No coords on purpose. This screen does not ask for your
             location and is not going to start, so the sheet is told
             nothing rather than being handed a guess — and fetchWhatsOn
             treats "no location" as "do not filter by distance and do
             not print a distance", which is the only honest option. */
          onClose={() => setWhatsOn(false)}
        />
      ) : null}

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
      {/* Your avatar opens the ONE real profile — same as the SPACE tab.
          Guarded by the flag as well as by `visible`, so the profile
          page is not even asked for until you open it. */}
      {myProfileOpen ? (
      <Modal visible animationType="slide" onRequestClose={() => setMyProfileOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <Pressable onPress={() => setMyProfileOpen(false)} hitSlop={10} style={{ position: 'absolute', top: insets.top + 12, left: 14, zIndex: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <ProfileScreen />
        </View>
      </Modal>
      ) : null}
      {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}
      {notifOpen ? <NotificationsSheet onClose={() => setNotifOpen(false)} /> : null}
      {bardiOpen ? <BardiSheet onClose={() => setBardiOpen(false)} /> : null}
      {likersPost ? (
        <LikersSheet
          post={likersPost} kind={likersKind}
          onClose={() => setLikersPost(null)}
          /* taking a reaction back from the list must un-light the card too */
          onChanged={(k) => {
            if (k === 'laugh') {
              setLaughs((l) => { const n = { ...l }; delete n[likersPost.id]; return n; });
              setLaughCounts((c) => ({ ...c, [likersPost.id]: Math.max(0, (c[likersPost.id] || 1) - 1) }));
            } else {
              setVibes((v) => { const n = { ...v }; delete n[likersPost.id]; return n; });
            }
          }}
        />
      ) : null}
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
              <View style={{ backgroundColor: C.float, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 }}>
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
          initialCaption={composeTag}
          onOpenStudio={(m) => setComposing(m)}
          onClose={() => { setComposing(null); setComposeTag(''); }}
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
          onOpenTopics={() => { setSearching(false); setTopicsOpen(true); }}
          onOpenTag={(tag) => { setSearching(false); setOpenTag(tag); }}
        />
      ) : null}

      {/* Topics — real hashtags with a name and a home. Posting from a
          topic drops you into the composer with the tag already in it,
          so the moment really lands in that room. */}
      {topicsOpen || openTag ? (
        <TopicsSheet
          initialTag={openTag}
          onClose={() => { setTopicsOpen(false); setOpenTag(null); }}
          onOpenPost={(row) => { setTopicsOpen(false); setOpenTag(null); setSharedPost(toCard(row)); }}
          onCompose={(tag) => { setTopicsOpen(false); setOpenTag(null); setComposeTag(tag); setComposing('post'); }}
        />
      ) : null}
      {storyIndex !== null ? (
        <StoryViewer
          groups={storyGroups}
          startGroup={storyIndex}
          startIndex={0}
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
          onDeleted={(id) => removePost(id)}
          onEdited={(id, fields) => patchPost(id, fields)}
        />
      ) : null}
    </View>
  );
};
