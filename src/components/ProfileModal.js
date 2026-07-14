import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Dimensions, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchMyPosts } from '../services/posts';
import { getProfile } from '../services/profiles';
import { getMateStatus, mateUp, countMates } from '../services/mates';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { Glass } from './Glass';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { AvatarRing } from './AvatarRing';
import { SectionHeader } from './SectionHeader';
import { tapLight, tapSuccess } from '../utils/feedback';
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
  const { user: me } = useAuth();
  const [posts, setPosts] = useState(null);         // their real moments
  const [mates, setMates] = useState(null);         // real mate count
  const [mateState, setMateState] = useState('none'); // none|requested|incoming|mates
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSent, setMsgSent] = useState(false);
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

  const [fullProfile, setFullProfile] = useState(null); // hydrated row (hobbies, bio…)

  const load = useCallback(async () => {
    if (!real) { setPosts([]); setMates(0); return; }
    fetchMyPosts(user.id).then((rows) => setPosts(rows || [])).catch(() => setPosts([]));
    countMates(user.id).then(setMates).catch(() => setMates(0));
    getProfile(user.id).then(setFullProfile).catch(() => {});
    if (!isMe) getMateStatus(me.id, user.id).then(setMateState).catch(() => {});
  }, [user, real, isMe]);

  useEffect(() => { load(); }, [load]);

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

  const stats = [
    { n: posts == null ? '—' : posts.length, l: 'Moments' },
    { n: mates == null ? '—' : mates, l: 'Mates' },
    { n: user.campfires || 0, l: 'Campfires' },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* cover — a clean brand gradient, no fake photos */}
          <LinearGradient colors={['#7C3AED', '#5B21B6', '#2A0F63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 150 }}>
            <Pressable
              onPress={onClose}
              style={{
                position: 'absolute', top: insets.top + 10, left: 16,
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: 'rgba(0,0,0,0.35)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-down" size={20} color="#FFF" />
            </Pressable>
          </LinearGradient>

          <View style={{ paddingHorizontal: 20, marginTop: -44 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <AvatarRing uri={user.avatar} size={88} live={user.live} />
              {user.intent ? (
                <Chip label={user.intent} tint={C.purpleSoft} color={C.purple} style={{ marginBottom: 8, borderColor: 'rgba(124,58,237,0.45)' }} />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{user.name}</Text>
              {user.verified ? <Tick size={17} /> : null}
              {user.countryFlag ? <Text style={{ fontSize: 18, marginLeft: 7 }}>{user.countryFlag}</Text> : null}
            </View>
            {user.handle ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{user.handle}</Text> : null}
            {(user.bio || (fullProfile && fullProfile.bio)) ? (
              <Text style={{ color: C.text, fontSize: 14, lineHeight: 21, marginTop: 12 }}>{user.bio || fullProfile.bio}</Text>
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

            <Glass style={{ flexDirection: 'row', marginTop: 16, paddingVertical: 14 }}>
              {stats.map((s, i) => (
                <View key={s.l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.line }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{s.n}</Text>
                  <Text style={{ color: C.faint, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 }}>{s.l.toUpperCase()}</Text>
                </View>
              ))}
            </Glass>

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
            <SectionHeader title="Recent Moments" style={{ marginTop: 26 }} />
            {posts == null ? (
              <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 20 }}>Loading…</Text>
            ) : posts.length === 0 ? (
              <Glass style={{ padding: 22, alignItems: 'center' }}>
                <Text style={{ fontSize: 30 }}>🌱</Text>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 8 }}>No moments yet</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, textAlign: 'center' }}>
                  {isMe ? 'Share your first moment from Home ✨' : 'Their story starts soon — wave to say hi 👋'}
                </Text>
              </Glass>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {posts.slice(0, 12).map((p) => (
                  <View key={p.id} style={{ width: CELL, height: CELL, borderRadius: 14, margin: 4, overflow: 'hidden', backgroundColor: C.glassHi }}>
                    {p.media_url && !isVideoUri(p.media_url) ? (
                      <Image source={{ uri: p.media_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <LinearGradient colors={['#EDE9FE', '#FCE7F3']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                        <Text style={{ color: '#4C1D95', fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={4}>
                          {isVideoUri(p.media_url) ? '🎬' : ''}{p.caption || '✨'}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
