import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { usePlayer } from '../context/PlayerContext';
import { tapLight } from '../utils/feedback';

const fmt = (s) => {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
};

/* The full-screen player — big art, artist, a real seek bar, transport
   controls, shuffle, the licence credit, and the up-next queue. */
export const NowPlayingSheet = () => {
  const {
    current, queue, index, playing, position, duration, shuffle,
    toggle, next, prev, seek, setShuffle, closeFull, playTrack,
  } = usePlayer();
  const insets = useSafeAreaInsets();
  if (!current) return null;
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;

  // tap anywhere on the bar to seek there
  const onBar = (e) => {
    if (!duration) return;
    const { locationX, target } = e.nativeEvent;
    // width is measured via onLayout below
    const w = barWidth.current || 1;
    seek(Math.max(0, Math.min(1, locationX / w)) * duration);
  };
  const barWidth = React.useRef(0);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={closeFull}>
      <LinearGradient colors={['#241146', '#12071f', '#08040f']} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}>
          {/* header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <Pressable onPress={() => { tapLight(); closeFull(); }} hitSlop={10}>
              <Ionicons name="chevron-down" size={30} color="#FFF" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 }}>NOW PLAYING</Text>
            </View>
            <View style={{ width: 30 }} />
          </View>

          {/* big cover */}
          <View style={{ alignItems: 'center', marginTop: 30, marginBottom: 24 }}>
            <View style={{ width: 230, height: 230, borderRadius: 28, backgroundColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
              <Text style={{ fontSize: 96 }}>{current.emoji || '🎵'}</Text>
            </View>
          </View>

          {/* title + artist */}
          <View style={{ paddingHorizontal: 26 }}>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900' }} numberOfLines={1}>{current.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.66)', fontSize: 14, marginTop: 4 }} numberOfLines={1}>{current.artist || 'indie'}</Text>
            {current.license ? (
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5, marginTop: 6 }} numberOfLines={1}>
                © {current.license}{current.attribution ? ' · ' + current.attribution : ''}
              </Text>
            ) : null}
          </View>

          {/* seek bar */}
          <View style={{ paddingHorizontal: 26, marginTop: 26 }}>
            <Pressable onPress={onBar} onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.gold, width: (pct * 100) + '%' }} />
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{fmt(position)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{fmt(duration)}</Text>
            </View>
          </View>

          {/* transport */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 }}>
            <Pressable onPress={() => { tapLight(); setShuffle(); }} hitSlop={10} style={{ marginHorizontal: 18 }}>
              <Ionicons name="shuffle" size={22} color={shuffle ? C.gold : 'rgba(255,255,255,0.55)'} />
            </Pressable>
            <Pressable onPress={() => { tapLight(); prev(); }} hitSlop={10} style={{ marginHorizontal: 14 }}>
              <Ionicons name="play-skip-back" size={30} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => { tapLight(); toggle(); }} hitSlop={10} style={{ marginHorizontal: 18 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={playing ? 'pause' : 'play'} size={34} color="#12071f" style={{ marginLeft: playing ? 0 : 3 }} />
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); next(); }} hitSlop={10} style={{ marginHorizontal: 14 }}>
              <Ionicons name="play-skip-forward" size={30} color="#FFF" />
            </Pressable>
            <View style={{ width: 22, marginHorizontal: 18 }} />
          </View>

          {/* up next */}
          {queue.length > 1 ? (
            <View style={{ flex: 1, marginTop: 24 }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 26, marginBottom: 8 }}>UP NEXT</Text>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
                {queue.map((t, i) => (
                  <Pressable key={t.id + '-' + i} onPress={() => { tapLight(); playTrack(t, queue, i); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 12, backgroundColor: i === index ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                      <Text style={{ fontSize: 20, width: 30 }}>{t.emoji || '🎵'}</Text>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ color: i === index ? C.gold : '#FFF', fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{t.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{t.artist || 'indie'}</Text>
                      </View>
                      {i === index ? <Ionicons name="musical-notes" size={16} color={C.gold} /> : null}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : <View style={{ flex: 1 }} />}
        </View>
      </LinearGradient>
    </Modal>
  );
};
