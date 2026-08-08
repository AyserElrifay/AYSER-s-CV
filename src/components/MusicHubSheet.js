import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { HUB_TRACKS } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { fetchTracks, incrementTrackUse, uploadSound, fetchMySounds, SOUND_TERMS } from '../services/music';
import {
  fetchMyPlaylists, createPlaylist, ensureLiked, fetchPlaylistTracks,
  addToPlaylist, removeFromPlaylist, deletePlaylist, fetchSavedTrackIds,
} from '../services/playlists';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxPop } from '../utils/sfx';
import { useStable } from '../hooks/useStable';

/* ── MUSIC ──────────────────────────────────────────────────────────
   A place to listen, not a place to manage a catalogue.

   Everything an owner needs — adding tracks, importing, approving,
   promoting — has moved to the Studio, where it belongs. What's left
   is what a person actually wants: browse, search, play, and keep the
   ones you like.

   Nothing downloads. A track streams from where it already lives and
   saving one costs a row, not a file, which is why a library here
   takes up no space on your phone.

   Every track is CC0, Creative Commons, or old enough to be out of
   copyright. Credit is stored and shown even when the licence doesn't
   ask for it. */

const SHELVES = [
  { id: 'Classics', label: 'Out of copyright', emoji: '📻', blurb: 'Recordings from before 1929 — nobody owns these any more' },
  { id: 'Chill', label: 'Chill', emoji: '🌊', blurb: 'Slow, wide and unbothered' },
  { id: 'Hype', label: 'Hype', emoji: '🔥', blurb: 'For the part where you run' },
  { id: 'Dreamy', label: 'Dreamy', emoji: '🌙', blurb: 'Late, soft, a little lost' },
  { id: 'Warm', label: 'Warm', emoji: '☀️', blurb: 'Golden hour in a track' },
  { id: 'Melancholic', label: 'Melancholic', emoji: '🍂', blurb: 'The honest ones' },
];

/* A cover you can tell apart at a glance. The catalogue is loops and
   old records, most with no artwork at all, so a stable colour drawn
   from the title beats a wall of identical grey squares. */
const COVERS = [
  ['#7C3AED', '#4C1D95'], ['#DB2777', '#831843'], ['#0891B2', '#164E63'],
  ['#EA580C', '#7C2D12'], ['#16A34A', '#14532D'], ['#4F46E5', '#312E81'],
  ['#DC2626', '#7F1D1D'], ['#0D9488', '#134E4A'],
];
const coverFor = (t) => {
  const key = String((t && (t.id || t.title)) || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length];
};

const Cover = ({ track, size = 52, radius = 8 }) => {
  const [a, b] = coverFor(track);
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42 }}>{(track && track.cover_emoji) || '🎵'}</Text>
    </LinearGradient>
  );
};

