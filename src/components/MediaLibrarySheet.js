import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchLibrary, addToLibrary, removeFromLibrary } from '../services/library';
import { MAX_UPLOAD_BYTES } from '../lib/storage';
import { compressVideo, probeVideo, needsCompressing, REEL_MAX_SECONDS } from '../lib/videoCompress';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';

/* ── YOUR LIBRARY ───────────────────────────────────────────────────
   Everything you've uploaded, waiting to be posted. Add clips and
   photos when you have signal; picking one later costs nothing,
   because the file is already up there.

   Nobody else can see this. The database hands out your own rows and
   nobody else's — that isn't a setting, it's the read policy.

   ── why `inline` exists ──────────────────────────────────────────
   Opened from the camera, this used to be a Modal inside a Modal, and
   on iPhone that produced a blank grey page: a sliding Modal carries a
   CSS transform, a transform makes a new containing block, and a
   `position: fixed` child then measures itself against that box
   instead of the screen. The sheet painted its background across the
   whole display and laid its contents out somewhere off it — a page
   the exact colour of our canvas, with nothing on it.

   So when something is already inside a modal, it says `inline` and we
   render an ordinary absolutely-positioned overlay instead. No second
   portal, no transform to fight, nothing to go wrong. */

const mb = (n) => (n ? (n / (1024 * 1024)).toFixed(1) + ' MB' : '');

