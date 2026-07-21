import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { HUB_TRACKS, TRACK_MOODS } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchTracks, uploadTrack, deleteTrack } from '../services/music';
import { startCheckout } from '../services/payments';
import { ReportSheet } from './ReportSheet';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* Flat licensing fee for using an indie track commercially (ads, brand
   content, etc.) — Moments takes its usual platform cut, the producer
   gets the rest. Real payment row via the existing checkout layer. */
const LICENSE_PRICE_EGP = 150;
const PROMO_PRICE_EGP = 75; // artist ad boost — Moments keeps 1/3, reach goes to the artist

/* Indie Music Hub — discover original tracks by how they SOUND
   (mood / BPM / instruments), not by artist. Pick one for your reel
   or story. Producers' uploads live here in real mode. */

export const MusicHubSheet = ({ onPick, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mood, setMood] = useState('All');
  const [remote, setRemote] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ── producer upload: a REAL audio file → a real playable track ──
  const [upFile, setUpFile] = useState(null);   // { uri, ext, mime, name }
  const [upTitle, setUpTitle] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const [upErr, setUpErr] = useState(null);

  const pickAudio = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setUpErr('Uploading from the mobile app arrives with the native build — use the web app for now.');
      return;
    }
    tapLight();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
      setUpFile({ uri: URL.createObjectURL(f), ext, mime: f.type || 'audio/mpeg', name: f.name });
      setUpTitle((f.name.replace(/\.[^.]+$/, '') || '').slice(0, 60));
      setUpErr(null);
    };
    input.click();
  };

  const doUpload = async () => {
    if (!upFile || !upTitle.trim() || upBusy) return;
    if (!SUPABASE_READY || !user) { setUpErr('Sign in to upload tracks.'); return; }
    setUpBusy(true); setUpErr(null);
    try {
      await uploadTrack(user.id, upFile.uri, upFile.ext, upFile.mime, {
        title: upTitle.trim(),
        mood: mood === 'All' ? null : mood,
        cover_emoji: '🎵',
      });
      tapSuccess(); sfxSuccess();
      setUpFile(null); setUpTitle('');
      setReloadKey((k) => k + 1); // refresh the list — your track is live
    } catch (e) {
      setUpErr(/does not exist|schema cache/i.test(e.message || '')
        ? 'One step left: run supabase/RUN_ME.sql to turn on the Music Hub.'
        : (e.message || 'Upload failed — try again.'));
    } finally { setUpBusy(false); }
  };

  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchTracks(mood === 'All' ? {} : { mood })
      .then((rows) => setRemote(rows.map((r) => ({
        id: r.id, title: r.title, cover_emoji: r.cover_emoji, mood: r.mood, bpm: r.bpm,
        music_key: r.music_key, instruments: r.instruments || [], genre_shape: r.genre_shape,
        uses_count: r.uses_count,
        by: r.artist || (r.uploader && r.uploader.name) || 'indie producer',
        official: !!r.is_official, license: r.license || null, attribution: r.attribution || null,
        mine: !!(user && r.uploader_id === user.id),
        audio_url: r.audio_url,
      }))))
      .catch(() => setRemote([]));
  }, [mood, reloadKey]);

  const source = SUPABASE_READY ? (remote || []) : HUB_TRACKS.filter((t) => mood === 'All' || t.mood === mood);

  const use = (t) => {
    tapSelection(); sfxPop();
    onPick && onPick({
      id: t.id, title: t.title,
      artist: t.by || t.genre_shape || 'indie',
      emoji: t.cover_emoji || '🎵', audio_url: t.audio_url,
      attribution: t.attribution || null, license: t.license || null,
    });
    onClose();
  };

  const [licensing, setLicensing] = useState(null); // track id in flight
  const [licenseNote, setLicenseNote] = useState(null);
  const [reportTrack, setReportTrack] = useState(null); // track being reported

  /* artist ad boost — a real payment row (kind 'track_promo'); the split
     is the platform's 1/3 cut, the rest funds the track's promotion */
  const promote = async (t) => {
    if (!SUPABASE_READY || !user) { setLicenseNote('Sign in to promote your track.'); return; }
    setLicensing(t.id); setLicenseNote(null);
    try {
      const res = await startCheckout('paymob', {
        amount: PROMO_PRICE_EGP, currency: 'EGP', kind: 'track_promo',
        refId: t.id, description: 'Promote · ' + t.title,
      });
      if (res.configured) { tapSuccess(); sfxSuccess(); }
      else setLicenseNote('Promo recorded — your track gets boosted reach once the payment gateway connects.');
    } catch (e) {
      setLicenseNote(e.message || 'Could not start the promo — try again.');
    } finally { setLicensing(null); }
  };

  const [confirmDel, setConfirmDel] = useState(null); // track id awaiting confirm
  const removeMine = async (t) => {
    if (confirmDel !== t.id) { tapLight(); setConfirmDel(t.id); return; } // tap once to arm, again to delete
    setConfirmDel(null);
    try {
      await deleteTrack(t.id, user.id);
      setRemote((list) => (list || []).filter((x) => x.id !== t.id));
      tapSuccess();
    } catch (e) { setLicenseNote('Could not delete that sound — try again.'); }
  };

  const license = async (t) => {
    if (!SUPABASE_READY || !user) { setLicenseNote('Sign in to license a track.'); return; }
    setLicensing(t.id); setLicenseNote(null);
    try {
      const res = await startCheckout('paymob', {
        amount: LICENSE_PRICE_EGP, currency: 'EGP', kind: 'music_license',
        refId: t.id, description: 'License · ' + t.title,
      });
      if (res.configured) { tapSuccess(); sfxSuccess(); }
      else setLicenseNote('Recorded — payment gateway connects soon; ' + t.title + '’s producer will be notified.');
    } catch (e) {
      setLicenseNote(e.message || 'Could not start licensing — try again.');
    } finally { setLicensing(null); }
  };

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16, maxHeight: '82%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Music Hub 🎧</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>Original indie tracks — find them by feel, not by name</Text>
          </View>
          <Pressable onPress={pickAudio}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
              <Ionicons name="cloud-upload-outline" size={15} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900', marginLeft: 5 }}>Upload</Text>
            </View>
          </Pressable>
        </View>

        {/* upload form — appears once a file is chosen */}
        {upFile ? (
          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 10 }}>
            <Text style={{ color: C.dim, fontSize: 11.5 }} numberOfLines={1}>🎵 {upFile.name}</Text>
            <TextInput
              placeholder="Track title"
              placeholderTextColor={C.faint}
              value={upTitle}
              onChangeText={setUpTitle}
              style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, marginTop: 8 }}
            />
            <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 6 }}>
              Mood: {mood === 'All' ? 'pick a mood chip below first (optional)' : mood} · you must own the rights to this audio
            </Text>
            <Pressable onPress={doUpload} style={{ marginTop: 9 }}>
              <View style={{ backgroundColor: upTitle.trim() && !upBusy ? C.purple : C.glassHi, borderRadius: 11, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: upTitle.trim() && !upBusy ? '#FFF' : C.faint, fontSize: 12.5, fontWeight: '900' }}>{upBusy ? 'Uploading…' : 'Publish to the Hub 🎧'}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
        {upErr ? <Text style={{ color: C.coral, fontSize: 11.5, marginTop: 8 }}>⚠️ {upErr}</Text> : null}

        {/* ── FOR ARTISTS — real distribution terms, no fine print ──
            Upload originals here = distribution on Moments. Every licence
            or promo purchase splits 2/3 to the artist, 1/3 to Moments. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10 }}>
          <Text style={{ fontSize: 16 }}>🎤</Text>
          <Text style={{ color: C.purple, fontSize: 11, fontWeight: '700', marginLeft: 8, flex: 1, lineHeight: 15 }}>
            Artists: distribute here & keep 2/3 of every licence and promo — Moments takes 1/3. Upload your originals ↑
          </Text>
        </View>
        <View style={{ height: 12 }} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {TRACK_MOODS.map((m) => (
            <Pressable key={m} onPress={() => { tapLight(); setMood(m); }}>
              <View style={{ backgroundColor: mood === m ? C.purple : C.glass, borderWidth: 1, borderColor: mood === m ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
                <Text style={{ color: mood === m ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{m}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {licenseNote ? <Text style={{ color: C.dim, fontSize: 11.5, marginBottom: 8, textAlign: 'center' }}>{licenseNote}</Text> : null}

        <ScrollView showsVerticalScrollIndicator={false}>
          {source.length ? source.map((t) => (
            <Pressable key={t.id} onPress={() => use(t)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 22 }}>{t.cover_emoji || '🎵'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{t.title}</Text>
                    {t.official ? (
                      <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 }}>
                        <Text style={{ color: C.purple, fontSize: 9, fontWeight: '900' }}>OFFICIAL</Text>
                      </View>
                    ) : null}
                  </View>
                  {t.by ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{t.by}</Text> : null}
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                    {t.bpm ? t.bpm + ' BPM · ' : ''}{t.genre_shape || ''}{t.instruments && t.instruments.length ? ' · ' + t.instruments.slice(0, 2).join(', ') : ''}
                  </Text>
                  {t.license ? (
                    <Text style={{ color: C.faint, fontSize: 9.5, marginTop: 2 }} numberOfLines={1}>© {t.license}{t.attribution ? ' · ' + t.attribution : ''}</Text>
                  ) : SUPABASE_READY ? (
                    <Text style={{ color: C.faint, fontSize: 10, marginTop: 2 }}>▶ {t.uses_count || 0} uses</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Pressable onPress={() => use(t)}>
                    <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 6 }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Use</Text>
                    </View>
                  </Pressable>
                  {SUPABASE_READY && t.mine ? (
                    /* your own track: buy a promo boost — 2/3 comes back to you as reach, Moments keeps 1/3 */
                    <>
                    <Pressable onPress={() => promote(t)} disabled={licensing === t.id}>
                      <Text style={{ color: C.blue, fontSize: 10.5, fontWeight: '800' }}>
                        {licensing === t.id ? 'Processing…' : '📣 Promote · E£' + PROMO_PRICE_EGP}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => removeMine(t)} hitSlop={6} style={{ marginTop: 5 }}>
                      <Text style={{ color: C.coral, fontSize: 10.5, fontWeight: '800' }}>{confirmDel === t.id ? 'Tap again to delete' : '🗑 Delete'}</Text>
                    </Pressable>
                    </>
                  ) : SUPABASE_READY ? (
                    <Pressable onPress={() => license(t)} disabled={licensing === t.id}>
                      <Text style={{ color: C.green, fontSize: 10.5, fontWeight: '800' }}>
                        {licensing === t.id ? 'Processing…' : '💸 License · E£' + LICENSE_PRICE_EGP}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => { tapLight(); setReportTrack(t); }} hitSlop={6} style={{ marginTop: 5 }}>
                    <Text style={{ color: C.faint, fontSize: 10, fontWeight: '700' }}>⚑ Report</Text>
                  </Pressable>
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
      {reportTrack ? (
        <ReportSheet contentType="track" contentId={reportTrack.id} contentLabel={reportTrack.title} onClose={() => setReportTrack(null)} />
      ) : null}
    </Pressable>
  );
};
