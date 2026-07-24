import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { MOVIES, WATCH_PROVIDERS, WATCH_GENRES, AV_NEUTRAL, PLAY_GAMES } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { openPartner } from '../services/broker';
import { fetchVideos, deletePost } from '../services/posts';
import { fetchTracks } from '../services/music';
import { usePlayer } from '../context/PlayerContext';
import { Page, ScreenHeader, SectionHeader, Glass, GameRunner, RooftopRush, SekoSeko3D, BoxingGame, StackGame } from '../components';
import { CaptureModal } from '../components/CaptureModal';
import { MusicHubSheet } from '../components/MusicHubSheet';
import { CommentsSheet } from '../components/CommentsSheet';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess, sfxPop } from '../utils/sfx';

/* ────────────── TAB 4 · CHILL — WATCH & UNWIND ──────────────
   Long-form videos (YouTube-style, real uploads of type 'vod') up top,
   then "Watch" — a where-to-stream discovery rail that deep-links to the
   real platform and earns an affiliate commission. Nothing fabricated:
   the video list is your community's real uploads with an honest empty
   state, and every "Watch on" link goes to the actual service. */

const isWeb = Platform.OS === 'web';

// Shape a DB 'vod' row (or a local optimistic one) into a video card.
const toVideo = (r) => ({
  id: r.id,
  userId: r.user_id, // owner — enables "delete my video"
  title: r.caption || 'Untitled video',
  media: r.media_url || r.media,
  author: (r.user && (r.user.name)) || 'Explorer',
  avatar: (r.user && (r.user.avatar_url || r.user.avatar)) || AV_NEUTRAL,
  place: r.place || 'Video',
});

