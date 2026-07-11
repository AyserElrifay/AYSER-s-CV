import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { av, USERS } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getOrCreateDmThread, fetchMessages, sendMessage, subscribeMessages } from '../services/messages';
import { TruthOrDare } from '../components/TruthOrDare';
import { WouldYouRather } from '../components/WouldYouRather';
import { CallScreen } from '../components/CallScreen';
import { tapLight, tapMedium } from '../utils/feedback';
import { sfxPop } from '../utils/sfx';

/* ─── A conversation — kept deliberately simple and warm, the kind of
   place you want to hang out in. Call & video in the header, and games
   (Truth or Dare) you can drop in and pull out anytime. ─── */

const SEED = (peer, group) => group
  ? [
      { id: 'm1', from: USERS.nour, text: 'okay who’s actually awake for the 5AM hike 🥱' },
      { id: 'm2', from: USERS.omar, text: 'me. bringing the flask ☕' },
      { id: 'm3', from: 'me', text: 'save me a seat, I’m 5 min out' },
      { id: 'm4', from: USERS.zeyad, text: 'someone start a truth or dare I’m bored 😂' },
    ]
  : [
      { id: 'm1', from: peer, text: 'yooo you saw the rooftop moment? 🌇' },
      { id: 'm2', from: 'me', text: 'just starred it 😍 who shot that?' },
      { id: 'm3', from: peer, text: 'malak! she’s hosting again friday' },
      { id: 'm4', from: 'me', text: 'say less. we’re going 🔥' },
    ];

