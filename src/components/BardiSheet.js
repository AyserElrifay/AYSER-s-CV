import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { askBardi, BARDI_STARTERS } from '../services/bardi';
import { bardiLocalSupported, bardiEngineReady, ensureBardiEngine, askBardiLocal, pickBardiModel } from '../services/bardiLocal';
import { tapLight, tapMedium } from '../utils/feedback';

const BARDI_ICON = require('../assets/brand/bardi.png');

/* ─── Bardi in the app — a real assistant, not a toy ──────────────────
   Two brains, the user's choice:
     · Bardi Local — Ayser's OWN model, running on-device (WebGPU). His
       chosen open weights + his persona, fully private, no API. Swappable
       for his fine-tuned Bardi-3B the moment it's published.
     · Cloud Bardi — the hosted endpoint (Claude when deployed) with a
       free fallback, for devices that can't run the on-device model. */

const LOCAL_PREF_KEY = 'mm_bardi_local';

export const BardiSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lang } = useLang();
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scroller = useRef(null);

  // ── Bardi Local (Ayser's own on-device model) ──
  const canLocal = bardiLocalSupported();
  const [localOn, setLocalOn] = useState(() => {
    try { return canLocal && typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_PREF_KEY) === '1'; }
    catch (e) { return false; }
  });
  const [dl, setDl] = useState(null);           // { pct, text } while the model downloads/compiles
  const [streaming, setStreaming] = useState(null); // partial on-device reply, streamed live
  const modelName = (pickBardiModel() || {}).name || 'on-device';

  const profile = user ? {
    name: (user.user_metadata && user.user_metadata.name) || 'friend',
    bio: (user.user_metadata && user.user_metadata.bio) || '',
  } : null;

  useEffect(() => {
    const t = setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, busy, streaming, dl]);

  const enableLocal = async () => {
    if (!canLocal) {
      setError(lang === 'ar'
        ? 'موديل باردي على الجهاز محتاج متصفح بيدعم WebGPU (Chrome أو Edge حديث على الكمبيوتر).'
        : 'Bardi on-device needs a WebGPU browser (recent Chrome/Edge on desktop).');
      return;
    }
    tapMedium();
    setError(null);
    setLocalOn(true);
    try { localStorage.setItem(LOCAL_PREF_KEY, '1'); } catch (e) {}
    if (!bardiEngineReady().ready) {
      setDl({ pct: 0, text: lang === 'ar' ? 'بيبدأ التحميل…' : 'Starting…' });
      try {
        await ensureBardiEngine(({ text, progress }) => setDl({ pct: Math.round((progress || 0) * 100), text }));
      } catch (e) {
        setError(lang === 'ar'
          ? 'مقدرتش أحمّل موديل باردي على الجهاز — اتأكد إن المتصفح بيدعم WebGPU.'
          : 'Could not load Bardi on-device — check WebGPU support.');
        setLocalOn(false);
        try { localStorage.setItem(LOCAL_PREF_KEY, '0'); } catch (e2) {}
      } finally { setDl(null); }
    }
  };
  const disableLocal = () => {
    tapLight();
    setLocalOn(false);
    try { localStorage.setItem(LOCAL_PREF_KEY, '0'); } catch (e) {}
  };

  const send = async (text) => {
    const content = (text != null ? text : input).trim();
    if (!content || busy) return;
    tapMedium();
    setInput('');
    setError(null);
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setBusy(true);

    // 1) Bardi Local — Ayser's own model, on-device. Privacy-first: when
    //    it's on, we use ONLY it and never silently route to the cloud.
    if (localOn && canLocal) {
      try {
        const final = await askBardiLocal(
          next,
          { language: lang || 'ar', profile, onProgress: ({ text: t, progress }) => setDl({ pct: Math.round((progress || 0) * 100), text: t }) },
          (full) => setStreaming(full),
        );
        setDl(null); setStreaming(null);
        if (final) {
          setMessages((m) => [...m, { role: 'assistant', content: final }]);
        } else {
          setError(lang === 'ar' ? 'موديل باردي رجّع رد فاضي — دوس حاول تاني.' : 'Bardi returned an empty reply — tap Try again.');
        }
      } catch (e) {
        setDl(null); setStreaming(null);
        setError(lang === 'ar' ? 'موديل باردي وقف لحظة على الجهاز — دوس حاول تاني.' : 'Bardi (on-device) hiccuped — tap Try again.');
      }
      setBusy(false);
      return;
    }

    // 2) Cloud Bardi — hosted endpoint → free fallback, with one auto-retry.
    let reply = null;
    for (let attempt = 0; attempt < 2 && !reply; attempt++) {
      try {
        reply = await askBardi(next, { language: lang || 'en', profile, userId: user && user.id });
      } catch (e) {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
      }
    }
    if (reply) {
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } else {
      setError(lang === 'ar'
        ? 'باردي مزحوم دلوقتي 🌱 — استنى ثانية ودوس "حاول تاني".'
        : 'Bardi is busy right now 🌱 — wait a second and tap "Try again".');
    }
    setBusy(false);
  };

  // resend the last user message (the error banner's "Try again")
  const retryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || busy) return;
    setError(null);
    setMessages((m) => {
      const copy = [...m];
      if (copy.length && copy[copy.length - 1].role === 'user') copy.pop();
      return copy;
    });
    setTimeout(() => send(lastUser.content), 30);
  };

  const empty = messages.length === 0;
  const brainLabel = localOn
    ? (lang === 'ar' ? 'موديل باردي · على جهازك · خاص 100%' : 'Bardi model · on your device · fully private')
    : (lang === 'ar' ? 'باردي السحابي' : 'Cloud Bardi');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,8,24,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', paddingBottom: insets.bottom + 8 }}>
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Image source={BARDI_ICON} style={{ width: 36, height: 36, borderRadius: 11, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Bardi</Text>
                <Text style={{ color: localOn ? C.green : C.dim, fontSize: 11.5, fontWeight: localOn ? '800' : '400' }}>{brainLabel}</Text>
              </View>
              <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="close" size={24} color={C.dim} /></Pressable>
            </View>

            {/* Bardi Local switch — Ayser's own on-device model */}
            <Pressable onPress={localOn ? disableLocal : enableLocal} disabled={!!dl}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, backgroundColor: localOn ? C.greenSoft : C.bg, borderWidth: 1, borderColor: localOn ? 'rgba(16,185,129,0.4)' : C.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 }}>
                <Ionicons name={localOn ? 'hardware-chip' : 'hardware-chip-outline'} size={18} color={localOn ? C.green : C.dim} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900' }}>
                    {lang === 'ar' ? 'موديل باردي على جهازك' : 'Bardi model on your device'}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 1 }}>
                    {canLocal
                      ? (lang === 'ar' ? `${modelName} · بيتحمّل مرة واحدة · بعدها بيشتغل من غير نت وخاص تمامًا` : `${modelName} · one-time download · then offline & fully private`)
                      : (lang === 'ar' ? 'محتاج متصفح بيدعم WebGPU (Chrome/Edge على كمبيوتر)' : 'Needs a WebGPU browser (Chrome/Edge on desktop)')}
                  </Text>
                </View>
                <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: localOn ? C.green : C.glassHi, padding: 3, justifyContent: 'center' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', marginLeft: localOn ? 18 : 0 }} />
                </View>
              </View>
            </Pressable>

            {/* download / compile progress */}
            {dl ? (
              <View style={{ marginHorizontal: 16, marginTop: 8 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: C.glassHi, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: (dl.pct || 0) + '%', backgroundColor: C.purple }} />
                </View>
                <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 4 }} numberOfLines={1}>
                  {(dl.pct || 0)}% · {dl.text || (lang === 'ar' ? 'بيجهّز موديل باردي…' : 'Preparing Bardi…')}
                </Text>
              </View>
            ) : null}

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

              {/* live on-device stream */}
              {streaming != null ? (
                <View style={{ alignSelf: 'flex-start', maxWidth: '86%', marginBottom: 10 }}>
                  <View style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21 }}>{streaming || '…'}▌</Text>
                  </View>
                </View>
              ) : null}

              {busy && streaming == null ? (
                <View style={{ alignSelf: 'flex-start', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10 }}>
                  <ActivityIndicator size="small" color={C.purple} />
                </View>
              ) : null}

              {error ? (
                <View style={{ backgroundColor: C.coralSoft, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 19, flex: 1 }}>{error}</Text>
                  <Pressable onPress={retryLast} disabled={busy} hitSlop={8} style={{ marginLeft: 10 }}>
                    <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{lang === 'ar' ? 'حاول تاني' : 'Try again'}</Text>
                    </View>
                  </Pressable>
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
