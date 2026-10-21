import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../../constants/theme';
import { AV_NEUTRAL } from '../../constants/mockData';
import { worldBoard, worldEnter, worldLeave, walkTotal, walkAdd, walkRank, uploadPhoto } from '../../services/squadGames';
import { todayChallenge, weekChallenges } from './challenges';
import { gw, fill, say, WALK_STOPS } from './words';
import { tapLight, tapSelection, tapSuccess } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';

/* ─── ONE WORLD ───────────────────────────────────────────────────────
   The same thing, everywhere, on the same day (supabase/RUN_ME.sql,
   "ONE WORLD"): tonight's sky from wherever people are, the dish of
   the month, and the kilometres everybody walked added up on the road
   from Cairo. Real entries only — an empty strip says nobody yet. */

const TABS = ['today', 'week', 'walk'];

/* what kind of challenge it is, said small above it */
const KIND = {
  sky: ['Sky', 'السما'], food: ['Food', 'أكل'], city: ['Your city', 'مدينتك'], detail: ['Up close', 'من قريب'],
  nature: ['Nature', 'طبيعة'], kind: ['A kindness', 'حاجة طيبة'], colour: ['Colour', 'لون'],
  cook: ['Cook', 'اطبخ'], go: ['Go', 'روح'], together: ['Together', 'سوا'],
};
export const kindLabel = (lang, c) => (KIND[c] ? KIND[c][lang === 'ar' ? 1 : 0] : '');
const WEEK_SUB = {
  cook: ['Everybody cooks this, this week. Show yours.', 'الكل بيطبخ ده الأسبوع ده. ورّينا بتاعك.'],
  go: ['Go this week. One photo from there.', 'روح الأسبوع ده، وصورة واحدة من هناك.'],
  together: ['With people, this week. Hands and backs are fine; faces only with their OK.', 'مع ناس الأسبوع ده. الإيدين والضهر ماشي، والوشوش بإذنهم.'],
};

/* the challenge itself: what kind, what, and one line */
const Head = ({ ch, lang, sub }) => (
  <View style={{ marginTop: 18 }}>
    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{kindLabel(lang, ch.c).toUpperCase()}</Text>
    <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 }}>{say(lang, ch)}</Text>
    <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{sub}</Text>
  </View>
);

/* five looks, the same CSS the main camera uses (CaptureModal.js) —
   seen live on the camera and baked into the pixels that are shared */
const LOOKS = [
  { id: 'f_none', css: 'none' },
  { id: 'f_golden', css: 'sepia(0.34) saturate(1.45) brightness(1.06) hue-rotate(-8deg)' },
  { id: 'f_warm', css: 'sepia(0.30) saturate(1.5) contrast(1.06) brightness(1.02)' },
  { id: 'f_night', css: 'brightness(0.86) contrast(1.18) saturate(1.1) hue-rotate(-14deg)' },
  { id: 'f_mono', css: 'grayscale(1) contrast(1.12)' },
];
const WEB = Platform.OS === 'web' && typeof document !== 'undefined';

/* draw a video frame or a picked photo through the look, as a jpeg Blob
   (handed to the upload as it is: Safari can't always fetch its own blob: urls) */
const bake = (src, w, h, css) => new Promise((resolve) => {
  const max = 1440; const k = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const g = cv.getContext('2d'); g.filter = css === 'none' ? 'none' : css; g.drawImage(src, 0, 0, cv.width, cv.height);
  cv.toBlob((b) => resolve(b || null), 'image/jpeg', 0.86);
});

/* ─── THE CAMERA IS THE SCREEN ────────────────────────────────────────
   Ayser: "سهّل الدنيا … خلي الكاميرا شغالة بفلاتر في الحتت الفاضية".
   One frame, five looks under it, one shutter. Tap the frame and the
   camera opens (asked only then, never on arrival). After the shot:
   the picture, an optional line, Share. The city comes from the
   profile — nobody types it. */
