import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Animated, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang, tNow } from '../context/LanguageContext';
import { BrainDump } from './BrainDump';
import { Focus } from './Focus';
import { Compass, GROW, growLabel, growEmoji, readCompass, KEY as COMPASS_KEY } from './Compass';
import { Dates, readDates, dateNudges, yearly, nextOf } from './Dates';
import { Diary } from './Diary';
import { prayerTimes } from '../lib/prayerTimes';
import { buildIcs, openIcs } from '../lib/ics';
import { lastFix } from '../services/squadAdmin';
import { keptGatherings, listGatherings } from '../services/green';
import { goToTab } from '../lib/mapBus';
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
const REMIND = 'mm.myday.remind';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const write = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} };
const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const doneKey = () => 'mm.myday.done.' + dayKey();
const readDone = () => { try { return JSON.parse(localStorage.getItem(doneKey()) || '[]'); } catch (e) { return []; } };
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const NOTES = 'mm.myday.notes';
const addedKey = () => 'mm.myday.add.' + dayKey();

/* ─── A BALANCED DAY ──────────────────────────────────────────────────
   Ayser: "خليها متوازنة — جزء لأهلك، لنفسك، لصحتك ورياضتك، حتى لو
   تعرض عليك تمشي شوية". Four small parts of a day, each just a tap:
   done or not. In free time the card offers one small idea for a part
   not done yet — a walk, a call home, a glass of water — and "Another"
   if that one does not fit. Ideas, never rules: nothing turns red. */
const BALANCE = [
  { id: 'family', emoji: '👨‍👩‍👧' },
  { id: 'me', emoji: '🧘' },
  { id: 'health', emoji: '💧' },
  { id: 'move', emoji: '🚶' },
];
const balOrder = (h) => (h >= 5 && h < 11 ? ['move', 'health', 'me', 'family'] : h >= 11 && h < 17 ? ['health', 'move', 'family', 'me'] : ['family', 'me', 'move', 'health']);
const sameDay = (x, y) => x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();

/* the plans on Moments today: the ones you are going to are part of
   your day by themselves; others you can add with one tap */
const plansToday = (rows, now = new Date()) => (rows || []).filter((g) => g && g.starts_at && sameDay(new Date(g.starts_at), now));
const planItem = (g) => {
  const s = new Date(g.starts_at);
  return { id: 'g:' + g.id, emoji: g.emoji || '🤝', label: g.title || '', at: s, end: new Date(s.getTime() + (g.minutes || 90) * 60000), plan: true };
};

const HOURS = { uni: { m: [8, 0, 14, 0], d: [10, 0, 16, 0], e: [14, 0, 20, 0] }, work: { m: [8, 0, 16, 0], d: [9, 0, 17, 0], e: [12, 0, 20, 0] } };
const SLEEP = { early: { bed: [22, 0], wake: [6, 0] }, regular: { bed: [23, 30], wake: [7, 30] }, late: { bed: [1, 0], wake: [9, 0] } };
const DAYS = { sun: ['SU', 'MO', 'TU', 'WE', 'TH'], mon: ['MO', 'TU', 'WE', 'TH', 'FR'], all: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] };
const JS_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const CHURCH = { m: [8, 0, 10, 0], l: [10, 30, 12, 30], e: [18, 0, 20, 0] };
const at = (base, h, m) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
const hm = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

/* ─── YOUR OWN DAYS, YOUR OWN HOURS ───────────────────────────────────
   Ayser: "افرض حد بيدرس يومين وبيشتغل خمسة، بيبتدي ٨ وبيخلص ٥". So
   university and work each have their own days (tapped, any of the
   seven) and their own hours (one of three, or set with + and −). An
   older answer ('m', 'sun') is read into the same shape. */
const blockOf = (a, kind) => {
  const v = a[kind];
  if (v && typeof v === 'object' && Array.isArray(v.days)) return v;
  const h = HOURS[kind][typeof v === 'string' ? v : (kind === 'uni' ? 'm' : 'd')];
  return { days: DAYS[a.days || 'sun'] || DAYS.sun, s: [h[0], h[1]], e: [h[2], h[3]] };
};
const has = (a, kind) => (kind === 'uni' ? a.role === 'student' || a.role === 'both' : a.role === 'work' || a.role === 'both');
/* faith, for whoever has one: the five prayers, or church, or nothing */
const faithOf = (a) => a.faith || (a.pray === true ? 'muslim' : a.pray === false ? 'none' : null);
const muslim = (a) => faithOf(a) === 'muslim' && !!a.at;

/* every question there can be, in the order they are asked */
const ORDER = ['role', 'uni', 'work', 'faith', 'church', 'loc', 'grow', 'sleep'];

/* the questions, in order; some only follow from an earlier answer */
const steps = (a) => {
  const s = ['role'];
  if (has(a, 'uni')) s.push('uni');
  if (has(a, 'work')) s.push('work');
  s.push('faith');
  if (faithOf(a) === 'christian') s.push('church');
  if (faithOf(a) === 'muslim' && !a.at) s.push('loc');
  s.push('grow');
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

const Chip = ({ label, on, onPress, wide }) => (
  <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }} style={{ marginEnd: 6, marginBottom: 8, flexGrow: wide ? 1 : 0 }}>
    <View style={{ minWidth: 44, alignItems: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purple : C.glass, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);
const Label = ({ children }) => <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 6, marginBottom: 8 }}>{String(children).toUpperCase()}</Text>;

