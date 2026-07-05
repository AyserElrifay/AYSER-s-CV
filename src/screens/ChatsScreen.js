import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SQUADS, DMS } from '../constants/mockData';
import { Page, ScreenHeader, SectionHeader, Glass, Chip, Tick, AvatarStack } from '../components';

/* ─────────────────── TAB 4 · CHATS — CONNECTIONS ───────────────────── */

export const ChatsScreen = () => (
  <Page>
    <ScreenHeader
      kicker="Connections"
      title="Chats 💬"
      right={
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="create-outline" size={17} color={C.text} />
        </View>
      }
    />

    <SectionHeader title="Roam Mates · Active Squads" />
    {SQUADS.map((s) => (
      <Pressable key={s.id}>
        <Glass tint={C.blueSoft} border="rgba(59,130,246,0.35)" style={{ padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
                <Chip label={s.activity} color="#9EC5FF" tint="rgba(59,130,246,0.16)" style={{ marginLeft: 8, borderColor: 'rgba(59,130,246,0.35)' }} />
              </View>
              <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }} numberOfLines={1}>{s.last}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
              <Text style={{ color: C.faint, fontSize: 11 }}>{s.time}</Text>
              {s.unread > 0 ? (
                <View style={{ marginTop: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{s.unread}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <AvatarStack uris={s.members} />
            <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 10 }}>
              {s.members.length} Roam Mates · squad expires after the vibe
            </Text>
          </View>
        </Glass>
      </Pressable>
    ))}

    <SectionHeader title="Direct" style={{ marginTop: 14 }} />
    {DMS.map((d) => (
      <Pressable key={d.id}>
        <Glass style={{ padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: d.user.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{d.user.name}</Text>
              {d.user.verified ? <Tick /> : null}
              {d.translated ? (
                <MaterialCommunityIcons name="translate" size={14} color={C.blue} style={{ marginLeft: 7 }} />
              ) : null}
            </View>
            <Text style={{ color: d.unread ? C.text : C.dim, fontSize: 12.5, marginTop: 3, fontWeight: d.unread ? '600' : '400' }} numberOfLines={1}>
              {d.last}
            </Text>
            {d.translated ? (
              <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>Tap to translate · Arabic detected</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
            <Text style={{ color: C.faint, fontSize: 11 }}>{d.time}</Text>
            {d.unread > 0 ? (
              <View style={{ marginTop: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple }} />
            ) : null}
          </View>
        </Glass>
      </Pressable>
    ))}
  </Page>
);
