import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── WHY THE STUDIO DID NOT OPEN ─────────────────────────────────────
   Ayser opened the Studio link and got nothing: no lock, no Studio, no
   reason. When the server did not answer, or did not recognise the
   account, the gate simply drew nothing — right for a stranger with the
   link, useless for the owner. Shown only on the owner's own email
   (src/services/music.js isOwner), so the link still tells nobody else
   that anything is there. */
const WHY = {
  no_answer: ['The server did not answer', 'The connection may have dropped, or the latest database parts are not in yet. Try again in a moment.'],
  not_recognised: ['The server did not recognise this account as the owner', 'You are signed in as {email}. If that is right, run the latest database parts (20 → 27) and try again.'],
};

export const StudioProblem = ({ why, email, onRetry, onClose }) => {
  useSheetBack(onClose);
  const [title, sub] = WHY[why] || WHY.no_answer;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: C.bg, borderRadius: 22, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '900' }}>🔒 Moments Studio</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>{title}</Text>
          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>{sub.replace('{email}', email || '—')}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" style={{ marginTop: 16, backgroundColor: C.purple, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>Try again</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
