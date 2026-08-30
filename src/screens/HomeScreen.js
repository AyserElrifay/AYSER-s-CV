import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tap, Rise, Breathe } from '../lib/motion';
import { SkeletonFeed } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';
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
  width: 42, height: 42, borderRadius: 21,
  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
  alignItems: 'center', justifyContent: 'center',
});

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, rtl } = useLang();
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
    if (postId || storyId || userId) window.history.replaceState({}, '', window.location.pathname);
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
    /* the raw one, which may be nothing — <Avatar/> draws a real
       fallback for that case instead of showing an empty ring */
    avatarUrl: (myProfile && myProfile.avatar_url) || null,
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
              {/* ── FIVE GREY CIRCLES, AND ONE OF THEM MATTERS ────────
                  They were all the same: same size, same grey, same
                  weight, so the eye had to read every one to find the
                  one it wanted. Now the ✦ that starts a moment is a
                  filled violet button and the rest are quiet beside
                  it, and each one moves under your thumb when you
                  press it — which is the whole of "this app is fast",
                  and it costs nothing and waits for nothing. */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Tap testID="btn-bardi" onPress={() => { tapLight(); setBardiOpen(true); }} style={{ marginRight: 9 }}>
                  <Image source={require('../assets/brand/bardi.png')} style={{ width: 42, height: 42, borderRadius: 14 }} />
                </Tap>
                <Tap testID="btn-notifs" onPress={() => { tapLight(); setNotifOpen(true); setUnread(0); }} style={[headerBtn(), { marginRight: 9 }]}>
                  <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={19} color={unread ? C.purple : C.text} />
                  {unread ? (
                    <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg }}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : null}
                </Tap>
                <Tap testID="btn-search" onPress={() => setSearching(true)} style={[headerBtn(), { marginRight: 9 }]}>
                  <Ionicons name="search" size={19} color={C.text} />
                </Tap>
                <Tap testID="btn-compose" onPress={() => setComposing('post')} style={{ marginRight: 9 }}>
                  <LinearGradient
                    colors={[C.purple, '#C026D3']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="star-four-points" size={22} color="#FFF" />
                  </LinearGradient>
                </Tap>
                <Tap testID="btn-profile" onPress={() => { tapLight(); setMyProfileOpen(true); }}>
                  <Avatar uri={me.avatarUrl} size={42} ring />
                </Tap>
              </View>
            </View>

            <StoriesBar
              stories={stories}
              onOpenStory={setStoryIndex}
              onAddStory={() => setComposing('story')}
            />

            {/* share box — your moment or your opinion, one tap away */}
            {/* ── THE BOX YOU SAY SOMETHING IN ───────────────────────
                Two bare coloured icons sat on the right of this, and
                nobody who has not already learned them knows which is
                which. They are chips with their names on now — which
                is the difference between guessing and reading, for a
                child and for somebody's mother equally. */}
            <Glass style={{ padding: 13, marginTop: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar uri={me.avatarUrl} size={42} />
                <Tap
                  testID="share-box"
                  onPress={() => setComposing('post')}
                  style={{
                    flex: 1, marginLeft: 11,
                    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line,
                    borderRadius: 999, paddingVertical: 13, paddingHorizontal: 17,
                  }}
                >
                  <Text style={{ color: C.dim, fontSize: 14.5 }}>{t('whats_your_moment')}</Text>
                </Tap>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 11 }}>
                <Tap testID="btn-new-reel" onPress={() => setComposing('reel')} style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralSoft, borderRadius: 14, paddingVertical: 10 }}>
                    <Ionicons name="videocam" size={19} color={C.coral} />
                    <Text style={{ color: C.coral, fontSize: 13, fontWeight: '900', marginLeft: 7 }}>{t('hs_video')}</Text>
                  </View>
                </Tap>
                <Tap onPress={() => setComposing('post')} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenSoft, borderRadius: 14, paddingVertical: 10 }}>
                    <Ionicons name="image" size={19} color={C.green} />
                    <Text style={{ color: C.green, fontSize: 13, fontWeight: '900', marginLeft: 7 }}>{t('hs_photo')}</Text>
                  </View>
                </Tap>
              </View>
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
              onOpenTag={(tag) => setOpenTag(tag)}
              onOpenLikers={(p) => openLikers(p, 'star')}
              onOpenLaughers={(p) => openLikers(p, 'laugh')}
              onReport={setReportPost}
            />
          );
        }}
        ListEmptyComponent={
          /* ── AN EMPTY FEED IS THE SCREEN MOST PEOPLE MEET FIRST ────
              It was a small ✨, two lines of grey, and then five
              hundred pixels of nothing above the tab bar. Nothing to
              look at and nothing to do — which is what "the app looks
              old" actually looks like.

              While the first load is still happening it now shows the
              shape of the feed instead. Two grey cards where two real
              ones are about to be tells you the app is working and,
              because the layout is already right, nothing jumps when
              the real posts land — which is most of what people mean
              when they say something feels fast.

              And when the feed really is empty, the space is filled by
              the three things you could do about it, big enough to hit
              without aiming. */
          SUPABASE_READY ? (
            refreshing && !loadError ? (
              <SkeletonFeed count={2} />
            ) : (
            <Rise>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingHorizontal: 8 }}>
                <Breathe>
                  <LinearGradient
                    colors={loadError ? [C.glassHi, C.glass] : [C.purple, '#C026D3']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 34 }}>{loadError ? '📡' : '✨'}</Text>
                  </LinearGradient>
                </Breathe>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginTop: 12, textAlign: 'center', lineHeight: 26 }}>
                  {loadError ? t('couldnt_load_moments') : t('no_moments_yet')}
                </Text>
                <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 6, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 }}>
                  {loadError
                    ? t(loadError === 'setup' ? 'load_err_setup'
                      : loadError === 'permission' ? 'load_err_permission'
                      : 'load_err_offline')
                    : t('share_first_moment_hint')}
                </Text>

                {loadError ? null : (
                  <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
                    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10, marginLeft: 4 }}>
                      {t('hs_start_here').toUpperCase()}
                    </Text>
                    {[
                      { key: 'reel', icon: 'camera', tint: C.coral, soft: C.coralSoft, label: t('hs_photo'), go: () => setComposing('story') },
                      { key: 'write', icon: 'create', tint: C.purple, soft: C.purpleSoft, label: t('hs_write'), go: () => setComposing('post') },
                      { key: 'people', icon: 'people', tint: C.green, soft: C.greenSoft, label: t('hs_find_people'), go: () => setSearching(true) },
                    ].map((a, i) => (
                      <Rise key={a.key} delay={90 + i * 70}>
                        <Tap onPress={() => { tapLight(); a.go(); }}>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                            borderRadius: 18, padding: 12, marginBottom: 8,
                          }}>
                            <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: a.soft, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={a.icon} size={21} color={a.tint} />
                            </View>
                            <Text style={{ flex: 1, color: C.text, fontSize: 15.5, fontWeight: '800', marginLeft: 13 }}>{a.label}</Text>
                            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={C.faint} />
                          </View>
                        </Tap>
                      </Rise>
                    ))}
                  </View>
                )}
              </View>
            </Rise>
            )
          ) : null
        }
      />

      {/* ── EVERYTHING BELOW ARRIVES WHEN IT IS OPENED ────────────── */}
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
