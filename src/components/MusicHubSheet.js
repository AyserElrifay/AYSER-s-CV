import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { HUB_TRACKS, TRACK_MOODS } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchTracks } from '../services/music';
import { tapLight, tapSelection } from '../utils/feedback';
import { sfxPop } from '../utils/sfx';

/* Indie Music Hub — discover original tracks by how they SOUND
   (mood / BPM / instruments), not by artist. Pick one for your reel
   or story. Producers' uploads live here in real mode. */

export const MusicHubSheet = ({ onPick, onClose }) => {
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState('All');
  const [remote, setRemote] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchTracks(mood === 'All' ? {} : { mood })
      .then((rows) => setRemote(rows.map((r) => ({
        id: r.id, title: r.title, cover_emoji: r.cover_emoji, mood: r.mood, bpm: r.bpm,
        music_key: r.music_key, instruments: r.instruments || [], genre_shape: r.genre_shape,
        uses_count: r.uses_count, by: (r.uploader && r.uploader.name) || 'indie producer',
        audio_url: r.audio_url,
      }))))
      .catch(() => setRemote([]));
  }, [mood]);

  const source = SUPABASE_READY ? (remote || []) : HUB_TRACKS.filter((t) => mood === 'All' || t.mood === mood);

  const use = (t) => {
    tapSelection(); sfxPop();
    onPick && onPick({ id: t.id, title: t.title, artist: t.genre_shape || 'indie', emoji: t.cover_emoji || '🎵', audio_url: t.audio_url });
    onClose();
  };

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16, maxHeight: '82%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Music Hub 🎧</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 12 }}>Original indie tracks — find them by feel, not by name</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {TRACK_MOODS.map((m) => (
            <Pressable key={m} onPress={() => { tapLight(); setMood(m); }}>
              <View style={{ backgroundColor: mood === m ? C.purple : C.glass, borderWidth: 1, borderColor: mood === m ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
                <Text style={{ color: mood === m ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{m}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false}>
          {source.length ? source.map((t) => (
            <Pressable key={t.id} onPress={() => use(t)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 22 }}>{t.cover_emoji || '🎵'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{t.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                    {t.bpm ? t.bpm + ' BPM · ' : ''}{t.genre_shape || ''}{t.instruments && t.instruments.length ? ' · ' + t.instruments.slice(0, 2).join(', ') : ''}
                  </Text>
                </View>
                <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Use</Text>
                </View>
              </View>
            </Pressable>
          )) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 26 }}>🎼</Text>
              <Text style={{ color: C.faint, fontSize: 13, marginTop: 8, textAlign: 'center' }}>No tracks in this mood yet.{'\n'}Producers can upload originals to the Hub.</Text>
            </View>
          )}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
