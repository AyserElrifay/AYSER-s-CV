import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Platform, PanResponder, Pressable } from 'react-native';
import { LinearGradient } from '../ui/Gradient';
import { useLang } from '../context/LanguageContext';
import { fetchHighlights } from '../services/appHighlights';
import { remember, recall } from '../lib/offline';
import { publicMedia } from '../lib/publicMedia';
import { getPrefs } from '../services/prefs';
import { isSaving } from '../lib/dataSaver';

/* ─── REAL EVENINGS, ONE AFTER ANOTHER ────────────────────────────────
   Ayser, November 2026: "البتاعة بتاعت الفيديوهات اللي كانت موجودة …
   أحسن … خلّي كل ما فيديو يخلص يعمل slide على الفيديو اللي بعده … بس
   اوعى يبان علامة الفيديو أو تحكّمات فيه".
   The owner's highlights (real evenings on Moments, live only after he
   confirmed everyone in them agreed — app_highlights in RUN_ME.sql) and
   the two afternoons out by @khaledelnagar9 (he agreed). Each plays once,
   silent, and when it ends the next one slides in. No controls, no play
   button — it is a window, not a player. On data saver it shows the
   still frames instead.

   Then: "دي بتهنج وفي فديو بيبقي صوره او بيبان اسود … وخليني اقدر اقلب
   ما بينهم". So:
   · the slides are placed by hand (left = ±k × width), not by a flex row —
     in Arabic the row ran the other way and the second slide was off in
     the dark;
   · this hero plays its own videos (data-mm-own: the page-wide keeper in
     inject-html.mjs used to take the source off the hidden slides and only
     gave it back to the first one);
   · a video that fails, stalls or never starts is skipped after STUCK_MS;
   · a swipe (or a tap on a dot) moves between them; only the one showing
     and its two neighbours hold a video, the rest are their still frame. */
const IDEAS = ['hang', 'shop'].map((k) => ({
  id: 'idea-' + k, idea: true, kind: 'video', key: 'hl_' + k,
  media_url: publicMedia('welcome-' + k + '.mp4'), poster_url: publicMedia('welcome-' + k + '.webp'),   // under 25 KB
}));
const BY = '@khaledelnagar9';
const STILL_MS = 6000;
const STUCK_MS = 7000;

/* the browser's own video chrome (the big iOS play arrow, the controls
   bar, picture-in-picture) — hidden once, for every hero video */
let styled = false;
const hideChrome = () => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = 'video.mm-hero::-webkit-media-controls,video.mm-hero::-webkit-media-controls-panel,video.mm-hero::-webkit-media-controls-play-button,video.mm-hero::-webkit-media-controls-start-playback-button,video.mm-hero::-webkit-media-controls-overlay-play-button{display:none!important;-webkit-appearance:none!important;opacity:0!important}';
  document.head.appendChild(s);
};

