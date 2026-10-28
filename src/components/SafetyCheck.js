import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { mv } from '../constants/mvpWords';
import { mySafety, sendSafetyCheck } from '../services/mvp';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── ONE SAFETY CHECK, BEFORE BOOKING OR CHATTING ────────────────────
   Ayser: browsing is free; booking a Drop or starting a chat needs a
   one-time check. A live selfie from the camera (getUserMedia — not a
   picture from the gallery), or a photo of an ID / university card, and
   an optional Instagram or LinkedIn. The photo is made small here (under
   100KB), goes to the private bucket, and is deleted the moment somebody
   in the Studio decides (RUN_ME.sql, studio_safety_decide). */

// draw it small, then lower the quality until it is under 100KB
const shrink = (source, w0, h0) => new Promise((resolve) => {
  const side = 480;
  const k = Math.min(1, side / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  const tryQ = (q) => c.toBlob((b) => {
    if (!b) return resolve(null);
    if (b.size <= 100 * 1024 || q <= 0.35) resolve(b); else tryQ(q - 0.1);
  }, 'image/jpeg', q);
  tryQ(0.8);
});
const fileToBlob = (file) => new Promise((resolve) => {
  const img = new window.Image();
  const url = URL.createObjectURL(file);
  img.onload = () => { shrink(img, img.naturalWidth, img.naturalHeight).then((b) => { URL.revokeObjectURL(url); resolve(b); }); };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  img.src = url;
});
const pickFile = () => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
  document.body.appendChild(input); input.click();
});

const Btn = ({ label, onPress, solid, icon, busy }) => (
  <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={{ marginTop: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 15, borderWidth: 1, borderColor: C.text, backgroundColor: solid ? C.text : 'transparent' }}>
      {busy ? <ActivityIndicator color={solid ? C.bg : C.text} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={solid ? C.bg : C.text} style={{ marginEnd: 8 }} /> : null}
          <Text style={{ color: solid ? C.bg : C.text, fontSize: 15.5, fontWeight: '600' }}>{label}</Text>
        </>
      )}
    </View>
  </Pressable>
);

export const SafetyCheck = ({ onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(null);       // my_safety()
  const [mode, setMode] = useState(null);         // null | 'cam'
  const [shot, setShot] = useState(null);         // { kind, blob, url }
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const video = useRef(null);
  const stream = useRef(null);
  useEffect(() => { mySafety().then(setState); }, []);
  const stopCam = () => { try { (stream.current && stream.current.getTracks() || []).forEach((t) => t.stop()); } catch (e) {} stream.current = null; };
  useEffect(() => () => { stopCam(); if (shot) URL.revokeObjectURL(shot.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCam = async () => {
    tapLight(); setNote(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false });
      stream.current = s; setMode('cam');
      setTimeout(() => { if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } }, 50);
    } catch (e) { setNote(mv(lang, 'vNoCam')); }
  };
  const snap = async () => {
    const v = video.current; if (!v || !v.videoWidth) return;
    const b = await shrink(v, v.videoWidth, v.videoHeight);
    stopCam(); setMode(null);
    if (b) { tapSuccess(); setShot({ kind: 'selfie', blob: b, url: URL.createObjectURL(b) }); }
  };
  const card = async () => {
    tapLight(); setNote(null);
    const f = await pickFile(); if (!f) return;
    const b = await fileToBlob(f);
    if (b) setShot({ kind: 'id', blob: b, url: URL.createObjectURL(b) }); else setNote(mv(lang, 'vErr'));
  };
  const send = async () => {
    if (!shot || busy) return;
    setBusy(true); setNote(null);
    const r = await sendSafetyCheck(shot.kind, shot.blob, handle.trim());
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setState({ ...(state || {}), status: r.status, verified: r.status === 'approved' }); }
    else setNote(mv(lang, 'vErr'));
  };

  const done = state && state.verified;
  const waiting = state && !state.verified && state.status === 'pending';
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 30 }}>
          <Pressable onPress={() => { stopCam(); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.6, marginTop: 18 }}>{mv(lang, 'vT')}</Text>
          {done ? <Text style={{ color: '#FFFFFF', fontSize: 16, marginTop: 14 }}>{mv(lang, 'vDone')}</Text>
            : waiting ? <Text style={{ color: '#A3A3A3', fontSize: 15.5, lineHeight: 23, marginTop: 14 }}>{mv(lang, 'vWait')}</Text>
            : (
              <>
                <Text style={{ color: '#A3A3A3', fontSize: 15, lineHeight: 23, marginTop: 10 }}>{mv(lang, 'vS')}</Text>
                {mode === 'cam' && Platform.OS === 'web' ? (
                  <View style={{ marginTop: 18, alignItems: 'center' }}>
                    <View style={{ width: 240, height: 320, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#262626', backgroundColor: '#0A0A0A' }}>
                      <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    </View>
                    <View style={{ alignSelf: 'stretch' }}><Btn solid label={mv(lang, 'vSnap')} icon="camera-outline" onPress={snap} /></View>
                  </View>
                ) : shot ? (
                  <View style={{ marginTop: 18, alignItems: 'center' }}>
                    {Platform.OS === 'web' ? <img src={shot.url} alt="" style={{ width: 200, borderRadius: 18, border: '1px solid #262626' }} /> : null}
                    <Pressable onPress={() => { URL.revokeObjectURL(shot.url); setShot(null); }} accessibilityRole="button" style={{ marginTop: 10 }}>
                      <Text style={{ color: '#A3A3A3', fontSize: 14, textDecorationLine: 'underline' }}>{mv(lang, 'vAgain')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ marginTop: 14 }}>
                    <Btn solid label={mv(lang, 'vSelfie')} icon="camera-outline" onPress={openCam} />
                    <Btn label={mv(lang, 'vId')} icon="card-outline" onPress={card} />
                  </View>
                )}
                <TextInput value={handle} onChangeText={setHandle} placeholder={mv(lang, 'vHandle')} placeholderTextColor="#737373" autoCapitalize="none" autoCorrect={false} maxLength={120}
                  style={{ color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#262626', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, marginTop: 18, outlineStyle: 'none' }} />
                {shot ? <Btn solid busy={busy} label={mv(lang, 'vSend')} onPress={send} /> : null}
                {note ? <Text style={{ color: '#FFFFFF', fontSize: 14, marginTop: 12 }}>{note}</Text> : null}
              </>
            )}
        </ScrollView>
      </View>
    </Modal>
  );
};