/* the seven days in the reader's language, the week starting where theirs does */
const dayNames = (lang) => {
  const order = lang === 'ar' ? ['SA', 'SU', 'MO', 'TU', 'WE', 'TH', 'FR'] : ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  return order.map((d) => {
    let name = d;
    try { name = new Date(2024, 0, 7 + JS_DAY.indexOf(d)).toLocaleDateString(lang || 'en', { weekday: 'short' }); } catch (e) {}
    return { d, name };
  });
};
const step30 = (hmv, k) => { let m = hmv[0] * 60 + hmv[1] + k * 30; m = Math.max(5 * 60, Math.min(23 * 60 + 30, m)); return [Math.floor(m / 60), m % 60]; };

const Stepper = ({ label, value, onMinus, onPlus }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
    <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800', width: 70 }}>{label}</Text>
    <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel="−" hitSlop={6}><View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="remove" size={20} color={C.text} /></View></Pressable>
    <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', width: 96, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{hm(value[0], value[1])}</Text>
    <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="+" hitSlop={6}><View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={20} color={C.text} /></View></Pressable>
  </View>
);

/* university or work: which days, and from when to when — tap only */
const Hours = ({ kind, value, onDone, t, lang }) => {
  const [v, setV] = useState(value);
  const [custom, setCustom] = useState(() => !['m', 'd', 'e'].some((k) => { const h = HOURS[kind][k]; return h[0] === value.s[0] && h[1] === value.s[1] && h[2] === value.e[0] && h[3] === value.e[1]; }));
  const flip = (d) => { tapSelection(); setV((x) => ({ ...x, days: x.days.indexOf(d) >= 0 ? x.days.filter((y) => y !== d) : x.days.concat(d) })); };
  const preset = (k) => { tapSelection(); const h = HOURS[kind][k]; setCustom(false); setV((x) => ({ ...x, s: [h[0], h[1]], e: [h[2], h[3]] })); };
  const isPreset = (k) => { const h = HOURS[kind][k]; return !custom && h[0] === v.s[0] && h[1] === v.s[1] && h[2] === v.e[0] && h[3] === v.e[1]; };
  const move = (which, k) => {
    tapLight();
    setV((x) => {
      const n = { ...x, [which]: step30(x[which], k) };
      const sm = n.s[0] * 60 + n.s[1]; const em = n.e[0] * 60 + n.e[1];
      if (em <= sm) { if (which === 's') n.e = step30(n.s, 1); else n.s = step30(n.e, -1); }
      return n;
    });
  };
  return (
    <View>
      <Label>{t('md_days_label')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {dayNames(lang).map(({ d, name }) => <Chip key={d} label={name} on={v.days.indexOf(d) >= 0} onPress={() => flip(d)} />)}
      </View>
      <Label>{t('md_hours_label')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['m', 'd', 'e'].map((k) => { const h = HOURS[kind][k]; return <Chip key={k} label={hm(h[0], h[1]) + '–' + hm(h[2], h[3])} on={isPreset(k)} onPress={() => preset(k)} />; })}
        <Chip label={t('md_custom')} on={custom} onPress={() => { tapSelection(); setCustom(true); }} />
      </View>
      {custom ? (
        <View style={{ marginTop: 4 }}>
          <Stepper label={t('md_from')} value={v.s} onMinus={() => move('s', -1)} onPlus={() => move('s', 1)} />
          <Stepper label={t('md_to')} value={v.e} onMinus={() => move('e', -1)} onPlus={() => move('e', 1)} />
        </View>
      ) : null}
      <Pressable disabled={!v.days.length} onPress={() => onDone(v)} accessibilityRole="button" style={{ marginTop: 14 }}>
        <View style={{ borderRadius: 999, backgroundColor: v.days.length ? C.purple : C.glassHi, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: v.days.length ? '#FFF' : C.faint, fontSize: 16, fontWeight: '900' }}>{t('md_continue')}</Text>
        </View>
      </Pressable>
    </View>
  );
};

/* church: which day, and when — or not every week */
const Church = ({ value, onDone, t, lang }) => {
  const [v, setV] = useState(value || { day: lang === 'ar' ? 'FR' : 'SU', slot: 'm' });
  return (
    <View>
      <Label>{t('md_days_label')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {dayNames(lang).filter(({ d }) => ['FR', 'SA', 'SU'].indexOf(d) >= 0).map(({ d, name }) => <Chip key={d} label={name} on={v.day === d} onPress={() => { tapSelection(); setV({ ...v, day: d }); }} />)}
      </View>
      <Label>{t('md_hours_label')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['m', 'l', 'e'].map((k) => { const h = CHURCH[k]; return <Chip key={k} label={hm(h[0], h[1]) + '–' + hm(h[2], h[3])} on={v.slot === k} onPress={() => { tapSelection(); setV({ ...v, slot: k }); }} />; })}
      </View>
      <Pressable onPress={() => onDone(v)} accessibilityRole="button" style={{ marginTop: 14 }}>
        <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{t('md_continue')}</Text>
        </View>
      </Pressable>
      <Pressable onPress={() => onDone(null)} accessibilityRole="button" style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800' }}>{t('md_church_none')}</Text>
      </Pressable>
    </View>
  );
};

/* "where would you like to be better?" — up to three, or none */
const GrowStep = ({ t, faith, onDone }) => {
  const [pick, setPick] = useState(() => readCompass().grow || []);
  const flip = (id) => { tapSelection(); setPick((x) => (x.indexOf(id) >= 0 ? x.filter((y) => y !== id) : x.concat(id).slice(-3))); };
  return (
    <View>
      <Text style={{ color: C.dim, fontSize: 14, marginTop: -8, marginBottom: 14 }}>{t('cp_grow_sub')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {GROW.map((g) => <Chip key={g.id} label={g.emoji + ' ' + t('cp_grow_' + g.id)} on={pick.indexOf(g.id) >= 0} onPress={() => flip(g.id)} />)}
      </View>
      {pick.length ? (
        <View style={{ marginTop: 6, borderRadius: 16, backgroundColor: C.purpleSoft, padding: 12 }}>
          {pick.map((id) => { const g = GROW.find((x) => x.id === id); return <Text key={id} style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }}>{growEmoji(g, faith) + '  ' + growLabel(g, faith, t) + ' · ' + t('md_min').replace('{n}', String(g.min))}</Text>; })}
        </View>
      ) : null}
      <Pressable onPress={() => onDone(pick)} accessibilityRole="button" style={{ marginTop: 14 }}>
        <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{pick.length ? t('md_continue') : t('md_skip_grow')}</Text>
        </View>
      </Pressable>
    </View>
  );
};

/* ─── THE REST OF LIFE, GIVEN A PLACE IN THE DAY ─────────────────────
   Ayser: "فين بقية الحياة اللي قلنا عليها؟ خليها متوزعة". Family, time
   for yourself, moving, a proper meal: each is put into a real gap in
   the day — after work for a walk, the evening for family, a quiet
   twenty minutes before winding down — around whatever is already
   there. If a day is full, a part waits for a day that is not. */
const BLOCKS = [
  { id: 'health', min: 30, prefer: [[12.5, 15], [19, 21]] },
  { id: 'move', min: 30, prefer: [[17, 20.5], [6.5, 9.5]] },
  { id: 'family', min: 45, prefer: [[19, 22.5], [13, 18]] },
  { id: 'me', min: 20, prefer: [[20.5, 23.5], [7, 10]] },
];
/* where each place to grow fits best in a day */
const GROW_WHEN = { faith: [[5.5, 8], [20, 22.5]], learn: [[20, 22.5], [13, 16]], body: [[17, 20.5], [6.5, 9]], love: [[19, 21.5]], friends: [[12, 14.5], [18, 21]], career: [[20, 22.5], [7, 9]], calm: [[21.5, 23.5], [7, 9]], create: [[18, 21.5]] };
const growBlocks = (a, t) => (readCompass().grow || []).map((id) => {
  const g = GROW.find((x) => x.id === id);
  return g ? { id: 'grow:' + id, min: g.min, prefer: GROW_WHEN[id] || [[18, 22]], emoji: growEmoji(g, faithOf(a)), label: growLabel(g, faithOf(a), t) } : null;
}).filter(Boolean);

function placeBalance(busy, from, until, day, t, extraBlocks = []) {
  const taken = busy.map((x) => [x.at.getTime() - 10 * 60000, x.end.getTime() + 10 * 60000]);
  const free = (s, e) => s >= from && e <= until && !taken.some(([a, b]) => s < b && e > a);
  const out = [];
  BLOCKS.concat(extraBlocks).forEach((b) => {
    const len = b.min * 60000;
    const windows = b.prefer.concat([[0, 24]]);
    for (const [ws, we] of windows) {
      let found = null;
      for (let h = ws; h + b.min / 60 <= we && !found; h += 0.25) {
        const s = at(day, Math.floor(h), Math.round((h % 1) * 60)).getTime();
        if (free(s, s + len)) found = s;
      }
      if (found != null) {
        const bl = BALANCE.find((x) => x.id === b.id);
        out.push(bl
          ? { id: 'bal:' + b.id, emoji: bl.emoji, label: t('md_blk_' + b.id), at: new Date(found), end: new Date(found + len), balance: true }
          : { id: b.id, emoji: b.emoji, label: b.label + ' · ' + t('md_min').replace('{n}', String(b.min)), at: new Date(found), end: new Date(found + len), balance: true });
        taken.push([found - 10 * 60000, found + len + 10 * 60000]);
        break;
      }
    }
  });
  return out;
}

/* today's day, in time order */
function todayItems(a, t, now = new Date(), extra = []) {
  const out = extra.slice();
  const sl = SLEEP[a.sleep || 'regular'];
  const wake = at(now, sl.wake[0], sl.wake[1]);
  out.push({ id: 'wake', emoji: '⏰', label: t('md_wake'), at: wake, end: new Date(wake.getTime() + 20 * 60000) });
  const today = JS_DAY[now.getDay()];
  ['uni', 'work'].forEach((kind) => {
    if (!has(a, kind)) return;
    const b = blockOf(a, kind);
    if (b.days.indexOf(today) < 0) return;
    out.push({ id: kind, emoji: kind === 'uni' ? '🎓' : '💼', label: t('md_' + kind) + ' · ' + hm(b.s[0], b.s[1]) + '–' + hm(b.e[0], b.e[1]), at: at(now, b.s[0], b.s[1]), end: at(now, b.e[0], b.e[1]) });
  });
  if (muslim(a)) {
    const p = prayerTimes(now, a.at.lat, a.at.lng);
    [['fajr', '🌅'], ['dhuhr', '☀️'], ['asr', '🌤️'], ['maghrib', '🌇'], ['isha', '🌙']].forEach(([k, e]) => out.push({ id: k, emoji: e, label: t('md_' + k), at: p[k], end: new Date(p[k].getTime() + 15 * 60000) }));
  }
  if (faithOf(a) === 'christian' && a.church && a.church.day === today) {
    const h = CHURCH[a.church.slot || 'm'];
    out.push({ id: 'church', emoji: '⛪', label: t('md_church') + ' · ' + hm(h[0], h[1]) + '–' + hm(h[2], h[3]), at: at(now, h[0], h[1]), end: at(now, h[2], h[3]) });
  }
  const bed = at(now, sl.bed[0], sl.bed[1]);
  if (sl.bed[0] < 12) bed.setDate(bed.getDate() + 1);       // after midnight is still tonight
  const wind = new Date(bed.getTime() - 30 * 60000);
  out.push({ id: 'wind', emoji: '📵', label: t('md_wind'), at: wind, end: bed });
  const w2 = new Date(bed); w2.setHours(sl.wake[0], sl.wake[1], 0, 0); if (w2 <= bed) w2.setDate(w2.getDate() + 1);
  out.push({ id: 'sleep', emoji: '😴', label: t('md_sleep'), at: bed, end: w2 });
  // the rest of life, in the gaps that are left
  out.push(...placeBalance(out, wake.getTime() + 20 * 60000, wind.getTime(), now, t, growBlocks(a, t)));
  out.forEach((x) => { if (!x.end) x.end = new Date(x.at.getTime() + 20 * 60000); });
  return out.sort((x, y) => x.at - y.at);
}

/* "2h 10m" / "25 min" — time you can feel, not a clock to read */
const span = (ms, t) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return t('md_min').replace('{n}', String(m));
  const h = Math.floor(m / 60); const r = m % 60;
  return t('md_hm').replace('{h}', String(h)).replace('{m}', String(r));
};