const Shot = ({ T, busy, onShare }) => {
  const [live, setLive] = useState(false);
  const [shot, setShot] = useState(null);     // { uri, w, h, el }
  const [look, setLook] = useState(LOOKS[0]);
  const [cap, setCap] = useState('');
  const [camErr, setCamErr] = useState(false);
  const vid = useRef(null);
  const stream = useRef(null);
  const stop = () => { try { if (stream.current) stream.current.getTracks().forEach((t) => t.stop()); } catch (e) {} stream.current = null; setLive(false); };
  useEffect(() => stop, []);

  /* The camera, handed to the <video> the moment it exists. It used to be
     handed over on the next tick — before React had drawn the box — so on
     an iPhone the camera was on (the red light) and the box stayed black. */
  const attach = (el) => {
    vid.current = el;
    if (!el || !stream.current) return;
    if (el.srcObject !== stream.current) {
      el.muted = true; el.setAttribute('playsinline', ''); el.setAttribute('muted', '');
      el.srcObject = stream.current;
    }
    const p = el.play && el.play(); if (p && p.catch) p.catch(() => {});
  };
  const open = async () => {
    tapLight(); setCamErr(false);
    if (!WEB) return pick(true);
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      stream.current = st; setLive(true);
      attach(vid.current);   // if the box is already there; otherwise it takes it when it appears
    } catch (e) { setCamErr(true); }
  };
  const snap = () => {
    const v = vid.current; if (!v || !v.videoWidth) return;
    tapSuccess();
    const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d').drawImage(v, 0, 0);
    setShot({ uri: cv.toDataURL('image/jpeg', 0.92), w: v.videoWidth, h: v.videoHeight, el: cv });
    stop();
  };
  const pick = async (camera) => {
    try {
      const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const res = await fn({ mediaTypes: ['images'], quality: 0.85 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const a = res.assets[0];
      stop();
      if (WEB) {
        const im = new window.Image();
        im.onload = () => setShot({ uri: a.uri, w: im.naturalWidth, h: im.naturalHeight, el: im });
        im.src = a.uri;
      } else setShot({ uri: a.uri, w: a.width, h: a.height, el: null });
    } catch (e) { setCamErr(true); }
  };
  const share = async () => {
    if (!shot || busy) return;
    const uri = WEB && shot.el ? (await bake(shot.el, shot.w, shot.h, look.css)) || shot.uri : shot.uri;
    const ok = await onShare(uri, cap.trim());
    if (ok) { setShot(null); setCap(''); setLook(LOOKS[0]); }
  };
  const filt = WEB && look.css !== 'none' ? { filter: look.css } : null;

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B0B0F', aspectRatio: 4 / 5, width: '100%' }}>
        {shot ? (
          <Image source={{ uri: shot.uri }} style={[{ width: '100%', height: '100%' }, filt]} resizeMode="cover" />
        ) : live && WEB ? (
          React.createElement('video', { ref: attach, autoPlay: true, muted: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'cover', filter: look.css } })
        ) : (
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={T('shoot_tap')} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera-outline" size={30} color="#FFF" />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginTop: 14 }}>{camErr ? T('cam_no') : T('shoot_tap')}</Text>
          </Pressable>
        )}
      </View>

      {/* the looks */}
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingEnd: 8 }}>
        {LOOKS.map((l) => (
          <Pressable key={l.id} onPress={() => { tapSelection(); setLook(l); }} accessibilityRole="button" accessibilityState={{ selected: look.id === l.id }} style={{ marginEnd: 8 }}>
            <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: look.id === l.id ? C.text : C.glass, borderWidth: 1, borderColor: look.id === l.id ? C.text : C.line }}>
              <Text style={{ color: look.id === l.id ? C.bg : C.text, fontSize: 13, fontWeight: '800' }}>{T(l.id)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {shot ? (
        <>
          <TextInput value={cap} onChangeText={setCap} maxLength={140} placeholder={T('caption_ph')} placeholderTextColor={C.faint}
            style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: C.glass, marginTop: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <Pressable onPress={() => { tapLight(); setShot(null); }} hitSlop={8} accessibilityRole="button" style={{ paddingHorizontal: 6, paddingVertical: 12, marginEnd: 14 }}>
              <Text style={{ color: C.dim, fontSize: 15, fontWeight: '800' }}>{T('retake')}</Text>
            </Pressable>
            <Pressable onPress={share} disabled={busy} accessibilityRole="button" style={{ flex: 1 }}>
              <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple }}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{T('share')}</Text>}
              </View>
            </Pressable>
          </View>
        </>
      ) : (
        /* library · shutter · (balance) */
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 12 }}>
          <Pressable onPress={() => { tapLight(); pick(false); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={T('library')}
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            <Ionicons name="images-outline" size={20} color={C.text} />
          </Pressable>
          <Pressable onPress={live ? snap : open} accessibilityRole="button" accessibilityLabel={live ? T('photo') : T('shoot_tap')}
            style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: C.text, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: live ? C.text : C.purple }} />
          </Pressable>
          <View style={{ width: 46 }} />
        </View>
      )}
      <Text style={{ color: C.faint, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{T('no_faces')}</Text>
    </View>
  );
};

