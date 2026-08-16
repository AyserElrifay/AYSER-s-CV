import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL, PLAY_GAMES } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { openPartner } from '../services/broker';
import { fetchVideos, deletePost } from '../services/posts';
import { fetchTracks } from '../services/music';
import { FILM_GENRES, fetchFilms, fetchOurScores } from '../services/films';
import { usePlayer } from '../context/PlayerContext';
import { Page, ScreenHeader, SectionHeader, Glass, GameRunner, RooftopRush, RockPaperScissors, StackGame, TowerClimb, StreetHop } from '../components';
import { CaptureModal } from '../components/CaptureModal';
import { MusicHubSheet } from '../components/MusicHubSheet';
import { FilmSheet } from '../components/FilmSheet';
import { BooksShelf } from '../components/BooksShelf';
import { CommentsSheet } from '../components/CommentsSheet';
import { GameHub } from '../components/lamma/GameHub';
import { GreenSheet } from '../components/green/GreenSheet';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { trackPlayer } from '../lib/videoSound';
import { sfxSuccess, sfxPop } from '../utils/sfx';

/* ────────────── TAB 4 · CHILL — WATCH & UNWIND ──────────────
   Long-form videos (YouTube-style, real uploads of type 'vod') up top,
   then "Watch" — a where-to-stream discovery rail that deep-links to the
   real platform and earns an affiliate commission. Nothing fabricated:
   the video list is your community's real uploads with an honest empty
   state, and every "Watch on" link goes to the actual service. */

const isWeb = Platform.OS === 'web';

/* The genre is a value the catalogue is queried with, so it stays
   English on the wire; only what people read changes. */
