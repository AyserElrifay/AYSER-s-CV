import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { askBardi, BARDI_STARTERS } from '../services/bardi';
import { bardiLocalSupported, bardiEngineReady, ensureBardiEngine, askBardiLocal, pickBardiModel } from '../services/bardiLocal';
import { clearMyBardiMemory } from '../services/bardiOwner';
import { loadChats, saveChats, newChat, chatTitle, clearAllChats } from '../services/bardiChat';
import { isOwner } from '../services/music';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

const BARDI_ICON = require('../assets/brand/bardi.png');
const MEMORY_PREF_KEY = 'mm_bardi_remember';

/* ─── Bardi in the app — a real assistant, not a toy ──────────────────
   Two brains, the user's choice:
     · Bardi Local — Ayser's OWN model, running on-device (WebGPU). His
       chosen open weights + his persona, fully private, no API. Swappable
       for his fine-tuned Bardi-3B the moment it's published.
     · Cloud Bardi — the hosted endpoint (Claude when deployed) with a
       free fallback, for devices that can't run the on-device model. */

const LOCAL_PREF_KEY = 'mm_bardi_local';

/* ─── THE CONVERSATION ────────────────────────────────────────────────
   Every bubble used to be rebuilt each time the sheet rendered — and
   the sheet renders on every letter you type, because the composer's
   text lives in it. So a long conversation was re-laid-out character by
   character while you were still writing the next question, which is
   the worst possible moment to be busy.

   The list only depends on the messages, so it is memoised on them. Type
   as long a question as you like; the thread above it does nothing. */