export const MusicHubSheet = ({ onPick, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { playTrack, current, playing } = usePlayer();

  const [tab, setTab] = useState('browse');      // browse | search | library
  const [tracks, setTracks] = useState(null);
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(new Set());
  const [playlists, setPlaylists] = useState([]);
  const [openList, setOpenList] = useState(null); // { id, name } → its tracks
  const [listTracks, setListTracks] = useState(null);
  const [picker, setPicker] = useState(null);     // the track waiting for a playlist
  const [newName, setNewName] = useState('');
  const [sheetFor, setSheetFor] = useState(null);  // playlist held down
  const [mine, setMine] = useState([]);           // sounds you recorded
  const [upBusy, setUpBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [err, setErr] = useState(null);

  const say = (m) => { setToast(m); setTimeout(() => setToast(null), 1900); };

  useEffect(() => {
    if (!SUPABASE_READY) { setTracks(HUB_TRACKS); return; }
    fetchTracks({})
      .then((rows) => setTracks(rows || []))
      .catch((e) => { setTracks([]); setErr(e && e.message); });
  }, []);

  const reloadLibrary = useCallback(() => {
    if (!SUPABASE_READY || !user) return;
    fetchMyPlaylists(user.id).then(setPlaylists).catch(() => {});
    fetchSavedTrackIds(user.id).then(setSaved).catch(() => {});
    fetchMySounds(user.id).then(setMine).catch(() => {});
  }, [user]);
  useEffect(reloadLibrary, [reloadLibrary]);

  const play = (t, list) => { tapLight(); sfxPop(); playTrack(t, list || [t], 0); };

  /* RECORD it — never pick a file.

     A file picker is an invitation to upload someone else's song, and
     one copyrighted track in a shared library is a real problem for
     everyone using it. The microphone can only capture what is
     actually in front of you, so an "original sound" here genuinely is
     one. Everything browsable in this screen stays Moments' own vetted
     catalogue: out of copyright, CC0, or licensed. */
  const recRef = React.useRef(null);
  const chunksRef = React.useRef([]);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const tickRef = React.useRef(null);
  const MAX_SECS = 60;

  const stopSoundRec = () => {
    clearInterval(tickRef.current);
    setRecording(false);
    const r = recRef.current;
    if (r && r.state !== 'inactive') r.stop();
  };

  const addSound = async () => {
    if (!SUPABASE_READY || !user) { say('Sign in to record a sound'); return; }
    if (recording) { stopSoundRec(); return; }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) { say('Recording needs a browser with a microphone'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (rec.mimeType || 'audio/mp4').split(';')[0];
        const blob = new Blob(chunksRef.current, { type });
        if (!blob.size) { say('Nothing was recorded — try again'); return; }
        setUpBusy(true);
        try {
          const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /webm/.test(type) ? 'webm' : 'mp3';
          const row = await uploadSound(user.id, blob, {
            title: 'My sound ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            ext, contentType: type,
          });
          setMine((m) => [row, ...m]);
          say('Recorded — only you can see it until you post with it');
        } catch (e) { say((e && e.message) || 'Could not save that sound'); }
        finally { setUpBusy(false); }
      };
      rec.start();
      setRecording(true);
      setRecSecs(0);
      tickRef.current = setInterval(() => {
        setRecSecs((n) => { if (n + 1 >= MAX_SECS) stopSoundRec(); return n + 1; });
      }, 1000);
    } catch (e) { say('Allow the microphone to record a sound 🎙️'); }
  };

  useEffect(() => () => { clearInterval(tickRef.current); }, []);

  /* The heart goes straight to Liked Songs — one tap, no dialogue.
     The + button is the one that asks which playlist. */
  const toggleLike = async (t) => {
    if (!SUPABASE_READY || !user) { say('Sign in to save tracks'); return; }
    const on = saved.has(t.id);
    setSaved((s) => { const n = new Set(s); on ? n.delete(t.id) : n.add(t.id); return n; });
    tapSelection();
    try {
      const liked = await ensureLiked(user.id);
      if (on) await removeFromPlaylist(liked, t.id);
      else await addToPlaylist(liked, t.id);
      reloadLibrary();
    } catch (e) {
      setSaved((s) => { const n = new Set(s); on ? n.add(t.id) : n.delete(t.id); return n; });
      say('Could not save — try again');
    }
  };

  const saveInto = async (playlistId) => {
    if (!picker) return;
    try {
      await addToPlaylist(playlistId, picker.id);
      setSaved((s) => new Set(s).add(picker.id));
      tapSuccess(); say('Saved');
      setPicker(null); reloadLibrary();
    } catch (e) { say('Could not save'); }
  };

  const makeList = async () => {
    const name = newName.trim();
    if (!name || !user) return;
    try {
      const pl = await createPlaylist(user.id, name);
      setNewName('');
      setPlaylists((p) => [...p, pl]);
      if (picker) await saveInto(pl.id);
    } catch (e) { say('Could not create'); }
  };

  const openPlaylist = async (pl) => {
    tapLight();
    setOpenList(pl); setListTracks(null);
    try { setListTracks(await fetchPlaylistTracks(pl.id)); } catch (e) { setListTracks([]); }
  };

  const all = tracks || [];
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return all.filter((t) =>
      String(t.title || '').toLowerCase().includes(s) ||
      String(t.artist || '').toLowerCase().includes(s) ||
      String(t.mood || '').toLowerCase().includes(s)).slice(0, 60);
  }, [q, all]);

  /* Moods arrive both as plain words and with an emoji in front
     ('Chill' and '🌊 Chill'), so match on contains rather than equals
     or half the catalogue lands on no shelf at all. */
  const shelfTracks = (id) => all.filter((t) => String(t.mood || '').toLowerCase().includes(id.toLowerCase()));

  /* ── one track row ── */
  const Row = useStable(({ t, list, onRemove }) => {
    const isNow = current && current.id === t.id;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
        <Pressable onPress={() => play(t, list)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View>
            <Cover track={t} />
            {/* a play/pause you can see, not a row you have to guess is
                tappable — and it doubles as "which one is playing" */}
            <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons
                name={isNow && playing ? 'pause' : 'play'}
                size={11}
                color={isNow ? C.purple : C.dim}
                style={{ marginLeft: isNow && playing ? 0 : 1 }}
              />
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
            <Text numberOfLines={1} style={{ color: isNow ? C.purple : C.text, fontSize: 14.5, fontWeight: '800' }}>
              {t.title || 'Untitled'}
            </Text>
            <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
              {(t.artist || 'Unknown') + (t.license ? ' · ' + t.license : '')}
            </Text>
          </View>
        </Pressable>

        <Pressable onPress={() => toggleLike(t)} hitSlop={8} style={{ paddingHorizontal: 6 }}>
          <Ionicons name={saved.has(t.id) ? 'heart' : 'heart-outline'} size={19} color={saved.has(t.id) ? C.purple : C.dim} />
        </Pressable>
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={8} style={{ paddingHorizontal: 6 }}>
            <Ionicons name="remove-circle-outline" size={19} color={C.dim} />
          </Pressable>
        ) : (
          <Pressable onPress={() => { tapLight(); setPicker(t); }} hitSlop={8} style={{ paddingHorizontal: 6 }}>
            <Ionicons name="add" size={20} color={C.dim} />
          </Pressable>
        )}
        {onPick ? (
          <Pressable
            onPress={() => { tapSuccess(); incrementTrackUse(t.id).catch(() => {}); onPick(t); }}
            style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginLeft: 4 }}
          >
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Use</Text>
          </Pressable>
        ) : null}
      </View>
    );
  });

  const Tab = useStable(({ id, icon, label }) => (
    <Pressable onPress={() => { tapLight(); setTab(id); }} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 18, paddingVertical: 6 }}>
      <Ionicons name={icon} size={16} color={tab === id ? C.purple : C.dim} />
      <Text style={{ color: tab === id ? C.purple : C.dim, fontSize: 13.5, fontWeight: '900', marginLeft: 6 }}>{label}</Text>
    </Pressable>
  ));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 8, borderTopRightRadius: R + 8,
        borderWidth: 1, borderColor: C.line, height: '82%', paddingBottom: insets.bottom,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6 }}>
          <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', flex: 1 }}>Music</Text>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={20} color={C.dim} /></Pressable>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 }}>
          <Tab id="browse" icon="grid-outline" label="Browse" />
          <Tab id="search" icon="search-outline" label="Search" />
          <Tab id="library" icon="library-outline" label="Your library" />
        </View>

        {tracks === null ? (
          <View style={{ paddingVertical: 50 }}><ActivityIndicator color={C.purple} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>

            {/* ── BROWSE ── */}
            {tab === 'browse' ? (
              !all.length ? (
                <Empty
                  title="The library is still empty"
                  body={err || 'Tracks appear here as they are added. Nothing is invented to fill the space.'}
                />
              ) : (<>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 12, lineHeight: 16 }}>
                  Moments' own catalogue — out of copyright, CC0 or licensed. Anything you record
                  yourself lives in Your library, never mixed in here.
                </Text>

                {SHELVES.map((sh) => {
                const list = shelfTracks(sh.id);
                if (!list.length) return null;
                return (
                  <View key={sh.id} style={{ marginTop: 18 }}>
                    <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }}>{sh.emoji} {sh.label}</Text>
                    <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 6 }}>{sh.blurb}</Text>
                    {list.slice(0, 8).map((t) => <Row key={t.id} t={t} list={list} />)}
                  </View>
                );
              })}
              </>)
            ) : null}

            {/* ── SEARCH ── */}
            {tab === 'search' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, marginTop: 10, marginBottom: 6 }}>
                  <Ionicons name="search" size={16} color={C.dim} />
                  <TextInput
                    placeholder="Songs, artists, a mood…"
                    placeholderTextColor={C.faint}
                    value={q} onChangeText={setQ} autoCapitalize="none"
                    style={{ flex: 1, color: C.text, fontSize: 14.5, paddingVertical: 11, marginLeft: 9 }}
                  />
                  {q ? <Pressable onPress={() => setQ('')}><Ionicons name="close-circle" size={16} color={C.faint} /></Pressable> : null}
                </View>
                {!q ? (
                  <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 26 }}>
                    {all.length} tracks to look through
                  </Text>
                ) : results.length ? (
                  results.map((t) => <Row key={t.id} t={t} list={results} />)
                ) : (
                  <Empty title={'Nothing for “' + q + '”'} body="Try a mood — chill, hype, dreamy — or an instrument." />
                )}
              </>
            ) : null}

            {/* ── LIBRARY ── */}
            {tab === 'library' ? (
              !SUPABASE_READY || !user ? (
                <Empty title="Sign in to keep music" body="Your playlists live with your account, not on this device." />
              ) : (
                <>
                {/* on your phone */}
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }}>📱 On your phone</Text>
                      <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
                        Record your own — yours alone until you post with it
                      </Text>
                    </View>
                    <Pressable onPress={addSound} disabled={upBusy}
                      style={{ backgroundColor: recording ? C.coral : C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, opacity: upBusy ? 0.5 : 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>
                        {upBusy ? 'Saving…' : recording ? 'Stop · ' + recSecs + 's' : '🎙️ Record'}
                      </Text>
                    </Pressable>
                  </View>
                  {mine.length ? mine.map((t) => (
                    <View key={t.id}>
                      <Row t={t} list={mine} />
                      {t.visibility === 'private' ? (
                        <Text style={{ color: C.faint, fontSize: 10.5, marginTop: -4, marginBottom: 6, marginLeft: 64 }}>
                          Private — post a reel with it to share it
                        </Text>
                      ) : null}
                    </View>
                  )) : (
                    <Text style={{ color: C.faint, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
                      Nothing yet. Record something — your voice, a street, a room. It has to be
                      yours: only the microphone, never a file, so nobody's music ends up here by accident.
                    </Text>
                  )}
                  <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 8, lineHeight: 15 }}>
                    {SOUND_TERMS}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 6, lineHeight: 15 }}>
                    The shelves in Browse are Moments' own catalogue — out of copyright, CC0 or
                    licensed. Your recordings are never mixed into them.
                  </Text>
                </View>


                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 6 }}>
                    <TextInput
                      placeholder="New playlist…"
                      placeholderTextColor={C.faint}
                      value={newName} onChangeText={setNewName}
                      onSubmitEditing={makeList}
                      style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                    />
                    <Pressable onPress={makeList} style={{ marginLeft: 8, backgroundColor: newName.trim() ? C.purple : C.glassHi, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11 }}>
                      <Text style={{ color: newName.trim() ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>Create</Text>
                    </Pressable>
                  </View>

                  {!playlists.length ? (
                    <Empty title="No playlists yet" body="Press the heart on a track and Liked Songs makes itself." />
                  ) : (
                    /* Two across, cover on the left, name on the right —
                       the shape every music app settled on because it
                       fits twice as many shortcuts in a thumb's reach. */
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 6 }}>
                      {playlists.map((pl) => (
                        <View key={pl.id} style={{ width: '50%', paddingHorizontal: 4, paddingBottom: 8 }}>
                          <Pressable
                            onPress={() => openPlaylist(pl)}
                            onLongPress={() => { tapLight(); setSheetFor(pl); }}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 8, overflow: 'hidden' }}
                          >
                            <View style={{ width: 52, height: 52, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 23 }}>{pl.emoji || '🎧'}</Text>
                            </View>
                            <View style={{ flex: 1, paddingHorizontal: 9 }}>
                              <Text numberOfLines={2} style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{pl.name}</Text>
                              <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>{pl.count}</Text>
                            </View>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 6 }}>
                    Hold a playlist to empty or delete it
                  </Text>
                </>
              )
            ) : null}
          </ScrollView>
        )}

        {toast ? (
          <View style={{ position: 'absolute', bottom: insets.bottom + 18, left: 30, right: 30, backgroundColor: C.float, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingVertical: 11 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', textAlign: 'center' }}>{toast}</Text>
          </View>
        ) : null}
      </View>

      {/* which playlist? */}
      {picker ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPicker(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.6)', justifyContent: 'center', padding: 26 }} onPress={() => setPicker(null)}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.bg2, borderRadius: R, borderWidth: 1, borderColor: C.line, padding: 16 }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>Save “{picker.title}”</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, marginBottom: 10 }}>Pick a playlist, or make one.</Text>
              {playlists.map((pl) => (
                <Pressable key={pl.id} onPress={() => saveInto(pl.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
                  <Text style={{ fontSize: 18, marginRight: 10 }}>{pl.emoji || '🎧'}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{pl.name}</Text>
                  <Text style={{ color: C.faint, fontSize: 12 }}>{pl.count}</Text>
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <TextInput
                  placeholder="New playlist…" placeholderTextColor={C.faint}
                  value={newName} onChangeText={setNewName} onSubmitEditing={makeList}
                  style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }}
                />
                <Pressable onPress={makeList} style={{ marginLeft: 8, backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 }}>
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>Add</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* hold a playlist: empty it, or remove it entirely */}
      {sheetFor ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSheetFor(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.6)', justifyContent: 'flex-end' }} onPress={() => setSheetFor(null)}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.bg2, borderTopLeftRadius: R, borderTopRightRadius: R, padding: 18, paddingBottom: insets.bottom + 20 }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>{sheetFor.emoji} {sheetFor.name}</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, marginBottom: 12 }}>{sheetFor.count} saved</Text>

              <Pressable
                onPress={async () => {
                  const pl = sheetFor; setSheetFor(null);
                  try {
                    const list = await fetchPlaylistTracks(pl.id);
                    await Promise.all(list.map((t) => removeFromPlaylist(pl.id, t.id).catch(() => {})));
                    say('Emptied ' + pl.name); reloadLibrary();
                  } catch (e) { say('Could not empty it'); }
                }}
                style={{ paddingVertical: 13 }}
              >
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>🧹  Empty it — keep the playlist</Text>
              </Pressable>

              {sheetFor.name !== 'Liked Songs' ? (
                <Pressable
                  onPress={async () => {
                    const pl = sheetFor; setSheetFor(null);
                    try { await deletePlaylist(pl.id); say('Deleted ' + pl.name); reloadLibrary(); }
                    catch (e) { say('Could not delete'); }
                  }}
                  style={{ paddingVertical: 13 }}
                >
                  <Text style={{ color: C.coral, fontSize: 14, fontWeight: '800' }}>🗑  Delete the playlist</Text>
                </Pressable>
              ) : (
                <Text style={{ color: C.faint, fontSize: 12, paddingVertical: 8 }}>
                  Liked Songs stays — emptying it is the same thing.
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* inside a playlist */}
      {openList ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpenList(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 }}>
              <Pressable onPress={() => setOpenList(null)} hitSlop={10}><Ionicons name="chevron-back" size={22} color={C.text} /></Pressable>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginLeft: 10, flex: 1 }}>{openList.emoji} {openList.name}</Text>
              <Pressable onPress={() => { setSheetFor(openList); }} hitSlop={8}>
                <Ionicons name="ellipsis-horizontal" size={20} color={C.dim} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
              {listTracks === null ? (
                <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              ) : listTracks.length ? (
                listTracks.map((t) => (
                  <Row
                    key={t.id} t={t} list={listTracks}
                    onRemove={async () => {
                      await removeFromPlaylist(openList.id, t.id).catch(() => {});
                      setListTracks((l) => l.filter((x) => x.id !== t.id));
                      reloadLibrary();
                    }}
                  />
                ))
              ) : (
                <Empty title="Nothing saved here yet" body="Press the heart or the + on any track." />
              )}
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
};

const Empty = ({ title, body }) => (
  <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
    <Text style={{ fontSize: 32 }}>🎧</Text>
    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>{title}</Text>
    <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 19, marginTop: 5, textAlign: 'center' }}>{body}</Text>
  </View>
);
