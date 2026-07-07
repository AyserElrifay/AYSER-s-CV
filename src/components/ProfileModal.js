import React from 'react';
import { View, Text, ScrollView, Pressable, Image, ImageBackground, Modal, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { pic } from '../constants/mockData';
import { Glass } from './Glass';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { VouchBadge } from './VouchBadge';
import { AvatarRing } from './AvatarRing';
import { NeonButton } from './NeonButton';
import { GhostButton } from './GhostButton';
import { SectionHeader } from './SectionHeader';

const { width: W } = Dimensions.get('window');

export const ProfileModal = ({ user, onClose }) => {
  const insets = useSafeAreaInsets();
  if (!user) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          <ImageBackground source={{ uri: pic(user.id + 'cover', 900, 500) }} style={{ height: 190 }}>
            <LinearGradient colors={['rgba(18,18,18,0.15)', C.bg]} style={{ flex: 1 }} />
            <Pressable
              onPress={onClose}
              style={{
                position: 'absolute', top: insets.top + 10, left: 16,
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: 'rgba(18,18,20,0.7)', borderWidth: 1, borderColor: C.line,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-down" size={20} color={C.text} />
            </Pressable>
          </ImageBackground>

          <View style={{ paddingHorizontal: 20, marginTop: -44 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <AvatarRing uri={user.avatar} size={88} live={user.live} />
              <Chip label={user.intent} tint={C.purpleSoft} color={C.purple} style={{ marginBottom: 8, borderColor: 'rgba(124,58,237,0.45)' }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{user.name}</Text>
              {user.verified ? <Tick size={17} /> : null}
            </View>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>
              {user.handle} · <Text style={{ color: C.blue }}>ID Verified</Text>
            </Text>

            <VouchBadge tag={user.vouchTag} count={user.vouches} style={{ marginTop: 14, alignSelf: 'flex-start' }} />

            <Text style={{ color: C.text, fontSize: 14, lineHeight: 21, marginTop: 14 }}>{user.bio}</Text>

            <Glass style={{ flexDirection: 'row', marginTop: 18, paddingVertical: 14 }}>
              {[
                { n: user.moments, l: 'Moments' },
                { n: user.mates, l: 'Roam Mates' },
                { n: user.campfires, l: 'Campfires' },
              ].map((s, i) => (
                <View key={s.l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.line }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{s.n}</Text>
                  <Text style={{ color: C.faint, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 }}>{s.l.toUpperCase()}</Text>
                </View>
              ))}
            </Glass>

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <NeonButton small label="JOIN THEIR NEXT VIBE" icon="⚡" style={{ flex: 1, marginRight: 10 }} onPress={onClose} />
              <GhostButton small label="Message" style={{ width: 110 }} onPress={onClose} />
            </View>

            <SectionHeader title="Recent Moments" style={{ marginTop: 26 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Image
                  key={i}
                  source={{ uri: pic(user.id + 'm' + i, 400, 400) }}
                  style={{ width: (W - 48) / 3, height: (W - 48) / 3, borderRadius: 14, margin: 4 }}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
