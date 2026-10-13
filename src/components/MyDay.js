import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { BrainDump } from './BrainDump';
import { prayerTimes } from '../lib/prayerTimes';
import { buildIcs, openIcs } from '../lib/ics';
import { lastFix } from '../services/squadAdmin';
import { getCurrentCoords } from '../utils/location';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── MY DAY ───────────────────────────────────────────────────────────
   Ayser: "حاجة زي to-do list بس tools جاهزة للنجاح … بيسألك: طالب ولا
   بتشتغل ولا الاتنين؟ … مواقيت الصلاة … معاد النوم يديك تلات اختيارات …
   المهم الـ user الـ ADHD مايكتبش، يختار — خليها simple — ولو ينفع alarm
   يتربط ببردي وبالـ calendar، repeated بالـ notifications".

   So it is set up by tapping, never typing: one question a screen, big
   choices, a way back on every step. Then today, as a short list in
   time order — wake, prayers if asked for, university or work on the
   right days, winding down, sleep — each one ticked with a tap. Bardi's
   "one thing today" sits on top. And one button hands every reminder to
   the phone's own calendar, repeating, with an alarm — the only way a
   web app can ring reliably with the screen off.

   Everything stays on this phone (localStorage): who you are, your
   hours, whether you pray. Nothing is sent anywhere. */

const KEY = 'mm.myday.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const write = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} };
const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const doneKey = () => 'mm.myday.done.' + dayKey();
const readDone = () => { try { return JSON.parse(localStorage.getItem(doneKey()) || '[]'); } catch (e) { return []; } };

const HOURS = { uni: { m: [8, 0, 14, 0], d: [10, 0, 16, 0], e: [14, 0, 20, 0] }, work: { m: [8, 0, 16, 0], d: [9, 0, 17, 0], e: [12, 0, 20, 0] } };
const SLEEP = { early: { bed: [22, 0], wake: [6, 0] }, regular: { bed: [23, 30], wake: [7, 30] }, late: { bed: [1, 0], wake: [9, 0] } };
const DAYS = { sun: ['SU', 'MO', 'TU', 'WE', 'TH'], mon: ['MO', 'TU', 'WE', 'TH', 'FR'], all: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] };
const JS_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const at = (base, h, m) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
const hm = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

/* the questions, in order; some only follow from an earlier answer */
const steps = (a) => {
  const s = ['role'];
  if (a.role === 'student' || a.role === 'both') s.push('uni');
  if (a.role === 'work' || a.role === 'both') s.push('work');
  if (a.role && a.role !== 'none') s.push('days');
  s.push('pray');
  if (a.pray && !a.at) s.push('loc');
  s.push('sleep');
  return s;
};

const Choice = ({ emoji, title, sub, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: !!on }} style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass, paddingVertical: 16, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 26, marginEnd: 14 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{title}</Text>
        {sub ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {on ? <Ionicons name="checkmark-circle" size={22} color={C.purple} /> : null}
    </View>
  </Pressable>
);

const Q = ({ title, n, of, children }) => (
  <View>
    <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>{n + ' / ' + of}</Text>
    <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.3, marginTop: 4, marginBottom: 16 }}>{title}</Text>
    {children}
  </View>
);