/* ─── A FEW REMINDERS THAT REPEAT, NOT A HUNDRED AND FIFTY ──────────
   Ayser saw "152 Events" and said: معقد. A reminder for every prayer of
   every day of a month is a wall to scroll before "Add All". So each
   thing is ONE event that repeats — waking, university and work on
   their own days, church, winding down, the four parts of a day, and
   the five prayers — about fifteen in all. Prayer times move a minute
   or so a day, so the screen says to add it again every couple of
   weeks; each event keeps the same id, so a calendar that knows ids
   updates it instead of doubling it. */
/* the first day, from tomorrow, that is one of `days` — a weekly event
   has to start on one of its own days, or a calendar adds a stray one */
const firstOn = (days, h, m) => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  for (let i = 0; i < 7 && days.indexOf(JS_DAY[d.getDay()]) < 0; i++) d.setDate(d.getDate() + 1);
  return at(d, h, m);
};

function calendarEvents(a, t) {
  const now = new Date();
  const ev = [];
  const sl = SLEEP[a.sleep || 'regular'];
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  ev.push({ uid: 'wake', title: '⏰ ' + t('md_wake'), start: at(tomorrow, sl.wake[0], sl.wake[1]), minutes: 10, days: 'daily', alarm: 0 });
  const bed = at(tomorrow, sl.bed[0], sl.bed[1]); if (sl.bed[0] < 12) bed.setDate(bed.getDate() + 1);
  ev.push({ uid: 'wind', title: '📵 ' + t('md_wind'), start: new Date(bed.getTime() - 30 * 60000), minutes: 30, days: 'daily', alarm: 0 });
  ['uni', 'work'].forEach((kind) => {
    if (!has(a, kind)) return;
    const b = blockOf(a, kind);
    if (!b.days.length) return;
    ev.push({ uid: kind, title: (kind === 'uni' ? '🎓 ' : '💼 ') + t('md_' + kind), start: firstOn(b.days, b.s[0], b.s[1]), minutes: (b.e[0] * 60 + b.e[1]) - (b.s[0] * 60 + b.s[1]), days: b.days, alarm: 30 });
  });
  if (faithOf(a) === 'christian' && a.church) {
    const h = CHURCH[a.church.slot || 'm'];
    ev.push({ uid: 'church', title: '⛪ ' + t('md_church'), start: firstOn([a.church.day], h[0], h[1]), minutes: (h[2] * 60 + h[3]) - (h[0] * 60 + h[1]), days: [a.church.day], alarm: 30 });
  }
  // the four parts of a day, where they fall on a usual working day
  let day = tomorrow;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    if (['uni', 'work'].some((k) => has(a, k) && blockOf(a, k).days.indexOf(JS_DAY[d.getDay()]) >= 0)) { day = d; break; }
  }
  todayItems(a, t, day).filter((x) => x.balance).forEach((x) => {
    ev.push({ uid: x.id.replace(':', '-'), title: x.emoji + ' ' + x.label, start: at(tomorrow, x.at.getHours(), x.at.getMinutes()), minutes: Math.round((x.end - x.at) / 60000), days: 'daily', alarm: 0 });
  });
  if (muslim(a)) {
    const p = prayerTimes(tomorrow, a.at.lat, a.at.lng);
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach((k) => ev.push({ uid: k, title: '🕌 ' + t('md_' + k), start: p[k], minutes: 10, days: 'daily', alarm: 0 }));
  }
  // the dates that matter: every year for birthdays and anniversaries (a gift reminder three days ahead), once for a trip
  readDates().forEach((x) => {
    const d = nextOf(x); d.setHours(9, 0, 0, 0);
    if (d < now) return;
    ev.push({ uid: 'date-' + x.id, title: (x.kind === 'birthday' ? '🎂 ' : x.kind === 'anniversary' ? '💍 ' : x.kind === 'trip' ? '🧳 ' : '⭐ ') + x.name, start: d, minutes: 30,
      days: yearly(x.kind) ? 'yearly' : null, alarm: yearly(x.kind) ? 3 * 24 * 60 : x.kind === 'trip' ? 24 * 60 : 60 });
  });
  return ev;
}

