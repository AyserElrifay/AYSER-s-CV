import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, FlatList, TextInput, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchComments, addComment, fetchCommentLikes, toggleCommentLike } from '../services/social';
import { useAuth } from '../context/AuthContext';
import { sfxPop, sfxStar } from '../utils/sfx';
import { tapSelection, tapLight } from '../utils/feedback';
import { Micro } from './Micro';
import { ProfileModal } from './ProfileModal';

/* Comments — real, with the full loop: reply to anyone (threads), and
   react with a ❤️ that persists. Country flags next to names. */

const toRow = (row) => ({
  id: row.id,
  parentId: row.parent_id || null,
  user: {
    name: (row.user && row.user.name) || 'Explorer',
    avatar: (row.user && row.user.avatar_url) || AV_NEUTRAL,
    flag: (row.user && row.user.country_flag) || '',
  },
  // full profile so tapping the comment opens the real account
  profile: row.user && row.user.id ? {
    id: row.user.id,
    name: row.user.name || 'Explorer',
    handle: row.user.handle ? '@' + row.user.handle : null,
    avatar: row.user.avatar_url || AV_NEUTRAL,
    verified: !!row.user.verified,
    intent: row.user.intent || null,
    bio: row.user.bio || null,
    countryFlag: row.user.country_flag || null,
  } : null,
  body: row.body,
});

/* parents first, each followed by its replies (one level, IG-style) */
const toThread = (rows) => {
  const parents = rows.filter((r) => !r.parentId);
  const byParent = {};
  rows.filter((r) => r.parentId).forEach((r) => {
    (byParent[r.parentId] = byParent[r.parentId] || []).push(r);
  });
  const out = [];
  parents.forEach((p) => {
    out.push(p);
    (byParent[p.id] || []).forEach((r) => out.push({ ...r, isReply: true }));
  });
  // replies whose parent vanished still show, un-indented
  rows.filter((r) => r.parentId && !parents.some((p) => p.id === r.parentId)).forEach((r) => out.push(r));
  return out;
};

