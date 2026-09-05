import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { tapLight, tapSuccess } from '../utils/feedback';
import { grabFrames, pickBest } from '../lib/frames';
import { compressImage } from '../lib/storage';

/* ─── CHANGING THE COVER AFTER IT IS POSTED ───────────────────────────
   "او بعد ما ينزلها و يحطه" — the second half of the ask, and the
   harder one: the file is on the server now, so the frames have to be
   read back out of it.

   A canvas that has drawn a video from another origin refuses to be
   read (that is the whole point of the rule — a page must not be able
   to look at pictures from a site you are signed in to). Our storage
   sends the header that permits it, so asking with crossOrigin set
   normally works. When it does not, the strip does not appear and the
   only honest answer is offered instead: use a picture from the phone.

   Nothing here uploads. It hands back a data URL and the screen that
   opened it decides what that means — which is what keeps this the
   same sheet for a moment, a reel and a video. */
export const CoverSheet = ({ videoUrl, current, onClose, onChoose }) => {
  const { t } = useLang();
  const [frames, setFrames] = useState(null);     // null = still looking
  const [blocked, setBlocked] = useState(false);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    if (Platform.OS !== 'web' || !videoUrl) { setFrames([]); return () => {}; }
    grabFrames(videoUrl, 6, { crossOrigin: true }).then((r) => {
      if (dead) return;
      setFrames(r.frames);
      setBlocked(r.blocked || (!r.frames.length));
      const best = pickBest(r.frames);
      if (r.frames.length && best >= 0) setPicked(r.frames[best].url);
    });
    return () => { dead = true; };
  }, [videoUrl]);

  /* the way out when the frames cannot be read — and a perfectly good
     way in its own right: a lot of people would rather use a photo
     they took than a frame of the clip */
  /* one file input, made and thrown away — the capture screen has its
     own and this sheet is opened from three different places that do
     not have one */
  const pickImage = () => new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
    document.body.appendChild(input);
    input.click();
    return undefined;
  });

  const fromPhone = async () => {
    try {
      const file = await pickImage();
      if (!file) return;
      const small = await compressImage(URL.createObjectURL(file), 1080, 0.85);
      setPicked(small);
    } catch (e) { /* they closed the picker */ }
  };

  const save = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try { await onChoose(picked); tapSuccess(); onClose(); }
    catch (e) { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 28 }}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{t('cover_title')}</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, marginBottom: 12 }}>{t('cover_sub')}</Text>

        {frames === null ? (
          <View style={{ height: 132, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.purple} />
          </View>
        ) : frames.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {frames.map((f) => {
              const on = picked === f.url;
              return (
                <Pressable key={f.t} onPress={() => { tapLight(); setPicked(f.url); }} style={{ marginRight: 10 }}>
                  <Image
                    source={{ uri: f.url }}
                    style={{
                      width: 84, height: 124, borderRadius: 12, backgroundColor: C.glassHi,
                      borderWidth: on ? 2.5 : 1, borderColor: on ? C.purple : C.line,
                    }}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
            {t('cover_no_frames')}
          </Text>
        )}

        {/* always offered, not only when the frames failed */}
        <Pressable onPress={() => { tapLight(); fromPhone(); }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: C.line, borderRadius: 14, marginBottom: 12 }}>
            <Ionicons name="image-outline" size={17} color={C.purple} />
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginLeft: 9 }}>{t('cover_from_phone')}</Text>
          </View>
        </Pressable>

        {picked ? (
          <Image source={{ uri: picked }} style={{ width: '100%', height: 150, borderRadius: 14, backgroundColor: C.glassHi, marginBottom: 12 }} resizeMode="cover" />
        ) : null}

        <Pressable onPress={save} disabled={!picked || busy}>
          <View style={{ backgroundColor: picked ? C.purple : C.glassHi, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ color: picked ? '#FFF' : C.faint, fontSize: 14, fontWeight: '900' }}>
              {busy ? t('saving_dots') : t('cover_use')}
            </Text>
          </View>
        </Pressable>
        {blocked && frames && !frames.length ? (
          <Text style={{ color: C.faint, fontSize: 11, marginTop: 8, textAlign: 'center' }}>{t('cover_blocked')}</Text>
        ) : null}
      </View>
    </Modal>
  );
};
