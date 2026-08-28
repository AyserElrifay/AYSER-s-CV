import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
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

  /* The bar was six pixels tall and tap-only, which is not a control —
     it is a target you miss. It drags now, inside a tap area tall
     enough for a thumb, and while you are dragging the time readout
     follows your finger instead of the audio. */
  const barWidth = React.useRef(0);
  const barX = React.useRef(0);
  const [scrub, setScrub] = React.useState(null);   // 0..1 while dragging

  const posFrom = (pageX) => {
    const w = barWidth.current || 1;
    return Math.max(0, Math.min(1, (pageX - barX.current) / w));
  };

  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setScrub(posFrom(e.nativeEvent.pageX)),
      onPanResponderMove: (e) => setScrub(posFrom(e.nativeEvent.pageX)),
      onPanResponderRelease: (e) => {
        const p = posFrom(e.nativeEvent.pageX);
        setScrub(null);
        if (durationRef.current) seekRef.current(p * durationRef.current);
      },
      onPanResponderTerminate: () => setScrub(null),
    })
  ).current;

  /* The responder is created once, so it must read the live duration
     and seek through refs rather than the values captured at birth. */
  const durationRef = React.useRef(duration);
  const seekRef = React.useRef(seek);
  durationRef.current = duration;
  seekRef.current = seek;

  const nudge = (secs) => {
    if (!duration) return;
    seek(Math.max(0, Math.min(duration, position + secs)));
  };

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

          {/* seek bar — draggable, with a thumb-sized hit area */}
          <View style={{ paddingHorizontal: 26, marginTop: 26 }}>
            <View
              {...pan.panHandlers}
              onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
              ref={(r) => { if (r && r.measureInWindow) r.measureInWindow((x) => { barX.current = x; }); }}
              style={{ height: 34, justifyContent: 'center' }}
            >
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.gold, width: ((scrub != null ? scrub : pct) * 100) + '%' }} />
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (scrub != null ? scrub : pct) * (barWidth.current || 0) - 8,
                  width: 16, height: 16, borderRadius: 8, backgroundColor: C.gold,
                  shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6,
                  transform: [{ scale: scrub != null ? 1.25 : 1 }],
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={{ color: scrub != null ? C.gold : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: scrub != null ? '900' : '400' }}>
                {fmt(scrub != null ? scrub * duration : position)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{fmt(duration)}</Text>
            </View>
          </View>

          {/* transport */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 }}>
            <Pressable onPress={() => { tapLight(); setShuffle(); }} hitSlop={10} style={{ marginHorizontal: 18 }}>
              <Ionicons name="shuffle" size={22} color={shuffle ? C.gold : 'rgba(255,255,255,0.55)'} />
            </Pressable>
            {/* the control a four-minute record actually needs */}
            <Pressable onPress={() => { tapLight(); nudge(-15); }} hitSlop={10} style={{ marginHorizontal: 10 }}>
              <Ionicons name="play-back" size={20} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable onPress={() => { tapLight(); prev(); }} hitSlop={10} style={{ marginHorizontal: 14 }}>
              <Ionicons name="play-skip-back" size={30} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => { tapLight(); toggle(); }} hitSlop={10} style={{ marginHorizontal: 18 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={playing ? 'pause' : 'play'} size={34} color="#12071f" style={{ marginLeft: playing ? 0 : 3 }} />
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); next(); }} hitSlop={14} style={{ marginHorizontal: 14 }}>
              <Ionicons name="play-skip-forward" size={30} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => { tapLight(); nudge(15); }} hitSlop={10} style={{ marginHorizontal: 10 }}>
              <Ionicons name="play-forward" size={20} color="rgba(255,255,255,0.75)" />
            </Pressable>
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