const genreKey = (g) => 'genre_' + String(g).toLowerCase().replace('science fiction', 'scifi').replace(/[^a-z]/g, '');

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
  const [films, setFilms] = useState(null);        // real rows from our catalogue
  const [filmScores, setFilmScores] = useState({}); // what people HERE gave them
  const [film, setFilm] = useState(null);

  /* The catalogue lives in our own table, refreshed nightly, so the
     app never carries an API key and still works if the upstream
     service is down. */
  useEffect(() => {
    if (!SUPABASE_READY) { setFilms([]); return; }
    let alive = true;
    setFilms(null);
    fetchFilms({ genre, arabic: false })
      .then(async (rows) => {
        if (!alive) return;
        setFilms(rows);
        if (rows.length) {
          try { setFilmScores(await fetchOurScores(rows.map((r) => r.id))); } catch (e) {}
        }
      })
      .catch(() => alive && setFilms([]));
    return () => { alive = false; };
  }, [genre]);
  const [videos, setVideos] = useState(null);     // null until first load
  const [player, setPlayer] = useState(null);     // the video now playing
  const [commentsPost, setCommentsPost] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [game, setGame] = useState(null); // a launched game
  const [lammaOpen, setLammaOpen] = useState(false);
  const [greenOpen, setGreenOpen] = useState(false);
  const { t } = useLang();

  // Every real, playable game — surfaced here so they're actually findable
  // (they used to be buried in Search → Play).
  /* Seko Seko is out of the list until it looks the way it should —
     the code stays, it just isn't offered while it's rough. */
  const PLAYABLE = ['runner', 'stack', 'rooftop', 'rps', 'tower', 'hop'];
  const games = PLAY_GAMES.filter((g) => PLAYABLE.includes(g.kind));

  // ── music: a real listening library on your legal catalog ──
  const { playTrack, current } = usePlayer();
  const [tracks, setTracks] = useState(null);
  const [hubOpen, setHubOpen] = useState(false);
  /* A taste of the whole library rather than the top of one pile:
     take a couple from each mood so classics, chill and hype are all
     represented in the twelve rows this strip has room for. */
  const listenSample = React.useMemo(() => {
    const byMood = new Map();
    (tracks || []).forEach((t) => {
      const k = String(t.mood || 'Other');
      const arr = byMood.get(k) || [];
      if (arr.length < 3) { arr.push(t); byMood.set(k, arr); }
    });
    const out = [];
    let round = 0;
    while (out.length < 12 && round < 3) {
      byMood.forEach((arr) => { if (arr[round] && out.length < 12) out.push(arr[round]); });
      round++;
    }
    return out.length ? out : (tracks || []).slice(0, 12);
  }, [tracks]);

  const toTrack = (t) => ({
    id: t.id, title: t.title, artist: t.artist || t.genre_shape || 'indie',
    emoji: t.cover_emoji || '🎵', audio_url: t.audio_url,
    attribution: t.attribution || null, license: t.license || null,
  });
  useEffect(() => {
    if (!SUPABASE_READY) { setTracks([]); return; }
    /* A dead connection never rejects on its own, and a placeholder
       that never resolves is worse than an error — see
       src/lib/deadline.js */
    withDeadline(fetchTracks())
      .then((rows) => setTracks((rows || []).map(toTrack)))
      .catch(() => setTracks([]));
  }, []);
  const playFrom = (i) => { if (tracks && tracks[i]) playTrack(tracks[i], tracks, i); };


  const loadVideos = useCallback(async () => {
    if (!SUPABASE_READY) { setVideos([]); return; }
    try {
      const rows = await withDeadline(fetchVideos());
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
      <ScreenHeader kicker={t('chill_kicker')} title={t('chill_title')} />

      {/* ── PLAY — every real game, finally easy to find ── */}
      <SectionHeader title={t('sec_play')} />

      {/* لمّة sits above the strip and not inside it. The others are
          games you play alone on a bus; this is the one you open when
          there are people in the room, and a 132px card in a sideways
          list is not how you invite five friends to anything. */}
      <Pressable onPress={() => { tapLight(); sfxPop(); setLammaOpen(true); }} style={{ marginTop: -4, marginBottom: 14 }}>
        <LinearGradient
          colors={['#2B1055', '#7C3AED']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 34 }}>🧠</Text>
          <View style={{ flex: 1, marginStart: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{t('lamma_title')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
              {t('lamma_tagline')}
            </Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('lamma_start')}</Text>
          </View>
        </LinearGradient>
      </Pressable>

      {/* ── THE GREEN CORNER ─────────────────────────────────────
          Next to لمّة because it is the same idea from the other side:
          لمّة is a room full of people laughing indoors, this is the
          same people outside doing something small that lasts. */}
      <Pressable onPress={() => { tapLight(); sfxPop(); setGreenOpen(true); }} style={{ marginBottom: 18 }}>
        <LinearGradient
          colors={['#0E3B2E', '#1F7A5A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 34 }}>🌿</Text>
          <View style={{ flex: 1, minWidth: 0, marginStart: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{t('green_title')}</Text>
            <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
              {t('green_tagline')}
            </Text>
          </View>
          {/* an arrow rather than a word: this card already says what
              it is twice, and a third label in thirteen languages is a
              translation bill for nothing */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </View>
        </LinearGradient>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4, paddingRight: 8 }} style={{ marginTop: -4, marginBottom: 22 }}>
        {games.map((g) => (
          <Pressable key={g.id} onPress={() => { tapLight(); sfxPop(); setGame(g); }} style={{ width: 132, marginRight: 12 }}>
            <LinearGradient
              colors={g.kind === 'rps' ? ['#2B1055', '#7C3AED'] : g.kind === 'rooftop' ? ['#0D2B5E', '#F59E0B'] : g.kind === 'stack' ? ['#0B7285', '#22D3EE'] : g.kind === 'tower' ? ['#2B1055', '#E5813F'] : g.kind === 'hop' ? ['#14204A', '#2FBFA0'] : ['#0A1D3F', '#0D2B5E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: 128, borderRadius: 18, padding: 12, justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 34 }}>{g.emoji}</Text>
              <View>
                <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }} numberOfLines={1}>{t(g.nameKey)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{t(g.playersKey)}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── LISTEN — a real music library on your legal catalog ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader title={t('sec_listen')} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {tracks && tracks.length ? (
            <Pressable onPress={() => { tapLight(); sfxPop(); playFrom(0); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
              <Ionicons name="play-circle" size={18} color={C.purple} />
              <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 4 }}>{t('play_all')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => { tapLight(); setHubOpen(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add-circle" size={18} color={C.purple} />
            <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 4 }}>{t('music_hub')}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 12, lineHeight: 18 }}>
        {t('music_blurb')}
      </Text>

      {tracks === null ? (
        /* Shaped like the list that is coming, not like a sign saying
           one is coming. A short "Loading…" slab turning into three tall
           rows shoves everything below it down the screen the instant
           the data lands — that lurch is what makes the app feel like it
           froze and then jumped. Occupy the space now, fill it in later,
           and nothing moves. */
        <Glass style={{ padding: 6, marginBottom: 24 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, opacity: 0.55 - i * 0.13 }}>
              <View style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: C.glassHi, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <View style={{ height: 11, width: '70%', borderRadius: 6, backgroundColor: C.glassHi }} />
                <View style={{ height: 9, width: '45%', borderRadius: 5, backgroundColor: C.glassHi, marginTop: 7 }} />
              </View>
            </View>
          ))}
        </Glass>
      ) : tracks.length === 0 ? (
        <Glass style={{ padding: 22, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 34 }}>🎼</Text>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 8 }}>{t('no_tracks')}</Text>
          <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 17 }}>
            {t('no_tracks_hint')}
          </Text>
          <Pressable onPress={() => { tapLight(); setHubOpen(true); }} style={{ marginTop: 12 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{t('open_music_hub')}</Text>
            </View>
          </Pressable>
        </Glass>
      ) : (
        <Glass style={{ padding: 6, marginBottom: 24 }}>
          {listenSample.map((t, i) => {
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
        <SectionHeader title={t('sec_videos')} />
        <Pressable onPress={() => { tapLight(); sfxPop(); setShooting(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="add-circle" size={18} color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 4 }}>{t('upload')}</Text>
        </Pressable>
      </View>
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 14, lineHeight: 18 }}>
        {t('videos_hint')}
      </Text>

      {videos === null ? (
        /* Same again, in the shape of a video card. */
        <View style={{ marginBottom: 24, opacity: 0.5 }}>
          <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: C.glassHi }} />
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.glassHi }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ height: 11, width: '80%', borderRadius: 6, backgroundColor: C.glassHi }} />
              <View style={{ height: 9, width: '40%', borderRadius: 5, backgroundColor: C.glassHi, marginTop: 8 }} />
            </View>
          </View>
        </View>
      ) : videos.length === 0 ? (
        <Glass style={{ padding: 24, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 40 }}>🎬</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 10 }}>{t('no_videos')}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
            {t('no_videos_hint')}
          </Text>
          <Pressable onPress={() => { tapSuccess(); sfxPop(); setShooting(true); }} style={{ marginTop: 14 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('upload_video')}</Text>
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

      {/* ── READ — free out-of-copyright books, and a real shop for the rest ── */}
      <View style={{ marginTop: 26 }}>
        <BooksShelf />
      </View>

      {/* ── WATCH — real films from our own catalogue, with real posters,
             a synopsis, and what the people here made of them ── */}
      <SectionHeader title={t('sec_watch')} style={{ marginTop: 8 }} />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 12, lineHeight: 18 }}>
        {t('watch_hint')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {FILM_GENRES.map((g) => (
          <Pressable key={g} onPress={() => { tapSelection(); setGenre(g); }}>
            <View style={{ backgroundColor: genre === g ? C.text : C.glass, borderWidth: 1, borderColor: genre === g ? C.text : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
              <Text style={{ color: genre === g ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{t(genreKey(g))}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {films === null ? (
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.purple} />
        </View>
      ) : films.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          {films.map((m) => {
            const ours = filmScores[m.id];
            return (
              <Pressable key={m.id} onPress={() => { tapLight(); sfxPop(); setFilm(m); }}>
                <View style={{ width: 138, marginRight: 12 }}>
                  <View style={{ height: 196, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi }}>
                    {m.poster_url ? (
                      <Image source={{ uri: m.poster_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <LinearGradient colors={['#4C1D95', '#7C3AED']} style={{ flex: 1, padding: 12, justifyContent: 'flex-end' }}>
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }} numberOfLines={3}>{m.title}</Text>
                      </LinearGradient>
                    )}
                    {m.rating ? (
                      <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '900' }}>⭐ {m.rating}</Text>
                      </View>
                    ) : null}
                    {ours && ours.votes ? (
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '900' }}>★ {ours.stars}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', marginTop: 7 }} numberOfLines={1}>{m.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                    {[m.year, (m.genres || [])[0]].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ paddingVertical: 30, alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 28 }}>🎬</Text>
          <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
            {t('films_empty')}
          </Text>
        </View>
      )}
    </Page>

    {film ? (
      <FilmSheet
        film={film}
        ourScore={filmScores[film.id]}
        onClose={() => setFilm(null)}
        onSaved={() => { if (films && films.length) fetchOurScores(films.map((r) => r.id)).then(setFilmScores).catch(() => {}); }}
      />
    ) : null}

    {/* Music Hub — browse / upload / license; picking a track plays it here */}
    {hubOpen ? (
      /* No onPick here: tapping a track in the sheet already plays it.
         A "Use" button only belongs where a track is being chosen FOR
         something — the reel composer. */
      <MusicHubSheet
        onClose={() => { setHubOpen(false); if (SUPABASE_READY) fetchTracks().then((rows) => setTracks((rows || []).map(toTrack))).catch(() => {}); }}
      />
    ) : null}

    {/* video player — real playback, with a comments button */}
    {player ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => setPlayer(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {/* the player is registered so locking the phone stops it
                too — see src/lib/videoSound.js */}
            {isWeb && player.media ? (
              <video
                src={player.media}
                controls autoPlay playsInline
                ref={(el) => { if (el) trackPlayer(el); }}
                style={{ width: '100%', maxHeight: '80%' }}
              />
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
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginLeft: 5 }}>{t('delete')}</Text>
                  </View>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { tapLight(); setCommentsPost({ id: player.id, place: 'Video' }); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Ionicons name="chatbubble-outline" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{t('comments')}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    ) : null}

    {/* "where to watch" sheet — deep-links to the real platform (affiliate) */}

    {shooting ? <CaptureModal initialMode="video" onClose={() => setShooting(false)} onPosted={onUploaded} /> : null}
    {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}

    {/* launched game */}
    {game && game.kind === 'stack' ? <StackGame onClose={() => setGame(null)} />
      : game && game.kind === 'tower' ? <TowerClimb onClose={() => setGame(null)} />
      : game && game.kind === 'hop' ? <StreetHop onClose={() => setGame(null)} />
      : game && game.kind === 'rooftop' ? <RooftopRush onClose={() => setGame(null)} />
      : game && game.kind === 'rps' ? <RockPaperScissors onClose={() => setGame(null)} />
      : game ? <GameRunner onClose={() => setGame(null)} /> : null}

    {lammaOpen ? <GameHub onClose={() => setLammaOpen(false)} /> : null}
    {greenOpen ? <GreenSheet onClose={() => setGreenOpen(false)} /> : null}
    </>
  );
};
