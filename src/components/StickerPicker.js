import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { STICKERS, stickerToDataUrl } from '../services/avatarArt';
import { tapLight } from '../utils/feedback';

/* ── YOUR STICKERS ──────────────────────────────────────────────────
   Your own avatar pulling a face — because the character is drawn by
   us, a sticker is the same character with a different expression. No
   pack to download, and it's you rather than a stock cartoon. Tap one
   and it's sent into the chat as a real message. */
export const StickerPicker = ({ dna, onPick, onClose }) => {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(null);

  const send = async (st) => {
    if (busy) return;
    tapLight();
    setBusy(st.id);
    const url = stickerToDataUrl(dna, st, 320);
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
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', flex: 1 }}>Your stickers</Text>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 10 }}>
          {STICKERS.map((st) => {
            const uri = stickerToDataUrl(dna, st, 160);
            return (
              <Pressable key={st.id} onPress={() => send(st)} style={{ width: '25%', alignItems: 'center', paddingVertical: 8, opacity: busy === st.id ? 0.5 : 1 }}>
                {uri ? <Image source={{ uri }} style={{ width: 68, height: 68 }} /> : <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.glassHi }} />}
                <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{st.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', paddingHorizontal: 24, lineHeight: 16 }}>
          These are made from your own avatar — change your look and every sticker changes with it.
        </Text>
      </View>
    </Modal>
  );
};