export const MyDay = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [a, setA] = useState(() => read() || {});
  const [setup, setSetup] = useState(() => !(read() && read().ready));
  /* half-way through the questions and the app closed (or the phone
     needed the memory): it opens again on the question you were on */
  const [step, setStep] = useState(() => { const r = read(); const l = steps(r || {}); const i = r && r.next ? l.indexOf(r.next) : -1; return i > 0 ? i : 0; });
  const [done, setDone] = useState(readDone);
  const [locBusy, setLocBusy] = useState(false);
  const [calNote, setCalNote] = useState(null);
  const [plans, setPlans] = useState(() => plansToday(keptGatherings(null)));
  useEffect(() => {
    let alive = true;
    listGatherings(null).then((r) => { if (alive) setPlans(plansToday(r)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [added, setAdded] = useState(() => rd(addedKey(), []));
  const [notes, setNotes] = useState(() => rd(NOTES, []));
  const [draft, setDraft] = useState('');
  const [allNotes, setAllNotes] = useState(false);
  const [skip, setSkip] = useState(0);
  const [sheet, setSheet] = useState(null);          // 'focus' | 'compass' | 'dates' | 'diary'
  const [ver, setVer] = useState(0);                 // the compass or the dates changed: the day is worked out again
  const closeSheet = () => { setSheet(null); setVer((v) => v + 1); };
  const [remind, setRemind] = useState(() => { try { return localStorage.getItem(REMIND) === '1'; } catch (e) { return false; } });

  const list = steps(a);
  const cur = list[Math.min(step, list.length - 1)];
  const answer = (patchIn) => {
    let patch = patchIn;
    tapSelection();
    // praying, and the map already knows roughly where you are: no extra question
    if (patch.faith === 'muslim' && !a.at) { const f = lastFix(); if (f) patch = { ...patch, at: { lat: f.lat, lng: f.lng } }; }
    const next = { ...a, ...patch };
    setA(next);
    /* An answer can take its own question away — telling us where you are
       removes "where are you?", skipping it sets no faith — and looking
       this question up in the new list then found nothing and sent
       everybody back to question one. So: the next question is the first
       one still asked that comes after this one. */
    const l = steps(next);
    const after = l.find((q) => ORDER.indexOf(q) > ORDER.indexOf(cur));
    if (!after) { const fin = { ...next, ready: true, next: undefined }; write(fin); setA(fin); setSetup(false); setStep(0); tapSuccess(); }
    else { write({ ...next, ready: !!a.ready, next: after }); setStep(l.indexOf(after)); }
  };
  const useLocation = async () => {
    setLocBusy(true);
    // never a spinner for ever: eight seconds, then what the map last knew
    const c = await Promise.race([getCurrentCoords().catch(() => null), new Promise((r) => setTimeout(() => r(null), 8000))]);
    setLocBusy(false);
    const fix = c ? { lat: c.latitude, lng: c.longitude } : lastFix();
    if (fix) answer({ at: { lat: fix.lat, lng: fix.lng } }); else answer({ faith: 'none' });
  };
  const items = useMemo(() => (setup ? [] : todayItems(a, t, new Date(), plans.filter((g) => g.im_going || added.indexOf(g.id) >= 0).map(planItem))), [a, setup, t, plans, added, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const nudges = useMemo(() => dateNudges(readDates(), t), [t, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  /* the clock moves on its own: every half minute the card catches up */
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  const [later, setLater] = useState({});          // id -> until (ms): "not now" for a while
  const [showAll, setShowAll] = useState(false);
  const open = (x) => done.indexOf(x.id) < 0 && !(later[x.id] && later[x.id] > now);
  const nowItem = items.find((x) => x.at.getTime() <= now && now < x.end.getTime() && open(x));
  const nextItem = items.find((x) => x.at.getTime() > now && open(x) && x !== nowItem);
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
  /* one small idea for a part of the day not done yet */
  const balLeft = balOrder(new Date(now).getHours()).filter((id) => done.indexOf('bal:' + id) < 0);
  const ideaArea = balLeft.length ? BALANCE.find((b) => b.id === balLeft[skip % balLeft.length]) : null;
  const ideaN = 1 + ((Math.floor(skip / Math.max(1, balLeft.length)) + new Date(now).getDate()) % 3);
  const offers = plans.filter((g) => !g.im_going && added.indexOf(g.id) < 0 && new Date(g.starts_at).getTime() > now).slice(0, 2);
  const addPlan = (g) => { tapSuccess(); const n = added.concat(g.id); setAdded(n); wr(addedKey(), n); };
  const addNote = () => {
    const v = draft.trim(); if (!v) return;
    tapLight();
    const n = [{ id: Date.now().toString(36), text: v.slice(0, 200) }].concat(notes).slice(0, 30);
    setNotes(n); wr(NOTES, n); setDraft('');
  };
  const dropNote = (id) => { tapLight(); const n = notes.filter((x) => x.id !== id); setNotes(n); wr(NOTES, n); };
  const flipRemind = async () => {
    tapLight();
    const n = !remind;
    if (n && typeof window.Notification !== 'undefined' && window.Notification.permission === 'default') { try { await window.Notification.requestPermission(); } catch (e) {} }
    setRemind(n);
    try { if (n) localStorage.setItem(REMIND, '1'); else localStorage.removeItem(REMIND); } catch (e) {}
    if (n) scheduleReminders(t);
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
              <Q n={step + 1} of={list.length} title={t(cur === 'uni' ? 'md_q_uni2' : 'md_q_work2')}>
                <Hours key={cur} kind={cur} t={t} lang={lang}
                  value={a[cur] && typeof a[cur] === 'object' ? a[cur] : { ...blockOf(a, cur), days: a[cur] ? blockOf(a, cur).days : (lang === 'ar' ? DAYS.sun : DAYS.mon) }}
                  onDone={(v) => answer({ [cur]: v })} />
              </Q>
            ) : cur === 'faith' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_faith')}>
                <Choice emoji="🕌" title={t('md_faith_muslim')} on={faithOf(a) === 'muslim'} onPress={() => answer({ faith: 'muslim', pray: undefined })} />
                <Choice emoji="⛪" title={t('md_faith_christian')} on={faithOf(a) === 'christian'} onPress={() => answer({ faith: 'christian', pray: undefined })} />
                <Choice emoji="➖" title={t('md_faith_none')} on={faithOf(a) === 'none'} onPress={() => answer({ faith: 'none', pray: undefined })} />
              </Q>
            ) : cur === 'church' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_church')}>
                <Church value={a.church} t={t} lang={lang} onDone={(v) => answer({ church: v })} />
              </Q>
            ) : cur === 'grow' ? (
              <Q n={step + 1} of={list.length} title={t('cp_grow_q')}>
                <GrowStep t={t} faith={faithOf(a)} onDone={(g) => {
                  try { localStorage.setItem(COMPASS_KEY, JSON.stringify({ ...readCompass(), grow: g })); } catch (e) {}
                  answer({});
                }} />
              </Q>
            ) : cur === 'loc' ? (
              <Q n={step + 1} of={list.length} title={t('md_q_loc')}>
                {locBusy ? <ActivityIndicator color={C.purple} style={{ marginVertical: 20 }} /> : (
                  <>
                    <Choice emoji="📍" title={t('md_loc_btn')} onPress={useLocation} />
                    <Choice emoji="⏭️" title={t('md_loc_skip')} onPress={() => answer({ faith: 'none' })} />
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
                    {free ? (
                      ideaArea ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
                          <Text style={{ fontSize: 24, marginEnd: 10 }}>{ideaArea.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{t('md_bal_' + ideaArea.id).toUpperCase()}</Text>
                            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 1 }}>{t('md_idea_' + ideaArea.id + '_' + ideaN)}</Text>
                          </View>
                          <Pressable onPress={() => toggle('bal:' + ideaArea.id)} accessibilityRole="button" accessibilityLabel={t('md_idea_did')} hitSlop={6} style={{ marginStart: 8 }}>
                            <View style={{ borderRadius: 999, backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 8 }}>
                              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{'✓ ' + t('md_idea_did')}</Text>
                            </View>
                          </Pressable>
                          <Pressable onPress={() => { tapLight(); setSkip((n) => n + 1); }} accessibilityRole="button" accessibilityLabel={t('md_idea_other')} hitSlop={8} style={{ marginStart: 6 }}>
                            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="refresh" size={16} color={C.dim} />
                            </View>
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={{ color: C.green, fontSize: 14, fontWeight: '900', marginTop: 12 }}>{t('md_bal_all')}</Text>
                      )
                    ) : null}
                    {nextItem ? (
                      <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '700', marginTop: 12 }}>
                        {t('md_then').replace('{what}', nextItem.emoji + ' ' + nextItem.label).replace('{t}', span(nextItem.at.getTime() - now, t))}
                      </Text>
                    ) : null}
                  </Animated.View>
                );
              })()}

              {/* ── THE PLAN ──
                  Ayser: "دوشه اوي — إحنا شركة بساطة وشياكة". It was the same
                  list twice (three things in a card, then the whole day again
                  as a stack of boxes, each with two emojis). Now it is one
                  list: time, name, a quiet circle — hairlines between, no
                  boxes, no icons. The next three by default; "the whole day"
                  opens the rest in the same list, what has passed greyed. */}
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 22, marginBottom: 4 }}>{t('md_plan').toUpperCase()}</Text>
              <View>
                {(showAll ? items : nudges.concat(items.filter((x) => x.end.getTime() > now && done.indexOf(x.id) < 0 && x.id !== 'sleep').slice(0, 3))).map((x, i, arr) => {
                  const isDone = done.indexOf(x.id) >= 0;
                  const past = !isDone && x.end && x.end.getTime() <= now;
                  const isNow = nowItem && nowItem.id === x.id;
                  return (
                    <Pressable key={x.id} onPress={() => toggle(x.id)} accessibilityRole="checkbox" accessibilityState={{ checked: isDone }} accessibilityLabel={x.label}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.line, opacity: isDone || past ? 0.4 : 1 }}>
                        <Text style={{ color: isNow ? C.purple : C.dim, fontSize: 13.5, fontWeight: '700', width: 52, fontVariant: ['tabular-nums'] }}>{x.at ? hm(x.at.getHours(), x.at.getMinutes()) : ''}</Text>
                        <Text style={{ color: C.text, fontSize: 15.5, fontWeight: isNow ? '800' : '600', flex: 1, textDecorationLine: isDone ? 'line-through' : 'none' }} numberOfLines={1}>{x.label}</Text>
                        <Ionicons name={isDone ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={isDone ? C.green : C.faint} />
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => { tapLight(); setShowAll((v) => !v); }} accessibilityRole="button" style={{ paddingVertical: 12 }}>
                  <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '800' }}>{showAll ? t('md_hide_day') : t('md_see_day')}</Text>
                </Pressable>
              </View>

              {/* ── FOUR DOORS: focus, your compass, the dates that matter, your diary ── */}
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                {[['focus', '🪁'], ['compass', '🧭'], ['dates', '🎂'], ['diary', '📓']].map(([k, e], i) => (
                  <Pressable key={k} onPress={() => { tapLight(); setSheet(k); }} accessibilityRole="button" style={{ flex: 1, marginEnd: i < 3 ? 8 : 0 }}>
                    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24 }}>{e}</Text>
                      <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{t('md_door_' + k)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* the four parts of a day, each a tap */}
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>{t('md_bal_title').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row' }}>
                {BALANCE.map((b, i) => {
                  const on = done.indexOf('bal:' + b.id) >= 0;
                  return (
                    <Pressable key={b.id} onPress={() => toggle('bal:' + b.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={t('md_bal_' + b.id)} style={{ flex: 1, marginEnd: i < BALANCE.length - 1 ? 8 : 0 }}>
                      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: on ? C.green : C.line, backgroundColor: on ? C.greenSoft : C.glass, paddingVertical: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 20 }}>{on ? '✓' : b.emoji}</Text>
                        <Text style={{ color: on ? C.green : C.dim, fontSize: 11.5, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>{t('md_bal_' + b.id)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* something on Moments today, for the free time — one tap puts it in your day */}
              {!nowItem && offers.length ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>{t('md_from_app').toUpperCase()}</Text>
                  {offers.map((g) => {
                    const s = new Date(g.starts_at);
                    return (
                      <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 12, marginBottom: 8 }}>
                        <Pressable onPress={() => { tapLight(); onClose(); goToTab('TOGETHER'); }} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 20, marginEnd: 10 }}>{g.emoji || '🤝'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{g.title}</Text>
                            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>{hm(s.getHours(), s.getMinutes()) + (g.place_name ? ' · ' + g.place_name : '')}</Text>
                          </View>
                        </Pressable>
                        <Pressable onPress={() => addPlan(g)} accessibilityRole="button" hitSlop={6} style={{ marginStart: 8 }}>
                          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.purple, paddingHorizontal: 12, paddingVertical: 7 }}>
                            <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900' }}>{'＋ ' + t('md_add_day')}</Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* free time is Papyrus's: the one thing worth doing with it */}
              {!nowItem ? (
                <View style={{ marginTop: 16 }}>
                  <BrainDump />
                </View>
              ) : null}

              {/* notes to yourself: one line, kept until you clear them */}
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>{'📝 ' + t('md_notes').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingStart: 14, paddingEnd: 6 }}>
                <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={addNote} returnKeyType="done" blurOnSubmit={false} maxLength={200}
                  placeholder={t('md_note_ph')} placeholderTextColor={C.faint}
                  style={{ flex: 1, color: C.text, fontSize: 14.5, paddingVertical: 12, outlineStyle: 'none' }} />
                {draft.trim() ? (
                  <Pressable onPress={addNote} accessibilityRole="button" accessibilityLabel={t('md_note_add')} hitSlop={8}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="arrow-up" size={17} color="#FFF" />
                    </View>
                  </Pressable>
                ) : null}
              </View>
              {(allNotes ? notes : notes.slice(0, 3)).map((n) => (
                <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, backgroundColor: '#FFF6D6', paddingVertical: 10, paddingHorizontal: 12, marginTop: 6 }}>
                  <Text style={{ color: '#4A3B12', fontSize: 14, lineHeight: 20, flex: 1 }}>{n.text}</Text>
                  <Pressable onPress={() => dropNote(n.id)} accessibilityRole="button" accessibilityLabel={t('md_note_clear')} hitSlop={10} style={{ marginStart: 8, marginTop: 2 }}>
                    <Ionicons name="close" size={16} color="#8A7535" />
                  </Pressable>
                </View>
              ))}
              {notes.length > 3 ? (
                <Pressable onPress={() => { tapLight(); setAllNotes((v) => !v); }} accessibilityRole="button" style={{ marginTop: 6 }}>
                  <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>{allNotes ? t('md_hide_day') : t('md_note_more').replace('{n}', String(notes.length - 3))}</Text>
                </Pressable>
              ) : null}

              {muslim(a) ? <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{t('md_pray_note')}</Text> : null}

              <Pressable onPress={toCalendar} accessibilityRole="button" style={{ marginTop: 18 }}>
                <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                  <Ionicons name="alarm-outline" size={19} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginStart: 8 }}>{t('md_cal')}</Text>
                </View>
              </Pressable>
              <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8, textAlign: 'center' }}>{calNote || t('md_cal_sub')}</Text>
              {muslim(a) ? <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 6, textAlign: 'center' }}>{t('md_cal_refresh')}</Text> : null}

              {/* reminders while Moments is open — the calendar rings even when it is closed */}
              <Pressable onPress={flipRemind} accessibilityRole="switch" accessibilityState={{ checked: remind }} style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: remind ? C.purple : C.line, backgroundColor: remind ? C.purpleSoft : C.glass, padding: 13 }}>
                  <Text style={{ fontSize: 20, marginEnd: 10 }}>🔔</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('md_remind')}</Text>
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{t('md_remind_sub')}</Text>
                  </View>
                  <Ionicons name={remind ? 'toggle' : 'toggle-outline'} size={30} color={remind ? C.purple : C.faint} />
                </View>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
      {sheet === 'focus' ? <Focus onClose={closeSheet} /> : null}
      {sheet === 'compass' ? <Compass onClose={closeSheet} faith={faithOf(a)} /> : null}
      {sheet === 'dates' ? <Dates onClose={closeSheet} /> : null}
      {sheet === 'diary' ? <Diary onClose={closeSheet} /> : null}
    </Modal>
  );
};

