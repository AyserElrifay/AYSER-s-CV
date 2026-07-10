import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, R, TEXT_BGS } from '../constants/theme';
import { ME, HIGHLIGHTS, MY_MOMENTS, BADGES } from '../constants/mockData';
import { Tick, GhostButton } from '../components';
import { SettingsScreen } from './SettingsScreen';
import { tapLight, tapSelection } from '../utils/feedback';

/* ─── YOUR SPACE — the profile, Facebook / Instagram / X style ───
   Clean identity header, stats, highlights, then your moment grid.
   The gear opens Settings (where the wallet now lives). */

const GAP = 3;
const COL = 3;
const SIZE = (Dimensions.get('window').width - 32 - GAP * (COL - 1)) / COL;

const Stat = ({ n, label }) => (
  <Pressable onPress={tapSelection} style={{ alignItems: 'center', flex: 1 }}>
    <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>{n}</Text>
    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2, letterSpacing: 0.3 }}>{label}</Text>
  </Pressable>
);

const GridCell = ({ item }) => {
  if (item.text) {
    const bg = TEXT_BGS[item.textBg] || TEXT_BGS.plain;
    return (
      <LinearGradient
        colors={bg.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', padding: 8 }}
      >
        <Text style={{ color: bg.text, fontSize: 11.5, fontWeight: '700', textAlign: 'center', lineHeight: 15 }} numberOfLines={4}>
          {item.text}
        </Text>
      </LinearGradient>
    );
  }
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Image source={{ uri: item.media }} style={{ width: SIZE, height: SIZE }} />
      {item.kind === 'reel' ? (
        <MaterialCommunityIcons name="play-box-outline" size={16} color="#fff" style={{ position: 'absolute', top: 6, right: 6, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 }} />
      ) : null}
      <View style={{ position: 'absolute', bottom: 5, left: 6, flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name="star-four-points" size={11} color={C.gold} />
        <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', marginLeft: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>{item.vibes}</Text>
      </View>
    </View>
  );
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState('grid');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* top bar — handle + gear */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{ME.handle}</Text>
            {ME.verified ? <Tick /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={tapLight} hitSlop={8} style={{ marginRight: 18 }}>
              <MaterialCommunityIcons name="plus-box-outline" size={24} color={C.text} />
            </Pressable>
            <Pressable onPress={() => { tapLight(); setSettings(true); }} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={C.text} />
            </Pressable>
          </View>
        </View>

        {/* identity */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient
              colors={[C.gold, C.purple, C.green]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ backgroundColor: C.bg, borderRadius: 46, padding: 3 }}>
                <Image source={{ uri: ME.avatar }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              </View>
            </LinearGradient>
            <View style={{ flex: 1, flexDirection: 'row', marginLeft: 6 }}>
              <Stat n={ME.moments} label="Moments" />
              <Stat n={ME.mates} label="Mates" />
              <Stat n={ME.campfires} label="Campfires" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{ME.name}</Text>
            <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 }}>
              <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800' }}>{ME.intent}</Text>
            </View>
          </View>
          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 6 }}>{ME.bio}</Text>

          {/* badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {BADGES.map((b) => (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 12 }}>{b.emoji}</Text>
                <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700', marginLeft: 5 }}>{b.label}</Text>
              </View>
            ))}
          </View>

          {/* actions */}
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <GhostButton small label="Edit your space" onPress={tapLight} style={{ flex: 1, marginRight: 8 }} />
            <GhostButton small label="Share profile" onPress={tapLight} style={{ flex: 1, marginRight: 8 }} />
            <Pressable onPress={tapLight} style={{ width: 44 }}>
              <View style={{ borderRadius: R - 4, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 10, alignItems: 'center' }}>
                <Ionicons name="person-add-outline" size={16} color={C.text} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* highlights */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginTop: 20 }}>
          {HIGHLIGHTS.map((h) => (
            <Pressable key={h.id} onPress={tapSelection} style={{ alignItems: 'center', marginRight: 16 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.line, padding: 3 }}>
                <Image source={{ uri: h.cover }} style={{ width: '100%', height: '100%', borderRadius: 28 }} />
              </View>
              <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 5, fontWeight: '600' }}>{h.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={tapLight} style={{ alignItems: 'center', marginRight: 16 }}>
            <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={26} color={C.faint} />
            </View>
            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 5 }}>New</Text>
          </Pressable>
        </ScrollView>

        {/* tab strip */}
        <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: C.line }}>
          {[
            { key: 'grid', icon: 'grid-outline' },
            { key: 'reels', icon: 'play-outline' },
            { key: 'tagged', icon: 'pricetag-outline' },
          ].map((t) => (
            <Pressable key={t.key} onPress={() => { tapSelection(); setTab(t.key); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name={t.icon} size={22} color={tab === t.key ? C.text : C.faint} />
              {tab === t.key ? <View style={{ height: 2, width: '60%', backgroundColor: C.text, marginTop: 10, position: 'absolute', bottom: -1 }} /> : null}
            </Pressable>
          ))}
        </View>

        {/* grid */}
        {tab === 'tagged' ? (
          <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 }}>
            <Ionicons name="pricetag-outline" size={30} color={C.faint} />
            <Text style={{ color: C.faint, fontSize: 13, marginTop: 10, textAlign: 'center' }}>Moments you're tagged in will show up here ✨</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: GAP }}>
            {(tab === 'reels' ? MY_MOMENTS.filter((m) => m.kind === 'reel') : MY_MOMENTS).map((item, i) => (
              <Pressable
                key={item.id}
                onPress={tapSelection}
                style={{ marginRight: (i % COL === COL - 1) ? 0 : GAP, marginBottom: GAP, borderRadius: 4, overflow: 'hidden' }}
              >
                <GridCell item={item} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}>
        <SettingsScreen onClose={() => setSettings(false)} />
      </Modal>
    </View>
  );
};
