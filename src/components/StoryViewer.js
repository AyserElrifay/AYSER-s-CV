import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ImageBackground, Animated, Image, Dimensions, Platform, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SoundChip } from './SoundChip';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isOwner } from '../services/music';
import {
  deleteStory, castPollVote, fetchPollResults,
  recordStoryView, fetchStoryViewers, reactToStory, fetchMyStoryReaction,
  fetchStoryComments, addStoryComment, deleteStoryComment, setStoryComments,
} from '../services/stories';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';
import { holdToClip } from '../lib/soundClip';
import { soundOn, setSoundOn, applySound, trackPlayer, untrackPlayer, stopVideos } from '../lib/videoSound';
import { setupNotice } from '../lib/plumbing';

const REACT_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

/* Say what actually went wrong instead of failing in silence. The
   commonest cause by far is the tables not existing yet. */
const explainStory = (e) => {
  const m = (e && e.message) || '';
  if (/does not exist|schema cache|relation .* does not exist/i.test(m)) {
    return setupNotice('One step left — run supabase/RUN_ME.sql in Supabase to turn this on.');
  }
  if (/row-level security|violates row-level/i.test(m)) return 'Comments are off for this story.';
  if (/JWT|auth/i.test(m)) return 'Sign in again and try that once more.';
  return m || 'That did not go through — try again.';
};

/* Time-ago for the viewers list ("3m", "2h") — short, no library. */
const timeAgo = (iso) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
};

const { width: W } = Dimensions.get('window');
const STORY_MS = 5000;
const HOURS_24 = 24 * 60 * 60 * 1000;

const hoursLeft = (createdAt) => {
  if (!createdAt) return null;
  const left = new Date(createdAt).getTime() + HOURS_24 - Date.now();
  return Math.max(0, Math.ceil(left / (60 * 60 * 1000)));
};

/* Full-screen story playback: tap right → next, left → back,
   auto-advances with the familiar progress bars up top. Real reply
   (DMs the poster), real share (a ?story= link), real delete of your
   own story, and real poll / question stickers. */
