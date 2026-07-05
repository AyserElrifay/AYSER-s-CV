import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { FEED } from '../constants/mockData';
import { StoriesBar, PostCard, MagicFlowModal, ProfileModal } from '../components';

/* ───────────────────── TAB 1 · HOME — THE ACTION FEED ──────────────── */

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const [joined, setJoined] = useState({});
  const [magicPost, setMagicPost] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={FEED}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 130, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', letterSpacing: 5 }}>MOMENTS</Text>
                <Text style={{ color: C.faint, fontSize: 11, marginTop: 2, letterSpacing: 0.4 }}>
                  Don&apos;t scroll it. Live it.
                </Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="search" size={17} color={C.text} />
                </View>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="notifications-outline" size={17} color={C.text} />
                  <View style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: C.coral }} />
                </View>
              </View>
            </View>
            <StoriesBar onOpenProfile={setProfileUser} />
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            joined={!!joined[item.id]}
            onJoin={setMagicPost}
            onOpenProfile={setProfileUser}
          />
        )}
      />

      {magicPost ? (
        <MagicFlowModal
          post={magicPost}
          onClose={() => setMagicPost(null)}
          onComplete={(id) => {
            setJoined((j) => ({ ...j, [id]: true }));
            setMagicPost(null);
          }}
        />
      ) : null}
      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
    </View>
  );
};
