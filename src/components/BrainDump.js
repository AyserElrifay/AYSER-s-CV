import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { parseDump, newDay, current, markDone, notNow, left, dayKey, FOCUS, LOOK } from '../lib/brainDump';
import { setFocus, transcribe } from '../services/bardiFocus';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight, tapSuccess } from '../utils/feedback';

const GoNowSheet = lazyOverlay(() => import('./GoNowSheet').then((m) => ({ default: m.GoNowSheet })));

/* ─── TODAY, ONE THING AT A TIME ──────────────────────────────────────
   The brain dump (src/lib/brainDump.js) on the Home screen. Empty, it
   is one line and a microphone. Full, it is the one next thing — Done,
   or Not now — and nothing else: no list, no ticks, no count of what
   is left beyond a faint "1 of 4". When the one thing is studying or
   deep work, it offers the way out of the room: focus with people
   nearby. The day lives on this phone and is gone tomorrow. */

const KEY = 'moments.today';
const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && v.day === dayKey() && Array.isArray(v.items) ? v : null;
  } catch (e) { return null; }
};
const save = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} };

const canRecord = () => Platform.OS === 'web' && typeof window !== 'undefined' && !!window.MediaRecorder
  && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

export const BrainDump = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [day, setDay] = useState(load);
  const [text, setText] = useState('');
  const [rec, setRec] = useState(null);          // null | 'on' | 'busy'
  const [note, setNote] = useState(null);        // a one-line message about the voice note
  const [goNow, setGoNow] = useState(false);
  const media = useRef(null);
  const sentFocus = useRef(null);

  const now = current(day);
  const total = day ? day.items.length : 0;

  /* tell the server only the kind, and only while it is a focus kind */
  useEffect(() => {
    if (!user) return;
    const want = now && FOCUS.has(now.kind) ? now.kind : null;
    if (want === sentFocus.current) return;
    sentFocus.current = want;
    setFocus(want).catch(() => {});
  }, [user && user.id, now && now.kind, now && now.index]);

  const commit = (next) => { setDay(next); save(next); };

  const dump = (raw) => {
    const items = parseDump(raw);
    if (!items.length) return;
    tapSuccess();
    setText(''); setNote(null);
    commit(newDay(items));
  };

  const startRec = async () => {
    if (!canRecord()) { setNote(t('bd_voice_no')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new window.MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRec('busy');
        const r = await transcribe(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), lang);
        setRec(null);
        if (r.text) { setText((x) => (x ? x + ' ' : '') + r.text); setNote(null); }
        else setNote(r.error === 'not_ready' ? t('bd_voice_not_ready') : t('lamma_offline'));
      };
      media.current = mr;
      mr.start();
      tapLight();
      setRec('on'); setNote(null);
    } catch (e) { setNote(t('bd_voice_denied')); }
  };
  const stopRec = () => { try { media.current && media.current.stop(); } catch (e) {} };

  const card = { backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16, marginTop: 16 };
  const kicker = { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 };

  /* ── nothing dumped yet today ── */
  if (!day) {
    const listening = rec === 'on';
    return (
      <View style={card}>
        <Text style={kicker}>BARDI · {t('bd_today')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={listening ? t('bd_listening') : t('bd_ph')}
            placeholderTextColor={listening ? C.text : C.faint}
            multiline
            onSubmitEditing={() => dump(text)}
            accessibilityLabel={t('bd_ph')}
            style={{ flex: 1, minWidth: 0, color: C.text, fontSize: 16, lineHeight: 22, paddingVertical: 6, maxHeight: 120 }}
          />
          {text.trim() ? (
            <Pressable onPress={() => dump(text)} accessibilityRole="button" accessibilityLabel={t('bd_go')}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', marginStart: 10 }}>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </Pressable>
          ) : (
            <Pressable onPress={listening ? stopRec : startRec} disabled={rec === 'busy'} accessibilityRole="button"
              accessibilityLabel={listening ? t('bd_stop') : t('bd_voice')}
              style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: listening ? C.coral : C.line, alignItems: 'center', justifyContent: 'center', marginStart: 10 }}>
              {rec === 'busy' ? <ActivityIndicator color={C.text} /> : <Ionicons name={listening ? 'stop' : 'mic-outline'} size={19} color={listening ? C.coral : C.text} />}
            </Pressable>
          )}
        </View>
        <Text style={{ color: note ? C.coral : C.faint, fontSize: 12, marginTop: 8 }}>{note || t('bd_private')}</Text>
      </View>
    );
  }

  /* ── everything done ── */
  if (!now) {
    return (
      <View style={[card, { flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={{ fontSize: 22 }}>🌿</Text>
        <Text style={{ flex: 1, minWidth: 0, color: C.text, fontSize: 15, fontWeight: '700', marginStart: 10 }}>{t('bd_all_done')}</Text>
        <Pressable onPress={() => { tapLight(); commit(null); }} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700' }}>{t('bd_again')}</Text>
        </Pressable>
      </View>
    );
  }

  /* ── the one thing ── */
  const position = total - left(day) + 1;
  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[kicker, { flex: 1 }]}>BARDI · {t('bd_now')}</Text>
        <Text style={{ color: C.faint, fontSize: 11.5 }}>{t('bd_of').replace('{i}', String(position)).replace('{n}', String(total))}</Text>
        <Pressable onPress={() => { tapLight(); commit(null); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('bd_again')} style={{ marginStart: 12 }}>
          <Ionicons name="refresh" size={15} color={C.faint} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Text style={{ fontSize: 26 }}>{(LOOK[now.kind] || LOOK.other).emoji}</Text>
        <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={3}>{now.text}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{t('bd_kind_' + now.kind)}</Text>
        </View>
      </View>

      {FOCUS.has(now.kind) ? (
        <Pressable onPress={() => { tapLight(); setGoNow(true); }} accessibilityRole="button" style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="people-outline" size={16} color={C.text} />
          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', marginStart: 6, textDecorationLine: 'underline' }}>{t('bd_focus_with')}</Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', marginTop: 14 }}>
        <Pressable onPress={() => { tapSuccess(); commit(markDone(day)); }} accessibilityRole="button"
          style={{ flex: 1, backgroundColor: C.purple, borderRadius: 999, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '800' }}>{t('bd_done')}</Text>
        </Pressable>
        {left(day) > 1 ? (
          <Pressable onPress={() => { tapLight(); commit(notNow(day)); }} accessibilityRole="button"
            style={{ paddingHorizontal: 18, justifyContent: 'center', marginStart: 6 }}>
            <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>{t('bd_not_now')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* the dumped words stay private: the session gets a plain title */}
      {goNow ? <GoNowSheet initialKind="focus" onClose={() => setGoNow(false)} /> : null}
    </View>
  );
};
