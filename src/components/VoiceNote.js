import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { uploadMediaSmart } from '../lib/storage';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

/* ─── VOICE NOTES, 15 SECONDS ─────────────────────────────────────────
   Ayser, November 2026: hold the mic, talk, let go — like a walkie-talkie,
   in Table Chats and in Connections. Recorded small on the phone (Opus at
   24 kbps, about 45 KB for 15 seconds), stored through our R2 adapter
   (Supabase if R2 is off), sent as a message of kind 'voice' (RUN_ME.sql
   messages_voice_guard). Notes play one after the other. Nothing opens
   another app. */
export const VOICE_MAX = 15;
const W = {
  en: { hold: 'Hold to talk', rec: 'Recording… let go to send', mic: 'Allow the microphone to send voice notes.', err: 'The voice note did not send. Try again.' },
  ar: { hold: 'دوس واتكلم', rec: 'بيسجّل… سيب عشان يتبعت', mic: 'اسمح بالمايك عشان تبعت رسايل صوتية.', err: 'الرسالة الصوتية ماتبعتتش. جرّب تاني.' },
};
const vw = (lang, k) => W[lang === 'ar' ? 'ar' : 'en'][k];
const pickType = () => {
  try {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return ['audio/webm;codecs=opus', 'audio/webm', 'webm'];
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/mp4')) return ['audio/mp4', 'audio/mp4', 'm4a'];
  } catch (e) {}
  return ['', 'audio/webm', 'webm'];
};

export async function sendVoice({ squadId, dmThreadId, userId, url, seconds }) {
  const { data, error } = await supabase.from('messages')
    .insert({ squad_id: squadId || null, dm_thread_id: dmThreadId || null, user_id: userId, body: '🎙 ' + seconds + 's', kind: 'voice', media_url: url, media_kind: 'audio' })
    .select('*, user:profiles!messages_user_id_fkey(name, handle, avatar_url)').single();
  if (error) throw error;
  return data;
}

/* the hold-to-talk button, next to the text box */
export const VoiceButton = ({ lang, userId, squadId, dmThreadId, onSent, onError, disabled }) => {
  const [rec, setRec] = useState(null);      // { mr, stream, chunks, started }
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState(null);
  const timer = useRef(null);
  const recRef = useRef(null);
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.MediaRecorder) return null;

  const stop = async (send = true) => {
    const r = recRef.current;
    recRef.current = null;
    clearInterval(timer.current);
    if (!r) return;
    const done = new Promise((res) => { r.mr.onstop = res; });
    try { r.mr.stop(); } catch (e) {}
    await done;
    r.stream.getTracks().forEach((t) => t.stop());
    setRec(null);
    const seconds = Math.min(VOICE_MAX, Math.max(1, Math.round((Date.now() - r.started) / 1000)));
    if (!send || Date.now() - r.started < 600) { setSecs(0); return; }   // a tap, not a note
    try {
      const [, type, ext] = pickType();
      const blob = new Blob(r.chunks, { type });
      const url = await uploadMediaSmart(userId, blob, ext, type);
      const row = await sendVoice({ squadId, dmThreadId, userId, url, seconds });
      tapSuccess(); onSent && onSent(row);
    } catch (e) { setNote(vw(lang, 'err')); onError && onError(e); }
    setSecs(0);
  };
  const start = async () => {
    if (disabled || recRef.current) return;
    setNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const [mime] = pickType();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
      const r = { mr, stream, chunks: [], started: Date.now() };
      mr.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
      mr.start(250);
      recRef.current = r; setRec(r); tapMedium(); setSecs(0);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - r.started) / 1000);
        setSecs(s);
        if (s >= VOICE_MAX) stop(true);              // 15 seconds, then it sends itself
      }, 200);
    } catch (e) { setNote(vw(lang, 'mic')); }
  };
  return (
    <View>
      <Pressable testID="voice-hold" onPressIn={start} onPressOut={() => stop(true)} disabled={disabled} accessibilityRole="button" accessibilityLabel={vw(lang, 'hold')}
        style={{ marginStart: 8 }}>
        <View style={{ height: 42, minWidth: 42, paddingHorizontal: rec ? 12 : 0, borderRadius: 21, backgroundColor: rec ? C.coral : C.text, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          <Ionicons name={rec ? 'radio-button-on' : 'mic'} size={19} color="#FFF" />
          {rec ? <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', marginStart: 6 }}>{(VOICE_MAX - secs) + 's'}</Text> : null}
        </View>
      </Pressable>
      {note ? <Text style={{ position: 'absolute', bottom: 48, right: 0, width: 220, color: C.coral, fontSize: 12, textAlign: 'right' }}>{note}</Text> : null}
    </View>
  );
};

/* one voice note in the chat: play / pause, a thin progress line; when it
   ends, the next one plays (the list passes autoPlay down) */
export const VoicePlayer = ({ url, seconds, mine, autoPlay, onEnded }) => {
  const a = useRef(null);
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Audio) return undefined;
    const au = new window.Audio(url);
    au.preload = 'none';
    au.ontimeupdate = () => setPos(au.duration ? au.currentTime / au.duration : 0);
    au.onended = () => { setOn(false); setPos(0); onEnded && onEnded(); };
    au.onpause = () => setOn(false);
    au.onplay = () => setOn(true);
    a.current = au;
    return () => { try { au.pause(); } catch (e) {} a.current = null; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoPlay && a.current) a.current.play().catch(() => {}); }, [autoPlay]);
  const toggle = () => { tapLight(); const au = a.current; if (!au) return; if (au.paused) au.play().catch(() => {}); else au.pause(); };
  const ink = mine ? '#FFF' : C.text;
  return (
    <Pressable testID="voice-play" onPress={toggle} accessibilityRole="button" accessibilityLabel={on ? 'pause' : 'play'} style={{ flexDirection: 'row', alignItems: 'center', minWidth: 150 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: mine ? 'rgba(255,255,255,0.22)' : C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={on ? 'pause' : 'play'} size={15} color={ink} />
      </View>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: mine ? 'rgba(255,255,255,0.3)' : C.line, marginHorizontal: 10, overflow: 'hidden' }}>
        <View style={{ height: 3, width: Math.round(pos * 100) + '%', backgroundColor: ink }} />
      </View>
      <Text style={{ color: ink, fontSize: 12.5, fontWeight: '700' }}>{(seconds || '') + (seconds ? 's' : '')}</Text>
    </Pressable>
  );
};
export const voiceSeconds = (m) => { const x = String((m && m.body) || '').match(/(\d+)s/); return x ? Number(x[1]) : null; };
