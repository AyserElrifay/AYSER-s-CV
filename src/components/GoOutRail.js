import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { listGatherings, joinGathering } from '../services/green';
import { fetchHighlight } from '../services/appHighlights';
import { planPhotoOf } from './green/PlanPhoto';
import { titleFor, whenFor } from '../lib/activityPins';
import { getPrefs } from '../services/prefs';
import { isSaving } from '../lib/dataSaver';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── MAKE PEOPLE WANT TO GO OUT ──────────────────────────────────────
   Ayser: "استخدم صور أو فيديوهات عشان تحمّس الناس تخرج … والأهم
   الـ experience — الناس تتواصل وتخرج وتتبسط".

   Two things, both real, never stock:
     · one highlight — a real evening on Moments, chosen by the owner in
       the Studio and live only after he confirmed everyone in it agreed
       (app_highlights in RUN_ME.sql), with one button: find one like it;
     · the plans coming up that already have a photo — the host's, or
       from the last time it happened — big, with who is going and a
       Join right on the card. A plan with no real photo is not shown
       here at all (it is still everywhere else), so nothing is dressed
       up to look like more than it is.
   If there is neither, this draws nothing. */

const HighlightVideo = ({ uri, poster }) => {
  const ref = useRef(null);
  const holder = useRef(null);
  /* plays only while it is on the screen, and never on data saver */
  useEffect(() => {
    const el = holder.current;
    const v = ref.current;
    if (!el || !v || typeof IntersectionObserver === 'undefined') return undefined;
    if (isSaving((getPrefs() || {}).dataSaver)) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [uri]);
  return (
    <View ref={holder} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <video ref={ref} src={poster ? uri : uri + '#t=0.1'} poster={poster || undefined} muted loop playsInline preload="metadata" tabIndex={-1}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
    </View>
  );
};

const PlanCard = ({ g, lang, t, onOpen, onJoin, joining }) => (
  <Pressable onPress={() => { tapLight(); onOpen(g); }} accessibilityRole="button" accessibilityLabel={titleFor(g.title, lang)} style={{ marginEnd: 10 }}>
    <View style={{ width: 156, height: 208, borderRadius: 20, overflow: 'hidden', backgroundColor: C.glassHi }}>
      <Image source={{ uri: planPhotoOf(g) }} style={{ width: 156, height: 208 }} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
      <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>
        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 18 }} numberOfLines={2}>{titleFor(g.title, lang)}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', marginTop: 3 }} numberOfLines={1}>{whenFor(g.starts_at, lang)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Text style={{ flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700' }}>{(Number(g.going) || 0) + ' ' + t('green_going')}</Text>
          {g.im_going ? (
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>✓ {t('green_joined')}</Text>
          ) : (
            <Pressable onPress={() => onJoin(g)} disabled={!!joining} accessibilityRole="button" hitSlop={6}
              style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, opacity: joining ? 0.6 : 1 }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('green_join')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  </Pressable>
);

export const GoOutRail = ({ onFind, onOpenPlan }) => {
  const { t, lang } = useLang();
  const [hl, setHl] = useState(null);
  const [plans, setPlans] = useState([]);
  const [joining, setJoining] = useState({});
  useEffect(() => {
    let alive = true;
    fetchHighlight().then((h) => { if (alive) setHl(h); });
    listGatherings(null).then((rows) => {
      if (!alive) return;
      const now = Date.now();
      setPlans((rows || []).filter((g) => planPhotoOf(g) && new Date(g.starts_at).getTime() > now).slice(0, 8));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const join = async (g) => {
    if (joining[g.id]) return;
    setJoining((j) => ({ ...j, [g.id]: true }));
    try {
      const r = await joinGathering(g.id, true);
      if (r && r.ok) { tapSuccess(); setPlans((l) => l.map((x) => (x.id === g.id ? { ...x, im_going: true, going: (Number(x.going) || 0) + 1 } : x))); }
    } catch (e) {}
    setJoining((j) => ({ ...j, [g.id]: false }));
  };

  if (!hl && !plans.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      {hl ? (
        <Pressable onPress={() => { tapLight(); onFind(); }} accessibilityRole="button" accessibilityLabel={t('hl_cta')}>
          <View style={{ height: 230, borderRadius: 22, overflow: 'hidden', backgroundColor: C.glassHi }}>
            {hl.kind === 'video' ? <HighlightVideo uri={hl.media_url} poster={hl.poster_url} /> : <Image source={{ uri: hl.media_url }} style={{ width: '100%', height: '100%' }} />}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 }} />
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
              <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>{t('hl_title')}</Text>
              {hl.caption ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 3 }} numberOfLines={2}>{hl.caption}</Text> : null}
              <View style={{ alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: '#1A1A1A', fontSize: 13, fontWeight: '900' }}>{t('hl_cta')}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      ) : null}
      {plans.length ? (
        <>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: hl ? 18 : 0, marginBottom: 10 }}>{t('gr_title').toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {plans.map((g) => <PlanCard key={g.id} g={g} lang={lang} t={t} onOpen={onOpenPlan} onJoin={join} joining={joining[g.id]} />)}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
};
