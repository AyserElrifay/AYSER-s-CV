import React from 'react';
import { View, Text, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { usePlayer } from '../context/PlayerContext';
import { NowPlayingSheet } from './NowPlayingSheet';
import { tapLight } from '../utils/feedback';

/* The floating now-playing bar. Sits just above the bottom tab bar (or in
   the corner on desktop) whenever a track is loaded, and follows you
   across every tab. Tap it to open the full player. */
export const MiniPlayer = () => {
  const { current, playing, toggle, next, position, duration, openFull, showFull } = usePlayer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sidebar = Platform.OS === 'web' && width >= 820;
  if (!current) return null;

  const pct = duration > 0 ? Math.min(1, position / duration) : 0;
  const bottom = sidebar ? 18 : (Platform.OS === 'ios' ? 86 : 70);
  const left = sidebar ? 236 : 8;
  const right = sidebar ? undefined : 8;
  const maxWidth = sidebar ? 420 : undefined;

  return (
    <>
      <View style={{ position: 'absolute', bottom, left, right, maxWidth, zIndex: 400 }} pointerEvents="box-none">
        <Pressable onPress={() => { tapLight(); openFull(); }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: '#1b1030',
            borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8,
            shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
            borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)',
          }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{current.emoji || '🎵'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{current.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{current.artist || 'indie'}</Text>
            </View>
            <Pressable onPress={() => { tapLight(); toggle(); }} hitSlop={10} style={{ marginRight: 4 }}>
              <Ionicons name={playing ? 'pause' : 'play'} size={24} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => { tapLight(); next(); }} hitSlop={10} style={{ marginLeft: 8 }}>
              <Ionicons name="play-skip-forward" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
          {/* thin progress line */}
          <View style={{ height: 2.5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginHorizontal: 6, marginTop: -1, overflow: 'hidden' }}>
            <View style={{ height: 2.5, backgroundColor: C.gold, width: (pct * 100) + '%' }} />
          </View>
        </Pressable>
      </View>
      {showFull ? <NowPlayingSheet /> : null}
    </>
  );
};