export const ChatThread = ({ chat, group, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const peer = group ? null : chat.user;
  const title = group ? chat.name : peer.name;
  const avatarUri = group ? null : peer.avatar;
  const players = group
    ? [USERS.nour, USERS.omar, USERS.zeyad, { id: 'me', name: 'You', avatar: av(5) }]
    : [peer, { id: 'me', name: 'You', avatar: av(5) }];

  // Real only when the peer/squad is backed by a real uuid — a mock
  // demo row (fake id like 's1') never touches the real database.
  const REAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isReal = SUPABASE_READY && !!user && (group ? REAL_ID.test(chat.id || '') : REAL_ID.test((peer && peer.id) || ''));

  const [msgs, setMsgs] = useState(() => (isReal ? [] : SEED(peer, group)));
  const [dmThreadId, setDmThreadId] = useState((!group && chat.threadId) || null);
  const [draft, setDraft] = useState('');
  const [todOn, setTodOn] = useState(false);
  const [wyrOn, setWyrOn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [call, setCall] = useState(null); // {video:bool}
  const scroller = useRef(null);

  const toLocal = (row) => ({
    id: row.id,
    from: row.user_id === user.id
      ? 'me'
      : { name: (row.user && row.user.name) || (peer && peer.name) || 'Someone', avatar: (row.user && row.user.avatar_url) || (peer && peer.avatar) || av(60) },
    text: row.body,
  });

  useEffect(() => {
    if (!isReal) return;
    let unsub = null;
    let cancelled = false;
    (async () => {
      const squadId = group ? chat.id : null;
      let threadId = dmThreadId;
      if (!group && !threadId) {
        threadId = await getOrCreateDmThread(peer.id).catch(() => null);
        if (cancelled) return;
        setDmThreadId(threadId);
      }
      if (!squadId && !threadId) return;
      const rows = await fetchMessages({ squadId, dmThreadId: threadId }).catch(() => []);
      if (cancelled) return;
      setMsgs((rows || []).map(toLocal));
      setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: false }), 60);
      unsub = subscribeMessages({ squadId, dmThreadId: threadId }, (payload) => {
        const row = payload.new;
        setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, toLocal(row)]));
        setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 60);
      });
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    const t = draft.trim();
    if (!t) return;
    tapLight(); sfxPop();
    setDraft('');
    if (isReal) {
      const squadId = group ? chat.id : null;
      if (!squadId && !dmThreadId) return;
      try {
        const row = await sendMessage({ squadId, dmThreadId, userId: user.id, body: t });
        setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, { id: row.id, from: 'me', text: t }]));
      } catch (e) {}
    } else {
      setMsgs((m) => [...m, { id: 'x' + Date.now(), from: 'me', text: t }]);
    }
    setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 60);
  };

  const callPeer = group ? { name: chat.name, avatar: chat.members ? chat.members[0] : av(12) } : peer;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#FFF' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10} style={{ marginRight: 4 }}>
            <Ionicons name="chevron-back" size={28} color={C.text} />
          </Pressable>
          {group ? (
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{chat.emoji}</Text>
            </View>
          ) : (
            <Image source={{ uri: avatarUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
            <Text style={{ color: C.green, fontSize: 11.5, marginTop: 1 }}>{group ? (chat.members ? chat.members.length + ' mates · active now' : 'active now') : 'Active now'}</Text>
          </View>
          <Pressable onPress={() => { tapMedium(); setCall({ video: false }); }} hitSlop={8} style={{ marginHorizontal: 10 }}>
            <Ionicons name="call-outline" size={23} color={C.purple} />
          </Pressable>
          <Pressable onPress={() => { tapMedium(); setCall({ video: true }); }} hitSlop={8}>
            <Ionicons name="videocam-outline" size={25} color={C.purple} />
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {msgs.map((m) => {
              const mine = m.from === 'me';
              return (
                <View key={m.id} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10, alignItems: 'flex-end' }}>
                  {!mine && group ? <Image source={{ uri: m.from.avatar }} style={{ width: 26, height: 26, borderRadius: 13, marginRight: 7 }} /> : null}
                  <View style={{ maxWidth: '76%' }}>
                    {!mine && group ? <Text style={{ color: C.faint, fontSize: 10.5, marginBottom: 3, marginLeft: 4 }}>{m.from.name}</Text> : null}
                    <View style={{ backgroundColor: mine ? C.purple : '#FFF', borderWidth: mine ? 0 : 1, borderColor: C.line, borderRadius: 18, borderBottomRightRadius: mine ? 5 : 18, borderBottomLeftRadius: mine ? 18 : 5, paddingHorizontal: 14, paddingVertical: 9 }}>
                      <Text style={{ color: mine ? '#FFF' : C.text, fontSize: 14.5, lineHeight: 20 }}>{m.text}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {todOn ? <TruthOrDare players={players} onRemove={() => setTodOn(false)} /> : null}
            {wyrOn ? <WouldYouRather onRemove={() => setWyrOn(false)} /> : null}
          </ScrollView>

          {/* games menu */}
          {menu ? (
            <View style={{ position: 'absolute', bottom: 70, left: 12, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
              <Pressable onPress={() => { tapLight(); setMenu(false); setTodOn(true); setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 }}>
                  <Text style={{ fontSize: 20 }}>🎲</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Truth or Dare</Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>Play it right here</Text>
                  </View>
                </View>
              </Pressable>
              <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 10 }} />
              <Pressable onPress={() => { tapLight(); setMenu(false); setWyrOn(true); setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 }}>
                  <Text style={{ fontSize: 20 }}>🤔</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Would You Rather</Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>Pick a side, see the split</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* input bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#FFF' }}>
            <Pressable onPress={() => { tapLight(); setMenu((v) => !v); }} hitSlop={8} style={{ marginRight: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: menu ? C.purple : C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={menu ? 'close' : 'game-controller'} size={19} color={menu ? '#FFF' : C.purple} />
              </View>
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 22, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 3 }}>
              <TextInput
                placeholder="Message…"
                placeholderTextColor={C.faint}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={send}
                style={{ flex: 1, color: C.text, fontSize: 14.5 }}
              />
              <Ionicons name="happy-outline" size={20} color={C.faint} />
            </View>
            <Pressable onPress={send} hitSlop={8} style={{ marginLeft: 8 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="send" size={17} color="#FFF" style={{ marginLeft: -1 }} />
              </View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      {call ? <CallScreen peer={callPeer} video={call.video} onClose={() => setCall(null)} /> : null}
    </Modal>
  );
};
