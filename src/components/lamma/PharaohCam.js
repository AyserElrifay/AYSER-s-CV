import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { LENSES, drawLens, placeOnFace } from '../lensArt';
import { bakeFace } from './faceShot';
import { loadFaceDetector, findFace, makeFaceTracker } from '../../lib/faceDetect';
import { tapLight, tapMedium, tapSuccess } from '../../utils/feedback';

/* ─── لمّة · YOUR FACE, IN THE PACK'S OWN WORLD ──────────────────────
   A letter in a circle is not a player. Everybody in a room together
   already knows what everybody else looks like, and the scoreboard is
   funnier when it is faces.

   So before an Egyptian game starts you take ONE photo, here, with a
   nemes headcloth or Nefertiti's crown on your head, and that is who
   you are for the rest of the night — in the lobby, between questions
   and on the podium.

   ── WHY THIS IS NOT A COSTUME OF ANYBODY ──
   Every piece of regalia in here is drawn in code (see lensArt.js) and
   is three thousand years old. There is no photograph of a museum
   piece, no traced illustration and no asset from anybody's pack — the
   same rule the rest of the app is built on, and the reason it can
   ship at all.

   ── WHAT LEAVES THE PHONE ──
   One small square JPEG, and only after you have looked at it and said
   yes. It is scoped to the room: it is stored on your seat in that
   room, it goes to the people playing with you, and it goes away when
   the room does. Nothing is written to your profile, and there is no
   copy of the video anywhere — the frames are drawn and thrown away.

   ── AND IT WORKS WITHOUT A FACE DETECTOR ──
   If the cascade cannot be fetched, the regalia sits where a face
   usually is and you frame yourself instead. A camera that refuses to
   take a picture is worse than one that needs you to lean left.      */

const isWeb = Platform.OS === 'web';
const EGYPT = LENSES.filter((l) => l.tag === 'egypt');

/* The overlay is the FRAME, fitted the same way the video is — the note
   on LensLayer in CaptureModal is the story of what happens otherwise:
   preview and photo end up being two different pictures. */
const Overlay = ({ lens, frame }) => {
  const ref = useRef(null);
  const lensRef = useRef(lens);
  lensRef.current = lens;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    if (!isWeb) return undefined;
    let raf = null;
    const loop = () => {
      const cv = ref.current;
      if (cv) {
        const { w, h } = frameRef.current;
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        drawLens(ctx, w, h, lensRef.current, performance.now());
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []);

  if (!isWeb) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
    </View>
  );
};

export const PharaohCam = ({ visible, onClose, onDone, t }) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackerRef = useRef(null);
  const [frame, setFrame] = useState({ w: 1280, h: 720 });
  const [lens, setLens] = useState({ id: EGYPT[0] ? EGYPT[0].id : 'nemes', x: 0.5, y: 0.45, s: 0.3 });
  const lensRef = useRef(lens);
  lensRef.current = lens;
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => { try { tr.stop(); } catch (e) {} });
      streamRef.current = null;
    }
  }, []);

  /* The camera runs only while this is open, and it is handed back the
     moment it closes — a light left on behind a closed sheet is the
     kind of thing people uninstall an app over. */
  useEffect(() => {
    if (!visible || !isWeb) return undefined;
    let alive = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,                       // a photo has no sound in it
        });
        if (!alive) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setErr(null);
      } catch (e) {
        setErr('cam');
      }
    })();
    return () => { alive = false; stop(); };
  }, [visible, stop]);

  /* Follow the face, a few times a second. Mirrored preview, so what
     the detector calls left is the person's right. */
  useEffect(() => {
    if (!visible || !isWeb || shot) return undefined;
    let stopped = false;
    let timer = null;
    if (!trackerRef.current) trackerRef.current = makeFaceTracker({ ease: 0.35, holdMs: 800 });
    (async () => {
      const ok = await loadFaceDetector();
      if (!ok || stopped) return;             // no cascade → it still takes a photo
      const tick = () => {
        if (stopped) return;
        const el = videoRef.current;
        if (el && el.videoWidth) {
          const raw = findFace(el);
          const f = trackerRef.current.push(raw);
          if (f) {
            const seen = { ...f, x: 1 - f.x };
            setFrame((cur) => (cur.w === el.videoWidth && cur.h === el.videoHeight
              ? cur : { w: el.videoWidth, h: el.videoHeight }));
            setLens((cur) => {
              const placed = placeOnFace(cur.id, seen);
              return placed ? { ...cur, ...placed } : cur;
            });
          }
        }
        timer = setTimeout(tick, 140);
      };
      tick();
    })();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [visible, shot, lens.id]);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    tapMedium();
    // the mirror, the crop and the encode all live in faceShot.js, where
    // they can be run and checked away from a phone
    const url = bakeFace(v, v.videoWidth, v.videoHeight, lensRef.current, performance.now());
    if (url) setShot(url);
  };

  const keep = () => {
    tapSuccess();
    if (onDone) onDone(shot);
    setShot(null);
    stop();
    if (onClose) onClose();
  };

  const close = () => {
    tapLight();
    setShot(null);
    stop();
    if (onClose) onClose();
  };

  return (
    <Modal visible={!!visible} animationType="slide" transparent={false} onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#0A0614', paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={26} color="#FFF" />
          </Pressable>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginStart: 12, flex: 1 }}>
            {t('lamma_face_title')}
          </Text>
        </View>

        <View style={{ flex: 1, marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: '#150E28' }}>
          {shot ? (
            <Image source={{ uri: shot }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          ) : isWeb ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => {
                  const el = e && e.currentTarget;
                  if (el && el.videoWidth) {
                    setFrame((cur) => (cur.w === el.videoWidth && cur.h === el.videoHeight
                      ? cur : { w: el.videoWidth, h: el.videoHeight }));
                  }
                }}
                style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              <Overlay lens={lens} frame={frame} />
            </>
          ) : null}

          {err ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
              <Text style={{ fontSize: 34 }}>🎥</Text>
              <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '800', textAlign: 'center', marginTop: 10 }}>
                {t('lamma_face_no_cam')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* the regalia, one tap each */}
        {!shot ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 14 }}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {EGYPT.map((l) => {
              const on = lens.id === l.id;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => {
                    tapLight();
                    if (trackerRef.current) trackerRef.current.reset();
                    setLens((cur) => ({ ...cur, id: l.id }));
                  }}
                  style={{ marginEnd: 10 }}
                >
                  <View style={{
                    width: on ? 58 : 50, height: on ? 58 : 50, borderRadius: 29,
                    backgroundColor: on ? '#FFF' : 'rgba(255,255,255,0.14)',
                    borderWidth: 2, borderColor: on ? C.gold : 'rgba(255,255,255,0.3)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: on ? 24 : 20 }}>{l.emoji}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 16 }}>
          {shot ? (
            <View style={{ flexDirection: 'row' }}>
              <Pressable onPress={() => { tapLight(); setShot(null); }} style={{ flex: 1, marginEnd: 10 }}>
                <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>{t('lamma_face_again')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={keep} style={{ flex: 1 }}>
                <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>{t('lamma_face_use')}</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={snap} disabled={!!err}>
              <View style={{
                backgroundColor: err ? 'rgba(255,255,255,0.16)' : C.purple,
                borderRadius: 999, paddingVertical: 15, alignItems: 'center',
              }}>
                <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{t('lamma_face_snap')}</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};
