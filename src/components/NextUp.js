import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { supabase, SUPABASE_READY } from '../lib/supabase';
import { listGatherings, keptGatherings, joinGathering } from '../services/green';
import { lastFix } from '../services/squadAdmin';
import { ideaPhoto, ideaPics } from './green/PlanPhoto';
import { greenPic } from './green/GreenCards';
import { isGreen } from '../lib/greenKinds';
import { lookOf, titleFor } from '../lib/activityPins';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { appLink, shareLink } from '../utils/share';

/* ─── HOME OPENS ON ONE THING ─────────────────────────────────────────
   The Steve Jobs note: Moments does a lot, and somebody opening it for
   the first time should not have to find out what it is for. So the
   first thing on Home is the answer — the next real plan near you,
   big, with when, where, who is going and one button. Under it, the
   one number about you: how many weeks in a row you actually went out
   (my_out_weeks in RUN_ME.sql, from check-ins at the place). Nothing
   near you yet: one line and one button to start the first one. */

const NEAR_KM = 80;
const km = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/* the next few near you, one of each — Ayser: "هي ليه كورة بس" — the
   card turns between them; the ones you said yes to come first */
const pick = (rows) => {
  const now = Date.now();
  const fix = lastFix();
  const seen = {};
  return (rows || []).filter((g) => new Date(g.starts_at).getTime() > now - 30 * 60000
      && (!fix || (g.lat != null && km(fix, { lat: +g.lat, lng: +g.lng }) <= NEAR_KM)))
    .sort((a, b) => (b.im_going ? 1 : 0) - (a.im_going ? 1 : 0) || new Date(a.starts_at) - new Date(b.starts_at))
    .filter((g) => !seen[g.title] && (seen[g.title] = 1)).slice(0, 5);
};

