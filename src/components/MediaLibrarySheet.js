import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchLibrary, addToLibrary, removeFromLibrary } from '../services/library';
import { MAX_UPLOAD_BYTES } from '../lib/storage';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';

/* ── YOUR LIBRARY ───────────────────────────────────────────────────
   Everything you've uploaded, waiting to be posted. Add clips and
   photos when you have signal; picking one later costs nothing,
   because the file is already up there.

   Nobody else can see this. The database hands out your own rows and
   nobody else's — that isn't a setting, it's the read policy. */

const mb = (n) => (n ? (n / (1024 * 1024)).toFixed(1) + ' MB' : '');

export const MediaLibrarySheet = ({ onPick, onClose, only = null }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);      // 'photo' | 'video' while uploading
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
    if (file.size > MAX_UPLOAD_BYTES) {
      setErr('That one is ' + mb(file.size) + ' — the limit is ' + mb(MAX_UPLOAD_BYTES) + '. Trim it and try again.');
      return;
    }
    setBusy(label);
    try {
      const ext = (String(file.name || '').split('.').pop() || '').toLowerCase() || (/^video\//.test(file.type) ? 'mp4' : 'jpg');
      const row = await addToLibrary(user.id, file, { ext, contentType: file.type, bytes: file.size });
      tapSuccess();
      setRows((list) => [row].concat(list || []));
    } catch (e) {
      setErr((e && e.message) || 'That upload did not go through — try again.');
    } finally { setBusy(null); }
  };

  const drop = async (row) => {
    setConfirmDel(null);
    setRows((list) => (list || []).filter((r) => r.id !== row.id));
    try { await removeFromLibrary(row.id, user.id); } catch (e) { load(); }
  };

  const shown = (rows || []).filter((r) => !only || r.kind === only);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
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

        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <ActivityIndicator color={C.purple} />
            <Text style={{ color: C.faint, fontSize: 12, marginLeft: 8 }}>Sending it up — you can leave this open</Text>
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
    </Modal>
  );
};