export const ChillScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [genre, setGenre] = useState('All');
  const [movie, setMovie] = useState(null);       // the "watch on" sheet
  const [videos, setVideos] = useState(null);     // null until first load
  const [player, setPlayer] = useState(null);     // the video now playing
  const [commentsPost, setCommentsPost] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [game, setGame] = useState(null); // a launched game

  // Every real, playable game — surfaced here so they're actually findable
  // (they used to be buried in Search → Play).
  const PLAYABLE = ['runner', 'stack', 'rooftop', 'sekoseko', 'boxing'];
  const games = PLAY_GAMES.filter((g) => PLAYABLE.includes(g.kind));

  // ── music: a real listening library on your legal catalog ──
  const { playTrack, current } = usePlayer();
  const [tracks, setTracks] = useState(null);
  const [hubOpen, setHubOpen] = useState(false);
  const toTrack = (t) => ({
    id: t.id, title: t.title, artist: t.artist || t.genre_shape || 'indie',
    emoji: t.cover_emoji || '🎵', audio_url: t.audio_url,
    attribution: t.attribution || null, license: t.license || null,
  });
  useEffect(() => {
    if (!SUPABASE_READY) { setTracks([]); return; }
    fetchTracks().then((rows) => setTracks((rows || []).map(toTrack))).catch(() => setTracks([]));
  }, []);
  const playFrom = (i) => { if (tracks && tracks[i]) playTrack(tracks[i], tracks, i); };

  const movies = MOVIES.filter((m) => genre === 'All' || genre === '🍿 Trending' || m.genre === genre);

  const loadVideos = useCallback(async () => {
    if (!SUPABASE_READY) { setVideos([]); return; }
    try {
      const rows = await fetchVideos();
      setVideos((rows || []).map(toVideo));
    } catch (e) { setVideos([]); }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const onUploaded = (row) => {
    // optimistic prepend, then reconcile with the server
    setVideos((v) => [toVideo(row), ...(v || [])]);
    loadVideos();
  };

  /* Delete YOUR video — gone from the list instantly, gone from the DB. */
  const onDeleteVideo = (v) => {
    tapLight();
    setVideos((list) => (list || []).filter((x) => x.id !== v.id));
    setPlayer(null);
    if (SUPABASE_READY && user) deletePost(v.id, user.id).catch(() => {});
  };

  return (
    <>
    <Page>
      <ScreenHeader kicker="Watch & unwind" title="Chill Zone 🍿" />

      {/* ── PLAY — every real game, finally easy to find ── */}
      <SectionHeader title="Play 🎮" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4, paddingRight: 8 }} style={{ marginTop: -4, marginBottom: 22 }}>
        {games.map((g) => (
          <Pressable key={g.id} onPress={() => { tapLight(); sfxPop(); setGame(g); }} style={{ width: 132, marginRight: 12 }}>
            <LinearGradient
              colors={g.kind === 'boxing' ? ['#2B1055', '#7C3AED'] : g.kind === 'sekoseko' ? ['#241844', '#FF2E88'] : g.kind === 'rooftop' ? ['#0D2B5E', '#F59E0B'] : g.kind === 'stack' ? ['#0B7285', '#22D3EE'] : ['#0A1D3F', '#0D2B5E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: 128, borderRadius: 18, padding: 12, justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 34 }}>{g.emoji}</Text>
              <View>
                <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }} numberOfLines={1}>{g.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{g.players}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── LISTEN — a real music library on your legal catalog ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader title="Listen 🎧" />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {tracks && tracks.length ? (
            <Pressable onPress={() => { tapLight(); sfxPop(); playFrom(0); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
              <Ionicons name="play-circle" size={18} color={C.purple} />
              <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 4 }}>Play all</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => { tapLight(); setHubOpen(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add-circle" size={18} color={C.purple} />
            <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 4 }}>Hub</Text>
          </Pressable>
        </View>
      </View>
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 12, lineHeight: 18 }}>
        Play music while you browse — it keeps going across the app. Every track is licensed or creator-owned.
      </Text>

      {tracks === null ? (
        <Glass style={{ padding: 18, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ color: C.faint, fontSize: 12.5 }}>Loading music…</Text>
        </Glass>
      ) : tracks.length === 0 ? (
        <Glass style={{ padding: 22, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 34 }}>🎼</Text>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 8 }}>No tracks yet</Text>
          <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 17 }}>
            Add royalty-free songs from the Hub, or let creators upload — then press play here.
          </Text>
          <Pressable onPress={() => { tapLight(); setHubOpen(true); }} style={{ marginTop: 12 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>Open Music Hub 🎧</Text>
            </View>
          </Pressable>
        </Glass>
      ) : (
        <Glass style={{ padding: 6, marginBottom: 24 }}>
          {tracks.slice(0, 12).map((t, i) => {
            const on = current && current.id === t.id;
            return (
              <Pressable key={t.id} onPress={() => { tapLight(); sfxPop(); playFrom(i); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, backgroundColor: on ? C.purpleSoft : 'transparent' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: on ? C.purple : C.glass, borderWidth: on ? 0 : 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: on ? C.purple : C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{t.title}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>{t.artist}{t.license ? ' · © ' + t.license : ''}</Text>
                  </View>
                  <Ionicons name={on ? 'musical-notes' : 'play'} size={on ? 18 : 20} color={on ? C.purple : C.dim} />
                </View>
              </Pressable>
            );
          })}
        </Glass>
      )}

      {/* ── LONG-FORM VIDEOS (real uploads) ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader title="Videos 🎬" />
        <Pressable onPress={() => { tapLight(); sfxPop(); setShooting(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="add-circle" size={18} color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 4 }}>Upload</Text>
        </Pressable>
      </View>
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 14, lineHeight: 18 }}>
        Full-length videos from the community — the long-form home for tutorials, vlogs & docs.
      </Text>

      {videos === null ? (
        <Glass style={{ padding: 22, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ color: C.faint, fontSize: 12.5 }}>Loading videos…</Text>
        </Glass>
      ) : videos.length === 0 ? (
        <Glass style={{ padding: 24, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 40 }}>🎬</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 10 }}>No videos yet</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
            Be the first to upload a long-form video — tutorials, vlogs, mini-docs.
          </Text>
          <Pressable onPress={() => { tapSuccess(); sfxPop(); setShooting(true); }} style={{ marginTop: 14 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>Upload a video</Text>
            </View>
          </Pressable>
        </Glass>
      ) : (
        videos.map((v) => (
          <Pressable key={v.id} onPress={() => { tapLight(); sfxPop(); setPlayer(v); }} style={{ marginBottom: 16 }}>
            {/* 16:9 thumbnail — plays inline on tap */}
            <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
              {isWeb && v.media ? (
                <video src={v.media} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : v.media ? (
                <Image source={{ uri: v.media }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={26} color="#FFF" style={{ marginLeft: 3 }} />
                </View>
              </View>
            </View>
            {/* title row — avatar + title + author */}
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Image source={{ uri: v.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', lineHeight: 19 }} numberOfLines={2}>{v.title}</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 3 }}>{v.author}</Text>
              </View>
            </View>
          </Pressable>
        ))
      )}

      {/* ── WATCH — where to stream, anywhere in the world (affiliate) ── */}
      <SectionHeader title="Watch 🍿" style={{ marginTop: 8 }} />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 12, lineHeight: 18 }}>
        Find where to stream any film — we take you straight to Prime Video, Apple TV, Netflix, Shahid & more.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {WATCH_GENRES.map((g) => (
          <Pressable key={g} onPress={() => { tapSelection(); setGenre(g); }}>
            <View style={{ backgroundColor: genre === g ? C.text : C.glass, borderWidth: 1, borderColor: genre === g ? C.text : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
              <Text style={{ color: genre === g ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{g}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        {movies.map((m) => (
          <Pressable key={m.id} onPress={() => { tapLight(); sfxPop(); setMovie(m); }}>
            <View style={{ width: 138, marginRight: 12 }}>
              <LinearGradient colors={m.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 196, borderRadius: 16, padding: 12, justifyContent: 'space-between' }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '900' }}>⭐ {m.rating}</Text>
                </View>
                <View>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', lineHeight: 19 }} numberOfLines={2}>{m.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 3 }}>{m.genre} · {m.year}</Text>
                </View>
              </LinearGradient>
              <View style={{ flexDirection: 'row', marginTop: 7 }}>
                {m.on.slice(0, 3).map((o) => (
                  <View key={o.p} style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: WATCH_PROVIDERS[o.p].color, alignItems: 'center', justifyContent: 'center', marginRight: 5 }}>
                    <Text style={{ fontSize: 12 }}>{WATCH_PROVIDERS[o.p].emoji || '▷'}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Page>

    {/* Music Hub — browse / upload / license; picking a track plays it here */}
    {hubOpen ? (
      <MusicHubSheet
        onPick={(s) => playTrack({ id: s.id, title: s.title, artist: s.artist, emoji: s.emoji, audio_url: s.audio_url, attribution: s.attribution, license: s.license }, [{ id: s.id, title: s.title, artist: s.artist, emoji: s.emoji, audio_url: s.audio_url, attribution: s.attribution, license: s.license }], 0)}
        onClose={() => { setHubOpen(false); if (SUPABASE_READY) fetchTracks().then((rows) => setTracks((rows || []).map(toTrack))).catch(() => {}); }}
      />
    ) : null}

    {/* video player — real playback, with a comments button */}
    {player ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => setPlayer(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {isWeb && player.media ? (
              <video src={player.media} controls autoPlay playsInline style={{ width: '100%', maxHeight: '80%' }} />
            ) : player.media ? (
              <Image source={{ uri: player.media }} style={{ width: '100%', height: '60%' }} resizeMode="contain" />
            ) : null}
          </View>
          <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => { tapLight(); setPlayer(null); }} hitSlop={10}>
              <Ionicons name="close" size={30} color="#FFF" />
            </Pressable>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 12, flex: 1 }} numberOfLines={1}>{player.title}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: player.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800', marginLeft: 10, flex: 1 }}>{player.author}</Text>
              {user && player.userId === user.id ? (
                <Pressable onPress={() => onDeleteVideo(player)} style={{ marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.85)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Ionicons name="trash-outline" size={15} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginLeft: 5 }}>Delete</Text>
                  </View>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { tapLight(); setCommentsPost({ id: player.id, place: 'Video' }); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Ionicons name="chatbubble-outline" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>Comments</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    ) : null}

    {/* "where to watch" sheet — deep-links to the real platform (affiliate) */}
    {movie ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setMovie(null)}>
        <Pressable onPress={() => setMovie(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <LinearGradient colors={movie.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 60, height: 84, borderRadius: 12, marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{movie.title}</Text>
                <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3 }}>{movie.genre} · {movie.year} · ⭐ {movie.rating}</Text>
              </View>
            </View>
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>WATCH ON</Text>
            {movie.on.map((o) => {
              const prov = WATCH_PROVIDERS[o.p];
              return (
                <Pressable key={o.p} onPress={() => { tapSuccess(); sfxSuccess(); openPartner(user, { id: movie.id, partner: prov.partner, url: o.url }); setMovie(null); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, marginBottom: 9 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: prov.color, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 19 }}>{prov.emoji || '▷'}</Text>
                    </View>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', flex: 1 }}>{prov.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginRight: 6 }}>Watch ↗</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.faint} />
                  </View>
                </Pressable>
              );
            })}
            <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
              Opens the platform directly · Moments earns a small affiliate commission
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    ) : null}

    {shooting ? <CaptureModal initialMode="video" onClose={() => setShooting(false)} onPosted={onUploaded} /> : null}
    {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}

    {/* launched game */}
    {game && game.kind === 'stack' ? <StackGame onClose={() => setGame(null)} />
      : game && game.kind === 'rooftop' ? <RooftopRush onClose={() => setGame(null)} />
      : game && game.kind === 'sekoseko' ? <SekoSeko3D onClose={() => setGame(null)} />
      : game && game.kind === 'boxing' ? <BoxingGame onClose={() => setGame(null)} />
      : game ? <GameRunner onClose={() => setGame(null)} /> : null}
    </>
  );
};
