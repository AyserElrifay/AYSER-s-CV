import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, Image, TextInput, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../constants/theme';
import { SOUNDS, ME, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../services/posts';
import { createStory } from '../services/stories';
import { uploadCapture, uploadMedia } from '../services/social';
import { fetchTracks } from '../services/music';
import { MusicHubSheet } from './MusicHubSheet';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* ─── THE CAPTURE SCREEN — easier than IG, TikTok and Snap combined ───
   One tap opens a LIVE viewfinder. Tap the shutter for a photo, hold it
   to record video (Snapchat-style), release to stop. Pick a sound from
   the rail at the bottom while you shoot (TikTok-style). Preview,
   caption, share — three taps total from feed to posted.

   Web: real camera via getUserMedia + MediaRecorder.
   Native: one tap into the system camera (expo-image-picker); the
   in-app viewfinder arrives with the expo-camera build. */

const MAX_VIDEO_MS = 30000;

export const CaptureModal = ({ initialMode = 'story', onClose, onPosted, onPostedStory }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'story' | 'reel'
  const [sound, setSound] = useState(null);
  const [facing, setFacing] = useState('user');
  const [camError, setCamError] = useState(null);
  const [shot, setShot] = useState(null); // { uri, kind: 'photo'|'video', ext, contentType }
  const [recording, setRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [realTracks, setRealTracks] = useState([]); // real playable Hub tracks

  // Real mode: the rail shows REAL tracks (playable audio_url from the
  // Indie Hub) — never made-up artist names.
  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchTracks()
      .then((rows) => setRealTracks((rows || []).slice(0, 10).map((t) => ({
        id: t.id, title: t.title, artist: t.genre_shape || 'indie', emoji: t.cover_emoji || '🎵', audio_url: t.audio_url,
      }))))
      .catch(() => {});
  }, []);

  const railSounds = SUPABASE_READY
    ? [...realTracks, { id: 'orig', title: 'Original sound', artist: 'Your recording', emoji: '🎤' }]
    : SOUNDS;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const holdTimer = useRef(null);
  const recTimer = useRef(null);
  const heldRef = useRef(false);

  const isWeb = Platform.OS === 'web';

  /* ── live viewfinder (web) ── */
  const startStream = async (face) => {
    if (!isWeb) return;
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        // Phone-camera quality: ask for full sensor resolution (up to 4K)
        // and let the browser give us the best it can.
        video: {
          facingMode: face || facing,
          width: { ideal: 2160, max: 3840 },
          height: { ideal: 3840, max: 3840 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCamError(null);
    } catch (e) {
      setCamError('Allow camera access to shoot 🎥');
    }
  };

  useEffect(() => {
    if (isWeb && !shot) startStream();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(recTimer.current);
      clearTimeout(holdTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  const flip = () => {
    tapLight();
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startStream(next);
  };

  /* ── photo: freeze the current frame ── */
  const takePhoto = () => {
    if (!videoRef.current) return;
    tapMedium(); sfxPop();
    const v = videoRef.current;
    // Very high quality: keep the full sensor frame (cap at 4K longest side).
    const MAXL = 3840;
    let w = v.videoWidth || 1080;
    let h = v.videoHeight || 1920;
    const scale = Math.min(1, MAXL / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(v, 0, 0, w, h);
    setShot({ uri: canvas.toDataURL('image/jpeg', 0.95), kind: 'photo', ext: 'jpg', contentType: 'image/jpeg' });
  };

  /* ── video: hold to record, release to stop ── */
  const startRecording = () => {
    if (!streamRef.current) return;
    tapMedium(); sfxPop();
    chunksRef.current = [];
    try {
      const mime = window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      // ~12 Mbps — phone-camera-grade video, crisp on any screen.
      const opts = { videoBitsPerSecond: 12000000 };
      if (mime) opts.mimeType = mime;
      const rec = new MediaRecorder(streamRef.current, opts);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setShot({ uri: URL.createObjectURL(blob), kind: 'video', ext: 'webm', contentType: 'video/webm' });
      };
      rec.start();
      setRecording(true);
      setRecMs(0);
      recTimer.current = setInterval(() => {
        setRecMs((ms) => {
          if (ms + 100 >= MAX_VIDEO_MS) stopRecording();
          return ms + 100;
        });
      }, 100);
    } catch (e) {
      setCamError('Video recording is not supported in this browser');
    }
  };

  const stopRecording = () => {
    clearInterval(recTimer.current);
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  /* ── the shutter: tap = photo, hold = video ── */
  const onShutterDown = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => { heldRef.current = true; startRecording(); }, 260);
  };
  const onShutterUp = () => {
    clearTimeout(holdTimer.current);
    if (heldRef.current) stopRecording();
    else takePhoto();
  };

  /* ── gallery: upload a photo or video from your library into a
     story/reel — with the full sound rail available in preview ── */
  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        const isVid = (a.type || '').startsWith('video') || /^video\//.test(a.mimeType || '');
        const mime = a.mimeType || (isVid ? 'video/mp4' : 'image/jpeg');
        const ext = (mime.split('/')[1] || (isVid ? 'mp4' : 'jpg')).replace('jpeg', 'jpg');
        setShot({ uri: a.uri, kind: isVid ? 'video' : 'photo', ext, contentType: mime });
      }
    } catch (e) { setCamError('Could not open your gallery'); }
  };

  /* ── long-form video: pick an existing file (works on web + native) ── */
  const pickVideoFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 900 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        const raw = (a.fileName || a.uri || 'video.mp4').split('?')[0];
        const ext = (raw.split('.').pop() || 'mp4').toLowerCase();
        setShot({ uri: a.uri, kind: 'video', ext: ext || 'mp4', contentType: a.mimeType || ('video/' + (ext || 'mp4')) });
      }
    } catch (e) { setCamError('Could not open your videos'); }
  };

  /* ── native: one tap into the system camera ── */
  const nativeShoot = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setCamError('Camera permission needed 🎥'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1, videoMaxDuration: 30, videoQuality: ImagePicker.UIImagePickerControllerQualityType && ImagePicker.UIImagePickerControllerQualityType.High });
    if (!result.canceled && result.assets && result.assets[0]) {
      const a = result.assets[0];
      const isVid = (a.type || '').startsWith('video');
      setShot({ uri: a.uri, kind: isVid ? 'video' : 'photo', ext: isVid ? 'mp4' : 'jpg', contentType: isVid ? 'video/mp4' : 'image/jpeg' });
    }
  };

  /* ── share ── */
  const share = async () => {
    if (!shot || busy) return;
    setBusy(true);
    try {
      if (SUPABASE_READY && user) {
        const mediaUrl = isWeb
          ? await uploadCapture(user.id, shot.uri, shot.ext, shot.contentType)
          : await uploadMedia(user.id, shot.uri);
        if (mode === 'story') {
          await createStory(user.id, { mediaUrl, caption: caption.trim(), sound });
          onPostedStory && onPostedStory({ user: { id: user.id, name: 'You', avatar: av(5) }, media: mediaUrl, sound, caption: caption.trim() || null });
        } else if (mode === 'video') {
          const row = await createPost({ userId: user.id, type: 'vod', caption: caption.trim() || '🎬 Video', mediaUrl });
          onPosted && onPosted(row);
        } else {
          const row = await createPost({ userId: user.id, type: 'reel', caption: caption.trim() || '🎬', mediaUrl, sound });
          onPosted && onPosted({
            id: row.id,
            user: { name: (row.user && row.user.name) || 'You', avatar: (row.user && row.user.avatar_url) || av(5), verified: !!(row.user && row.user.verified) },
            type: 'reel', media: row.media_url, caption: row.caption,
            place: 'Right here', startsIn: 'Live now', coords: ME.coords,
            sound, vibes: 0, comments: 0, squad: 'New Vibe Squad',
          });
        }
      } else {
        // demo mode — local only
        if (mode === 'story') onPostedStory && onPostedStory({ user: { id: 'me', name: 'You', avatar: av(5) }, media: shot.uri, sound, caption: caption.trim() || null });
        else if (mode === 'video') onPosted && onPosted({ id: 'local-' + Date.now(), type: 'vod', media_url: shot.uri, caption: caption.trim() || '🎬 Video', user: { name: 'You', avatar_url: av(5) } });
        else onPosted && onPosted({ id: 'local-' + Date.now(), user: { name: 'You', avatar: av(5), verified: false }, type: 'reel', media: shot.uri, caption: caption.trim() || '🎬', place: 'Right here', startsIn: 'Live now', coords: ME.coords, sound, vibes: 0, comments: 0, squad: 'New Vibe Squad' });
      }
      tapSuccess(); sfxSuccess();
      onClose();
    } catch (e) {
      setCamError(e.message || 'Could not share — try again');
    } finally {
      setBusy(false);
    }
  };

  const recPct = Math.min(1, recMs / MAX_VIDEO_MS);

  /* TikTok-style sound rail — shown while shooting AND on the preview,
     so an uploaded gallery photo can get a song too. */
  const soundRail = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, marginBottom: 16 }}>
      <Pressable onPress={() => { tapLight(); setHubOpen(true); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,58,237,0.9)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 }}>
          <Text style={{ fontSize: 13 }}>🎧</Text>
          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginLeft: 5 }}>Music Hub</Text>
        </View>
      </Pressable>
      {railSounds.map((s) => {
        const on = sound && sound.id === s.id;
        return (
          <Pressable key={s.id} onPress={() => { tapLight(); sfxPop(); setSound(on ? null : s); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 }}>
              <Text style={{ fontSize: 13 }}>{s.emoji}</Text>
              <Text style={{ color: on ? C.text : '#FFF', fontSize: 11.5, fontWeight: '800', marginLeft: 5 }} numberOfLines={1}>
                {s.title}
              </Text>
              {on ? <Ionicons name="checkmark" size={13} color={C.purple} style={{ marginLeft: 4 }} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* ── viewfinder / preview ── */}
        {shot ? (
          shot.kind === 'video' && isWeb ? (
            <video src={shot.uri} autoPlay loop playsInline style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Image source={{ uri: shot.uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          )
        ) : isWeb ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Pressable onPress={nativeShoot}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera" size={38} color="#FFF" />
                </View>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 12 }}>Tap to shoot</Text>
              </View>
            </Pressable>
            <Pressable onPress={pickFromLibrary} style={{ marginTop: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Ionicons name="images-outline" size={17} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', marginLeft: 7 }}>Upload from gallery</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* recording border */}
        {recording ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 4, borderColor: C.coral }} />
        ) : null}

        {/* ── top bar ── */}
        <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); shot ? setShot(null) : onClose(); }} hitSlop={10}>
            <Ionicons name={shot ? 'arrow-back' : 'close'} size={30} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1 }} />
          {recording ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.9)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginRight: 6 }} />
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{(recMs / 1000).toFixed(1)}s</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {!shot && isWeb ? (
            <Pressable onPress={flip} hitSlop={10}>
              <Ionicons name="camera-reverse-outline" size={28} color="#FFF" />
            </Pressable>
          ) : <View style={{ width: 28 }} />}
        </View>

        {camError ? (
          <View style={{ position: 'absolute', top: insets.top + 60, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>{camError}</Text>
          </View>
        ) : null}

        {/* ── bottom controls ── */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 16 }}>
          {!shot ? (
            <>
              {/* pick a sound while you shoot */}
              {soundRail}

              {/* shutter row — gallery upload on the left, shutter center */}
              {isWeb ? (
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={() => { tapLight(); pickFromLibrary(); }} hitSlop={8} style={{ marginRight: 34 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="images-outline" size={22} color="#FFF" />
                      </View>
                    </Pressable>
                    <Pressable onPressIn={onShutterDown} onPressOut={onShutterUp} disabled={!!camError}>
                      <View style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: recording ? C.coral : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: recording ? 34 : 62, height: recording ? 34 : 62, borderRadius: recording ? 9 : 31, backgroundColor: recording ? C.coral : '#FFF' }} />
                      </View>
                    </Pressable>
                    <View style={{ width: 46, marginLeft: 34 }} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', marginTop: 10 }}>
                    Tap for photo · hold for video · 🖼️ upload
                  </Text>
                  {recording ? (
                    <View style={{ height: 4, width: 160, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: 160 * recPct, backgroundColor: C.coral }} />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* long-form: upload a full video (YouTube-style) */}
              {mode === 'video' ? (
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <Pressable onPress={() => { tapLight(); pickVideoFile(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}>
                      <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', marginLeft: 8 }}>Upload a video 📁</Text>
                    </View>
                  </Pressable>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 8 }}>Long-form · or hold the shutter to record</Text>
                </View>
              ) : null}

              {/* mode switch */}
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                {['story', 'reel', 'video'].map((m) => (
                  <Pressable key={m} onPress={() => { tapLight(); setMode(m); }} style={{ marginHorizontal: 12 }}>
                    <Text style={{ color: mode === m ? '#FFF' : 'rgba(255,255,255,0.5)', fontSize: 13.5, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      {m === 'story' ? '⭕ Story' : m === 'reel' ? '🎬 Reel' : '📺 Video'}
                    </Text>
                    {mode === m ? <View style={{ height: 3, borderRadius: 2, backgroundColor: C.gold, marginTop: 5 }} /> : null}
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            /* ── preview: song rail + caption + share — an uploaded
               photo gets its music right here ── */
            <View>
              {mode !== 'video' ? soundRail : null}
              <View style={{ paddingHorizontal: 16 }}>
              {sound ? (
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 10 }}>
                  <Text style={{ fontSize: 13 }}>{sound.emoji}</Text>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>♫ {sound.title} · {sound.artist}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 4, marginRight: 10 }}>
                  <TextInput
                    placeholder={mode === 'story' ? 'Say something… (optional)' : mode === 'video' ? 'Title your video…' : 'Caption your reel…'}
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    value={caption}
                    onChangeText={setCaption}
                    style={{ color: '#FFF', fontSize: 14 }}
                  />
                </View>
                <Pressable onPress={share} disabled={busy}>
                  <LinearGradient colors={[C.purple, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13, opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{busy ? 'Sharing…' : mode === 'story' ? 'Add to Story' : mode === 'video' ? 'Post Video' : 'Post Reel'}</Text>
                    <MaterialCommunityIcons name="star-four-points" size={15} color={C.gold} style={{ marginLeft: 6 }} />
                  </LinearGradient>
                </Pressable>
              </View>
              </View>
            </View>
          )}
        </View>

        {hubOpen ? <MusicHubSheet onPick={(t) => setSound(t)} onClose={() => setHubOpen(false)} /> : null}
      </View>
    </Modal>
  );
};
