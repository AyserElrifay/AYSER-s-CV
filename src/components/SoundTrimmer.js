import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, PanResponder, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { DEFAULT_LEN, MIN_LEN, MAX_LEN, clipUrl, parseClip, clock } from '../lib/soundClip';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';

/* ─── PICK THE BIT OF THE SONG YOU MEANT ──────────────────────────────
   A window you drag along the track. Fifteen seconds to start with,
   because that is what a story is, and stretchable to a minute if the
   moment deserves it.

   It plays while you drag. That is the whole design: choosing a piece
   of music by looking at numbers is guessing, and one loop of the
   actual window tells you in two seconds whether you got the part you
   were thinking of. The preview loops the window exactly — the same
   enforcement the story itself will use, so what you hear here is what
   gets posted.

   The bar is not a waveform. Drawing a real one means downloading and
   decoding the whole file to peaks, and a fake one drawn from noise
   would be a picture of nothing pretending to be a picture of the
   song. A plain track with a clear window on it is honest and does
   the same job. */

const BAR_H = 54;

export const SoundTrimmer = ({ sound, onDone, onClose }) => {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const url = (sound && sound.audio_url) || null;

  const existing = parseClip(url);
  const [dur, setDur] = useState(null);                       // real, from the file
  const [start, setStart] = useState(existing ? existing.start : 0);
  const [len, setLen] = useState(existing && existing.len ? existing.len : DEFAULT_LEN);
  const [playing, setPlaying] = useState(false);
  const [barW, setBarW] = useState(280);

  /* Everything the drag needs, in refs. The PanResponder is built once
     and its handlers keep the values from that first render — where the
     track's duration is still null, because it hasn't been read out of
     the file yet. Closing over that directly means every drag hits the
     "no duration, do nothing" guard and the window never moves. */
  const audioRef = useRef(null);
  const startRef = useRef(start);
  const lenRef = useRef(len);
  const durRef = useRef(dur);
  const barWRef = useRef(barW);
  startRef.current = start;
  lenRef.current = len;
  durRef.current = dur;
  barWRef.current = barW;

  /* The track's real length. Everything on screen is scaled to it, so
     until it arrives there is nothing honest to draw. */
  useEffect(() => {
    if (!isWeb || !url) return undefined;
    let a;
    try {
      a = new window.Audio();
      a.preload = 'metadata';
      a.src = url.split('#')[0];
      a.volume = 0.9;
      audioRef.current = a;
    } catch (e) { return undefined; }

    const onMeta = () => {
      const d = a.duration;
      if (isFinite(d) && d > 0) {
        setDur(d);
        // a window can't run off the end of the song
        setLen((l) => Math.max(MIN_LEN, Math.min(l, Math.min(MAX_LEN, d))));
        setStart((s) => Math.max(0, Math.min(s, Math.max(0, d - MIN_LEN))));
      }
    };
    /* Hold the preview inside the window — the same rule the story
       plays by, so this is a real rehearsal and not an approximation. */
    const onTime = () => {
      if (a.currentTime >= startRef.current + lenRef.current || a.currentTime < startRef.current - 0.4) {
        try { a.currentTime = startRef.current; } catch (e) {}
      }
    };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      try { a.pause(); } catch (e) {}
      audioRef.current = null;
    };
  }, [url, isWeb]);

  const playFrom = (s) => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = Math.max(0, s);
      a.play().then(() => setPlaying(true)).catch(() => {});
    } catch (e) {}
  };
  const stop = () => {
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch (e) {} }
    setPlaying(false);
  };

  const maxStart = dur ? Math.max(0, dur - len) : 0;
  const pxPerSec = dur ? barW / dur : 0;

  /* Drag the window. Position is recomputed from the gesture's own
     start each move, so a slow drag doesn't accumulate rounding. */
  const dragBase = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { dragBase.current = startRef.current; tapLight(); },
      onPanResponderMove: (e, g) => {
        const d = durRef.current;
        if (!d) return;
        const perSec = barWRef.current / d;
        if (!perSec) return;
        const next = Math.max(0, Math.min(Math.max(0, d - lenRef.current), dragBase.current + g.dx / perSec));
        setStart(next);
      },
      onPanResponderRelease: () => { playFrom(startRef.current); },
    })
  ).current;

  const setLength = (l) => {
    tapSelection();
    const capped = dur ? Math.min(l, Math.floor(dur)) : l;
    setLen(Math.max(MIN_LEN, capped));
    if (dur) setStart((s) => Math.min(s, Math.max(0, dur - capped)));
    playFrom(startRef.current);
  };

  const done = () => {
    tapSuccess();
    stop();
    onDone({ ...sound, audio_url: clipUrl(url, start, len), clip: { start, len } });
  };

  const lengths = [15, 30, 45, 60].filter((l) => !dur || l <= Math.max(MIN_LEN, Math.floor(dur)));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { stop(); onClose(); }}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => { stop(); onClose(); }} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, paddingBottom: insets.bottom + 14, paddingHorizontal: 18,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 12 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Text style={{ fontSize: 21 }}>{(sound && sound.emoji) || '🎵'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{sound && sound.title}</Text>
            <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sound && sound.artist}</Text>
          </View>
          <Pressable onPress={() => (playing ? stop() : playFrom(start))} hitSlop={8}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={playing ? 'pause' : 'play'} size={19} color="#FFF" style={{ marginLeft: playing ? 0 : 2 }} />
            </View>
          </Pressable>
        </View>

        {/* the track, with the window on it */}
        <View
          style={{ marginTop: 18, height: BAR_H, borderRadius: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}
          onLayout={(e) => setBarW(Math.max(80, e.nativeEvent.layout.width))}
        >
          {/* evenly spaced ticks — the song's length made visible, not a
              drawing of its sound */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
            {Array.from({ length: 34 }).map((_, n) => (
              <View key={n} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: 2, height: n % 4 === 0 ? 22 : 12, borderRadius: 1, backgroundColor: C.glassHi }} />
              </View>
            ))}
          </View>

          {dur ? (
            <View
              testID="trim-window"
              {...pan.panHandlers}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: Math.max(0, start * pxPerSec),
                width: Math.max(26, len * pxPerSec),
                backgroundColor: 'rgba(124,58,237,0.28)',
                borderWidth: 2, borderColor: C.purple, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="code-outline" size={15} color="#FFF" />
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
          <Text style={{ color: C.faint, fontSize: 11 }}>
            {dur ? clock(start) + ' → ' + clock(start + len) : 'Reading the track…'}
          </Text>
          <Text style={{ color: C.faint, fontSize: 11 }}>{dur ? clock(dur) : ''}</Text>
        </View>

        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 12, marginBottom: 8 }}>How long</Text>
        <View style={{ flexDirection: 'row' }}>
          {lengths.map((l) => {
            const on = Math.round(len) === l;
            return (
              <Pressable key={l} onPress={() => setLength(l)} style={{ flex: 1, marginRight: l === lengths[lengths.length - 1] ? 0 : 8 }}>
                <View style={{
                  paddingVertical: 11, borderRadius: 13, alignItems: 'center',
                  backgroundColor: on ? C.purple : C.glass,
                  borderWidth: 1, borderColor: on ? C.purple : C.line,
                }}>
                  <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 13, fontWeight: '800' }}>{l}s</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ color: C.faint, fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          Drag the purple window to the part you meant. It plays as you move it.
        </Text>

        <Pressable onPress={done} style={{ marginTop: 14 }}>
          <View style={{ backgroundColor: C.purple, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>Use these {Math.round(len)} seconds</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};