/* today's list, in time order */
function todayItems(a, t, now = new Date()) {
  const out = [];
  const sl = SLEEP[a.sleep || 'regular'];
  out.push({ id: 'wake', emoji: '⏰', label: t('md_wake'), at: at(now, sl.wake[0], sl.wake[1]) });
  const workday = a.role && a.role !== 'none' && (DAYS[a.days || 'sun'] || []).indexOf(JS_DAY[now.getDay()]) >= 0;
  if (workday && (a.role === 'student' || a.role === 'both')) { const h = HOURS.uni[a.uni || 'm']; out.push({ id: 'uni', emoji: '🎓', label: t('md_uni') + ' · ' + hm(h[0], h[1]) + '–' + hm(h[2], h[3]), at: at(now, h[0], h[1]) }); }
  if (workday && (a.role === 'work' || a.role === 'both')) { const h = HOURS.work[a.work || 'd']; out.push({ id: 'work', emoji: '💼', label: t('md_work') + ' · ' + hm(h[0], h[1]) + '–' + hm(h[2], h[3]), at: at(now, h[0], h[1]) }); }
  if (a.pray && a.at) {
    const p = prayerTimes(now, a.at.lat, a.at.lng);
    [['fajr', '🌅'], ['dhuhr', '☀️'], ['asr', '🌤️'], ['maghrib', '🌇'], ['isha', '🌙']].forEach(([k, e]) => out.push({ id: k, emoji: e, label: '🕌 ' + t('md_' + k), at: p[k] }));
  }
  const bed = at(now, sl.bed[0], sl.bed[1]);
  if (sl.bed[0] < 12) bed.setDate(bed.getDate() + 1);       // after midnight is still tonight
  out.push({ id: 'wind', emoji: '📵', label: t('md_wind'), at: new Date(bed.getTime() - 30 * 60000) });
  out.push({ id: 'sleep', emoji: '😴', label: t('md_sleep'), at: bed });
  // how long each thing lasts, so "now" has an end you can see coming
  out.forEach((x) => {
    if (x.end) return;
    if (x.id === 'uni' || x.id === 'work') { const h = HOURS[x.id][a[x.id] || (x.id === 'uni' ? 'm' : 'd')]; x.end = at(now, h[2], h[3]); }
    else if (x.id === 'sleep') { const w = new Date(x.at); w.setHours(sl.wake[0], sl.wake[1], 0, 0); if (w <= x.at) w.setDate(w.getDate() + 1); x.end = w; }
    else x.end = new Date(x.at.getTime() + (x.id === 'wind' ? 30 : 20) * 60000);
  });
  return out.sort((x, y) => x.at - y.at);
}

/* "2h 10m" / "25 min" — time you can feel, not a clock to read */
const span = (ms, t) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return t('md_min').replace('{n}', String(m));
  const h = Math.floor(m / 60); const r = m % 60;
  return t('md_hm').replace('{h}', String(h)).replace('{m}', String(r));
};

/* everything worth a reminder, repeating, for the phone's calendar */
function calendarEvents(a, t) {
  const now = new Date();
  const ev = [];
  const sl = SLEEP[a.sleep || 'regular'];
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  ev.push({ title: '⏰ ' + t('md_wake'), start: at(tomorrow, sl.wake[0], sl.wake[1]), minutes: 10, days: 'daily', alarm: 0 });
  const bed = at(now, sl.bed[0], sl.bed[1]); if (sl.bed[0] < 12) bed.setDate(bed.getDate() + 1);
  ev.push({ title: '📵 ' + t('md_wind'), start: new Date(bed.getTime() - 30 * 60000), minutes: 30, days: 'daily', alarm: 0 });
  const days = DAYS[a.days || 'sun'];
  if (a.role === 'student' || a.role === 'both') { const h = HOURS.uni[a.uni || 'm']; ev.push({ title: '🎓 ' + t('md_uni'), start: at(tomorrow, h[0], h[1]), minutes: (h[2] - h[0]) * 60 + (h[3] - h[1]), days, alarm: 30 }); }
  if (a.role === 'work' || a.role === 'both') { const h = HOURS.work[a.work || 'd']; ev.push({ title: '💼 ' + t('md_work'), start: at(tomorrow, h[0], h[1]), minutes: (h[2] - h[0]) * 60 + (h[3] - h[1]), days, alarm: 30 }); }
  if (a.pray && a.at) {
    // prayer times move a little every day, so each of the next 30 days is its own event
    for (let i = 0; i < 30; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      const p = prayerTimes(d, a.at.lat, a.at.lng);
      ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach((k) => { if (p[k] > now) ev.push({ title: '🕌 ' + t('md_' + k), start: p[k], minutes: 10, alarm: 0 }); });
    }
  }
  return ev;
}

