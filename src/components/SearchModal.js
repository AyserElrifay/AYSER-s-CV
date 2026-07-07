import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { USERS, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { searchProfiles } from '../services/social';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { Micro } from './Micro';

/* Find people. One input, instant results, tap to open their profile.
   Demo mode searches the built-in crew; real mode searches profiles. */

const fromProfileRow = (row) => ({
  id: row.id,
  name: row.name || 'Explorer',
  handle: row.handle || '@' + (row.name || 'explorer').toLowerCase().replace(/\s+/g, '.'),
  emoji: row.emoji || '🧿',
  avatar: row.avatar_url || av(60),
  verified: !!row.verified,
  vouches: row.vouches || 1,
  vouchTag: row.vouch_tag || 'New Explorer',
  intent: row.intent || 'Exploring 🧭',
  moments: row.moments || 0,
  mates: row.mates || 0,
  campfires: row.campfires || 0,
  bio: row.bio || 'New to Moments — say hi! 👋',
});

export const SearchModal = ({ onClose, onOpenProfile }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState(null); // null until a real search ran

  const mockPeople = useMemo(() => Object.values(USERS), []);

  useEffect(() => {
    if (!SUPABASE_READY) return;
    if (!query.trim()) { setRemote(null); return; }
    const t = setTimeout(async () => {
      try { setRemote((await searchProfiles(query)).map(fromProfileRow)); }
      catch (e) { setRemote([]); }
    }, 280); // small debounce, feels instant without spamming the API
    return () => clearTimeout(t);
  }, [query]);

  const results = SUPABASE_READY && remote !== null
    ? remote
    : mockPeople.filter((u) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q);
      });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12 }}>
        {/* search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
              borderRadius: 999, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 4,
            }}
          >
            <Ionicons name="search" size={16} color={C.dim} />
            <TextInput
              placeholder="Search people…"
              placeholderTextColor={C.faint}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              style={{ color: C.text, marginLeft: 10, flex: 1, fontSize: 14.5 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={C.faint} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={onClose} style={{ marginLeft: 12 }}>
            <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 }}>
          <Micro>{query.trim() ? 'People' : 'Suggested for you'}</Micro>
        </View>

        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>
              No one found for “{query.trim()}” — yet 🌱
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenProfile(item)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
                <Image source={{ uri: item.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{item.name}</Text>
                    {item.verified ? <Tick /> : null}
                  </View>
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{item.handle}</Text>
                </View>
                <Chip label={item.intent} tint={C.purpleSoft} color="#CDB4FF" style={{ borderColor: 'rgba(124,58,237,0.35)' }} />
              </View>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
};