export const HighlightsHero = ({ height = 260 }) => {
  const { t, rtl } = useLang();
  const [hls, setHls] = useState(() => recall('highlights') || []);
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState(true);       // on screen, and the app in front
  const x = useRef(new Animated.Value(0)).current;
  const vids = useRef({});
  const box = useRef(null);
  const moved = useRef(0);                      // when the one showing last played a frame
  const saving = isSaving((getPrefs() || {}).dataSaver);
  useEffect(() => {
    hideChrome();
    let alive = true;
    fetchHighlights().then((h) => { if (alive && Array.isArray(h)) { setHls(h); remember('highlights', h); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const items = hls.concat(IDEAS);
  const n = items.length;
  // Arabic reads from the right: the next one waits on the left
  const dir = rtl ? -1 : 1;
  const live = useRef({});
  live.current = { i, n, w, dir, seen };

  const go = (k) => { const m = live.current.n; if (m) setI(((k % m) + m) % m); };
  const next = () => {
    const c = live.current;
    if (c.n < 2) { const v = vids.current[0]; if (v) { try { v.currentTime = 0; } catch (e) {} v.play().catch(() => {}); } moved.current = Date.now(); return; }
    go(c.i + 1);
  };
  const place = (k, dx = 0, anim = true) => {
    const c = live.current;
    const to = -c.dir * k * c.w + dx;
    if (!anim) { x.setValue(to); return; }
    Animated.timing(x, { toValue: to, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  };

  // paused while scrolled away, or while the app is in the background
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const el = box.current;
    let inView = true;
    const upd = () => setSeen(inView && !document.hidden);
    let io = null;
    if (el && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { inView = es.some((e) => e.isIntersecting && e.intersectionRatio > 0.2); upd(); }, { threshold: [0, 0.2, 0.6] });
      io.observe(el);
    }
    document.addEventListener('visibilitychange', upd);
    return () => { if (io) io.disconnect(); document.removeEventListener('visibilitychange', upd); };
  }, []);

  // slide to the one now showing
  useEffect(() => { if (w) place(i); }, [i, w, rtl]); // eslint-disable-line react-hooks/exhaustive-deps
  // play it (from the start when it has just arrived), pause the rest
  const steer = () => {
    const c = live.current;
    Object.keys(vids.current).forEach((k) => {
      const v = vids.current[k]; if (!v) return;
      if (Number(k) === c.i && v.error) { setTimeout(next, 600); return; }   // it already failed while waiting its turn
      if (Number(k) === c.i && c.seen && !saving) {
        if (v._mmAt !== c.i) { v._mmAt = c.i; try { v.currentTime = 0; } catch (e) {} }
        v.play().catch(() => {});
      } else {
        try { v.pause(); } catch (e) {}
        if (Number(k) !== c.i) v._mmAt = -1;
      }
    });
  };
  useEffect(() => { moved.current = Date.now(); steer(); }, [i, seen, n]); // eslint-disable-line react-hooks/exhaustive-deps

  // a still (data saver, or a photo highlight) moves on by itself; a video
  // that fails, stalls or never starts is skipped instead of hanging the hero
  useEffect(() => {
    if (!seen || !n) return undefined;
    const it = items[i];
    if (!it) return undefined;
    if (it.kind !== 'video' || saving || Platform.OS !== 'web') {
      const h = setTimeout(next, STILL_MS);
      return () => clearTimeout(h);
    }
    moved.current = Date.now();
    const h = setInterval(() => { if (Date.now() - moved.current > STUCK_MS) next(); }, 1000);
    return () => clearInterval(h);
  }, [i, n, saving, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  // a finger (or a mouse) moves between them
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onMoveShouldSetPanResponderCapture: (e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (e, g) => place(live.current.i, g.dx, false),
    onPanResponderRelease: (e, g) => {
      const c = live.current;
      const toward = c.dir * g.dx;              // < 0: towards the next one
      const far = Math.abs(g.dx) > (c.w || 300) * 0.18 || Math.abs(g.vx) > 0.35;
      if (far && c.n > 1) go(c.i + (toward < 0 ? 1 : -1));
      else place(c.i);
    },
    onPanResponderTerminate: () => place(live.current.i),
  })).current;

  if (!n) return null;
  const cur = items[i] || items[0];
  const near = (k) => k === i || k === (i + 1) % n || k === (i - 1 + n) % n;
  const W = w || 1;
  return (
    <View testID="highlights-hero" ref={box} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}
      style={{ marginTop: 16, height, borderRadius: 26, overflow: 'hidden', backgroundColor: '#17131F', direction: 'ltr',
        touchAction: 'pan-y', userSelect: 'none', cursor: n > 1 ? 'grab' : undefined }}>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: W, transform: [{ translateX: x }] }}>
        {items.map((it, k) => {
          const still = it.poster_url || (it.kind === 'video' ? null : it.media_url);
          const play = it.kind === 'video' && !saving && Platform.OS === 'web' && near(k);
          return (
            <View key={it.id} style={{ position: 'absolute', top: 0, bottom: 0, left: dir * k * W, width: W, backgroundColor: '#17131F' }}>
              {play ? React.createElement('video', {
                ref: (el) => { if (el) vids.current[k] = el; else delete vids.current[k]; },
                className: 'mm-hero', src: it.media_url, poster: it.poster_url || undefined,
                'data-mm-own': '1',
                muted: true, playsInline: true, preload: k === i ? 'auto' : 'metadata',
                disablePictureInPicture: true, controls: false, controlsList: 'nodownload nofullscreen noremoteplayback',
                tabIndex: -1, 'aria-hidden': true, draggable: false,
                onTimeUpdate: () => { if (k === live.current.i) moved.current = Date.now(); },
                onCanPlay: () => { if (k === live.current.i) steer(); },
                onEnded: () => { if (k === live.current.i) next(); },
                onError: () => { if (k === live.current.i) next(); },
                style: { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', display: 'block' },
              }) : still ? (
                React.createElement('img', { src: still, alt: '', draggable: false, style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' } })
              ) : null}
            </View>
          );
        })}
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: n > 1 ? 26 : 14, direction: rtl ? 'rtl' : 'ltr' }}>
        <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={1}>{t(cur.idea ? 'hl_idea' : 'hl_title')}</Text>
        {cur.idea ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{t(cur.key)}</Text>
          : cur.caption ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{cur.caption}</Text> : null}
        {cur.idea ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{t('hl_by').replace('{n}', '⁦' + BY + '⁩')}</Text> : null}
      </View>
      {n > 1 ? (
        <View testID="hero-dots" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'center' }}>
          {items.map((it, k) => (
            <Pressable key={it.id} testID={'hero-dot-' + k} onPress={() => go(k)} hitSlop={8} accessibilityRole="button" accessibilityLabel={String(k + 1)}
              style={{ paddingHorizontal: 3, paddingVertical: 4 }}>
              <View style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? '#FFF' : 'rgba(255,255,255,0.45)' }} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};