export const StoryViewer = ({ stories, groups, startGroup = 0, startIndex = 0, onClose, onShare, onDeleted }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  /* Stories belong to PEOPLE. One person's stories play as their own
     reel with their own progress bars; when they run out, the next
     person starts — you never find yourself halfway through a stranger's
     story inside someone else's. A flat `stories` list still works
     (a shared ?story= link) — it's just treated as one person's reel. */
  const groupList = (groups && groups.length)
    ? groups
    : [{ user: (stories && stories[0] && stories[0].user) || null, items: stories || [] }];
  const [groupIndex, setGroupIndex] = useState(Math.min(startGroup, Math.max(0, groupList.length - 1)));
  const items = (groupList[groupIndex] && groupList[groupIndex].items) || [];
  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [storySound, setStorySound] = useState(soundOn);
  const storyVideos = useRef([]);
  // closing a story stops its sound with it
  useEffect(() => () => {
    storyVideos.current.forEach((el) => untrackPlayer(el));
    stopVideos(new Set(storyVideos.current));
  }, []);
  const [poll, setPoll] = useState(null); // { counts:[a,b], mine, total }
  const [myReaction, setMyReaction] = useState(null);
  const [reactSent, setReactSent] = useState(false);
  const [viewers, setViewers] = useState(null); // null = not loaded, [] = loaded empty
  const [viewersOpen, setViewersOpen] = useState(false);
  // comments live UNDER the story and are saved — reopen it, they're there
  const [comments, setComments] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentsOff, setCommentsOff] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [storyErr, setStoryErr] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [barW, setBarW] = useState(0);   // measured once; the bars are equal
  const anim = useRef(null);
  const story = items[index];
  /* Yours if it is yours — and a leftover local one (id 'me', from
     before stories were saved properly) counts too, so it can be
     cleared off your own rail instead of sitting there forever. */
  const isMine = !!(user && story && story.user && (story.user.id === user.id || story.user.id === 'me'));
  /* And the person who runs Moments can take anything down: reports
     and takedowns are worth nothing if nobody can act on them. */
  const canRemoveAny = isOwner(user);

  useEffect(() => {
    setConfirmDel(false); setReply(''); setSent(false); setPoll(null);
    setMyReaction(null); setReactSent(false); setViewers(null); setViewersOpen(false);
    if (!story || !SUPABASE_READY || !user) return;
    if (story.stickerType === 'poll') {
      fetchPollResults(story.id, user.id).then(setPoll).catch(() => {});
    }
    setComments([]); setCommentText(''); setCommentsOpen(false); setStoryErr(null);
    setCommentsOff(!!story.commentsOff);
    // saved comments come back every time the story is opened
    fetchStoryComments(story.id).then(setComments).catch(() => setComments([]));
    if (isMine) {
      // real "who watched" — owner sees the count + list
      fetchStoryViewers(story.id).then(setViewers).catch(() => setViewers([]));
    } else {
      recordStoryView(story.id, user.id);
      fetchMyStoryReaction(story.id, user.id).then(setMyReaction).catch(() => {});
    }
  }, [index, groupIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    progress.setValue(0);
    if (paused) return undefined;
    /* Driven natively now — see the bar itself further down. A story
       lasts five seconds, so this is three hundred frames running
       alongside a playing video; it is the one animation in the app
       that absolutely cannot afford to be on the same thread as the
       rest of the work. */
    anim.current = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: true });
    anim.current.start(({ finished }) => {
      if (!finished) return;
      if (index < items.length - 1) setIndex(index + 1);
      else if (groupIndex < groupList.length - 1) { setGroupIndex(groupIndex + 1); setIndex(0); }
      else onClose();
    });
    return () => anim.current && anim.current.stop();
  }, [index, groupIndex, paused, progress, items.length, groupList.length, onClose]);

  if (!story) return null;

  const go = (dir) => {
    const next = index + dir;
    if (next >= 0 && next < items.length) { setIndex(next); return; }
    // ran off the end of this person — step to the next/previous person
    if (dir > 0) {
      if (groupIndex < groupList.length - 1) { setGroupIndex(groupIndex + 1); setIndex(0); }
      else onClose();
    } else {
      if (groupIndex > 0) {
        const prev = groupIndex - 1;
        setGroupIndex(prev);
        setIndex(Math.max(0, ((groupList[prev] && groupList[prev].items) || []).length - 1));
      } else onClose();
    }
  };

  const vote = async (choice) => {
    if (!SUPABASE_READY || !user || (poll && poll.mine != null)) return;
    tapSuccess(); sfxSuccess();
    setPoll((p) => {
      const counts = [...(p ? p.counts : [0, 0])];
      counts[choice] = (counts[choice] || 0) + 1;
      return { counts, mine: choice, total: (p ? p.total : 0) + 1 };
    });
    try { await castPollVote(story.id, user.id, choice); } catch (e) {}
  };

  const sendReply = async (asAnswer) => {
    const body = reply.trim();
    if (!body || !SUPABASE_READY || !user || isMine) return;
    tapLight(); sfxPop();
    try {
      const threadId = await getOrCreateDmThread(story.user.id, user && user.id);
      const prefix = asAnswer && story.stickerData && story.stickerData.question
        ? 'Answered "' + story.stickerData.question + '": '
        : 'Replied to your story: ';
      await sendMessage({ dmThreadId: threadId, userId: user.id, body: prefix + body });
      setReply('');
      setSent(true);
      setTimeout(() => setSent(false), 1600);
    } catch (e) {}
  };

  const sendReaction = async (emoji) => {
    if (!SUPABASE_READY || !user || isMine) return;
    const previous = myReaction;
    tapSuccess(); sfxSuccess();
    setMyReaction(emoji);
    setStoryErr(null);
    try {
      // this is the part that has to stick — if it fails, the reaction
      // goes back to what it was rather than pretending it saved
      await reactToStory(story.id, user.id, emoji);
      setReactSent(true);
      setTimeout(() => setReactSent(false), 1400);
    } catch (e) {
      setMyReaction(previous);
      setStoryErr(explainStory(e));
      return;
    }
    try {
      // and it lands in the owner's DMs too, so it's a real notification
      const threadId = await getOrCreateDmThread(story.user.id, user && user.id);
      await sendMessage({ dmThreadId: threadId, userId: user.id, body: 'Reacted to your story: ' + emoji });
    } catch (e) { /* the reaction itself is saved; the DM ping is a bonus */ }
  };

  /* Post a comment — it's saved, and everyone watching sees it. */
  const postComment = async () => {
    const body = commentText.trim();
    if (!body || !SUPABASE_READY || !user || commentBusy || commentsOff) return;
    setCommentBusy(true);
    setStoryErr(null);
    try {
      const row = await addStoryComment(story.id, user.id, body);
      setComments((list) => [...list, row]);
      setCommentText('');
      tapLight(); sfxPop();
    } catch (e) {
      setStoryErr(explainStory(e));   // never swallow it — say why
    } finally { setCommentBusy(false); }
  };

  const removeComment = async (c) => {
    setComments((list) => list.filter((x) => x.id !== c.id));
    try { await deleteStoryComment(c.id); } catch (e) {}
  };

  /* The owner switching comments off (or back on) for THIS story. */
  const toggleComments = async () => {
    if (!isMine || !SUPABASE_READY || !user) return;
    const next = !commentsOff;
    setCommentsOff(next);
    tapLight();
    try { await setStoryComments(story.id, user.id, next); } catch (e) { setCommentsOff(!next); }
  };

  const doDelete = async () => {
    if (!isMine && !canRemoveAny) return;
    tapLight();
    if (SUPABASE_READY && user) { try { await deleteStory(story.id, canRemoveAny && !isMine ? null : user.id); } catch (e) {} }
    onDeleted && onDeleted(story.id);
    if (items.length <= 1) onClose();
    else go(index < items.length - 1 ? 1 : -1);
  };

  const left = hoursLeft(story.createdAt);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* the story's REAL song — plays while you watch (web) */}
        {Platform.OS === 'web' && story.sound && story.sound.audio_url ? (
          <audio
            key={story.sound.audio_url + index}
            src={story.sound.audio_url}
            autoPlay
            loop
            /* the URL may carry the fifteen seconds they picked — see
               src/lib/soundClip.js. Browsers seek to a media fragment
               but won't hold the end of it, and looping sends the clip
               back to zero, so the window is kept here. */
            ref={(el) => { if (el && !el.__clipHeld) { el.__clipHeld = true; holdToClip(el); } }}
            style={{ display: 'none' }}
          />
        ) : null}
        {/* a VIDEO story must actually play — it rendered as a frozen
            ImageBackground before (why video stories "didn't work") */}
        {Platform.OS === 'web' && typeof story.media === 'string' && /\.(mp4|webm|mov)(\?|#|$)/i.test(story.media) ? (
          <video
            key={story.media}
            src={story.media}
            autoPlay muted loop playsInline
            ref={(el) => { if (el && !el.__wired) { el.__wired = true; storyVideos.current.push(el); trackPlayer(el); applySound(el); } }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        <ImageBackground
          source={{ uri: /\.(mp4|webm|mov)(\?|#|$)/i.test(String(story.media || '')) ? undefined : story.media }}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 30 }}>
            {/* ── PROGRESS BARS ─────────────────────────────────────
                These used to grow by animating their width from 0% to
                100%. A width is a layout: the browser re-measures and
                repaints the bar sixty times a second, for five seconds,
                on the same thread as everything else — while a video is
                decoding beside it. That is where the stutter at the top
                of a story came from.

                Same picture, different mechanism. The bar is drawn at
                full width and slid in from the left behind a clip, so
                the only thing changing per frame is a transform — no
                measuring, no repainting, and it can run natively off
                the main thread. */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {items.map((_, i) => (
                <View
                  key={i}
                  onLayout={i === 0 ? (e) => setBarW(e.nativeEvent.layout.width) : undefined}
                  style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, overflow: 'hidden' }}
                >
                  <Animated.View
                    style={{
                      height: 3, width: '100%', backgroundColor: '#FFF',
                      transform: [{
                        translateX: i < index ? 0
                          : i === index && barW
                            ? progress.interpolate({ inputRange: [0, 1], outputRange: [-barW, 0] })
                            : -(barW || 9999),
                      }],
                    }}
                  />
                </View>
              ))}
            </View>
            {/* author row */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: story.user.avatar }} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFF' }} />
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginLeft: 9, flex: 1 }} numberOfLines={1}>
                {story.user.name}{story.user.flag ? ' ' + story.user.flag : ''}{' '}
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
                  {left != null ? '· ' + left + 'h left' : '· now'}
                </Text>
              </Text>
              {isMine || canRemoveAny ? (
                confirmDel ? (
                  <Pressable onPress={doDelete} hitSlop={8} style={{ marginRight: 10 }}>
                    <View style={{ backgroundColor: 'rgba(244,63,94,0.9)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>Delete?</Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setConfirmDel(true)} hitSlop={10} style={{ marginRight: 14 }}>
                    <Ionicons name="trash-outline" size={22} color="#FFF" />
                  </Pressable>
                )
              ) : null}
              {/* a video story kept its sound to itself too */}
              <Pressable
                onPress={() => {
                  const next = !storySound;
                  tapLight();
                  setStorySound(next);
                  setSoundOn(next);
                  storyVideos.current.forEach((el) => { if (el && el.isConnected) applySound(el); });
                }}
                hitSlop={10}
                style={{ marginRight: 14 }}
              >
                <Ionicons name={storySound ? 'volume-high' : 'volume-mute'} size={21} color="#FFF" />
              </Pressable>
              <Pressable onPress={() => onShare && onShare(story)} hitSlop={10} style={{ marginRight: 14 }}>
                <Ionicons name="paper-plane-outline" size={22} color="#FFF" />
              </Pressable>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={26} color="#FFF" />
              </Pressable>
            </View>
          </LinearGradient>

          {/* tap zones */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Pressable style={{ width: W * 0.3 }} onPress={() => go(-1)} />
            <View style={{ flex: 1 }} />
            <Pressable style={{ width: W * 0.3 }} onPress={() => go(1)} />
          </View>

          {/* caption + sound + interactive stickers */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={{ padding: 16, paddingBottom: insets.bottom + 20 }}>
            {story.caption ? (
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>{story.caption}</Text>
            ) : null}
            <SoundChip sound={story.sound} />

            {/* poll sticker */}
            {story.stickerType === 'poll' && story.stickerData ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '800', marginBottom: 8 }}>{story.stickerData.question}</Text>
                {story.stickerData.options.map((opt, i) => {
                  const total = poll ? poll.total : 0;
                  const c = poll ? (poll.counts[i] || 0) : 0;
                  const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                  const voted = poll && poll.mine != null;
                  const mine = poll && poll.mine === i;
                  return (
                    <Pressable key={i} onPress={() => vote(i)} disabled={voted} style={{ marginBottom: 8 }}>
                      <View style={{ borderRadius: 12, borderWidth: 1.5, borderColor: mine ? C.gold : 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
                        {voted ? (
                          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', backgroundColor: mine ? 'rgba(245,179,1,0.35)' : 'rgba(255,255,255,0.18)' }} />
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11 }}>
                          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1 }}>{opt}</Text>
                          {voted ? <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{pct}%</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                {poll ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{poll.total} vote{poll.total === 1 ? '' : 's'}</Text> : null}
              </View>
            ) : null}

            {/* question sticker */}
            {story.stickerType === 'question' && story.stickerData ? (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 8 }}>❓ {story.stickerData.question}</Text>
                {!isMine ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      placeholder="Type your answer…" placeholderTextColor="rgba(255,255,255,0.55)"
                      value={reply} onChangeText={setReply}
                      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                      style={{ flex: 1, color: '#FFF', fontSize: 13.5, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 }}
                    />
                    <Pressable onPress={() => sendReply(true)} hitSlop={8}>
                      <Ionicons name={sent ? 'checkmark-circle' : 'arrow-up-circle'} size={30} color={sent ? '#10B981' : '#FFF'} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* quick-react "sticker" — one tap, lands in the owner's DMs
                as a real notification, same as a reply */}
            {!isMine && SUPABASE_READY ? (
              <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 4 }}>
                {REACT_EMOJIS.map((e) => (
                  <Pressable key={e} onPress={() => sendReaction(e)} hitSlop={6} style={{ marginRight: 10 }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: myReaction === e ? 'rgba(245,179,1,0.35)' : 'rgba(255,255,255,0.14)',
                      borderWidth: myReaction === e ? 1.5 : 0, borderColor: C.gold,
                    }}>
                      <Text style={{ fontSize: 18 }}>{e}</Text>
                    </View>
                  </Pressable>
                ))}
                {reactSent ? <Ionicons name="checkmark-circle" size={22} color="#10B981" style={{ alignSelf: 'center' }} /> : null}
              </View>
            ) : null}

            {/* ── comments, right here on the story ──────────────────
                Saved, so they're still here next time it's opened. The
                owner can switch them off and nobody can add one. */}
            {SUPABASE_READY ? (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable onPress={() => { tapLight(); setCommentsOpen((o) => !o); setPaused(!commentsOpen); }} hitSlop={8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
                      <Ionicons name="chatbubble-outline" size={15} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>
                        {comments.length ? comments.length + (comments.length === 1 ? ' comment' : ' comments') : 'Comments'}
                      </Text>
                      <Ionicons name={commentsOpen ? 'chevron-down' : 'chevron-up'} size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 5 }} />
                    </View>
                  </Pressable>

                  {/* the owner's switch for this story */}
                  {isMine ? (
                    <Pressable onPress={toggleComments} hitSlop={8} style={{ marginLeft: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: commentsOff ? 'rgba(244,63,94,0.28)' : 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Ionicons name={commentsOff ? 'lock-closed' : 'lock-open-outline'} size={14} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800', marginLeft: 5 }}>
                          {commentsOff ? 'Comments off' : 'Turn off'}
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>

                {storyErr ? (
                  <View style={{ marginTop: 8, backgroundColor: 'rgba(244,63,94,0.25)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.5)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                    <Text style={{ color: '#FFD9DF', fontSize: 12, fontWeight: '700', lineHeight: 17 }}>{storyErr}</Text>
                  </View>
                ) : null}

                {commentsOpen ? (
                  <View style={{ marginTop: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, padding: 12 }}>
                    {comments.length ? (
                      <ScrollView style={{ maxHeight: 168 }} showsVerticalScrollIndicator={false}>
                        {comments.map((c) => {
                          const canRemove = !!(user && (c.user_id === user.id || isMine));
                          return (
                            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                              <Image source={{ uri: (c.user && c.user.avatar_url) || undefined }} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>
                                  {(c.user && c.user.name) || 'Someone'}{c.user && c.user.country_flag ? ' ' + c.user.country_flag : ''}
                                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>{'  ' + timeAgo(c.created_at)}</Text>
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18, marginTop: 2 }}>{c.body}</Text>
                              </View>
                              {canRemove ? (
                                <Pressable onPress={() => removeComment(c)} hitSlop={8}>
                                  <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
                                </Pressable>
                              ) : null}
                            </View>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, paddingVertical: 6 }}>
                        {commentsOff ? 'Comments are off for this story.' : 'No comments yet — say something.'}
                      </Text>
                    )}

                    {!commentsOff ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <TextInput
                          placeholder="Add a comment…" placeholderTextColor="rgba(255,255,255,0.5)"
                          value={commentText} onChangeText={setCommentText}
                          onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                          onSubmitEditing={postComment}
                          style={{ flex: 1, color: '#FFF', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 }}
                        />
                        <Pressable onPress={postComment} hitSlop={8} disabled={commentBusy}>
                          <Ionicons name="arrow-up-circle" size={28} color={commentText.trim() ? '#FFF' : 'rgba(255,255,255,0.4)'} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* reply — always available, unless it's your own story or
                the question sticker's answer box already covers it */}
            {!isMine && story.stickerType !== 'question' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <TextInput
                  placeholder="Reply to this story…" placeholderTextColor="rgba(255,255,255,0.55)"
                  value={reply} onChangeText={setReply}
                  onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                  style={{ flex: 1, color: '#FFF', fontSize: 13.5, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, marginRight: 8 }}
                />
                <Pressable onPress={() => sendReply(false)} hitSlop={8}>
                  <Ionicons name={sent ? 'checkmark-circle' : 'send'} size={26} color={sent ? '#10B981' : '#FFF'} />
                </Pressable>
              </View>
            ) : null}

            {/* owner: real "who watched" — count pill opens the list */}
            {isMine && SUPABASE_READY && viewers ? (
              <Pressable onPress={() => setViewersOpen(true)} hitSlop={8}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
                  <Ionicons name="eye-outline" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>
                    {viewers.length} viewer{viewers.length === 1 ? '' : 's'}
                  </Text>
                  {viewers.length ? <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 6 }} /> : null}
                </View>
              </Pressable>
            ) : null}
          </LinearGradient>
        </ImageBackground>

        {/* viewers list — who watched + what they reacted with */}
        {viewersOpen ? (
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={() => setViewersOpen(false)}>
            <Pressable
              onPress={() => {}}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '62%', backgroundColor: '#161619', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, paddingBottom: insets.bottom + 16 }}
            >
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 12 }} />
              <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
                👁 {viewers ? viewers.length : 0} viewer{viewers && viewers.length === 1 ? '' : 's'}
              </Text>
              <ScrollView style={{ paddingHorizontal: 16 }}>
                {(viewers || []).length === 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, textAlign: 'center', paddingVertical: 20 }}>No one yet — check back soon</Text>
                ) : (viewers || []).map((v) => (
                  <View key={v.viewer_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
                    <Image source={{ uri: v.viewer && v.viewer.avatar_url }} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10, backgroundColor: '#333' }} />
                    <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      {(v.viewer && v.viewer.name) || 'Someone'}{v.viewer && v.viewer.country_flag ? ' ' + v.viewer.country_flag : ''}
                    </Text>
                    {v.emoji ? <Text style={{ fontSize: 16, marginRight: 8 }}>{v.emoji}</Text> : null}
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{timeAgo(v.viewed_at)}</Text>
                  </View>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
};