const Board = ({ ch, userId, T, city, intro }) => {
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const load = () => worldBoard(ch, 80).then((r) => { if (r && r.ok) setB(r); else setErr(T(r && r.reason === 'setup' ? 'setup' : 'err')); });
  useEffect(() => { load(); }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps

  const onShare = async (uri, cap) => {
    setBusy(true); setErr(null);
    try {
      const url = await uploadPhoto(userId, uri);
      const r = await worldEnter(ch, url, cap, city || '');
      if (r && r.ok) { tapSuccess(); load(); return true; }
      setErr(T('err')); return false;
    } catch (e) { setErr(T('photo_err')); return false; } finally { setBusy(false); }
  };

  return (
    <>
      {intro}
      <Shot T={T} busy={busy} onShare={onShare} />
      {err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>{err}</Text> : null}

      {!b ? (err ? null : <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} />) : (
        <>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 20 }}>{b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : T('none_yet')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 6 }}>
            {(b.entries || []).map((e) => (
              <View key={e.id} style={{ width: '50%', padding: 4 }}>
                <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                  <Image source={{ uri: e.photo }} style={{ width: '100%', aspectRatio: 4 / 5 }} resizeMode="cover" />
                  <View style={{ padding: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Image source={{ uri: e.avatar || AV_NEUTRAL }} style={{ width: 18, height: 18, borderRadius: 9, marginEnd: 6 }} />
                      <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', flex: 1 }} numberOfLines={1}>{(e.flag ? e.flag + ' ' : '') + (e.city || e.name || '')}</Text>
                    </View>
                    {e.body ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>{e.body}</Text> : null}
                    {e.mine ? (
                      <Pressable onPress={() => { tapLight(); worldLeave(e.id).then(load); }} hitSlop={6} style={{ marginTop: 4 }}>
                        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800' }}>{T('yours') + ' · ' + T('remove')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
};

/* ─── WHO WALKED THE MOST, THIS WEEK ── (RUN_ME.sql "WHO WALKED THE MOST") */
const Rank = ({ T, tick }) => {
  const [scope, setScope] = useState('all');
  const [r, setR] = useState(null);
  useEffect(() => { let alive = true; setR(null); walkRank(scope).then((x) => { if (alive) setR(x && x.ok ? x : { people: [], countries: [] }); }); return () => { alive = false; }; }, [scope, tick]);
  const km = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString() + ' km';
  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '800' }}>{T('rk_title')}</Text>
        <View style={{ flexDirection: 'row', backgroundColor: C.glassHi, borderRadius: 999, padding: 3 }}>
          {['all', 'mates'].map((k) => (
            <Pressable key={k} onPress={() => { tapSelection(); setScope(k); }} accessibilityRole="tab" accessibilityState={{ selected: scope === k }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: scope === k ? C.glass : 'transparent' }}>
                <Text style={{ color: scope === k ? C.text : C.dim, fontSize: 12.5, fontWeight: '800' }}>{T(k === 'all' ? 'rk_all' : 'rk_mates')}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      {r && r.me ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>{fill(T('rk_you'), { r: r.me.r, n: r.me.of })}</Text> : null}
      {!r ? <ActivityIndicator color={C.purple} style={{ marginTop: 18 }} /> : !r.people.length ? (
        <Text style={{ color: C.dim, fontSize: 14, marginTop: 12 }}>{T('rk_none')}</Text>
      ) : (
        <View style={{ marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, overflow: 'hidden' }}>
          {r.people.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, backgroundColor: p.me ? C.purpleSoft : 'transparent' }}>
              <Text style={{ width: 26, color: p.r <= 3 ? C.text : C.faint, fontSize: 15, fontWeight: '900' }}>{p.r}</Text>
              <Image source={{ uri: p.avatar || AV_NEUTRAL }} style={{ width: 30, height: 30, borderRadius: 15, marginEnd: 10, backgroundColor: C.glassHi }} />
              <Text style={{ flex: 1, color: C.text, fontSize: 14.5, fontWeight: p.me ? '900' : '700' }} numberOfLines={1}>{(p.name || '—') + (p.flag ? '  ' + p.flag : '')}</Text>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{km(p.km)}</Text>
            </View>
          ))}
        </View>
      )}
      {r && r.countries && r.countries.length > 1 ? (
        <>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 18 }}>{T('rk_countries').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {r.countries.map((c, i) => (
              <View key={c.cc} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginEnd: 8, marginBottom: 8, backgroundColor: i === 0 ? C.text : C.glass, borderWidth: 1, borderColor: i === 0 ? C.text : C.line }}>
                <Text style={{ fontSize: 14 }}>{c.flag || c.cc}</Text>
                <Text style={{ color: i === 0 ? C.bg : C.text, fontSize: 13, fontWeight: '800', marginStart: 6 }}>{km(c.km)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
};

const Walk = ({ lang, T }) => {
  const [w, setW] = useState(null);
  const [km, setKm] = useState('');
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { walkTotal().then((r) => { if (r && r.ok) { setW(r); if (r.today) setKm(String(r.today)); } else setErr(T(r && r.reason === 'setup' ? 'setup' : 'err')); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = w ? Number(w.km) || 0 : 0;
  const end = WALK_STOPS[WALK_STOPS.length - 1].km;
  // after Lisbon the road starts again from Cairo, and says how many times round
  const lap = Math.floor(total / end);
  const pos = total - lap * end;
  let at = WALK_STOPS[0]; let next = WALK_STOPS[1];
  WALK_STOPS.forEach((s, i) => { if (pos >= s.km) { at = s; next = WALK_STOPS[i + 1] || WALK_STOPS[0]; } });
  const save = async () => {
    const n = Math.min(30, Math.max(0, parseFloat(String(km).replace(',', '.')) || 0));
    tapSelection();
    const r = await walkAdd(n);
    if (r && r.ok) { tapSuccess(); setW(r); setErr(null); setTick((x) => x + 1); } else setErr(T('err'));
  };
  return (
    <>
      <Text style={{ color: C.dim, fontSize: 14, marginTop: 14, lineHeight: 20 }}>{T('walk_s')}</Text>
      {!w ? (err ? <Text style={{ color: C.coral, marginTop: 14 }}>{err}</Text> : <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} />) : (
        <>
          <View style={{ borderRadius: 22, padding: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 16 }}>
            <Text style={{ color: C.text, fontSize: 30, fontWeight: '900' }}>{Math.round(total).toLocaleString() + ' km'}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{fill(T('walk_km'), { km: Math.round(total).toLocaleString(), p: w.people || 0, c: w.countries || 0 })}</Text>
            {/* the road, Cairo to Lisbon, with where everybody has got to */}
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.glassHi, marginTop: 18, overflow: 'hidden' }}>
              <View style={{ width: Math.min(100, (pos / end) * 100) + '%', height: 8, backgroundColor: C.green }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: C.faint, fontSize: 11 }}>{say(lang, WALK_STOPS[0])}</Text>
              <Text style={{ color: C.faint, fontSize: 11 }}>{say(lang, WALK_STOPS[WALK_STOPS.length - 1])}</Text>
            </View>
            <Text style={{ color: C.green, fontSize: 15, fontWeight: '900', marginTop: 12 }}>{'📍 ' + fill(T('walk_at'), { place: say(lang, at) }) + (lap ? ' · ×' + (lap + 1) : '')}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{fill(T('walk_next'), { km: Math.max(0, Math.round((next.km || end) - pos)), place: say(lang, next) })}</Text>
          </View>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20 }}>{T('walk_today').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput value={km} onChangeText={setKm} keyboardType="decimal-pad" maxLength={4} placeholder="0" placeholderTextColor={C.faint}
              style={{ flex: 1, minWidth: 0, width: 0, color: C.text, fontSize: 18, fontWeight: '800', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.glass }} />
            <Pressable onPress={save} accessibilityRole="button" style={{ marginStart: 10 }}>
              <View style={{ borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: C.purple }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{T('done')}</Text>
              </View>
            </Pressable>
          </View>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{fill(T('walk_mine'), { km: Number(w.mine || 0).toLocaleString() })}</Text>
          {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
          <Rank T={T} tick={tick} />
        </>
      )}
    </>
  );
};

const Week = ({ userId, lang, T, city }) => {
  const list = weekChallenges();
  const [pick, setPick] = useState(0);
  const ch = list[pick];
  return (
    <>
      {/* the three of this week, side by side; one is open below */}
      <View style={{ flexDirection: 'row', marginTop: 16, marginHorizontal: -4 }}>
        {list.map((x, i) => (
          <Pressable key={x.key} onPress={() => { tapSelection(); setPick(i); }} accessibilityRole="tab" accessibilityState={{ selected: pick === i }} style={{ flex: 1, paddingHorizontal: 4 }}>
            <View style={{ borderRadius: 16, padding: 12, minHeight: 92, backgroundColor: pick === i ? C.text : C.glass, borderWidth: 1, borderColor: pick === i ? C.text : C.line }}>
              <Text style={{ color: pick === i ? C.bg : C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.2 }}>{kindLabel(lang, x.c).toUpperCase()}</Text>
              <Text style={{ color: pick === i ? C.bg : C.text, fontSize: 13.5, fontWeight: '800', marginTop: 4, lineHeight: 18 }} numberOfLines={3}>{say(lang, x)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Board key={ch.key} ch={ch.key} userId={userId} T={T} city={city}
        intro={<Head ch={ch} lang={lang} sub={WEEK_SUB[ch.c][lang === 'ar' ? 1 : 0]} />} />
    </>
  );
};

export const WorldSheet = ({ userId, lang, city, start, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const T = (k) => gw(lang, k);
  const [tab, setTab] = useState(start && TABS.includes(start) ? start : 'today');
  const today = todayChallenge();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* the clock and the notch stay clear: what scrolls goes under this */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg, zIndex: 5 }} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={T('close')} style={{ alignSelf: 'flex-start', outlineStyle: 'none' }}>
            <Ionicons name="close" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{T('world')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{T('world_s')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 16, backgroundColor: C.glassHi, borderRadius: 999, padding: 4 }}>
            {TABS.map((k) => (
              <Pressable key={k} onPress={() => { tapSelection(); setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1 }}>
                <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: tab === k ? C.glass : 'transparent' }}>
                  <Text style={{ color: tab === k ? C.text : C.dim, fontSize: 13, fontWeight: '900' }} numberOfLines={1}>{T(k === 'walk' ? 'walk_t' : 'tab_' + k)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {tab === 'today' ? <Board key="today" ch={today.key} userId={userId} T={T} city={city} intro={<Head ch={today} lang={lang} sub={say(lang, { en: today.s_en, ar: today.s_ar })} />} /> : null}
          {tab === 'week' ? <Week userId={userId} lang={lang} T={T} city={city} /> : null}
          {tab === 'walk' ? <Walk lang={lang} T={T} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
