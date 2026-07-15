import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ImageBackground, Animated, Image, Dimensions, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SoundChip } from './SoundChip';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { deleteStory, castPollVote, fetchPollResults } from '../services/stories';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

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
export const StoryViewer = ({ stories, startIndex = 0, onClose, onShare, onDeleted }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [poll, setPoll] = useState(null); // { counts:[a,b], mine, total }
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);
  const story = stories[index];
  const isMine = !!(user && story && story.user && story.user.id === user.id);

  useEffect(() => {
    setConfirmDel(false); setReply(''); setSent(false); setPoll(null);
    if (story && story.stickerType === 'poll' && SUPABASE_READY) {
      fetchPollResults(story.id, user && user.id).then(setPoll).catch(() => {});
    }
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    progress.setValue(0);
    if (paused) return undefined;
    anim.current = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (finished) {
        if (index < stories.length - 1) setIndex(index + 1);
        else onClose();
      }
    });
    return () => anim.current && anim.current.stop();
  }, [index, paused, progress, stories.length, onClose]);

  if (!story) return null;

  const go = (dir) => {
    const next = index + dir;
    if (next < 0 || next >= stories.length) { onClose(); return; }
    setIndex(next);
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
      const threadId = await getOrCreateDmThread(story.user.id);
      const prefix = asAnswer && story.stickerData && story.stickerData.question
        ? 'Answered "' + story.stickerData.question + '": '
        : 'Replied to your story: ';
      await sendMessage({ dmThreadId: threadId, userId: user.id, body: prefix + body });
      setReply('');
      setSent(true);
      setTimeout(() => setSent(false), 1600);
    } catch (e) {}
  };

  const doDelete = async () => {
    if (!isMine) return;
    tapLight();
    if (SUPABASE_READY && user) { try { await deleteStory(story.id, user.id); } catch (e) {} }
    onDeleted && onDeleted(story.id);
    if (stories.length <= 1) onClose();
    else go(index < stories.length - 1 ? 1 : -1);
  };

  const left = hoursLeft(story.createdAt);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* the story's REAL song — plays while you watch (web) */}
        {Platform.OS === 'web' && story.sound && story.sound.audio_url ? (
          <audio key={story.sound.audio_url + index} src={story.sound.audio_url} autoPlay loop style={{ display: 'none' }} />
        ) : null}
        <ImageBackground source={{ uri: story.media }} style={{ flex: 1 }} resizeMode="cover">
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 30 }}>
            {/* progress bars */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {stories.map((_, i) => (
                <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, overflow: 'hidden' }}>
                  <Animated.View
                    style={{
                      height: 3, backgroundColor: '#FFF',
                      width: i < index ? '100%' : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
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
              {isMine ? (
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
          </LinearGradient>
        </ImageBackground>
      </View>
    </Modal>
  );
};