/* ─── REMINDERS WHILE MOMENTS IS OPEN ────────────────────────────────
   Ayser: "خلّي فيه reminder الناس تفعّله عشان يفكّرهم بوقت كل حاجة".
   Switched on in My day. While Moments is open (or just put away), each
   thing in today's plan taps you on the shoulder when its time comes —
   a notification with its name. A web page cannot promise this once the
   phone has closed it, which is what the calendar reminders are for;
   the switch says so. App.js starts this on every open, when it is on. */
let timers = [];
export function scheduleReminders(tIn) {
  timers.forEach(clearTimeout); timers = [];
  try { if (localStorage.getItem(REMIND) !== '1') return; } catch (e) { return; }
  const a = read();
  if (!a || !a.ready || typeof window.Notification === 'undefined' || window.Notification.permission !== 'granted') return;
  const t = tIn || tNow;
  const now = Date.now();
  const show = (x) => {
    try {
      const title = x.emoji + ' ' + x.label;
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification(title, { tag: 'mm-day-' + x.id, icon: '/icon-192.png' })).catch(() => {});
      else new window.Notification(title); // eslint-disable-line no-new
    } catch (e) {}
  };
  todayItems(a, t, new Date()).forEach((x) => {
    const ms = x.at.getTime() - now;
    if (ms > 0 && ms < 16 * 3600 * 1000 && x.id !== 'sleep') timers.push(setTimeout(() => { if (readDone().indexOf(x.id) < 0) show(x); }, ms));
  });
}