const Bubbles = React.memo(({ messages }) => (
  <>
    {messages.map((m, i) => (
      <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%', marginBottom: 10 }}>
        <View style={{ backgroundColor: m.role === 'user' ? C.purple : C.bg, borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text selectable style={{ color: m.role === 'user' ? '#FFF' : C.text, fontSize: 14.5, lineHeight: 21 }}>{m.content}</Text>
        </View>
      </View>
    ))}
  </>
));

export const BardiSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { user } = useAuth();
  const { lang } = useLang();
  /* ── THE CONVERSATION SURVIVES THE SHEET ──────────────────────────
     This used to be state and nothing else, so closing Bardi threw away
     everything you had said to him — you came back to a blank screen
     every time. It is loaded on the way in and kept on the way out.
     See src/services/bardiChat.js. */
  const [messages, setMessages] = useState([]); // { role, content }
  const [loaded, setLoaded] = useState(false);
  /* ── ROOM TO THINK, AND SOMEWHERE THINGS GO ───────────────────────
     A half-height sheet is fine for one question and cramped for a
     conversation, so it opens out to the full screen. And starting a
     new chat puts the old one away instead of destroying it — past
     chats are a list you can open, and a bin you can empty. */
  const [full, setFull] = useState(false);
  const [chats, setChats] = useState([]);        // every past conversation
  const [chatId, setChatId] = useState(null);    // the one on screen
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scroller = useRef(null);

  useEffect(() => {
    let alive = true;
    loadChats(user && user.id)
      .then((rows) => {
        if (!alive) return;
        const list = rows || [];
        setChats(list);
        const open = list[0];
        setChatId(open ? open.id : null);
        setMessages(open ? open.messages : []);
        setLoaded(true);
      })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [user && user.id]);

  // never save over a real thread with the empty one we start out holding
  useEffect(() => {
    if (!loaded) return;
    const id = chatId || (messages.length ? newChat().id : null);
    if (!id) { saveChats(user && user.id, chats); return; }
    if (!chatId && messages.length) setChatId(id);
    const rest = chats.filter((c) => c.id !== id);
    const mine = { id, title: chatTitle(messages), messages, at: Date.now() };
    const next = messages.length ? [mine].concat(rest) : rest;
    setChats(next);
    saveChats(user && user.id, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loaded, user && user.id]);

  const startNewChat = () => {
    tapLight();
    setMessages([]);
    setChatId(null);
    setError(null);
    setHistoryOpen(false);
  };

  const openChat = (c) => {
    tapLight();
    setChatId(c.id);
    setMessages(c.messages || []);
    setError(null);
    setHistoryOpen(false);
  };

  const dropChat = (c) => {
    tapLight();
    const next = chats.filter((x) => x.id !== c.id);
    setChats(next);
    saveChats(user && user.id, next);
    if (c.id === chatId) { setChatId(null); setMessages([]); }
  };

  const wipeEverything = async () => {
    tapSuccess();
    setChats([]); setChatId(null); setMessages([]); setConfirmWipe(false); setHistoryOpen(false);
    await clearAllChats(user && user.id);
  };

  // ── Bardi Local (Ayser's own on-device model) ──
  const canLocal = bardiLocalSupported();
  const [localOn, setLocalOn] = useState(() => {
    try { return canLocal && typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_PREF_KEY) === '1'; }
    catch (e) { return false; }
  });
  const [dl, setDl] = useState(null);           // { pct, text } while the model downloads/compiles
  const [streaming, setStreaming] = useState(null); // partial on-device reply, streamed live
  const modelName = (pickBardiModel() || {}).name || 'on-device';

  // ── memory: Bardi remembering this user (their own chats). Opt-out. ──
  const [remember, setRemember] = useState(() => {
    try { return !(typeof localStorage !== 'undefined' && localStorage.getItem(MEMORY_PREF_KEY) === '0'); }
    catch (e) { return true; }
  });
  const [forgot, setForgot] = useState(false);
  const toggleRemember = () => {
    tapLight();
    const next = !remember;
    setRemember(next);
    try { localStorage.setItem(MEMORY_PREF_KEY, next ? '1' : '0'); } catch (e) {}
  };
  const forgetMe = async () => {
    tapSuccess();
    setForgot(true);
    setTimeout(() => setForgot(false), 1600);
    if (user) { try { await clearMyBardiMemory(user.id); } catch (e) {} }
  };

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

  /* ── A WAY OUT OF A LONG WAIT ─────────────────────────────────────
     Asking something and then wanting to stop is completely ordinary —
     you spot a typo, you change your mind, it is taking too long. There
     was no way to do it: the sheet sat spinning until the answer came
     or the whole thing was closed, and closing it was the only button
     that worked.

     Each ask carries a ticket. Stop tears up the current ticket, so
     whatever comes back afterwards is quietly dropped instead of
     landing in a conversation that has moved on. Anything the on-device
     model had already written is kept rather than thrown away — it is
     half an answer, and half an answer is not nothing. */
  const runId = useRef(0);

  const stop = () => {
    tapLight();
    runId.current += 1;
    setBusy(false);
    setDl(null);
    /* Read what has been written so far from this render, rather than
       from inside a setStreaming updater. An updater has to be a pure
       function of the previous value — React is allowed to call it more
       than once, and it does in development — so appending a message
       from inside one can post the half-finished reply into the
       conversation twice. `streaming` here is exactly what is on screen
       at the moment the button is pressed, which is what we want to
       keep. */
    if (streaming) setMessages((m) => [...m, { role: 'assistant', content: streaming }]);
    setStreaming(null);
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
    const ticket = ++runId.current;
    const stale = () => runId.current !== ticket;

    // 1) Bardi Local — Ayser's own model, on-device. Privacy-first: when
    //    it's on, we use ONLY it and never silently route to the cloud.
    if (localOn && canLocal) {
      try {
        const final = await askBardiLocal(
          next,
          { language: lang || 'ar', profile, onProgress: ({ text: t, progress }) => { if (!stale()) setDl({ pct: Math.round((progress || 0) * 100), text: t }); } },
          (full) => { if (!stale()) setStreaming(full); },
        );
        if (stale()) return;                    // you pressed Stop; this is no longer wanted
        setDl(null); setStreaming(null);
        if (final) {
          setMessages((m) => [...m, { role: 'assistant', content: final }]);
        } else {
          setError(lang === 'ar' ? 'موديل باردي رجّع رد فاضي — دوس حاول تاني.' : 'Bardi returned an empty reply — tap Try again.');
        }
      } catch (e) {
        if (stale()) return;
        setDl(null); setStreaming(null);
        setError(lang === 'ar' ? 'موديل باردي وقف لحظة على الجهاز — دوس حاول تاني.' : 'Bardi (on-device) hiccuped — tap Try again.');
      }
      setBusy(false);
      return;
    }

    // 2) Cloud Bardi — hosted endpoint → free fallback. One attempt, kept
    //    fast inside askBardi; the "Try again" button handles manual retries
    //    so it can never sit spinning for minutes.
    let reply = null;
    let why = null;
    let edgeWhy = null;
    try {
      reply = await askBardi(next, { language: lang || 'en', profile, userId: user && user.id, remember });
    } catch (e) { reply = null; why = (e && e.code) || null; edgeWhy = (e && e.edgeWhy) || null; }
    if (stale()) return;                        // you pressed Stop while it was thinking
    if (reply) {
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } else {
      /* Say something TRUE about what happened rather than a shrug.
         The owner also gets the one line that actually fixes it —
         regular users never see anything about deploys. */
      const ar = lang === 'ar';
      let msg = why === 'offline'
        ? (ar ? 'مفيش نت دلوقتي — راجع الاتصال وجرّب تاني.' : 'You\'re offline — check your connection and try again.')
        : why === 'busy'
        ? (ar ? 'باردي مزحوم دلوقتي 🌱 — دوس "حاول تاني" بعد ثانية.' : 'Bardi is overloaded right now 🌱 — tap "Try again" in a second.')
        : (ar ? 'باردي مش قادر يوصل دلوقتي 🌱 — دوس "حاول تاني".' : 'Bardi couldn\'t connect right now 🌱 — tap "Try again".');
      /* The owner gets the endpoint's own words — the exact reason the
         hosted Bardi didn't answer — instead of a generic nudge that
         says "deploy it" when it is already deployed. Regular users
         still see nothing technical. */
      if (isOwner(user)) {
        msg += edgeWhy
          ? (ar ? ` — (باردي السحابي: ${edgeWhy})` : ` — (cloud Bardi: ${edgeWhy})`)
          : (ar ? ' (لو عايزه يشتغل من غير انقطاع: انشر bardi-chat على Supabase.)'
                : ' (To make this never happen: deploy bardi-chat on Supabase.)');
      }
      setError(msg);
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
        {/* the dim you can tap to leave — it gives up its space when the
            sheet is opened out to the whole screen */}
        <Pressable style={{ flex: full ? 0 : 1 }} onPress={full ? undefined : onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={full ? { flex: 1 } : undefined}
        >
          <View style={{
            backgroundColor: C.bg2,
            borderTopLeftRadius: full ? 0 : 26,
            borderTopRightRadius: full ? 0 : 26,
            flex: full ? 1 : undefined,
            /* A cap in per cent needs a parent with a real height to be a
               per cent OF, and this one has none — so the cap never
               applied and the half sheet grew as tall as the
               conversation. Forty messages made it three and a half
               thousand pixels tall, with the typing box somewhere far
               below the bottom of the phone. In pixels it binds. */
            maxHeight: full ? undefined : Math.round(winH * 0.88),
            /* ── CLEARING THE CLOCK ────────────────────────────────────
               Opened to the full page this covers the whole screen,
               notch and status bar included, so the header has to be
               pushed below them. It was using the inset the safe-area
               library reports — and installed to the home screen that
               came back as zero, which is why the word "Bardi" was
               sitting on top of the time.

               The browser knows the real number even when the library
               does not, so on web ask both and take whichever is
               bigger. Neither being available means a flat screen with
               nothing to avoid, and zero is then the right answer. */
            paddingTop: full
              ? (Platform.OS === 'web'
                ? 'max(' + (insets.top || 0) + 'px, env(safe-area-inset-top, 0px))'
                : insets.top)
              : 0,
            paddingBottom: insets.bottom + 8,
          }}>
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Image source={BARDI_ICON} style={{ width: 36, height: 36, borderRadius: 11, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Bardi</Text>
                <Text style={{ color: localOn ? C.green : C.dim, fontSize: 11.5, fontWeight: localOn ? '800' : '400' }}>{brainLabel}</Text>
              </View>
              {chats.length ? (
                <Pressable onPress={() => { tapLight(); setHistoryOpen((o) => !o); }} hitSlop={10} style={{ marginRight: 14 }}>
                  <Ionicons name={historyOpen ? 'time' : 'time-outline'} size={21} color={historyOpen ? C.purple : C.dim} />
                </Pressable>
              ) : null}
              {messages.length ? (
                <Pressable onPress={startNewChat} hitSlop={10} style={{ marginRight: 14 }}>
                  <Ionicons name="create-outline" size={21} color={C.dim} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => { tapLight(); setFull((f) => !f); }} hitSlop={10} style={{ marginRight: 14 }}>
                <Ionicons name={full ? 'contract-outline' : 'expand-outline'} size={20} color={C.dim} />
              </Pressable>
              <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="close" size={24} color={C.dim} /></Pressable>
            </View>

            {/* ── PAST CHATS ── a list you can open, and a bin you can
                   empty. Starting a new chat puts the old one here
                   rather than destroying it. */}
            {historyOpen ? (
              <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 7 }}>
                  <Text style={{ color: C.dim, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, flex: 1 }}>
                    {lang === 'ar' ? 'المحادثات السابقة' : 'PAST CHATS'}
                  </Text>
                  {chats.length ? (
                    <Pressable onPress={() => { tapLight(); setConfirmWipe((v) => !v); }} hitSlop={8}>
                      <Text style={{ color: C.coral, fontSize: 11.5, fontWeight: '900' }}>
                        {lang === 'ar' ? 'امسح الكل' : 'Delete all'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {confirmWipe ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingBottom: 10 }}>
                    <Text style={{ color: C.text, fontSize: 12, flex: 1 }}>
                      {lang === 'ar' ? 'تمسح كل المحادثات؟ مش هترجع.' : 'Delete every chat? They do not come back.'}
                    </Text>
                    <Pressable onPress={() => setConfirmWipe(false)} hitSlop={8} style={{ marginRight: 12 }}>
                      <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>{lang === 'ar' ? 'سيبها' : 'Keep'}</Text>
                    </Pressable>
                    <Pressable onPress={wipeEverything} hitSlop={8}>
                      <View style={{ backgroundColor: C.coral, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 }}>
                        <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>{lang === 'ar' ? 'امسح' : 'Delete'}</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
                <ScrollView style={{ maxHeight: full ? 300 : 190 }}>
                  {chats.map((c) => (
                    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line }}>
                      <Pressable onPress={() => openChat(c)} style={{ flex: 1, paddingHorizontal: 13, paddingVertical: 11 }}>
                        <Text style={{ color: c.id === chatId ? C.purple : C.text, fontSize: 13, fontWeight: c.id === chatId ? '900' : '600' }} numberOfLines={1}>
                          {c.title}
                        </Text>
                        <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>
                          {c.messages.length} {lang === 'ar' ? 'رسالة' : c.messages.length === 1 ? 'message' : 'messages'}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => dropChat(c)} hitSlop={8} style={{ paddingHorizontal: 13 }}>
                        <Ionicons name="trash-outline" size={16} color={C.faint} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

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

            {/* memory control — Bardi remembering you (your own chats). Off any time. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 3 }}>
              <Ionicons name={remember ? 'bookmark' : 'bookmark-outline'} size={15} color={remember ? C.purple : C.faint} />
              <Text style={{ color: C.dim, fontSize: 11.5, marginLeft: 7, flex: 1 }}>
                {forgot
                  ? (lang === 'ar' ? 'اتنسى كل حاجة ✓' : 'Forgotten everything ✓')
                  : remember
                    ? (lang === 'ar' ? 'باردي بيفتكرك من كلامك معاه (خاص ليك)' : 'Bardi remembers you from your own chats (private)')
                    : (lang === 'ar' ? 'باردي مش بيفتكر حاجة' : 'Bardi remembers nothing')}
              </Text>
              {remember && user ? (
                <Pressable onPress={forgetMe} hitSlop={6} style={{ marginRight: 12 }}>
                  <Text style={{ color: C.coral, fontSize: 11.5, fontWeight: '800' }}>{lang === 'ar' ? 'نسّيه' : 'Forget me'}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={toggleRemember} hitSlop={6}>
                <View style={{ width: 40, height: 23, borderRadius: 12, backgroundColor: remember ? C.purple : C.glassHi, padding: 3, justifyContent: 'center' }}>
                  <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: '#FFF', marginLeft: remember ? 17 : 0 }} />
                </View>
              </Pressable>
            </View>

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

            {/* ── THE CONVERSATION HAS TO BE THE PART THAT SCROLLS ──────
                On the half sheet the whole panel is capped at 88% of the
                screen, so this list is squeezed and scrolls by itself.
                Opened out to the full page that cap is gone — and with
                nothing telling it otherwise, the list simply grew as
                tall as the conversation. Past a certain number of
                messages it ran off the bottom of the screen and took the
                typing box with it, and because the list was taller than
                its parent rather than bounded by it there was nothing
                left to scroll either. That is exactly "I can't scroll
                and I can't keep talking after a long chat".

                flex: 1 makes it take the room that is left over instead
                of the room it wants, so the composer stays put and the
                overflow becomes scroll. */}
            <ScrollView
              ref={scroller}
              /* flexShrink lets the list give up space so the composer
                 always fits inside the capped sheet; flex takes the
                 leftover room on the full page. Either way the list is
                 bounded by the panel, which is what makes it scroll
                 instead of overflow. */
              style={[{ paddingHorizontal: 16, flexShrink: 1 }, full ? { flex: 1 } : null]}
              contentContainerStyle={{ paddingVertical: 14 }}
              keyboardShouldPersistTaps="handled"
            >
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

              <Bubbles messages={messages} />

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
              {/* while it is thinking, the same button stops it */}
              <Pressable onPress={busy ? stop : () => send()} disabled={!busy && !input.trim()}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: busy ? C.coral : input.trim() ? C.purple : C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={busy ? 'stop' : 'arrow-up'} size={busy ? 17 : 20} color={busy || input.trim() ? '#FFF' : C.faint} />
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
