import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Dimensions, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { useLang } from '../context/LanguageContext';
import { fetchMyMoments } from '../services/posts';
import { getProfile } from '../services/profiles';
import { fetchUserStories } from '../services/stories';
import { getMateStatus, mateUp, countMates } from '../services/mates';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { Glass } from './Glass';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { AvatarRing } from './AvatarRing';
import { SectionHeader } from './SectionHeader';
import { PostCard } from './PostCard';
import { LikersSheet } from './LikersSheet';
import { ReelsViewer } from './ReelsViewer';
import { StoryViewer } from './StoryViewer';
import { tapLight, tapSuccess, tapSelection } from '../utils/feedback';
import { toggleVibe as persistVibe, toggleLaugh as persistLaugh, toggleRepost as persistRepost, fetchEngagement } from '../services/social';
import { sharePost, shareNote } from '../utils/share';

/* CommentsSheet imports ProfileModal (tapping a commenter opens their
   profile), so importing it statically here would be a require cycle —
   resolve it lazily at render time instead. */
const getCommentsSheet = () => require('./CommentsSheet').CommentsSheet;
import { sfxPop, sfxSuccess } from '../utils/sfx';

const { width: W } = Dimensions.get('window');
const CELL = (W - 48) / 3;

/* ─── SOMEONE ELSE'S PROFILE ──────────────────────────────────────
   Organized exactly like your own space: header, stats, actions,
   then their REAL recent moments (their actual posts — never stock
   photos). Mate up sends a real friend request; Message sends a
   real DM. Honest empty states everywhere. */

const isVideoUri = (u) => typeof u === 'string' && /\.(webm|mp4|mov|m4v)(\?|$)/i.test(u);

