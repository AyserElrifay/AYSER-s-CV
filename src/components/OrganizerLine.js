import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { tapLight } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { dropDmSend, dropDmThread, dropDmInbox } from '../services/mvp';

/* ─── A PRIVATE LINE TO THE ORGANIZER ─────────────────────────────────
   Ayser, November 2026: in a Drop's group "الناس مش باينة ولا تقدر تبعت
   غير الأورجنيزر، وممكن يبعت للأورجنيزر بريفت". A member gets one thread
   with the organizer; the organizer gets a list of who wrote and answers
   each one. Only these two ever read a thread (RUN_ME.sql drop_dms). */
const T = {
  ar: { title: 'رسالة خاصة للمنظّم', inbox: 'رسائل خاصة', empty: 'محدش بعت لسه.', first: 'اسأل المنظّم أي حاجة — الرسالة دي ليه هو بس.', ph: 'اكتب رسالتك', fail: 'ما اتبعتتش — جرّب تاني.', back: 'رجوع', waiting: 'مستني رد' },
  en: { title: 'Private message to the organizer', inbox: 'Private messages', empty: 'Nobody has written yet.', first: 'Ask the organizer anything — only they read this.', ph: 'Write your message…', fail: 'Not sent — try again.', back: 'Back', waiting: 'waiting for you' },
};
const tw = (lang, k) => (T[lang === 'ar' ? 'ar' : 'en'])[k];

const Thread = ({ offerId, memberId, lang }) => {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const scroll = useRef(null);
  const load = () => dropDmThread(offerId, memberId).then((x) => setRows(x && x.ok ? x.rows || [] : []));
  useEffect(() => { load(); const h = setInterval(load, 15000); return () => clearInterval(h); }, [offerId, memberId]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    const b = draft.trim(); if (!b || busy) return;
    tapLight(); setBusy(true); setErr(false);
    const r = await dropDmSend(offerId, memberId, b);
    setBusy(false);
    if (r && r.ok) { setDraft(''); load(); } else setErr(true);
  };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: false })} contentContainerStyle={{ padding: 16 }}>
        {rows === null ? <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} />
          : !rows.length ? <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20 }}>{tw(lang, 'first')}</Text>
            : rows.map((m) => (
              <View key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '85%', marginTop: 8, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: m.mine ? C.purple : C.glass, borderWidth: m.mine ? 0 : 1, borderColor: C.line }}>
                <Text style={{ color: m.mine ? '#FFF' : C.text, fontSize: 14.5, lineHeight: 20 }}>{m.body}</Text>
              </View>
            ))}
      </ScrollView>
      {err ? <Text style={{ color: C.coral, fontSize: 13, textAlign: 'center', marginBottom: 6 }}>{tw(lang, 'fail')}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={tw(lang, 'ph')} placeholderTextColor={C.faint} maxLength={1000} multiline
          style={{ flex: 1, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120, textAlign: lang === 'ar' ? 'right' : 'left' }} />
        <Pressable onPress={send} disabled={busy || !draft.trim()} accessibilityRole="button" accessibilityLabel="send">
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', opacity: busy || !draft.trim() ? 0.5 : 1 }}>
            {busy ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="arrow-up" size={20} color="#FFF" />}
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export const OrganizerLine = ({ offerId, isHost, lang, onClose }) => {
  useSheetBack(onClose);
  const [member, setMember] = useState(null);     // the organizer: whose thread is open
  const [inbox, setInbox] = useState(null);
  useEffect(() => {
    if (!isHost) return undefined;
    const load = () => dropDmInbox(offerId).then((x) => setInbox(x && x.ok ? x.threads || [] : []));
    load(); const h = setInterval(load, 20000); return () => clearInterval(h);
  }, [offerId, isHost]);
  const title = isHost ? (member ? member.name || '' : tw(lang, 'inbox')) : tw(lang, 'title');
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 44, direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
          {isHost && member ? (
            <Pressable onPress={() => { tapLight(); setMember(null); }} accessibilityRole="button" accessibilityLabel={tw(lang, 'back')} hitSlop={10} style={{ marginEnd: 6 }}>
              <Ionicons name={lang === 'ar' ? 'chevron-forward' : 'chevron-back'} size={24} color={C.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => { tapLight(); onClose(); }} accessibilityRole="button" accessibilityLabel="close" hitSlop={10}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginHorizontal: 10, flex: 1 }} numberOfLines={1}>{title}</Text>
          <Ionicons name="lock-closed-outline" size={16} color={C.dim} />
        </View>
        {!isHost ? <Thread offerId={offerId} memberId={null} lang={lang} />
          : member ? <Thread offerId={offerId} memberId={member.member} lang={lang} />
            : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
                {inbox === null ? <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} />
                  : !inbox.length ? <Text style={{ color: C.dim, fontSize: 14 }}>{tw(lang, 'empty')}</Text>
                    : inbox.map((t) => (
                      <Pressable key={t.member} onPress={() => { tapLight(); setMember(t); }} accessibilityRole="button"
                        style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 8, backgroundColor: C.glass }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', flex: 1 }} numberOfLines={1}>{t.name || '—'}</Text>
                          {t.waiting ? <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}>{tw(lang, 'waiting')}</Text> : null}
                        </View>
                        <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 3 }} numberOfLines={2}>{t.body}</Text>
                      </Pressable>
                    ))}
              </ScrollView>
            )}
      </View>
    </Modal>
  );
};
