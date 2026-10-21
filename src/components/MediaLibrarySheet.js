import React, { useState, useEffect, useCallback, useRef } from 'react';
import { reportProblem } from '../lib/problems';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchLibrary, addToLibrary, removeFromLibrary } from '../services/library';
import { MAX_UPLOAD_BYTES } from '../lib/storage';
import { compressVideo, probeVideo, videoPlan, REEL_MAX_SECONDS } from '../lib/videoCompress';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

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
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const { t } = useLang();
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
    setBusy(label || 'file');
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
        /* ── THE LIBRARY MUST NOT CUT ANYBODY'S VIDEO ─────────────────
           Shrinking a heavy thirty-second clip is the point of this.
           Shrinking a twelve-minute one is not: the re-encoder works by
           playing the file back in real time and stops at the reel cap,
           so a long video put in the library came back three minutes
           long — and the library is reachable from the long-form tab,
           where length is the whole idea.

           So it is treated as long-form exactly when it IS long: kept
           whole, with only the bucket's real ceiling able to stop it.
           A short heavy clip is still shrunk, which is what this was
           for. */
        const tooLongToReEncode = seconds != null && seconds > REEL_MAX_SECONDS;
        const plan = videoPlan({
          bytes: file.size, seconds, longForm: tooLongToReEncode, maxBytes: MAX_UPLOAD_BYTES,
        });
        if (plan.action === 'shrink') {
          setSqueeze(0);
          const small = await compressVideo(file, {
            onProgress: setSqueeze,
            signal: ctrl && ctrl.signal,
          });
          setSqueeze(null);
          /* Cancel means cancel. Aborting the re-encode used to fall
             straight through to uploading the untouched original — and
             the abort signal was already spent, so nothing stopped that
             either. */
          if (ctrl && ctrl.signal && ctrl.signal.aborted) throw new Error('cancelled');
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
      if (!/cancelled/i.test(m)) reportProblem('library', e);
      setErr(/cancelled/i.test(m) ? null : 'That upload did not go through — try again.');
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
  const { lang } = useLang();

  /* ── LIKE A CAMERA ROLL, NOT A FILE MANAGER ─────────────────────────
     Ayser: "خلّي شكل الـgallery بسيط، عملي، حلو ومشجّع — أحلى من سناب".
     Dark like the camera it opens from; the pictures edge to edge, three
     across, under the month they were added; the first square is the
     one way to add more (photo or video, one picker). No two big
     buttons, no sizes, no "used 2×". Hold a picture to take it out. */
  const months = [];
  shown.forEach((r) => {
    const d = new Date(r.created_at || Date.now());
    let name = '';
    try { name = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { month: 'long', year: 'numeric' }); } catch (e) { name = d.toDateString(); }
    const last = months[months.length - 1];
    if (last && last.name === name) last.items.push(r); else months.push({ name, items: [r] });
  });
  const accept = only === 'video' ? 'video/*' : only === 'photo' ? 'image/*' : 'image/*,video/*';
  const DARK = '#0B0A10';
  const tile = (r) => (
    <Pressable
      key={r.id}
      onPress={() => { tapSelection(); onPick && onPick(r); }}
      onLongPress={() => { tapLight(); setConfirmDel(r); }}
      accessibilityRole="button"
      style={({ pressed }) => ({ width: '33.333%', padding: 1, opacity: pressed ? 0.75 : 1, outlineStyle: 'none' })}
    >
      <View style={{ aspectRatio: 0.8, backgroundColor: '#1A1922', overflow: 'hidden', borderRadius: 3 }}>
        {r.kind === 'video' ? (
          Platform.OS === 'web' ? <video src={r.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null
        ) : (
          <Image source={{ uri: r.url }} style={{ width: '100%', height: '100%' }} />
        )}
        {r.kind === 'video' ? (
          <View style={{ position: 'absolute', bottom: 6, left: 6 }}>
            <Ionicons name="play" size={14} color="#FFF" style={{ textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
  const addTile = () => (
    <Pressable onPress={() => add(accept, null)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={t('ml_add')}
      style={{ width: '33.333%', padding: 1, outlineStyle: 'none' }}>
      <View style={{ aspectRatio: 0.8, borderRadius: 3, backgroundColor: '#17161F', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
          <Ionicons name="add" size={26} color="#FFF" />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', marginTop: 8 }}>{t('ml_add')}</Text>
      </View>
    </Pressable>
  );

  const body = (
      <View style={inline ? [StyleSheet.absoluteFill, { backgroundColor: DARK, zIndex: 60 }] : { flex: 1, backgroundColor: DARK }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', outlineStyle: 'none' }} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: '#FFF', fontSize: 17, fontWeight: '900' }}>{t('ml_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* a bar that moves: slow and stuck look different */}
        {busy ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <View style={{ width: Math.max(4, Math.round((squeeze != null ? squeeze : pct) * 100)) + '%', height: '100%', backgroundColor: squeeze != null ? C.green : C.purple }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, flex: 1 }}>
                {squeeze != null ? t('ml_shrinking').replace('{n}', String(Math.round(squeeze * 100))) : t('ml_sending').replace('{n}', String(Math.round(pct * 100)))}
              </Text>
              <Pressable onPress={cancelUpload} hitSlop={8}>
                <Text style={{ color: C.coral, fontSize: 12, fontWeight: '900' }}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {err ? <Text style={{ color: C.coral, fontSize: 12.5, textAlign: 'center', marginBottom: 10, paddingHorizontal: 26 }}>{err}</Text> : null}

        {!SUPABASE_READY || !user ? (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 40, lineHeight: 20 }}>{t('ml_signin')}</Text>
        ) : rows === null ? (
          <ActivityIndicator color="#FFF" style={{ marginTop: 40 }} />
        ) : shown.length ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
            {months.map((m, i) => (
              <View key={m.name}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', paddingHorizontal: 14, paddingTop: i ? 18 : 4, paddingBottom: 8 }}>{m.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 1 }}>
                  {i === 0 ? addTile() : null}
                  {m.items.map(tile)}
                </View>
              </View>
            ))}
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11.5, textAlign: 'center', marginTop: 18 }}>{t('ml_private')}</Text>
          </ScrollView>
        ) : (
          /* empty: an invitation, not a folder icon */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 }}>
            <View style={{ flexDirection: 'row', marginBottom: 22 }}>
              {['-8deg', '0deg', '8deg'].map((rot, k) => (
                <View key={rot} style={{ width: 70, height: 88, borderRadius: 10, marginHorizontal: -8, backgroundColor: k === 1 ? '#2A2838' : '#1F1E2A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', transform: [{ rotate: rot }, { translateY: k === 1 ? -6 : 0 }], alignItems: 'center', justifyContent: 'center' }}>
                  {k === 1 ? <Ionicons name="images-outline" size={26} color="rgba(255,255,255,0.8)" /> : null}
                </View>
              ))}
            </View>
            <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', textAlign: 'center' }}>{t('ml_empty_t2')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{t('ml_empty_b2')}</Text>
            <Pressable onPress={() => add(accept, null)} disabled={!!busy} accessibilityRole="button" style={{ marginTop: 22, outlineStyle: 'none' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 13, opacity: busy ? 0.5 : 1 }}>
                <Ionicons name="add" size={19} color="#111" />
                <Text style={{ color: '#111', fontSize: 15, fontWeight: '900', marginStart: 6 }}>{t('ml_add_phone')}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {confirmDel ? (
          <View style={{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 16, backgroundColor: '#1F1E2A', borderRadius: R, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', flex: 1 }}>{t('ml_remove_q')}</Text>
            <Pressable onPress={() => drop(confirmDel)} style={{ marginRight: 16 }}>
              <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '900' }}>{t('remove')}</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmDel(null)}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: '800' }}>{t('keep_word')}</Text>
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