const whenLine = (g, lang, t) => {
  const d = new Date(g.starts_at);
  const loc = lang === 'ar' ? 'ar-EG' : lang;
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const k = new Date(d); k.setHours(0, 0, 0, 0);
  const diff = Math.round((k - day0) / 86400000);
  let day = '';
  try { day = diff === 0 ? t('green_today') : diff === 1 ? t('green_tomorrow') : d.toLocaleDateString(loc, { weekday: 'long' }); } catch (e) {}
  let time = '';
  try { time = d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' }); } catch (e) {}
  return day + ' · ' + time;
};

/* ─── THE PHOTOS, TURNING SLOWLY ──────────────────────────────────────
   Ayser: not one photo — several, or a video. The activity's videos are
   small (640px) and look soft on a big card, so: its sharp photos, one
   after another, each easing in a little closer as it shows (the slow
   push of a film, not a slideshow click) and fading into the next. */
const SLIDE_MS = 5000;
const Slides = ({ pics }) => {
  const [i, setI] = useState(0);
  const fade = React.useRef(new Animated.Value(1)).current;
  const zoom = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    zoom.setValue(0);
    Animated.timing(zoom, { toValue: 1, duration: SLIDE_MS + 900, easing: Easing.linear, useNativeDriver: true }).start();
    if (pics.length < 2) return undefined;
    const id = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => {
        setI((n) => (n + 1) % pics.length);
        Animated.timing(fade, { toValue: 1, duration: 650, useNativeDriver: true }).start();
      });
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [i, pics.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  return (
    <Animated.View style={{ position: 'absolute', width: '100%', height: '100%', opacity: fade, transform: [{ scale }] }}>
      <Image source={{ uri: pics[i] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
      {/* the next one, already on its way, so the fade never shows a gap */}
      {pics.length > 1 ? <Image source={{ uri: pics[(i + 1) % pics.length] }} style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }} /> : null}
    </Animated.View>
  );
};

export const NextUp = ({ user, onOpen, onStart }) => {
  const { t, lang } = useLang();
  const [all, setAll] = useState(() => pick(keptGatherings(null)));
  const [at, setAt] = useState(0);
  useEffect(() => { if (all.length < 2) return undefined; const id = setInterval(() => setAt((i) => i + 1), 7000); return () => clearInterval(id); }, [all.length]);
  const g = all[at % all.length] || null;
  const setG = (x) => setAll((l) => l.map((y) => (y.id === x.id ? x : y)));
  const [ready, setReady] = useState(() => !!keptGatherings(null));
  const [weeks, setWeeks] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    listGatherings(null).then((rows) => { if (alive) { setAll(pick(rows)); setReady(true); } }).catch(() => { if (alive) setReady(true); });
    if (SUPABASE_READY && user) {
      supabase.rpc('my_out_weeks').then(({ data }) => { if (alive && data) setWeeks(Number(data.weeks) || 0); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [user]);

  const join = async () => {
    if (!g || busy || g.im_going) return;
    tapMedium(); setBusy(true);
    try {
      const r = await joinGathering(g.id, true);
      if (r && r.ok) { tapSuccess(); setG({ ...g, im_going: true, going: (Number(g.going) || 0) + 1 }); }
    } catch (e) {}
    setBusy(false);
  };

  /* you said yes — the warmest next step is somebody coming with you */
  const [asked, setAsked] = useState(false);
  const bringFriend = async () => {
    tapLight();
    const r = await shareLink({
      url: appLink({ tab: 'TOGETHER', invite: user && user.id }),
      title: titleFor(g.title, lang),
      text: t('nu_share_text').replace('{plan}', titleFor(g.title, lang)).replace('{when}', whenLine(g, lang, t)),
    });
    if (r && r !== 'unsupported') setAsked(true);
  };

  const streak = weeks > 0 ? (
    <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800', marginTop: 10 }}>
      {'🔥 ' + t(weeks === 1 ? 'nu_weeks_1' : 'nu_weeks').replace('{n}', String(weeks))}
    </Text>
  ) : null;

  if (!ready) return null;
  if (!g) {
    return (
      <View style={{ marginTop: 16 }}>
        <Pressable onPress={() => { tapLight(); onStart(); }} accessibilityRole="button">
          <View style={{ borderRadius: 24, padding: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.2 }}>{t('nu_kicker').toUpperCase()}</Text>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginTop: 6 }}>{t('nu_none')}</Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 14, backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{t('nu_start')}</Text>
            </View>
          </View>
        </Pressable>
        {streak}
      </View>
    );
  }

  const look = lookOf(g.kind);
  const pics = ideaPics(g);
  const pic = pics[0] || ideaPhoto(g) || (isGreen(g) ? greenPic([g.title, g.place_name].join(' '), g.id) : null);
  const n = Number(g.going) || 0;
  return (
    <View style={{ marginTop: 16 }}>
      <Pressable onPress={() => { tapLight(); onOpen(g); }} accessibilityRole="button" accessibilityLabel={titleFor(g.title, lang)}>
        <View style={{ height: 260, borderRadius: 26, overflow: 'hidden', backgroundColor: look.from }}>
          {pics.length > 1 ? <Slides key={g.id} pics={pics} /> : pic ? <Image source={{ uri: pic }} style={{ position: 'absolute', width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
            : <LinearGradient colors={[look.from, look.to]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 80 }}>{look.emoji}</Text></LinearGradient>}
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} locations={[0, 0.3, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <Text style={{ position: 'absolute', top: 14, left: 16, color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>{t('nu_kicker').toUpperCase()}</Text>
          {g.im_going ? (
            <View style={{ position: 'absolute', top: 10, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="checkmark-circle" size={14} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginStart: 4 }}>{t('nu_going')}</Text>
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
            <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 }} numberOfLines={2}>{titleFor(g.title, lang)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>
              {[whenLine(g, lang, t), g.place_name || g.city].filter(Boolean).join(' · ')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800', marginEnd: 10 }} numberOfLines={2}>
                {g.im_going
                  ? (n > 1 ? t('nu_you_and').replace('{n}', String(n - 1)) : t('nu_first_in'))
                  : n > 0 ? t('gm_join_them').replace('{n}', String(n)) : t('gm_first')}
              </Text>
              {g.im_going ? (
                <Pressable onPress={bringFriend} accessibilityRole="button" hitSlop={6}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Ionicons name={asked ? 'checkmark' : 'person-add-outline'} size={16} color="#1A1A1A" />
                    <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '900', marginStart: 6 }}>{t(asked ? 'nu_asked' : 'nu_bring')}</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable onPress={user ? join : () => onOpen(g)} disabled={busy} accessibilityRole="button" hitSlop={6}>
                  <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ color: '#1A1A1A', fontSize: 14.5, fontWeight: '900' }}>{t('nu_im_going')}</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Pressable>
      {streak}
    </View>
  );
};
