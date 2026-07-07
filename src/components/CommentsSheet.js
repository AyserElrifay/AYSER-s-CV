import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, FlatList, TextInput, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchComments, addComment } from '../services/social';
import { useAuth } from '../context/AuthContext';
import { Micro } from './Micro';

/* Bottom sheet of what people wrote under a post. One list, one input —
   nothing else. Demo mode keeps comments in local state. */

const SEED = (post) => [
  { id: 'c1', user: { name: 'Nour El-Sayed', avatar: av(47) }, body: 'Count me in! 🙌' },
  { id: 'c2', user: { name: 'Omar Farouk', avatar: av(15) }, body: 'This is exactly my vibe. See you at ' + post.place + '?' },
];

const toRow = (row) => ({
  id: row.id,
  user: {
    name: (row.user && row.user.name) || 'Explorer',
    avatar: (row.user && row.user.avatar_url) || av(60),
  },
  body: row.body,
});

export const CommentsSheet = ({ post, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!SUPABASE_READY) { setComments(SEED(post)); return; }
    try {
      const rows = await fetchComments(post.id);
      setComments(rows.map(toRow));
    } catch (e) { setComments([]); }
  }, [post]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    if (SUPABASE_READY && user) {
      setSending(true);
      try {
        const row = await addComment(post.id, user.id, body);
        setComments((c) => [...c, toRow(row)]);
      } catch (e) {
        setComments((c) => [...c, { id: 'x' + Date.now(), user: { name: 'You', avatar: av(60) }, body }]);
      } finally { setSending(false); }
    } else {
      setComments((c) => [...c, { id: 'x' + Date.now(), user: { name: 'You', avatar: av(60) }, body }]);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
            borderWidth: 1, borderColor: C.line, maxHeight: 480,
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
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            ListEmptyComponent={
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
                No comments yet — say something nice ✨
              </Text>
            }
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                <Image source={{ uri: item.user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                <View style={{ flex: 1, marginLeft: 10, backgroundColor: C.glass, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 10 }}>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>{item.user.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{item.body}</Text>
                </View>
              </View>
            )}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8 }}>
            <TextInput
              placeholder="Write a comment…"
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
    </Modal>
  );
};
