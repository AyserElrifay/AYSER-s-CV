import React, { useState, useEffect } from 'react';
import { View, Text, Modal, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchVibers, fetchLaughers, toggleVibe, toggleLaugh } from '../services/social';
import { useAuth } from '../context/AuthContext';
import { tapLight } from '../utils/feedback';
import { Micro } from './Micro';
import { ProfileModal } from './ProfileModal';

/* The people who starred a post. Tap anyone to open their profile —
   real accounts only, no fabricated names. */

const toProfileUser = (p) => ({
  id: p.id,
  name: p.name || 'Explorer',
  handle: p.handle ? '@' + p.handle : null,
  avatar: p.avatar_url || AV_NEUTRAL,
  verified: !!p.verified,
  intent: p.intent || null,
  bio: p.bio || null,
  countryFlag: p.country_flag || null,
});

export const LikersSheet = ({ post, kind = 'star', onClose, onChanged }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [people, setPeople] = useState(null);
  const [openProfile, setOpenProfile] = useState(null);
  const [pulling, setPulling] = useState(false);
  const isLaugh = kind === 'laugh';

  /* You can see yourself in this list, so you should be able to leave
     it. Taking your laugh back from here removes the row for real —
     the same call the button on the card makes. */
  const takeMineBack = async () => {
    if (!user || !post || pulling) return;
    tapLight();
    setPulling(true);
    setPeople((list) => (list || []).filter((p) => p.id !== user.id));
    try {
      if (SUPABASE_READY) await (isLaugh ? toggleLaugh : toggleVibe)(post.id, user.id, false);
      onChanged && onChanged(kind, false);
    } catch (e) {
      const fetcher = isLaugh ? fetchLaughers : fetchVibers;
      fetcher(post.id).then(setPeople).catch(() => {});
    } finally { setPulling(false); }
  };

  useEffect(() => {
    if (!SUPABASE_READY || !post) { setPeople([]); return; }
    const fetcher = isLaugh ? fetchLaughers : fetchVibers;
    fetcher(post.id).then(setPeople).catch(() => setPeople([]));
  }, [post, kind]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '72%', paddingBottom: insets.bottom + 12,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isLaugh ? (
              <Text style={{ fontSize: 15 }}>😂</Text>
            ) : (
              <MaterialCommunityIcons name="star-four-points" size={16} color={C.gold} />
            )}
            <Micro>{'  ' + (isLaugh ? 'Laughs' : 'Stars') + (people && people.length ? ' · ' + people.length : '')}</Micro>
          </View>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        {people === null ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Loading…</Text>
        ) : people.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 30 }}>{isLaugh ? '😄' : '✦'}</Text>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 8 }}>{isLaugh ? 'No laughs yet' : 'No stars yet'}</Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 4, textAlign: 'center' }}>{isLaugh ? 'Be the first to laugh at this moment.' : 'Be the first to star this moment.'}</Text>
          </View>
        ) : (
          <FlatList
            data={people}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item: p }) => (
              <Pressable onPress={() => { tapLight(); setOpenProfile(toProfileUser(p)); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>
                      {p.name || 'Explorer'}{p.country_flag ? ' ' + p.country_flag : ''}
                    </Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                      {p.handle ? '@' + p.handle : (p.intent || 'Explorer')}
                    </Text>
                  </View>
                  {user && p.id === user.id ? (
                    <Pressable onPress={takeMineBack} hitSlop={8}
                      style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: C.coral, fontSize: 12, fontWeight: '900' }}>
                        {isLaugh ? 'Remove my laugh' : 'Remove my star'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={C.faint} />
                  )}
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
      {openProfile ? <ProfileModal user={openProfile} onClose={() => setOpenProfile(null)} /> : null}
    </Modal>
  );
};
