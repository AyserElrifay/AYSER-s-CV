import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { topicCircles, createTopicCircle, joinCircle, lastFix } from '../services/squadAdmin';
import { openChat } from '../lib/chatBus';
import { kept, keep } from '../lib/kept';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── GROUP CHATS ON ONE TOPIC ─────────────────────────────────────────
   Friends, self-development, languages: the open group chats on that
   topic (topic_circles in RUN_ME.sql), nearest first when we know where
   you are, with how many are in each — never who. Join opens the chat.
   None yet: start the first one, with a name already written. For
   languages there is also the one-to-one way, language partners. */
export const TOPICS = {
  friends: { emoji: '🤝' },
  growth: { emoji: '🌱' },
  language: { emoji: '🗣️' },
};

export const TopicCircles = ({ topic, onClose, onPartners }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const at = lastFix();
  const K = 'topic.' + topic;
  const [list, setList] = useState(() => kept(K));
  const [busy, setBusy] = useState(null);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const load = () => topicCircles(topic, at).then((r) => setList(keep(K, r)));
  useEffect(() => { load(); }, [topic]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (c) => { onClose(); openChat({ id: c.id, name: c.name, emoji: c.emoji || TOPICS[topic].emoji }); };
  const join = async (c) => {
    if (busy) return;
    tapLight(); setBusy(c.id);
    const r = c.mine ? { ok: true } : await joinCircle(c.id);
    setBusy(null);
    if (r && r.ok) { tapSuccess(); open(c); } else setErr(t('gc_failed'));
  };
  const start = async () => {
    const n = (name || t('tc_default_' + topic)).trim();
    if (busy) return;
    tapLight(); setBusy('new'); setErr(null);
    const r = await createTopicCircle(topic, n, t('tc_about_' + topic), at);
    setBusy(null);
    if (r && r.ok) { tapSuccess(); open({ id: r.id, name: n }); }
    else setErr(t(r && r.reason === 'too_many' ? 'tc_too_many' : 'gc_failed'));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: insets.bottom + 20, maxHeight: '86%' }}>
        <View style={{ alignItems: 'center', marginTop: -6, marginBottom: 6 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{TOPICS[topic].emoji + ' ' + t('tc_title_' + topic)}</Text>
        <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>{t('tc_sub_' + topic)}</Text>

        {topic === 'language' && onPartners ? (
          <Pressable onPress={() => { tapLight(); onPartners(); }} accessibilityRole="button" style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 }}>
              <Text style={{ fontSize: 20, marginEnd: 10 }}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('tc_partners')}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{t('tc_partners_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={C.dim} />
            </View>
          </Pressable>
        ) : null}

        <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
          {list == null ? <ActivityIndicator color={C.dim} style={{ marginVertical: 20 }} />
            : !list.length ? <Text style={{ color: C.dim, fontSize: 14, marginVertical: 8 }}>{t('tc_none')}</Text>
            : list.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{c.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                    {[t('gc_members_n').replace('{n}', String(c.members)), c.km != null ? c.km + ' km' : t('tc_online'), c.place_name].filter(Boolean).join(' · ')}
                  </Text>
                  {c.about ? <Text style={{ color: C.text, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{c.about}</Text> : null}
                </View>
                <Pressable onPress={() => join(c)} accessibilityRole="button" style={{ marginStart: 10 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: c.mine ? 'transparent' : C.purple, borderWidth: 1, borderColor: c.mine ? C.line : C.purple, opacity: busy === c.id ? 0.6 : 1 }}>
                    <Text style={{ color: c.mine ? C.text : '#FFF', fontSize: 13, fontWeight: '900' }}>{c.mine ? t('ci_open') : t('ci_join')}</Text>
                  </View>
                </Pressable>
              </View>
            ))}

          {making ? (
            <View style={{ marginTop: 8 }}>
              <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={t('tc_default_' + topic)} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 }} />
              <Pressable onPress={start} accessibilityRole="button" style={{ marginTop: 10 }}>
                <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.purple, opacity: busy === 'new' ? 0.6 : 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('tc_start')}</Text>
                </View>
              </Pressable>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{at ? t('tc_where_near') : t('tc_where_online')}</Text>
            </View>
          ) : (
            <Pressable onPress={() => { tapLight(); setMaking(true); }} accessibilityRole="button" style={{ marginTop: 8 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.purple }}>
                <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{'＋ ' + t('tc_start_new')}</Text>
              </View>
            </Pressable>
          )}
          {err ? <Text style={{ color: '#E11D48', fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
