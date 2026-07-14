import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchMyMates, unmate } from '../services/mates';
import { tapLight } from '../utils/feedback';
import { Micro } from './Micro';
import { ProfileModal } from './ProfileModal';

/* Your mates — the real friend list. Tap one to open their profile
   (message them from there); long game: remove with Unmate. */

export const MatesSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mates, setMates] = useState(null);
  const [confirm, setConfirm] = useState(null); // mate pending unmate confirm
  const [openMate, setOpenMate] = useState(null);

  const load = useCallback(async () => {
    if (!SUPABASE_READY || !user) { setMates([]); return; }
    try { setMates(await fetchMyMates(user.id)); } catch (e) { setMates([]); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const doUnmate = async (m) => {
    tapLight();
    setMates((list) => (list || []).filter((x) => x.id !== m.id));
    setConfirm(null);
    try { await unmate(user.id, m.id); } catch (e) {}
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '75%', paddingBottom: insets.bottom + 12,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Micro>Your Mates 🤝{mates ? ' · ' + mates.length : ''}</Micro>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        {mates === null ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Loading…</Text>
        ) : mates.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 34 }}>🤝</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 10 }}>No mates yet</Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              Find people on the Map or in Search and hit “Mate up” — accepted requests land here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={mates}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item: m }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Pressable
                  onPress={() => { tapLight(); setOpenMate({ id: m.id, name: m.name || 'Explorer', handle: m.handle ? '@' + m.handle : null, avatar: m.avatar_url || av(60), verified: !!m.verified, intent: m.intent, bio: m.bio, countryFlag: m.country_flag }); }}
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                >
                  <Image source={{ uri: m.avatar_url || av(60) }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{m.name || 'Explorer'} {m.country_flag || ''}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{m.intent || (m.handle ? '@' + m.handle : 'Explorer')}</Text>
                  </View>
                </Pressable>
                {confirm === m.id ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={() => doUnmate(m)} style={{ marginRight: 8 }}>
                      <View style={{ backgroundColor: C.coral, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>Remove</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => setConfirm(null)}>
                      <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700' }}>Keep</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => { tapLight(); setConfirm(m.id); }} hitSlop={8}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={C.faint} />
                  </Pressable>
                )}
              </View>
            )}
          />
        )}
      </View>
      {openMate ? <ProfileModal user={openMate} onClose={() => setOpenMate(null)} /> : null}
    </Modal>
  );
};