/* ─── WIDGETS ON HOME (MOMENTS PLUS) ──────────────────────────────────
   Ayser: "لو الناس مشتركة premium تقدر تعمل widgets". A web app cannot
   put a widget on the phone's own home screen — that needs the App
   Store version — so the widgets live where somebody looks first: the
   top of Home. Small, only the ones they picked (Personalise, by
   holding the Moments logo), each one line that is true right now.
   Here, beside My day, because they read the same plan. */
const nextPrayer = (a, now) => {
  if (!a || !muslim(a)) return null;
  for (let i = 0; i < 2; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const p = prayerTimes(d, a.at.lat, a.at.lng);
    const k = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].find((x) => p[x].getTime() > now);
    if (k) return { k, at: p[k] };
  }
  return null;
};

const Tile = ({ emoji, title, sub, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ width: '48.5%', marginBottom: 8 }}>
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 12, minHeight: 74 }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginTop: 4 }} numberOfLines={1}>{title}</Text>
      {sub ? <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </View>
  </Pressable>
);

export const HomeWidgets = ({ ids }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!open) setNow(Date.now()); }, [open]);
  const a = read();
  const ready = !!(a && a.ready);
  const show = (id) => { tapLight(); if (id === 'plan') goToTab('TOGETHER'); else setOpen(true); };
  const tiles = ids.map((id) => {
    if (id === 'now') {
      if (!ready) return <Tile key={id} emoji="🗓️" title={t('md_title')} sub={t('wg_setup')} onPress={() => show(id)} />;
      // the plan, like the list on a lock screen: the next three, ticked
      const done = readDone();
      const next3 = dateNudges(readDates(), t).concat(todayItems(a, t, new Date(now)).filter((y) => y.end.getTime() > now && done.indexOf(y.id) < 0 && y.id !== 'sleep')).slice(0, 3);
      return (
        <Pressable key={id} onPress={() => show(id)} accessibilityRole="button" style={{ width: '100%', marginBottom: 8 }}>
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingHorizontal: 14, paddingVertical: 10 }}>
            {next3.length ? next3.map((y) => (
              <View key={y.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                <Ionicons name="square-outline" size={17} color={C.faint} />
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', flex: 1, marginStart: 8 }} numberOfLines={1}>{y.emoji + ' ' + y.label}</Text>
                {y.at ? <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{hm(y.at.getHours(), y.at.getMinutes())}</Text> : null}
              </View>
            )) : <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>{'🌿 ' + t('md_free_rest')}</Text>}
          </View>
        </Pressable>
      );
    }
    if (id === 'prayer') {
      const p = nextPrayer(a, now);
      return p
        ? <Tile key={id} emoji="🕌" title={t('md_' + p.k) + ' · ' + hm(p.at.getHours(), p.at.getMinutes())} sub={t('wg_in').replace('{t}', span(p.at.getTime() - now, t))} onPress={() => show(id)} />
        : <Tile key={id} emoji="🕌" title={t('wg_prayer')} sub={t('wg_setup')} onPress={() => show(id)} />;
    }
    if (id === 'plan') {
      const g = (keptGatherings(null) || []).filter((r) => r.im_going && new Date(r.starts_at).getTime() > now - 3600000).sort((p, q) => new Date(p.starts_at) - new Date(q.starts_at))[0];
      return g
        ? <Tile key={id} emoji={g.emoji || '🤝'} title={g.title} sub={t('wg_in').replace('{t}', span(Math.max(0, new Date(g.starts_at).getTime() - now), t))} onPress={() => show(id)} />
        : <Tile key={id} emoji="🤝" title={t('wg_plan')} sub={t('wg_find_plan')} onPress={() => show(id)} />;
    }
    if (id === 'note') {
      const n = rd(NOTES, [])[0];
      return <Tile key={id} emoji="📝" title={n ? n.text : t('wg_note')} sub={n ? null : t('wg_add_note')} onPress={() => show(id)} />;
    }
    return null;
  });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>
      {tiles}
      {open ? <MyDay onClose={() => setOpen(false)} /> : null}
    </View>
  );
};
