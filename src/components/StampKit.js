import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image, Animated, Easing, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { pw, leftText } from '../constants/passportWords';
import { myPassport, stampClaim, eventQr, hostStamp, stampLink, codeOf } from '../services/passport';
import { askUpgrade } from '../services/membership';
import { goToTab } from '../lib/mapBus';
import { Qr } from './biz/Qr';
import { HostCard } from './ScaleKit';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── THE MOMENTS PASSPORT ────────────────────────────────────────────
   Ayser: attendance is counted, not claimed — a stamp for every table
   you really sat at, and the stamps open things: 3 in 30 days, a week of
   messages (Moments+); 5, a coffee at a partner café; 10, 30% off Level 2.
   The look is the gateway's — Moments violet as the ground, white type,
   one yellow spark — and every screen does one thing. The QR's
   signature, its 30-second life and every reward are the server's
   (RUN_ME.sql, "THE MOMENTS PASSPORT"); this only shows them.

     StampFlow        claims a code, then celebrates (or says why not)
     StampScanner     the camera, pointed at the table's QR
     StampBook        the passport on your profile
     HostQr           the host's / café's screen: the live QR, who is in */

const fmtDay = (iso, lang) => { try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
const initials = (s) => String(s || '·').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

/* one stamp: a round ink mark, slightly turned, the place's photo or its initials */
const Stamp = ({ s, lang, size = 64, i = 0 }) => (
  <View style={{ alignItems: 'center', width: size + 18, marginEnd: 6 }}>
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: i % 3 === 1 ? C.sun : '#FFF',
      alignItems: 'center', justifyContent: 'center', transform: [{ rotate: ((i % 5) - 2) * 5 + 'deg' }] }}>
      {s.photo ? <Image source={{ uri: s.photo }} style={{ width: size - 12, height: size - 12, borderRadius: (size - 12) / 2 }} />
        : <Text style={{ color: '#FFF', fontSize: size / 3.4, fontWeight: '800', letterSpacing: 0.5 }}>{initials(s.place || s.title)}</Text>}
    </View>
    <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11.5, marginTop: 6 }} numberOfLines={1}>{fmtDay(s.at, lang)}</Text>
  </View>
);

