import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from '../ui/Gradient';
import { C } from '../constants/theme';
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
   button, no progress line — it is a window, not a player. On data saver
   it shows the still frames instead. */
const IDEAS = ['hang', 'shop'].map((k) => ({
  id: 'idea-' + k, idea: true, kind: 'video', key: 'hl_' + k,
  media_url: publicMedia('welcome-' + k + '.mp4'), poster_url: publicMedia('welcome-' + k + '.jpg'),
}));
const BY = '@khaledelnagar9';
const STILL_MS = 6000;

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
  const { t } = useLang();
  const [hls, setHls] = useState(() => recall('highlights') || []);
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const vids = useRef({});
  const saving = isSaving((getPrefs() || {}).dataSaver);
  useEffect(() => {
    hideChrome();
    let alive = true;
    fetchHighlights().then((h) => { if (alive && Array.isArray(h)) { setHls(h); remember('highlights', h); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const items = hls.concat(IDEAS);
  const n = items.length;

  const next = () => {
    if (n < 2) { const v = vids.current[0]; if (v) { v.currentTime = 0; v.play().catch(() => {}); } return; }
    setI((k) => (k + 1) % n);
  };
  // slide to the one now showing; play it from the start, pause the rest
  useEffect(() => {
    if (!w) return;
    Animated.timing(x, { toValue: -i * w, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    Object.keys(vids.current).forEach((k) => {
      const v = vids.current[k]; if (!v) return;
      if (Number(k) === i && !saving) { try { v.currentTime = 0; } catch (e) {} v.play().catch(() => {}); } else v.pause();
    });
  }, [i, w]); // eslint-disable-line react-hooks/exhaustive-deps
  // a still (data saver, or a photo highlight) moves on by itself
  useEffect(() => {
    const it = items[i];
    if (!it || (it.kind === 'video' && !saving)) return undefined;
    const h = setTimeout(next, STILL_MS);
    return () => clearTimeout(h);
  }, [i, n, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!n) return null;
  const cur = items[i] || items[0];
  return (
    <View testID="highlights-hero" onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ marginTop: 16, height, borderRadius: 26, overflow: 'hidden', backgroundColor: '#17131F' }}>
      <Animated.View style={{ flexDirection: 'row', width: (w || 1) * n, height: '100%', transform: [{ translateX: x }] }}>
        {items.map((it, k) => (
          <View key={it.id} style={{ width: w || 1, height: '100%' }}>
            {it.kind === 'video' && !saving && Platform.OS === 'web' ? React.createElement('video', {
              ref: (el) => { vids.current[k] = el; },
              className: 'mm-hero', src: it.media_url, poster: it.poster_url || undefined,
              muted: true, playsInline: true, autoPlay: k === 0, preload: Math.abs(k - i) <= 1 ? 'auto' : 'metadata',
              disablePictureInPicture: true, controls: false, controlsList: 'nodownload nofullscreen noremoteplayback',
              tabIndex: -1, 'aria-hidden': true,
              onEnded: () => { if (k === i) next(); },
              style: { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', display: 'block' },
            }) : (
              React.createElement('img', { src: it.poster_url || it.media_url, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })
            )}
          </View>
        ))}
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
        <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={1}>{t(cur.idea ? 'hl_idea' : 'hl_title')}</Text>
        {cur.idea ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{t(cur.key)}</Text>
          : cur.caption ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{cur.caption}</Text> : null}
        {cur.idea ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{t('hl_by').replace('{n}', '⁦' + BY + '⁩')}</Text> : null}
      </View>
    </View>
  );
};
