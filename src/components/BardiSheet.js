import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { askBardi, BARDI_STARTERS } from '../services/bardi';
import { tapLight, tapMedium } from '../utils/feedback';

/* ─── Bardi in the app — a real assistant, not a toy ──────────────────
   A clean chat sheet that talks to the 'bardi-chat' Edge Function. It
   helps people understand themselves, plan trips and start projects.
   Honest failure: if Bardi isn't deployed yet, it says so plainly with
   the one command needed to turn it on — it never fakes a reply. */

export const BardiSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lang } = useLang();
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scroller = useRef(null);

  const profile = user ? {
    name: (user.user_metadata && user.user_metadata.name) || 'friend',
    bio: (user.user_metadata && user.user_metadata.bio) || '',
  } : null;

  useEffect(() => {
    const t = setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, busy]);

  const send = async (text) => {
    const content = (text != null ? text : input).trim();
    if (!content || busy) return;
    tapMedium();
    setInput('');
    setError(null);
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setBusy(true);
    try {
      const reply = await askBardi(next, { language: lang || 'en', profile });
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError('Couldn\'t reach Bardi just now — check your connection and try again. 🌱');
    } finally {
      setBusy(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,8,24,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', paddingBottom: insets.bottom + 8 }}>
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <MaterialCommunityIcons name="star-four-points" size={18} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Bardi</Text>
                <Text style={{ color: C.dim, fontSize: 11.5 }}>Your AI — here to help you grow</Text>
              </View>
              <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="close" size={24} color={C.dim} /></Pressable>
            </View>

            <ScrollView ref={scroller} style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingVertical: 14 }} keyboardShouldPersistTaps="handled">
              {empty ? (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>Hey{profile ? ' ' + profile.name : ''} 👋</Text>
                  <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginBottom: 16 }}>I'm Bardi. Tell me what's on your mind, or start with one of these:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {BARDI_STARTERS.map((s) => (
                      <Pressable key={s.id} onPress={() => send(s.prompt)} style={{ marginRight: 8, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 }}>
                          <Text style={{ fontSize: 15, marginRight: 6 }}>{s.emoji}</Text>
                          <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{s.title}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {messages.map((m, i) => (
                <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%', marginBottom: 10 }}>
                  <View style={{ backgroundColor: m.role === 'user' ? C.purple : C.bg, borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ color: m.role === 'user' ? '#FFF' : C.text, fontSize: 14.5, lineHeight: 21 }}>{m.content}</Text>
                  </View>
                </View>
              ))}

              {busy ? (
                <View style={{ alignSelf: 'flex-start', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10 }}>
                  <ActivityIndicator size="small" color={C.purple} />
                </View>
              ) : null}

              {error ? (
                <View style={{ backgroundColor: C.coralSoft, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                  <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 19 }}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* input */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingTop: 8 }}>
              <View style={{ flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 11 : 4, marginRight: 9, maxHeight: 120 }}>
                <TextInput
                  placeholder="Ask Bardi anything…"
                  placeholderTextColor={C.faint}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => send()}
                  multiline
                  style={{ color: C.text, fontSize: 14.5 }}
                />
              </View>
              <Pressable onPress={() => send()} disabled={busy || !input.trim()}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() && !busy ? C.purple : C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up" size={20} color={input.trim() && !busy ? '#FFF' : C.faint} />
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
