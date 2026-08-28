import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { STICKERS, stickerToDataUrl } from '../services/avatarArt';
import { COMICS, comicToDataUrl } from '../services/comicArt';
import { tapLight, tapSelection } from '../utils/feedback';

/* ── STICKERS ───────────────────────────────────────────────────────
   Two packs, both ours. "You" is your own avatar pulling a face — the
   character is drawn by us, so a sticker is that same character with a
   different expression. "Comics" is a hand-drawn strip pack: bursts,
   speech bubbles and little objects, painted onto a canvas the moment
   you tap them. Half of it speaks Arabic.

   Nothing here was downloaded, traced or borrowed, which is exactly
   why we can hand out this many of them. */
export const StickerPicker = ({ dna, onPick, onClose }) => {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(null);
  const [pack, setPack] = useState('comics');

  const send = async (st) => {
    if (busy) return;
    tapLight();
    setBusy(st.id);
    const url = pack === 'comics' ? comicToDataUrl(st, 320) : stickerToDataUrl(dna, st, 320);
    try { if (url) await onPick(url, st); } finally { setBusy(null); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, paddingBottom: insets.bottom + 14, maxHeight: '70%',
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', flex: 1 }}>Stickers</Text>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        {/* two packs — the comic strip, and you */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.glassHi, borderRadius: 999, padding: 4, marginBottom: 6 }}>
          {[{ k: 'comics', label: 'Comics 💥' }, { k: 'you', label: 'You ✨' }].map((t) => (
            <Pressable key={t.k} onPress={() => { tapSelection(); setPack(t.k); }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, backgroundColor: pack === t.k ? C.purple : 'transparent' }}>
              <Text style={{ color: pack === t.k ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800' }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 10 }}>
          {(pack === 'comics' ? COMICS : STICKERS).map((st) => {
            const uri = pack === 'comics' ? comicToDataUrl(st, 160) : stickerToDataUrl(dna, st, 160);
            return (
              <Pressable key={st.id} onPress={() => send(st)} style={{ width: '25%', alignItems: 'center', paddingVertical: 8, opacity: busy === st.id ? 0.5 : 1 }}>
                {uri ? <Image source={{ uri }} style={{ width: 68, height: 68 }} /> : <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.glassHi }} />}
                <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{st.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', paddingHorizontal: 24, lineHeight: 16 }}>
          {pack === 'comics'
            ? 'Every one of these is drawn by us — no packs to download, and nothing borrowed from anyone.'
            : 'These are made from your own avatar — change your look and every sticker changes with it.'}
        </Text>
      </View>
    </Modal>
  );
};