export const MediaLibrarySheet = ({ onPick, onClose, only = null, inline = false }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);      // 'photo' | 'video' while uploading
  const [pct, setPct] = useState(0);           // 0–1, real bytes sent
  const [squeeze, setSqueeze] = useState(null); // 0–1 while a big clip is re-encoded
  const abortRef = useRef(null);
  const [err, setErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(() => {
    if (!SUPABASE_READY || !user) { setRows([]); return; }
    fetchLibrary(user.id).then(setRows).catch(() => setRows([]));
  }, [user]);

  useEffect(load, [load]);

  const pickFile = (accept, capture) => new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', capture);
    input.onchange = () => resolve((input.files && input.files[0]) || null);
    input.click();
  });

  const add = async (accept, label, capture) => {
    if (busy) return;
    setErr(null);
    const file = await pickFile(accept, capture);
    if (!file) return;
    setBusy(label);
    setPct(0);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortRef.current = ctrl;
    try {
      /* ── BIG CLIPS GET MADE SMALLER, NOT REFUSED ────────────────
         A 120MB video from the camera roll used to come straight back
         as "the limit is …, trim it and try again", which is the app
         handing its own job to the person using it. If it is too big,
         or longer than a reel is allowed to be, we re-encode it here
         first — same picture, a fraction of the bytes, sound kept.
         See src/lib/videoCompress.js; if that cannot do it honestly it
         hands back the original and we carry on as before. */
      let body = file;
      let ext = (String(file.name || '').split('.').pop() || '').toLowerCase() || (/^video\//.test(file.type) ? 'mp4' : 'jpg');
      let type = file.type;

      if (/^video\//.test(file.type || '') || label === 'video') {
        const meta = await probeVideo(file);
        const seconds = meta && meta.seconds;
        if (needsCompressing(file.size, seconds)) {
          setSqueeze(0);
          const small = await compressVideo(file, {
            onProgress: setSqueeze,
            signal: ctrl && ctrl.signal,
          });
          setSqueeze(null);
          if (small) {
            body = small.blob; ext = small.ext; type = small.contentType;
          } else if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error('That clip is ' + mb(file.size) + ' and this browser cannot shrink it. '
              + 'Trim it in your Photos app and try again ✂️');
          } else if (seconds && seconds > REEL_MAX_SECONDS + 0.5) {
            throw new Error('That clip is ' + Math.round(seconds / 60) + ' minutes. A reel goes up to '
              + (REEL_MAX_SECONDS / 60) + ', and this browser cannot cut it — trim it in Photos ✂️');
          }
        }
      } else if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('That one is ' + mb(file.size) + ' — the limit is ' + mb(MAX_UPLOAD_BYTES) + '.');
      }

      const row = await addToLibrary(user.id, body, {
        ext, contentType: type, bytes: body.size,
        onProgress: (loaded, total) => setPct(total ? loaded / total : 0),
        signal: ctrl && ctrl.signal,
      });
      tapSuccess();
      setRows((list) => [row].concat(list || []));
    } catch (e) {
      const m = (e && e.message) || '';
      setErr(/cancelled/i.test(m) ? null : (m || 'That upload did not go through — try again.'));
    } finally { setBusy(null); setPct(0); setSqueeze(null); abortRef.current = null; }
  };

  const cancelUpload = () => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch (e) {} }
  };

  const drop = async (row) => {
    setConfirmDel(null);
    setRows((list) => (list || []).filter((r) => r.id !== row.id));
    try { await removeFromLibrary(row.id, user.id); } catch (e) { load(); }
  };

  const shown = (rows || []).filter((r) => !only || r.kind === only);

  const body = (
      <View style={inline ? [StyleSheet.absoluteFill, { backgroundColor: C.bg, zIndex: 60 }] : { flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }}>Your library</Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>Uploaded and ready — only you see this</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* add something, now, while you have signal */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 6 }}>
          <Pressable onPress={() => add('video/*', 'video')} disabled={!!busy} style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple, borderRadius: 14, paddingVertical: 13, opacity: busy ? 0.5 : 1 }}>
              <Ionicons name="videocam" size={17} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900', marginLeft: 7 }}>
                {busy === 'video' ? 'Uploading…' : 'Add video'}
              </Text>
            </View>
          </Pressable>
          <Pressable onPress={() => add('image/*', 'photo')} disabled={!!busy} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, opacity: busy ? 0.5 : 1 }}>
              <Ionicons name="image-outline" size={17} color={C.text} />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', marginLeft: 7 }}>
                {busy === 'photo' ? 'Uploading…' : 'Add photo'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* A bar that moves, because a spinner cannot tell you the
            difference between slow and stuck — and that is exactly what
            a stalled upload looked like. */}
        {busy ? (
          <View style={{ marginTop: 14, paddingHorizontal: 4 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.glassHi, overflow: 'hidden' }}>
              <View style={{
                width: Math.max(4, Math.round((squeeze != null ? squeeze : pct) * 100)) + '%',
                height: '100%', borderRadius: 3,
                backgroundColor: squeeze != null ? C.green : C.purple,
              }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: C.faint, fontSize: 12, flex: 1 }}>
                {squeeze != null
                  ? 'Shrinking it so it fits — ' + Math.round(squeeze * 100) + '%. This runs at real speed, so a long clip takes about as long as it is.'
                  : pct > 0
                    ? Math.round(pct * 100) + '% sent — you can leave this open'
                    : 'Starting the upload…'}
              </Text>
              <Pressable onPress={cancelUpload} hitSlop={8}>
                <Text style={{ color: C.coral, fontSize: 12, fontWeight: '900' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {err ? (
          <Text style={{ color: C.coral, fontSize: 12.5, textAlign: 'center', marginTop: 12, paddingHorizontal: 26, lineHeight: 18 }}>{err}</Text>
        ) : null}

        {!SUPABASE_READY || !user ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 40, lineHeight: 20 }}>
            Sign in and your library lives with your account, not on this phone.
          </Text>
        ) : rows === null ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : shown.length ? (
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 14, paddingBottom: insets.bottom + 30 }}>
            {shown.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => { tapSelection(); onPick && onPick(r); }}
                onLongPress={() => { tapLight(); setConfirmDel(r); }}
                style={{ width: '33.33%', padding: 4 }}
              >
                <View style={{ aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.line }}>
                  {r.kind === 'video' ? (
                    Platform.OS === 'web' ? (
                      <video src={r.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null
                  ) : (
                    <Image source={{ uri: r.url }} style={{ width: '100%', height: '100%' }} />
                  )}
                  {r.kind === 'video' ? (
                    <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="play" size={9} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800', marginLeft: 3 }}>{mb(r.bytes)}</Text>
                    </View>
                  ) : null}
                  {r.used_count ? (
                    <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>used {r.used_count}×</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ alignItems: 'center', paddingHorizontal: 44, paddingVertical: 46 }}>
            <Text style={{ fontSize: 34 }}>📂</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>Nothing in here yet</Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
              Add a clip now, while you have signal. Posting it later is instant, because the upload
              already happened.
            </Text>
          </View>
        )}

        {confirmDel ? (
          <View style={{ position: 'absolute', left: 18, right: 18, bottom: insets.bottom + 18, backgroundColor: C.float, borderRadius: R, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
              Take this out of your library?
            </Text>
            <Pressable onPress={() => drop(confirmDel)} style={{ marginRight: 14 }}>
              <Text style={{ color: C.coral, fontSize: 13, fontWeight: '900' }}>Remove</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmDel(null)}>
              <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>Keep</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
  );

  if (inline) return body;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {body}
    </Modal>
  );
};