/* ── the claim, and the moment after ── */
const ERR = { old: 'e_old', code: 'e_code', closed: 'e_closed', not_in: 'e_not_in', plus: 'e_plus', yours: 'e_yours', slow_down: 'e_slow', gone: 'e_code' };
export const StampFlow = ({ code, onClose, onAgain }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [r, setR] = useState(null);
  const [pp, setPp] = useState(null);
  const thud = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    stampClaim(code).then((x) => {
      if (!alive) return;
      const res = x || { ok: false, reason: 'err' };
      setR(res);
      if (res.ok) {
        try { window.dispatchEvent(new CustomEvent('mm-stamped')); } catch (e) {}
        myPassport().then((p) => alive && p && p.ok && setPp(p));
        // the stamp comes down hard, then everything else rises in
        Animated.sequence([
          Animated.timing(thud, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(rise, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
        setTimeout(() => { tapSuccess(); }, 400);
        if (res.rewards && res.rewards.length) setTimeout(() => tapSuccess(), 1100);
      } else { tapMedium(); if (res.reason === 'plus') askUpgrade('member'); }
    });
    return () => { alive = false; };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const rewards = (r && r.rewards) || [];
  const pass = rewards.find((x) => x.kind === 'pass');
  const toward = pp ? pp.toward_pass : null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.purple }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30 }}>
          <View style={{ width: '100%', maxWidth: 420, alignItems: 'center' }}>
            {!r ? <ActivityIndicator color="#FFF" size="large" /> : !r.ok ? (
              <>
                <Ionicons name="scan-outline" size={54} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '700', textAlign: 'center', lineHeight: 31, marginTop: 18 }}>{pw(lang, ERR[r.reason] || 'e_err')}</Text>
                {onAgain && r.reason !== 'plus' ? (
                  <Pressable onPress={() => { tapLight(); onAgain(); }} accessibilityRole="button" style={{ marginTop: 28 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 15, paddingHorizontal: 34, backgroundColor: '#FFF' }}>
                      <Text style={{ color: '#17131F', fontSize: 16, fontWeight: '700' }}>{pw(lang, 'again')}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                {/* the stamp */}
                <Animated.View style={{ opacity: thud, transform: [{ scale: thud.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }, { rotate: '-10deg' }] }}>
                  <View style={{ width: 196, height: 196, borderRadius: 98, borderWidth: 3, borderColor: C.sun, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 172, height: 172, borderRadius: 86, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                      <Text style={{ fontSize: 46 }}>✈️</Text>
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1.6, marginTop: 6, textAlign: 'center' }} numberOfLines={2}>{String(r.place || 'MOMENTS').toUpperCase()}</Text>
                      <Text style={[{ color: C.sun, fontSize: 13, fontWeight: '700', marginTop: 4 }, NUM]}>{fmtDay(new Date().toISOString(), lang)}</Text>
                    </View>
                  </View>
                </Animated.View>
                <Animated.View style={{ alignItems: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
                  <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 30, textAlign: 'center' }}>{pw(lang, 'got')}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, marginTop: 8, textAlign: 'center', lineHeight: 24 }}>{pw(lang, 'attended', { e: r.title || '' })}</Text>

                  {/* toward the pass: three rings, Apple Fitness-like */}
                  {toward != null && !pass && pp && pp.tier !== 'VIP' ? (
                    <View style={{ alignItems: 'center', marginTop: 26 }}>
                      <View style={{ flexDirection: 'row' }}>
                        {[0, 1, 2].map((k) => (
                          <View key={k} style={{ width: 22, height: 22, borderRadius: 11, marginHorizontal: 6, borderWidth: 2.5, borderColor: k < toward ? C.sun : 'rgba(255,255,255,0.35)', backgroundColor: k < toward ? C.sun : 'transparent' }} />
                        ))}
                      </View>
                      {toward < 3 ? <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 10, textAlign: 'center' }}>{pw(lang, 'toward', { n: 3 - toward })}</Text> : null}
                    </View>
                  ) : null}

                  {/* what it opened */}
                  {rewards.map((x) => (
                    <View key={x.kind} style={{ alignSelf: 'stretch', marginTop: 18, borderRadius: 24, padding: 20, backgroundColor: '#FFF' }}>
                      <Text style={{ color: '#17131F', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{x.kind === 'pass' ? '🔥 ' + pw(lang, 'pass_t') : x.kind === 'coffee_5' ? '☕ ' + pw(lang, 'coffee_t') : '🎓 ' + pw(lang, 'l2_t')}</Text>
                      <Text style={{ color: '#6F6A75', fontSize: 15, marginTop: 4, lineHeight: 21 }}>{x.kind === 'pass' ? pw(lang, 'pass_s') : x.kind === 'coffee_5' ? pw(lang, 'coffee_s') : pw(lang, 'l2')}</Text>
                    </View>
                  ))}
                </Animated.View>
              </>
            )}
            {r ? (
              <View style={{ alignSelf: 'stretch', marginTop: 30 }}>
                {pass ? (
                  <Pressable onPress={() => { tapLight(); onClose(); goToTab('TOGETHER'); setTimeout(() => { try { window.dispatchEvent(new CustomEvent('mm-open-buddies')); } catch (e) {} }, 350); }} accessibilityRole="button" style={{ marginBottom: 12 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: C.sun }}>
                      <Text style={{ color: '#17131F', fontSize: 16.5, fontWeight: '700' }}>{pw(lang, 'open_msgs')}</Text>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => { tapLight(); onClose(); }} accessibilityRole="button">
                  <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: pass ? 'transparent' : '#FFF', borderWidth: pass ? 1.5 : 0, borderColor: '#FFF' }}>
                    <Text style={{ color: pass ? '#FFF' : '#17131F', fontSize: 16.5, fontWeight: '700' }}>{pw(lang, 'done')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

/* ── the camera ── BarcodeDetector where the browser has it, jsQR (fetched
   only now) where it does not, which is every iPhone */
export const StampScanner = ({ onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const host = useRef(null);
  const [state, setState] = useState('starting');   // starting | on | none
  const [code, setCode] = useState(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || code) return undefined;
    let stream = null; let alive = true; let raf = null; let video = null;
    const stop = () => { alive = false; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); if (video) video.remove(); };
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!alive) { stop(); return; }
        video = document.createElement('video');
        video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = stream;
        Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: '0' });
        if (host.current) host.current.appendChild(video);
        await video.play();
        setState('on');
        const native = typeof window.BarcodeDetector === 'function' ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
        const jsQR = native ? null : (await import('jsqr')).default;
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let last = 0;
        const tick = async (t) => {
          if (!alive) return;
          if (t - last > 220 && video.readyState >= 2) {
            last = t;
            let text = null;
            try {
              if (native) { const found = await native.detect(video); text = found && found[0] && found[0].rawValue; }
              else {
                const w = Math.min(640, video.videoWidth), h = Math.round(w * video.videoHeight / video.videoWidth);
                canvas.width = w; canvas.height = h; ctx.drawImage(video, 0, 0, w, h);
                const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
                text = hit && hit.data;
              }
            } catch (e) { /* a frame we could not read; the next one will do */ }
            const c = codeOf(text);
            if (c) { tapMedium(); stop(); setCode(c); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) { if (alive) setState('none'); }
    })();
    return stop;
  }, [round, code]);

  if (code) return <StampFlow code={code} onClose={onClose} onAgain={() => { setCode(null); setState('starting'); setRound((n) => n + 1); }} />;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {Platform.OS === 'web' ? React.createElement('div', { ref: host, style: { position: 'absolute', inset: 0, overflow: 'hidden' } }) : null}
        {/* the frame: four corners, nothing else */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 250, height: 250, borderRadius: 34, borderWidth: 3, borderColor: 'rgba(255,255,255,0.92)' }} />
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '600', marginTop: 26, textAlign: 'center', paddingHorizontal: 30 }}>
            {state === 'none' ? pw(lang, 'cam_no') : pw(lang, 'cam')}
          </Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={pw(lang, 'done')} hitSlop={12}
          style={{ position: 'absolute', top: insets.top + 14, left: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={24} color="#FFF" />
        </Pressable>
      </View>
    </Modal>
  );
};

