import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { STORIES } from '../constants/mockData';
import { AvatarRing } from './AvatarRing';

export const StoriesBar = ({ onOpenProfile }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingRight: 8 }}>
    <View style={{ alignItems: 'center', marginRight: 14 }}>
      <View
        style={{
          width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.purple,
          borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft,
        }}
      >
        <Ionicons name="add" size={26} color="#CDB4FF" />
      </View>
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>Your vibe</Text>
    </View>
    {STORIES.map((u) => (
      <Pressable key={u.id} onPress={() => onOpenProfile(u)} style={{ alignItems: 'center', marginRight: 14 }}>
        <AvatarRing uri={u.avatar} size={62} live={u.live} />
        <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>{u.name.split(' ')[0]}</Text>
      </Pressable>
    ))}
  </ScrollView>
);