export const MyDay = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [a, setA] = useState(() => read() || {});
  const [setup, setSetup] = useState(() => !(read() && read().ready));
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(readDone);
  const [locBusy, setLocBusy] = useState(false);
  const [calNote, setCalNote] = useState(null);

  const list = steps(a);
  const cur = list[Math.min(step, list.length - 1)];
  const answer = (patchIn) => {
    let patch = patchIn;
    tapSelection();
    // praying, and the map already knows roughly where you are: no extra question
    if (patch.pray && !a.at) { const f = lastFix(); if (f) patch = { ...patch, at: { lat: f.lat, lng: f.lng } }; }
    const next = { ...a, ...patch };
    setA(next);
    const l = steps(next);
    const i = l.indexOf(cur);
    if (i >= l.length - 1) { const fin = { ...next, ready: true }; write(fin); setA(fin); setSetup(false); setStep(0); tapSuccess(); }
    else setStep(i + 1);
  };
  const useLocation = async () => {
    setLocBusy(true);
    // never a spinner for ever: eight seconds, then what the map last knew
    const c = await Promise.race([getCurrentCoords().catch(() => null), new Promise((r) => setTimeout(() => r(null), 8000))]);
    setLocBusy(false);
    const fix = c ? { lat: c.latitude, lng: c.longitude } : lastFix();
    if (fix) answer({ at: { lat: fix.lat, lng: fix.lng } }); else answer({ pray: false });
  };
  const items = useMemo(() => (setup ? [] : todayItems(a, t)), [a, setup, t]);
  /* the clock moves on its own: every half minute the card catches up */
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  const [later, setLater] = useState({});          // id -> until (ms): "not now" for a while
  const [showAll, setShowAll] = useState(false);
  const open = (x) => done.indexOf(x.id) < 0 && !(later[x.id] && later[x.id] > now);
  const nowItem = items.find((x) => x.at.getTime() <= now && now < x.end.getTime() && open(x));
  const nextItem = items.find((x) => x.at.getTime() > now && open(x) && x !== nowItem);
  const nextId = (nowItem || nextItem || {}).id;
  const pop = useRef(new Animated.Value(1)).current;
  const celebrate = () => { pop.setValue(0.92); Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start(); };
  const notNow = (x) => { tapLight(); setLater((l) => ({ ...l, [x.id]: Date.now() + 15 * 60000 })); };
  const toggle = (id) => {
    tapLight();
    const n = done.indexOf(id) >= 0 ? done.filter((x) => x !== id) : done.concat(id);
    if (n.length > done.length) { tapSuccess(); celebrate(); }
    setDone(n);
    try { localStorage.setItem(doneKey(), JSON.stringify(n)); } catch (e) {}
  };
  const toCalendar = () => {
    tapLight();
    const ok = openIcs(buildIcs(calendarEvents(a, t)));
    setCalNote(ok ? t('md_cal_done') : t('bk_err'));
  };


  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => { tapLight(); if (setup && step > 0) setStep(step - 1); else onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={setup && step > 0 ? t('md_back') : t('close')}>
              <Ionicons name={setup && step > 0 ? 'chevron-back' : 'chevron-down'} size={26} color={C.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {!setup ? <Pressable onPress={() => { tapLight(); setSetup(true); setStep(0); }} accessibilityRole="button"><Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '800' }}>{t('md_change')}</Text></Pressable> : null}
          </View>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🗓️ ' + t('md_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, marginBottom: 20 }}>{t('md_sub')}</Text>

          {setup ? (
            cur === 'role' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_role')}>
                <Choice emoji="🎓" title={t('md_role_student')} on={a.role === 'student'} onPress={() => answer({ role: 'student' })} />
                <Choice emoji="💼" title={t('md_role_work')} on={a.role === 'work'} onPress={() => answer({ role: 'work' })} />
                <Choice emoji="🎓💼" title={t('md_role_both')} on={a.role === 'both'} onPress={() => answer({ role: 'both' })} />
                <Choice emoji="🌱" title={t('md_role_none')} on={a.role === 'none'} onPress={() => answer({ role: 'none' })} />
              </Q>
            ) : cur === 'uni' || cur === 'work' ? (
              <Q n={step + 1} of={list.length} title={t(cur === 'uni' ? 'md_q_uni' : 'md_q_work')}>
                {['m', 'd', 'e'].map((k) => { const h = HOURS[cur][k]; return (
                  <Choice key={k} emoji={k === 'm' ? '🌅' : k === 'd' ? '☀️' : '🌆'} title={t('md_slot_' + k)} sub={hm(h[0], h[1]) + ' – ' + hm(h[2], h[3])} on={a[cur] === k} onPress={() => answer({ [cur]: k })} />
                ); })}
              </Q>
            ) : cur === 'days' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_days')}>
                <Choice emoji="📅" title={t('md_days_sun')} on={a.days === 'sun'} onPress={() => answer({ days: 'sun' })} />
                <Choice emoji="📅" title={t('md_days_mon')} on={a.days === 'mon'} onPress={() => answer({ days: 'mon' })} />
                <Choice emoji="🔁" title={t('md_days_all')} on={a.days === 'all'} onPress={() => answer({ days: 'all' })} />
              </Q>
            ) : cur === 'pray' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_pray')}>
                <Choice emoji="🕌" title={t('md_pray_yes')} on={a.pray === true} onPress={() => answer({ pray: true })} />
                <Choice emoji="➖" title={t('md_pray_no')} on={a.pray === false} onPress={() => answer({ pray: false, at: null })} />
              </Q>
            ) : cur === 'loc' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_loc')}>
                {locBusy ? <ActivityIndicator color={C.purple} style={{ marginVertical: 20 }} /> : (
                  <>
                    <Choice emoji="📍" title={t('md_loc_btn')} onPress={useLocation} />
                    <Choice emoji="⏭️" title={t('md_loc_skip')} onPress={() => answer({ pray: false })} />
                  </>
                )}
              </Q>
            ) : (
              <Q n={step + 1} of={list.length} title={t('md_q_sleep')}>
                {[['early', '🐦'], ['regular', '😴'], ['late', '🦉']].map(([k, e]) => { const s = SLEEP[k]; return (
                  <Choice key={k} emoji={e} title={t('md_sleep_' + k)} sub={hm(s.bed[0], s.bed[1]) + ' → ' + hm(s.wake[0], s.wake[1])} on={a.sleep === k} onPress={() => answer({ sleep: k })} />
                ); })}
              </Q>
            )
          ) : (
            <View>
              {/* ── ONE THING AT A TIME, AND TIME YOU CAN SEE ──────────────
                  Ayser: "مش todo عادية — حاجة جديدة، بسيطة، ADHD killer،
                  عملية، مش مزعجة". So there is no list to face. There is
                  one card: what is happening now, with how long is left as
                  a bar that empties, or — between things — the free time
                  you have until the next one, and Papyrus's one thing to do
                  with it. Done or Not now, nothing else. Whatever was missed
                  just slips past: no red, no count, no streak to break. */}
              {(() => {
                const x = nowItem;
                const free = !x;
                const startMs = free ? (items.filter((y) => y.end.getTime() <= now).map((y) => y.end.getTime()).sort((p, q) => q - p)[0] || now - 30 * 60000) : x.at.getTime();
                const endMs = free ? (nextItem ? nextItem.at.getTime() : null) : x.end.getTime();
                const frac = endMs ? Math.max(0, Math.min(1, (now - startMs) / Math.max(1, endMs - startMs))) : 0;
                return (
                  <Animated.View style={{ transform: [{ scale: pop }], borderRadius: 26, padding: 18, backgroundColor: free ? C.glass : C.purpleSoft, borderWidth: 1.5, borderColor: free ? C.line : C.purple }}>
                    <Text style={{ color: free ? C.dim : C.purple, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>{(free ? t('md_free') : t('md_now')).toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ fontSize: 40, marginEnd: 12 }}>{free ? '🌿' : x.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={2}>{free ? (endMs ? t('md_free_for').replace('{t}', span(endMs - now, t)) : t('md_free_rest')) : x.label}</Text>
                        {!free ? <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{t('md_left').replace('{t}', span(endMs - now, t))}</Text> : null}
                      </View>
                    </View>
                    {endMs ? (
                      <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(124,58,237,0.12)', marginTop: 14, overflow: 'hidden' }}>
                        <View style={{ width: Math.round((1 - frac) * 100) + '%', height: 10, borderRadius: 5, backgroundColor: free ? C.green : C.purple }} />
                      </View>
                    ) : null}
                    {!free ? (
                      <View style={{ flexDirection: 'row', marginTop: 14 }}>
                        <Pressable onPress={() => toggle(x.id)} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
                          <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 13, alignItems: 'center' }}>
                            <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{'✓ ' + t('md_done')}</Text>
                          </View>
                        </Pressable>
                        <Pressable onPress={() => notNow(x)} accessibilityRole="button" style={{ flex: 1 }}>
                          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingVertical: 13, alignItems: 'center' }}>
                            <Text style={{ color: C.dim, fontSize: 15.5, fontWeight: '800' }}>{t('md_not_now')}</Text>
                          </View>
                        </Pressable>
                      </View>
                    ) : null}
                    {nextItem ? (
                      <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '700', marginTop: 12 }}>
                        {t('md_then').replace('{what}', nextItem.emoji + ' ' + nextItem.label).replace('{t}', span(nextItem.at.getTime() - now, t))}
                      </Text>
                    ) : null}
                  </Animated.View>
                );
              })()}

              {/* free time is Papyrus's: the one thing worth doing with it */}
              {!nowItem ? (
                <View style={{ marginTop: 16 }}>
                  <BrainDump />
                </View>
              ) : null}

              {/* the whole day — a row of small marks, not a list to face */}
              <Pressable onPress={() => { tapLight(); setShowAll((v) => !v); }} accessibilityRole="button" style={{ marginTop: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  {items.map((y) => {
                    const d = done.indexOf(y.id) >= 0; const cur = y.id === nextId;
                    return (
                      <View key={y.id} style={{ width: 30, height: 30, borderRadius: 15, marginEnd: 6, marginBottom: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: d ? C.greenSoft : cur ? C.purpleSoft : C.glass, borderWidth: cur ? 1.5 : 1, borderColor: cur ? C.purple : C.line, opacity: !d && !cur && y.end.getTime() < now ? 0.4 : 1 }}>
                        <Text style={{ fontSize: 13 }}>{d ? '✓' : y.emoji}</Text>
                      </View>
                    );
                  })}
                  <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', marginStart: 4 }}>{showAll ? t('md_hide_day') : t('md_see_day')}</Text>
                </View>
              </Pressable>
              {showAll ? items.map((x) => {
                const isDone = done.indexOf(x.id) >= 0;
                return (
                  <Pressable key={x.id} onPress={() => toggle(x.id)} accessibilityRole="checkbox" accessibilityState={{ checked: isDone }} style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 10, paddingHorizontal: 12, opacity: isDone ? 0.55 : 1 }}>
                      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', width: 50, fontVariant: ['tabular-nums'] }}>{hm(x.at.getHours(), x.at.getMinutes())}</Text>
                      <Text style={{ fontSize: 16, marginEnd: 8 }}>{x.emoji}</Text>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1, textDecorationLine: isDone ? 'line-through' : 'none' }} numberOfLines={1}>{x.label}</Text>
                      <Ionicons name={isDone ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isDone ? C.green : C.faint} />
                    </View>
                  </Pressable>
                );
              }) : null}
              {a.pray ? <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{t('md_pray_note')}</Text> : null}

              <Pressable onPress={toCalendar} accessibilityRole="button" style={{ marginTop: 18 }}>
                <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                  <Ionicons name="alarm-outline" size={19} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginStart: 8 }}>{t('md_cal')}</Text>
                </View>
              </Pressable>
              <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8, textAlign: 'center' }}>{calNote || t('md_cal_sub')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
