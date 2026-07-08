import React from 'react';
import { View, Text, Modal, Pressable, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { SOUNDS } from '../constants/mockData';
import { Micro } from './Micro';

/* Pick a track for your story or reel — IG/TikTok style. */
export const SoundPicker = ({ selected, onSelect, onClose }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
          borderWidth: 1, borderColor: C.line, paddingBottom: insets.bottom + 12, maxHeight: 440,
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
          <Micro>Add a sound 🎵</Micro>
        </View>
        <FlatList
          data={SOUNDS}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 14 }}
          renderItem={({ item }) => {
            const sel = selected && selected.id === item.id;
            return (
              <Pressable onPress={() => { onSelect(sel ? null : item); onClose(); }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8,
                    backgroundColor: sel ? C.purpleSoft : C.glass,
                    borderWidth: 1, borderColor: sel ? 'rgba(124,58,237,0.45)' : C.line,
                    borderRadius: 16,
                  }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{item.title}</Text>
                    <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{item.artist} · {item.uses} moments</Text>
                  </View>
                  {sel ? <Ionicons name="checkmark-circle" size={22} color={C.purple} /> : <Ionicons name="add-circle-outline" size={22} color={C.faint} />}
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
};
