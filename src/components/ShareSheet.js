import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fetchMyDmThreads, sendMessage } from '../services/messages';
import { shareOut } from '../lib/shareLink';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── SEND THIS TO SOMEBODY ──────────────────────────────────────────
   Ayser: "Make that we can share the group link to moments chat and
   even out side the app".

   Both, from one sheet, because they are the same intention. Somebody
   who wants to show a group to a friend does not first decide which
   messaging app the friend uses — they decide they want to show it.

   ── WHY THE CHATS ARE IN THE SAME SHEET AS THE SHARE BUTTON ───────
   The alternative is what most apps do: a system share sheet with your
   own app buried among thirty icons, or a separate "send to" screen.
   Both put a decision in front of the thing you were trying to do. Your
   own conversations are right here and one tap sends it; everything
   else is one more tap below them.

   Nothing is sent silently: the row says "Sent" once it really has, and
   goes back to normal if it did not, because a message you think you
   sent and did not is worse than one that plainly failed. */

const Avatar = ({ uri, name }) => (
  uri
    ? <Image source={{ uri }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.line }} />
    : (
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.dim, fontSize: 15, fontWeight: '900' }}>
          {String(name || '?').trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    )
);

export const ShareSheet = ({ url, message, onClose }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [threads, setThreads] = useState(null);   // null = still asking
  const [sent, setSent] = useState({});           // threadId -> 'busy' | 'done'
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!user) { setThreads([]); return () => {}; }
    fetchMyDmThreads(user.id)
      .then((r) => alive && setThreads(r || []))
      .catch(() => alive && setThreads([]));
    return () => { alive = false; };
  }, [user]);

  const body = (message ? message + '\n' : '') + url;

  const sendTo = async (d) => {
    if (!user || sent[d.threadId]) return;
    tapLight();
    setSent((s) => ({ ...s, [d.threadId]: 'busy' }));
    try {
      await sendMessage({ dmThreadId: d.threadId, userId: user.id, body });
      setSent((s) => ({ ...s, [d.threadId]: 'done' }));
      tapSuccess();
    } catch (e) {
      /* Put the row back. Saying "Sent" for a message that never left is
         the one thing this sheet must never do. */
      setSent((s) => { const n = { ...s }; delete n[d.threadId]; return n; });
    }
  };

  const outside = async () => {
    tapLight();
    const how = await shareOut(url, message);
    if (how === 'cancelled') return;
    setOutcome(how === 'copied' ? t('sh_copied') : how === 'manual' ? url : null);
    if (how === 'shared') onClose && onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 18, maxHeight: '82%',
      }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{t('sh_title')}</Text>
        <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3, marginBottom: 14 }} numberOfLines={1}>{url}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {threads === null ? (
            <ActivityIndicator color={C.gold} style={{ marginVertical: 18 }} />
          ) : threads.length ? (
            <>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
                {t('sh_in_moments')}
              </Text>
              {threads.map((d) => {
                const state = sent[d.threadId];
                return (
                  <Pressable key={d.threadId} onPress={() => sendTo(d)}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass,
                      borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 11, marginBottom: 9,
                    }}>
                      <Avatar uri={d.user.avatar_url} name={d.user.name} />
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', flex: 1, marginStart: 11 }} numberOfLines={1}>
                        {d.user.name}
                      </Text>
                      {state === 'busy' ? <ActivityIndicator size="small" color={C.faint} />
                        : state === 'done' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle" size={17} color={C.green} />
                            <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', marginStart: 5 }}>{t('sh_sent')}</Text>
                          </View>
                        ) : (
                          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900' }}>{t('sh_send')}</Text>
                        )}
                    </View>
                  </Pressable>
                );
              })}
            </>
          ) : (
            <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
              {t('sh_no_chats')}
            </Text>
          )}

          <Pressable onPress={outside} style={{ marginTop: 6 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.text, borderRadius: 14, paddingVertical: 13,
            }}>
              <Ionicons name="share-outline" size={18} color={C.bg} />
              <Text style={{ color: C.bg, fontSize: 14, fontWeight: '900', marginStart: 8 }}>{t('sh_outside')}</Text>
            </View>
          </Pressable>

          {outcome ? (
            <Text selectable style={{ color: C.faint, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{outcome}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