export const ProfileModal = ({ user, onClose }) => {
  const insets = useSafeAreaInsets();
  // their live stories — tap the photo to watch them
  const [theirStories, setTheirStories] = useState([]);
  const [storyOpen, setStoryOpen] = useState(false);
  const { user: me } = useAuth();
  const { rtl } = useLang();
  const [posts, setPosts] = useState(null);         // their real moments
  const [mates, setMates] = useState(null);         // real mate count
  const [mateState, setMateState] = useState('none'); // none|requested|incoming|mates
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSent, setMsgSent] = useState(false);
  const [tab, setTab] = useState('grid');   // grid | reel | tag

  /* The tab decides what the grid shows — the same three the owner's
     own space offers, so switching between two profiles doesn't
     switch how the app works. */
  const shownPosts = React.useMemo(() => {
    const all = posts || [];
    if (tab === 'reel') return all.filter((p) => p.type === 'reel');
    if (tab === 'tag') return [];          // tagging isn't built yet — say so, don't fake it
    return all.filter((p) => p.type !== 'reel');
  }, [posts, tab]);

  /* Opening someone's moment from their profile used to be a dead end:
     star, laugh, repost and share were all empty functions. They run
     through the same services as the feed now, so a reaction here is
     the same reaction everywhere. */
  const [myVibes, setMyVibes] = useState({});
  const [myLaughs, setMyLaughs] = useState({});
  const [myReposts, setMyReposts] = useState({});
  const [shareMsg, setShareMsg] = useState(null);
  const [likersPost, setLikersPost] = useState(null);
  const [likersKind, setLikersKind] = useState('star');

  useEffect(() => {
    if (!SUPABASE_READY || !me) return;
    fetchEngagement(me.id)
      .then((e) => { setMyVibes(e.myVibes || {}); setMyLaughs(e.myLaughs || {}); setMyReposts(e.myReposts || {}); })
      .catch(() => {});
  }, [me && me.id]);

  const reactTo = (map, setMap, persist) => (post) => {
    if (!post) return;
    const id = post.id;
    const next = !map[id];
    setMap((m) => ({ ...m, [id]: next }));
    tapLight();
    if (SUPABASE_READY && me) persist(id, me.id, next).catch(() => setMap((m) => ({ ...m, [id]: !next })));
  };
  const vibeMoment = reactTo(myVibes, setMyVibes, persistVibe);
  const laughMoment = reactTo(myLaughs, setMyLaughs, persistLaugh);
  const repostMoment = reactTo(myReposts, setMyReposts, persistRepost);
  const shareMoment = async (post) => {
    const note = shareNote(await sharePost(post || {}));
    if (note) { setShareMsg(note); setTimeout(() => setShareMsg(null), 2400); }
  };
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState(null); // never swallow failures silently

  // "relation …mates… does not exist" → the SQL file wasn't run yet
  const explain = (e) => {
    const m = (e && e.message) || '';
    if (/relation .*mates.* does not exist|schema cache/i.test(m)) {
      return 'One step left: open Supabase → SQL Editor and run the file supabase/RUN_ME.sql (one paste turns on friends, chat & everything).';
    }
    return m || 'Something went wrong — try again.';
  };

  const real = SUPABASE_READY && me && user && user.id && String(user.id).length > 20; // uuid = real account
  const isMe = me && user && user.id === me.id;
  const { isOnline } = usePresence();
  const onlineNow = real && !isMe && isOnline(user.id);

  const [fullProfile, setFullProfile] = useState(null); // hydrated row (hobbies, bio…)
  /* Private is a real state, not a label: the read policy on posts and
     stories already refuses these rows to anyone who isn't an accepted
     mate, so the screen only has to say so. */
  const isPrivate = !!(fullProfile && fullProfile.account_type === 'private');
  const locked = isPrivate && !isMe && mateState !== 'mates';

  const load = useCallback(async () => {
    if (!real) { setPosts([]); setMates(0); return; }
    // fetchMyMoments carries real star counts too → powers the Likes stat
    fetchMyMoments(user.id).then((rows) => setPosts(rows || [])).catch(() => setPosts([]));
    countMates(user.id).then(setMates).catch(() => setMates(0));
    getProfile(user.id).then(setFullProfile).catch(() => {});
    if (!isMe) getMateStatus(me.id, user.id).then(setMateState).catch(() => {});
  }, [user, real, isMe]);

  // ── open their posts for real: text/photo → full PostCard, reel → viewer ──
  const [viewMoment, setViewMoment] = useState(null);
  const [reelView, setReelView] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const rowToCard = (row) => ({
    id: row.id,
    userId: row.user_id,
    user: { id: user.id, name: user.name, avatar: user.avatar, verified: !!user.verified, flag: user.countryFlag || (fullProfile && fullProfile.country_flag) || null },
    type: row.type || 'post',
    media: row.media_url || null,
    textBg: row.text_bg || null,
    caption: row.caption || '',
    place: row.place || 'Somewhere out there',
    startsIn: '',
    vibes: row.vibesCount || 0,
    comments: 0, laughs: 0, reposts: 0,
    sound: row.sound_title ? { title: row.sound_title, artist: row.sound_artist || '', emoji: '🎵', audio_url: row.sound_url || null } : null,
  });
  const openPost = (row) => {
    tapSelection();
    if (row.type === 'reel' && row.media_url) {
      const reels = (posts || []).filter((r) => r.type === 'reel' && r.media_url).map(rowToCard);
      const idx = Math.max(0, reels.findIndex((r) => r.id === row.id));
      setReelView({ reels, index: idx });
    } else {
      setViewMoment(rowToCard(row));
    }
  };

  useEffect(() => { load(); }, [load]);

  /* Their live stories, so the ring is honest: it only glows when they
     actually have something up right now. */
  useEffect(() => {
    if (!SUPABASE_READY || !user || !user.id) { setTheirStories([]); return undefined; }
    let cancelled = false;
    fetchUserStories(user.id)
      .then((rows) => { if (!cancelled) setTheirStories(rows || []); })
      .catch(() => { if (!cancelled) setTheirStories([]); });
    return () => { cancelled = true; };
  }, [user && user.id]);

  if (!user) return null;

  const doMateUp = async () => {
    if (!real || isMe || busy) return;
    setActionErr(null);
    setBusy(true);
    try {
      const next = await mateUp(me.id, user.id);
      setMateState(next);
      tapSuccess(); sfxSuccess(); // celebrate only when it actually worked
      if (next === 'mates') countMates(user.id).then(setMates).catch(() => {});
    } catch (e) {
      setActionErr(explain(e));
    } finally { setBusy(false); }
  };

  const doSend = async () => {
    const body = msgText.trim();
    if (!body || !real || isMe || busy) return;
    setActionErr(null);
    setBusy(true);
    try {
      const threadId = await getOrCreateDmThread(user.id);
      await sendMessage({ dmThreadId: threadId, userId: me.id, body });
      tapLight(); sfxPop();
      setMsgText('');
      setMsgSent(true);
      setTimeout(() => { setMsgSent(false); setMsgOpen(false); }, 1400);
    } catch (e) {
      setActionErr(explain(e));
    } finally { setBusy(false); }
  };

  const mateLabel =
    mateState === 'mates' ? 'Mates ✓'
    : mateState === 'requested' ? 'Requested ✓'
    : mateState === 'incoming' ? 'Accept request 🤝'
    : '＋ Mate up';

  // Same three stats as your own space — one unified profile look.
  const likes = posts == null ? null : posts.reduce((s, r) => s + (r.vibesCount || 0), 0);
  const stats = [
    { n: posts == null ? '—' : posts.length, l: 'Moments' },
    { n: mates == null ? '—' : mates, l: 'Followers' },
    { n: likes == null ? '—' : likes, l: 'Likes' },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* cover — rounded, same as your own profile (their photo, else brand gradient) */}
          <View style={{ marginTop: insets.top + 8, marginHorizontal: 16 }}>
            {fullProfile && fullProfile.cover_url ? (
              <Image source={{ uri: fullProfile.cover_url }} style={{ width: '100%', height: 130, borderRadius: 18 }} />
            ) : (
              <LinearGradient colors={['#7C3AED', '#5B21B6', '#2A0F63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 130, borderRadius: 18 }} />
            )}
            <Pressable onPress={onClose} style={{ position: 'absolute', top: 10, left: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-down" size={19} color="#FFF" />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            {/* identity — avatar on the LEFT, stats to its right (clean,
                balanced Instagram-style header). A plain flexDirection:'row'
                flips under Arabic (document dir="rtl" reverses which edge
                "row" starts from), so we swap child order when rtl is on and
                use a fixed-width spacer for the gap — keeps the avatar
                pinned LEFT in both languages. */}
            {(() => {
              const hasStory = theirStories.length > 0;
              const avatarBlock = (
                <Pressable
                  onPress={() => { if (hasStory) { tapLight(); setStoryOpen(true); } }}
                  disabled={!hasStory}
                >
                  <LinearGradient
                    colors={hasStory ? [C.gold, C.purple, C.green] : [C.line, C.line, C.line]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{ backgroundColor: C.bg, borderRadius: 44, padding: 3 }}>
                      <Image source={{ uri: user.avatar }} style={{ width: 76, height: 76, borderRadius: 38 }} />
                    </View>
                  </LinearGradient>
                  {hasStory ? (
                    <View style={{ position: 'absolute', bottom: -2, alignSelf: 'center', backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: C.bg }}>
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>
                        {theirStories.length > 1 ? theirStories.length + ' STORIES' : 'STORY'}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
              const statsBlock = (
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  {stats.map((s) => (
                    <View key={s.l} style={{ flex: 1, alignItems: 'center' }}>
                      {/* same weight and casing as your own space —
                          two profiles that show the same three numbers
                          should not shout one of them */}
                      <Text style={{ color: C.text, fontSize: 21, fontWeight: '900' }}>{s.n}</Text>
                      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{s.l}</Text>
                    </View>
                  ))}
                </View>
              );
              const spacer = <View style={{ width: 16 }} />;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {rtl ? statsBlock : avatarBlock}
                  {spacer}
                  {rtl ? avatarBlock : statsBlock}
                </View>
              );
            })()}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{user.name}</Text>
              {user.verified ? <Tick size={16} /> : null}
              {user.countryFlag ? <Text style={{ fontSize: 16, marginLeft: 6 }}>{user.countryFlag}</Text> : null}
              {user.intent ? (
                <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 }}>
                  <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800' }}>{user.intent}</Text>
                </View>
              ) : null}
            </View>
            {onlineNow ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 6 }} />
                <Text style={{ color: C.green, fontSize: 12, fontWeight: '800' }}>Online now</Text>
              </View>
            ) : null}
            {user.handle ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{user.handle}</Text> : null}
            {(user.bio || (fullProfile && fullProfile.bio)) ? (
              <Text style={{ color: C.text, fontSize: 14, lineHeight: 21, marginTop: 12 }}>{user.bio || fullProfile.bio}</Text>
            ) : null}
            {fullProfile && (fullProfile.age || fullProfile.occupation || fullProfile.education || fullProfile.speaks_language) ? (
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
                {[
                  fullProfile.age ? '🎂 ' + fullProfile.age : null,
                  fullProfile.occupation ? '💼 ' + fullProfile.occupation : null,
                  fullProfile.education ? '🎓 ' + fullProfile.education : null,
                  fullProfile.speaks_language ? '🗣️ ' + fullProfile.speaks_language : null,
                ].filter(Boolean).join('   ·   ')}
              </Text>
            ) : null}
            {fullProfile && fullProfile.hobbies ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                {String(fullProfile.hobbies).split(',').map((h) => h.trim()).filter(Boolean).map((h) => (
                  <View key={h} style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginRight: 6, marginBottom: 6 }}>
                    <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '800' }}>{h}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Joined — the same chip your own space carries. Two profiles
                in one app should not be describing a person differently. */}
            {fullProfile && fullProfile.created_at ? (
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700' }}>
                    📅 Joined {new Date(fullProfile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* actions — real friend request + real DM */}
            {!isMe ? (
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <Pressable onPress={doMateUp} style={{ flex: 1, marginRight: 10 }}>
                  <View style={{
                    borderRadius: 14, paddingVertical: 13, alignItems: 'center',
                    backgroundColor: mateState === 'mates' ? C.greenSoft : C.purple,
                    borderWidth: mateState === 'mates' ? 1 : 0, borderColor: 'rgba(16,185,129,0.45)',
                  }}>
                    <Text style={{ color: mateState === 'mates' ? C.green : '#FFF', fontSize: 13.5, fontWeight: '900' }}>
                      {real ? mateLabel : '＋ Mate up'}
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => { tapLight(); setMsgOpen((o) => !o); }} style={{ width: 118 }}>
                  <View style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>Message 💬</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {/* inline composer — say hi without leaving the profile */}
            {msgOpen && !isMe ? (
              <Glass style={{ padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  placeholder={real ? 'Say something nice…' : 'Connect Supabase to message for real'}
                  placeholderTextColor={C.faint}
                  value={msgText}
                  onChangeText={setMsgText}
                  onSubmitEditing={doSend}
                  returnKeyType="send"
                  style={{ flex: 1, color: C.text, fontSize: 13.5, paddingVertical: Platform.OS === 'ios' ? 8 : 6, paddingHorizontal: 6 }}
                />
                <Pressable onPress={doSend} hitSlop={8}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: msgSent ? C.green : msgText.trim() ? C.purple : C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={msgSent ? 'checkmark' : 'arrow-up'} size={18} color={msgSent || msgText.trim() ? '#FFF' : C.faint} />
                  </View>
                </Pressable>
              </Glass>
            ) : null}
            {msgSent ? (
              <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 8 }}>
                Sent! Continue in Chats 💬
              </Text>
            ) : null}
            {busy ? (
              <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Working…</Text>
            ) : null}
            {actionErr ? (
              <Text style={{ color: C.coral, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 17 }}>
                {actionErr}
              </Text>
            ) : null}

            {/* their REAL moments — same grid as your own profile */}
            {/* the same tab row your own space has, so a profile looks
                like a profile whoever it belongs to */}
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, marginTop: 22 }}>
              {[
                { k: 'grid', icon: 'grid-outline' },
                { k: 'reel', icon: 'play-outline' },
                { k: 'tag', icon: 'pricetag-outline' },
              ].map((t) => (
                <Pressable key={t.k} onPress={() => { tapLight(); setTab(t.k); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === t.k ? C.text : 'transparent' }}>
                  <Ionicons name={t.icon} size={20} color={tab === t.k ? C.text : C.faint} />
                </Pressable>
              ))}
            </View>
            {posts == null ? (
              <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 20 }}>Loading…</Text>
            ) : locked ? (
              /* A private account with nothing shared is not the same as
                 an empty one, and pretending otherwise is a small lie.
                 The database already refuses to hand these rows over —
                 this just explains the silence. */
              <Glass style={{ padding: 22, alignItems: 'center' }}>
                <Text style={{ fontSize: 30 }}>🔒</Text>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 8 }}>This account is private</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, textAlign: 'center', lineHeight: 18 }}>
                  {mateState === 'requested'
                    ? 'Your request is waiting — you\u2019ll see their moments once they accept.'
                    : 'Mate up with ' + String(user.name || 'them').split(' ')[0] + ' to see their moments and stories.'}
                </Text>
              </Glass>
            ) : shownPosts.length === 0 ? (
              <Glass style={{ padding: 22, alignItems: 'center' }}>
                <Text style={{ fontSize: 30 }}>🌱</Text>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 8 }}>No moments yet</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, textAlign: 'center' }}>
                  {tab === 'tag' ? 'Tagging isn\u2019t built yet — nothing to show here rather than something invented.'
                    : tab === 'reel' ? 'No reels yet.'
                    : isMe ? 'Share your first moment from Home ✨' : 'Their story starts soon — wave to say hi 👋'}
                </Text>
              </Glass>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {shownPosts.slice(0, 12).map((p) => (
                  <Pressable key={p.id} onPress={() => openPost(p)} style={{ width: CELL, height: CELL, borderRadius: 14, margin: 4, overflow: 'hidden', backgroundColor: C.glassHi }}>
                    {p.media_url && !isVideoUri(p.media_url) ? (
                      <Image source={{ uri: p.media_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <LinearGradient colors={['#EDE9FE', '#FCE7F3']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                        <Text style={{ color: '#4C1D95', fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={4}>
                          {p.caption || '✨'}
                        </Text>
                      </LinearGradient>
                    )}
                    {isVideoUri(p.media_url) ? (
                      <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: 4 }}>
                        <Ionicons name="play" size={11} color="#FFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* tapped moment → the full card, read-only (it's their post) */}
        {viewMoment ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setViewMoment(null)}>
            <View style={{ flex: 1, backgroundColor: C.bg }}>
              <Pressable onPress={() => setViewMoment(null)} hitSlop={10} style={{ position: 'absolute', top: insets.top + 12, left: 14, zIndex: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={22} color={C.text} />
              </Pressable>
              <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 14, paddingBottom: 40 }}>
                <PostCard
                  post={viewMoment}
                  vibed={!!myVibes[viewMoment.id]}
                  laughed={!!myLaughs[viewMoment.id]}
                  reposted={!!myReposts[viewMoment.id]}
                  onComment={() => setCommentsPost(viewMoment)}
                  onOpenProfile={() => {}}
                  onOpenReel={() => {}}
                  onVibe={() => vibeMoment(viewMoment)}
                  onLaugh={() => laughMoment(viewMoment)}
                  onRemoveLaugh={() => laughMoment(viewMoment)}
                  onRepost={() => repostMoment(viewMoment)}
                  onShare={shareMoment}
                  onJoin={() => {}}
                  onOpenLikers={(x) => { setLikersKind('star'); setLikersPost(x || viewMoment); }}
                  onOpenLaughers={(x) => { setLikersKind('laugh'); setLikersPost(x || viewMoment); }}
                />
              </ScrollView>
              {likersPost ? <LikersSheet post={likersPost} kind={likersKind} onClose={() => setLikersPost(null)} /> : null}
              {shareMsg ? (
                <View style={{ position: 'absolute', bottom: 40, left: 30, right: 30, backgroundColor: C.float, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingVertical: 11 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', textAlign: 'center' }}>{shareMsg}</Text>
                </View>
              ) : null}
            </View>
          </Modal>
        ) : null}

        {reelView ? (
          <ReelsViewer
            reels={reelView.reels}
            startIndex={reelView.index}
            vibes={myVibes}
            onVibe={vibeMoment}
            onComment={(item) => setCommentsPost(item)}
            onClose={() => setReelView(null)}
          />
        ) : null}

        {/* tapped their photo — watch their story */}
        {storyOpen && theirStories.length ? (
          <StoryViewer
            groups={[{
              user: {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                flag: user.countryFlag || (fullProfile && fullProfile.country_flag) || null,
              },
              items: theirStories.map((r) => ({
                id: r.id,
                createdAt: r.created_at,
                user: {
                  id: r.user_id,
                  name: (r.user && r.user.name) || user.name,
                  avatar: (r.user && r.user.avatar_url) || user.avatar,
                  flag: (r.user && r.user.country_flag) || null,
                },
                media: r.media_url,
                caption: r.caption,
                commentsOff: !!r.comments_off,
                sound: r.sound_title ? { title: r.sound_title, artist: r.sound_artist || '', emoji: '🎵', audio_url: r.sound_url || null } : null,
                stickerType: r.sticker_type || null,
                stickerData: r.sticker_data ? (() => { try { return JSON.parse(r.sticker_data); } catch (e) { return null; } })() : null,
              })),
            }]}
            startGroup={0}
            startIndex={0}
            onClose={() => setStoryOpen(false)}
            onDeleted={(id) => setTheirStories((list) => list.filter((x) => x.id !== id))}
          />
        ) : null}

        {commentsPost ? (() => { const CS = getCommentsSheet(); return <CS post={commentsPost} onClose={() => setCommentsPost(null)} />; })() : null}
      </View>
    </Modal>
  );
};