/* ── the passport on your profile ── */
// the way: three nodes on one line, their names under them
const Way = ({ lang, n, passUsed }) => {
  const steps = [[3, 'm3', passUsed || n >= 3], [5, 'm5', n >= 5], [10, 'm10', n >= 10]];
  const node = ([k, , on]) => (
    <View key={k} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.sun : 'rgba(255,255,255,0.16)' }}>
      <Text style={[{ color: on ? '#17131F' : '#FFF', fontSize: 13, fontWeight: '800' }, NUM]}>{k}</Text>
    </View>
  );
  const line = (on, k) => <View key={'l' + k} style={{ flex: 1, height: 2, marginHorizontal: 6, backgroundColor: on ? C.sun : 'rgba(255,255,255,0.22)' }} />;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22 }}>
        {node(steps[0])}{line(steps[1][2], 1)}{node(steps[1])}{line(steps[2][2], 2)}{node(steps[2])}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {steps.map(([k, key, on], i) => (
          <Text key={k} style={{ flex: 1, color: on ? '#FFF' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }} numberOfLines={2}>{pw(lang, key)}</Text>
        ))}
      </View>
    </View>
  );
};

export const StampBook = () => {
  const { lang } = useLang();
  const [p, setP] = useState(null);
  const [scan, setScan] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = () => myPassport().then((x) => setP(x && x.ok ? x : false));
  useEffect(() => {
    load();
    const on = () => load();
    const tick = setInterval(() => setNow(Date.now()), 60000);
    try { window.addEventListener('mm-stamped', on); } catch (e) {}
    return () => { clearInterval(tick); try { window.removeEventListener('mm-stamped', on); } catch (e) {} };
  }, []);
  if (!p) return null;
  const n = p.passport_stamps || 0;
  const hist = p.attended_events_history || [];
  const passLeft = p.temp_vip_until ? Date.parse(p.temp_vip_until) - now : 0;
  const coffee = (p.rewards || []).find((x) => x.kind === 'coffee_5');
  const l2 = (p.rewards || []).find((x) => x.kind === 'l2_30' && !x.used_at);
  const basic = p.tier === 'BASIC';
  return (
    <View style={{ marginHorizontal: 16, marginTop: 20, borderRadius: 28, padding: 24, backgroundColor: C.purple }}>
      <Text style={{ color: C.sun, fontSize: 12.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 2.2 }}>{'✦ ' + pw(lang, 'kicker')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
        <Text style={[{ color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: -1 }, NUM]}>{n === 1 ? pw(lang, 'stamp1') : pw(lang, 'stamps', { n })}</Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14.5, marginTop: 2 }}>{pw(lang, 'month', { n: p.monthly_attendance_count || 0 })}</Text>

      {/* the pass, while it runs */}
      {passLeft > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 14, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: C.sun }}>
          <Text style={{ color: '#17131F', fontSize: 13.5, fontWeight: '700' }}>{'🔥 ' + pw(lang, 'pass_on', { t: leftText(passLeft, lang) })}</Text>
        </View>
      ) : basic ? (
        /* a Moments+ member: three blank stamps toward the next week of messages */
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row' }}>
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ width: 34, height: 34, borderRadius: 17, marginEnd: 10, borderWidth: 2, borderStyle: k < p.toward_pass ? 'solid' : 'dashed',
                borderColor: k < p.toward_pass ? C.sun : 'rgba(255,255,255,0.5)', backgroundColor: k < p.toward_pass ? C.sun : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {k < p.toward_pass ? <Ionicons name="checkmark" size={18} color="#17131F" /> : null}
              </View>
            ))}
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 10, lineHeight: 20 }}>{pw(lang, 'toward', { n: 3 - (p.toward_pass || 0) })}</Text>
        </View>
      ) : null}

      {/* the way: 3 · 5 · 10 */}
      <Way lang={lang} n={n} passUsed={p.pass_used} />

      {/* the stamps */}
      {hist.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 22, marginHorizontal: -6 }} contentContainerStyle={{ paddingHorizontal: 6 }}>
          {hist.map((s, i) => <Stamp key={s.kind + s.id} s={s} lang={lang} i={i} />)}
        </ScrollView>
      ) : <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14.5, lineHeight: 21, marginTop: 20 }}>{pw(lang, 'empty')}</Text>}

      {/* what the stamps opened */}
      {coffee ? (
        <View style={{ marginTop: 20, borderRadius: 22, padding: 18, backgroundColor: '#FFF', opacity: coffee.used_at ? 0.6 : 1 }}>
          <Text style={{ color: '#17131F', fontSize: 16.5, fontWeight: '800' }}>{'☕ ' + pw(lang, 'coffee')}</Text>
          <Text style={{ color: '#6F6A75', fontSize: 13.5, marginTop: 3 }}>{coffee.used_at ? pw(lang, 'used') : pw(lang, 'coffee_s') + ' · ' + pw(lang, 'until', { d: fmtDay(coffee.expires_at, lang) })}</Text>
          {!coffee.used_at ? <Text selectable style={[{ color: C.purple, fontSize: 30, fontWeight: '800', letterSpacing: 6, marginTop: 10, textAlign: 'center' }, NUM]}>{coffee.code}</Text> : null}
        </View>
      ) : null}
      {l2 ? <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 20, marginTop: 14 }}>{'🎓 ' + pw(lang, 'l2')}</Text> : null}
      {/* 5 stamps also make a Certified Host: every table they start is official (ScaleKit) */}
      <HostCard onHost={() => { goToTab('TOGETHER'); setTimeout(() => { try { window.dispatchEvent(new CustomEvent('mm-host-table')); } catch (e) {} }, 350); }} />

      <Pressable onPress={() => { tapLight(); setScan(true); }} accessibilityRole="button" style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 15, backgroundColor: '#FFF' }}>
          <Ionicons name="qr-code-outline" size={19} color="#17131F" />
          <Text style={{ color: '#17131F', fontSize: 16, fontWeight: '700', marginStart: 8 }}>{pw(lang, 'scan')}</Text>
        </View>
      </Pressable>
      {scan ? <StampScanner onClose={() => { setScan(false); load(); }} /> : null}
    </View>
  );
};