export const CommentsSheet = ({ post, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState({});           // my hearts
  const [likeCounts, setLikeCounts] = useState({}); // crowd totals (incl. me at load)
  const [myInitialLikes, setMyInitialLikes] = useState({});
  const [replyTo, setReplyTo] = useState(null);     // { id, name }
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState(null);
  const [openProfile, setOpenProfile] = useState(null); // tapped commenter's account

  const load = useCallback(async () => {
    if (!SUPABASE_READY) { setComments([]); return; }
    try {
      const rows = (await fetchComments(post.id)).map(toRow);
      setComments(toThread(rows));
      const { counts, mine } = await fetchCommentLikes(rows.map((r) => r.id), user && user.id);
      setLikeCounts(counts);
      setMyInitialLikes(mine);
      setLikes((l) => ({ ...mine, ...l }));
    } catch (e) { setComments([]); }
  }, [post, user]);

  useEffect(() => { load(); }, [load]);

  const heart = (c) => {
    const next = !likes[c.id];
    tapLight(); if (next) sfxStar();
    setLikes((l) => ({ ...l, [c.id]: next }));
    if (SUPABASE_READY && user) toggleCommentLike(c.id, user.id, next).catch(() => {});
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    sfxPop(); tapSelection();
    const parentId = replyTo ? replyTo.id : null;
    if (SUPABASE_READY && user) {
      setSending(true);
      try {
        const row = await addComment(post.id, user.id, body, parentId);
        setSendErr(null);
        setReplyTo(null);
        const newRow = { ...toRow(row), isReply: !!parentId };
        setComments((c) => {
          if (!parentId) return [...c, newRow];
          // slot the reply right after its parent's last reply
          const out = [...c];
          let at = out.findIndex((x) => x.id === parentId);
          if (at === -1) return [...out, newRow];
          while (at + 1 < out.length && out[at + 1].isReply) at++;
          out.splice(at + 1, 0, newRow);
          return out;
        });
      } catch (e) {
        // honest failure — give the text back, say what went wrong
        setText(body);
        setSendErr((e && e.message) || 'Could not post your comment — try again.');
      } finally { setSending(false); }
    } else {
      setComments((c) => [...c, { id: 'x' + Date.now(), parentId, isReply: !!parentId, user: { name: 'You', avatar: AV_NEUTRAL, flag: '' }, body }]);
      setReplyTo(null);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
            borderWidth: 1, borderColor: C.line, maxHeight: 520,
            paddingBottom: insets.bottom + 10,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
          </View>
          <View style={{ paddingHorizontal: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Micro>Comments 💬</Micro>
            <Pressable testID="btn-close-comments" onPress={onClose}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            style={{ maxHeight: 340 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            ListEmptyComponent={
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
                No comments yet — say something nice ✨
              </Text>
            }
            renderItem={({ item }) => {
              const liked = !!likes[item.id];
              const baseLikes = Math.max(0, (likeCounts[item.id] || 0) - (myInitialLikes[item.id] ? 1 : 0));
              return (
                <View style={{ flexDirection: 'row', marginBottom: 12, marginLeft: item.isReply ? 34 : 0 }}>
                  <Pressable onPress={() => item.profile && setOpenProfile(item.profile)}>
                    <Image source={{ uri: item.user.avatar }} style={{ width: item.isReply ? 26 : 32, height: item.isReply ? 26 : 32, borderRadius: 16 }} />
                  </Pressable>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ backgroundColor: C.glass, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 10 }}>
                      <Pressable onPress={() => item.profile && setOpenProfile(item.profile)} hitSlop={4}>
                        <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>
                          {item.user.name}{item.user.flag ? ' ' + item.user.flag : ''}
                        </Text>
                      </Pressable>
                      <Text style={{ color: C.dim, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{item.body}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 6 }}>
                      <Pressable onPress={() => heart(item)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                        <Text style={{ fontSize: 12, opacity: liked ? 1 : 0.45 }}>{liked ? '❤️' : '🤍'}</Text>
                        {(baseLikes + (liked ? 1 : 0)) > 0 ? (
                          <Text style={{ color: liked ? C.coral : C.faint, fontSize: 11, fontWeight: '800', marginLeft: 3 }}>
                            {baseLikes + (liked ? 1 : 0)}
                          </Text>
                        ) : null}
                      </Pressable>
                      {!item.isReply ? (
                        <Pressable onPress={() => { tapLight(); setReplyTo({ id: item.id, name: item.user.name }); }} hitSlop={8}>
                          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800' }}>Reply</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, paddingHorizontal: 18, paddingVertical: 7 }}>
              <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '800', flex: 1 }}>↩︎ Replying to {replyTo.name}</Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}><Ionicons name="close" size={15} color={C.purple} /></Pressable>
            </View>
          ) : null}
          {sendErr ? (
            <Text style={{ color: C.coral, fontSize: 11.5, fontWeight: '700', paddingHorizontal: 18, paddingTop: 6 }}>⚠️ {sendErr}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8 }}>
            <TextInput
              placeholder={replyTo ? 'Reply to ' + replyTo.name + '…' : 'Write a comment…'}
              placeholderTextColor={C.faint}
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              returnKeyType="send"
              style={{
                flex: 1, color: C.text, fontSize: 14,
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 999, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 11 : 8,
              }}
            />
            <Pressable
              onPress={send}
              style={{
                marginLeft: 10, width: 42, height: 42, borderRadius: 21,
                backgroundColor: text.trim() ? C.green : C.glass,
                borderWidth: 1, borderColor: text.trim() ? C.green : C.line,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-up" size={19} color={text.trim() ? C.ink : C.faint} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      {openProfile ? <ProfileModal user={openProfile} onClose={() => setOpenProfile(null)} /> : null}
    </Modal>
  );
};