/* ── the host's screen: one big QR, new every 30 seconds, and who is in ── */
export const HostQr = ({ kind, id, onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState(null);
  const [busy, setBusy] = useState(null);
  const bar = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true; let t = null;
    const get = () => eventQr(kind, id).then((r) => {
      if (!alive) return;
      setQ(r || { ok: false });
      const s = r && r.ok ? Math.max(1, Number(r.seconds) || 30) : 15;
      if (r && r.ok) { bar.setValue(s / 30); Animated.timing(bar, { toValue: 0, duration: s * 1000, easing: Easing.linear, useNativeDriver: false }).start(); }
      t = setTimeout(get, Math.min(s, 6) * 1000 + 300);
    });
    get();
    return () => { alive = false; if (t) clearTimeout(t); };
  }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const going = (q && q.going) || [];
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 24, paddingBottom: insets.bottom + 30, alignItems: 'center' }}>
          <View style={{ alignSelf: 'stretch' }}><SheetHandle onClose={onClose} /></View>
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 2, marginTop: 16 }}>{'✦ ' + pw(lang, 'host').toUpperCase()}</Text>
          <Text style={{ color: '#17131F', fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>{(q && q.title) || ' '}</Text>
          {!q ? <ActivityIndicator color={C.purple} style={{ marginTop: 60 }} /> : !q.ok ? (
            <Text style={{ color: '#6F6A75', fontSize: 16, marginTop: 40, textAlign: 'center' }}>{pw(lang, q.reason === 'not_yet' ? 'not_yet' : q.reason === 'over' ? 'over' : 'e_err')}</Text>
          ) : (
            <>
              <View style={{ marginTop: 22, padding: 14, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(23,19,31,0.08)' }}>
                <Qr value={stampLink(q.code)} size={270} />
              </View>
              {/* how long this one lives */}
              <View style={{ width: 270, height: 4, borderRadius: 2, backgroundColor: 'rgba(23,19,31,0.08)', marginTop: 16, overflow: 'hidden' }}>
                <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: C.purple, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
              <Text style={{ color: '#6F6A75', fontSize: 14, lineHeight: 20, marginTop: 14, textAlign: 'center', maxWidth: 320 }}>{pw(lang, 'host_s')}</Text>
              <Text style={[{ color: '#17131F', fontSize: 22, fontWeight: '800', marginTop: 22 }, NUM]}>{pw(lang, 'stamped', { n: q.stamped || 0 })}</Text>
              {/* by hand, for a phone that won't scan */}
              <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
                {going.map((g) => (
                  <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(23,19,31,0.06)' }}>
                    {g.avatar_url ? <Image source={{ uri: g.avatar_url }} style={{ width: 34, height: 34, borderRadius: 17 }} /> : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(124,58,237,0.1)' }} />}
                    <Text style={{ color: '#17131F', fontSize: 15.5, fontWeight: '600', flex: 1, marginHorizontal: 12 }} numberOfLines={1}>{g.name || '—'}</Text>
                    {g.stamped ? <Ionicons name="checkmark-circle" size={24} color={C.green} /> : (
                      <Pressable onPress={async () => { tapLight(); setBusy(g.id); await hostStamp(kind, id, g.id, true); setBusy(null); setQ((o) => ({ ...o, stamped: (o.stamped || 0) + 1, going: o.going.map((x) => (x.id === g.id ? { ...x, stamped: true } : x)) })); }}
                        disabled={busy === g.id} accessibilityRole="button">
                        <View style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(124,58,237,0.1)' }}>
                          <Text style={{ color: C.purple, fontSize: 14, fontWeight: '700' }}>{pw(lang, 'stamp_hand')}</Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
