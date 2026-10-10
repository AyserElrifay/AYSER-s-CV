import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SUPABASE_READY } from '../../lib/supabase';
import { explain } from '../../lib/explain';
import {
  listGatherings, listSparks, createGathering, joinGathering, cancelGathering, sparkText, announceGathering,
} from '../../services/green';
import { tapLight, tapMedium, tapSuccess } from '../../utils/feedback';
import { PLAY_LANGS } from '../lamma/languages';
import { useSheetBack } from '../../hooks/useSheetBack';
import { GreenMark } from './GreenMark';
import { StartForm } from './StartForm';
import { lookOf, titleFor } from '../../lib/activityPins';

/* ─── أخضر · GREEN MINDS ──────────────────────────────────────────────
   A corner of Moments for the things that are better done outside and
   with other people: clean-ups, reflection circles, art and culture,
   and the Erasmus-shaped projects that run over a term.

   ── WHAT IS REAL AND WHAT IS AN IDEA ─────────────────────────────
   The two are never mixed on this screen. WHAT'S ON is gatherings
   people have actually made, and when nobody has made one it says so
   instead of filling the space with invented ones. IDEAS TO START is
   labelled as ideas, has no dates and nobody attending, and every card
   ends in the same button: start one.

   ── THE CARE CODE ────────────────────────────────────────────────
   Four lines, at the top, where they are read rather than agreed to in
   a settings screen nobody opens. They are the reason somebody who has
   never met the others turns up at all: come as you are, leave the
   place better than you found it, differences of culture and belief
   are welcome and not up for debate, and anybody may leave at any time
   without explaining.

   ── CHIC MEANS CALM ──────────────────────────────────────────────
   Deep green, one accent, lots of air, no badges and no counters
   shouting at anybody. The measure of this screen is whether it makes
   somebody want to go outside, not whether it holds them here.      */

/* most-started first: the first row is the one people actually see */
const KINDS = [
  { id: 'walk',    icon: 'walk',            key: 'green_kind_walk' },
  { id: 'coffee',  icon: 'coffee-outline',  key: 'gn_coffee' },
  { id: 'run',     icon: 'run',             key: 'gn_run' },
  { id: 'sport',   icon: 'soccer',          key: 'green_kind_sport' },
  { id: 'culture', icon: 'drama-masks',     key: 'green_kind_culture' },
  { id: 'art',     icon: 'palette-outline', key: 'green_kind_art' },
  { id: 'circle',  icon: 'account-group',   key: 'green_kind_circle' },
  { id: 'focus',   icon: 'book-open-variant', key: 'gn_focus' },
  { id: 'movie',   icon: 'popcorn',         key: 'gn_movie' },
  { id: 'cleanup', icon: 'broom',           key: 'green_kind_cleanup' },
  { id: 'project', icon: 'sprout-outline',  key: 'green_kind_project' },
];

/* The six Ayser asked for, plus everywhere. Codes on the wire, flags
   on the screen — the same separation the quiz packs use. */
const PLACES = [
  { code: null, flag: '🌍' },
  { code: 'EG', flag: '🇪🇬' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'ES', flag: '🇪🇸' },
  { code: 'MD', flag: '🇲🇩' },
  { code: 'HU', flag: '🇭🇺' },
  { code: 'CZ', flag: '🇨🇿' },
  { code: 'EE', flag: '🇪🇪' },
];

/* the flag for any two-letter code, so a country that is not in the
   short list above can still be the one somebody starts something in */
const flagOf = (code) => String.fromCodePoint(...String(code).toUpperCase().split('').map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));

const GREEN = '#1F7A5A';
const GREEN_SOFT = 'rgba(31,122,90,0.10)';

const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[0];

/* A day and an hour, in the reader's own language, from the browser's
   own formatter — no month names of ours to translate thirteen times. */
const when = (iso, lang) => {
  try {
    return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return ''; }
};

const hour = (iso, lang) => {
  try { return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang, { hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
};

const Chip = ({ on, children, onPress }) => (
  <Pressable onPress={onPress} style={{ marginEnd: 8, marginBottom: 8 }}>
    <View style={{
      backgroundColor: on ? C.text : 'transparent',
      borderWidth: 1, borderColor: on ? C.text : C.line,
      borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    }}>
      <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{children}</Text>
    </View>
  </Pressable>
);

/* The pack of questions that belongs to this corner. Named here rather
   than looked up by title: a title is translated thirteen ways and
   renamed on a whim, and an id is neither. */
export const GREEN_PACK = 'ffff6666-0000-4000-8000-000000000001';

export const GreenSheet = ({ onClose, onPlay, startNow, homeCountry, openOn, prefill }) => {
  /* the phone's own back closes this, the same as everything else;
     see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [country, setCountry] = useState(null);
  const [rows, setRows] = useState(null);            // null = still asking
  const [sparks, setSparks] = useState([]);
  const [why, setWhy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);            // the new-gathering sheet
  const [day, setDay] = useState(null);              // a day picked from the strip, or all week
  const [open, setOpen] = useState(null);            // the card showing its description
  const [more, setMore] = useState(openOn || null);  // 'ideas' | 'how' | null
  const [sent, setSent] = useState(null);            // { id, n } after an invite
  const [manage, setManage] = useState(null);         // the plan you host, its two actions
  const [confirmOff, setConfirmOff] = useState(false);

  /* the week, grouped by the day it falls on, in the reader's language */
  const days = React.useMemo(() => {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    (rows || []).forEach((g) => {
      const d = new Date(g.starts_at); const k = new Date(d); k.setHours(0, 0, 0, 0);
      const key = k.toISOString().slice(0, 10);
      let bucket = out.find((b) => b.key === key);
      if (!bucket) {
        const diff = Math.round((k - today) / 86400000);
        const loc = lang === 'ar' ? 'ar-EG' : lang;
        let wd = ''; let long = '';
        try { wd = k.toLocaleDateString(loc, { weekday: 'short' }); long = k.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'short' }); } catch (e) {}
        const label = diff === 0 ? t('green_today') : diff === 1 ? t('green_tomorrow') : wd;
        bucket = { key, label, long: diff === 0 ? t('green_today') + ' · ' + long : diff === 1 ? t('green_tomorrow') + ' · ' + long : long, items: [], count: 0 };
        out.push(bucket);
      }
      bucket.items.push(g); bucket.count += 1;
    });
    return out;
  }, [rows, lang, t]);

  const load = useCallback(() => {
    let alive = true;
    setRows(null);
    if (!SUPABASE_READY || !user) { setRows([]); setWhy('offline'); return () => {}; }
    Promise.all([listGatherings(country), listSparks(country)])
      .then(([gs, sp]) => { if (alive) { setRows(gs); setSparks(sp); setWhy(null); } })
      .catch((e) => { if (alive) { setRows([]); setWhy(explain(e)); } });
    return () => { alive = false; };
  }, [country, user]);

  useEffect(() => load(), [load]);

  /* Opened from Together's "+": straight into starting one, and closing
     the form is closing the whole thing — nobody asked for the list. */
  useEffect(() => { if (startNow) startFrom(null); }, []);
  const closeForm = () => { setForm(null); if (startNow && onClose) onClose(); };

  const going = async (row, yes) => {
    tapMedium();
    const r = await joinGathering(row.id, yes);
    if (r && r.ok) load();
  };

  /* "ابعت للusers انهم join" — the host, once, to everybody not coming yet */
  const invite = async (row) => {
    tapMedium();
    const r = await announceGathering(row.id);
    if (r && r.ok) { tapSuccess(); setSent({ id: row.id, n: r.sent }); load(); }
  };

  const drop = async (row) => {
    tapLight();
    const r = await cancelGathering(row.id);
    if (r && r.ok) load();
  };

  const submit = async () => {
    if (busy || !form) return;
    setBusy(true);
    const r = await createGathering({
      kind: form.kind,
      // nobody has to name it: an unnamed plan is called what it is
      title: (form.title || '').trim() || t(kindOf(form.kind).key),
      about: form.about,
      country: form.country || 'EG',
      city: form.city,
      place: form.place,
      lat: form.lat == null ? null : form.lat,
      lng: form.lng == null ? null : form.lng,
      startsAt: form.startsAt,
      minutes: form.minutes ? parseInt(form.minutes, 10) : null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      language: lang,
    });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); load(); closeForm(); }
    else setForm((f) => ({ ...f, err: r && r.reason }));
  };

  /* Starting from an idea carries the idea's kind and its title across,
     so the first thing anybody types is where and when — not what to
     call it. */
  const startFrom = (spark) => {
    tapMedium();
    // tomorrow at five: a real slot on the form's own day/time pickers
    const soon = new Date(Date.now() + 24 * 3600 * 1000);
    soon.setHours(prefill && prefill.hour != null ? prefill.hour : 17, 0, 0, 0);
    /* a prefill may bring the whole plan — "Watch together" brings the
       film as the title and what to watch it on (FilmSheet.js) */
    setForm({
      kind: spark ? spark.kind : (prefill ? prefill.kind || 'coffee' : 'walk'),
      title: spark ? sparkText(spark, lang, 'title') : (prefill && prefill.title) || '',
      about: spark ? sparkText(spark, lang, 'about') : (prefill && prefill.about) || '',
      country: (spark && spark.country) || country || homeCountry || 'EG',
      city: '', place: (prefill && prefill.place) || '',
      lat: prefill ? prefill.lat : null, lng: prefill ? prefill.lng : null,
      startsAt: soon.toISOString(),
      minutes: spark && spark.minutes ? String(spark.minutes) : prefill && prefill.minutes ? String(prefill.minutes) : '60',
      capacity: '',
    });
  };

  const formPlaces = homeCountry && !PLACES.some((p) => p.code === homeCountry)
    ? [{ code: homeCountry, flag: flagOf(homeCountry) }, ...PLACES.filter((p) => p.code)]
    : PLACES.filter((p) => p.code);

  /* Opened straight into starting one: just the sheet, over whatever
     the person was looking at — not the whole Green Minds page behind it. */
  /* a plan that arrives with its kind (movie night) shows that kind
     first, where it can be seen to be chosen */
  const formKinds = prefill && prefill.kind ? [kindOf(prefill.kind), ...KINDS.filter((k) => k.id !== prefill.kind)] : KINDS;
  if (startNow) {
    return form ? (
      <StartForm form={form} setForm={setForm} kinds={formKinds} places={formPlaces} busy={busy} t={t} lang={lang}
        onSubmit={submit} onClose={() => { tapLight(); closeForm(); }} />
    ) : null;
  }

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

          {/* a plain header: what this is, in one line — the week below is the point */}
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 18 }}>
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color={C.text} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <GreenMark size={26} />
              <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.4, marginStart: 8 }}>{t('green_title')}</Text>
            </View>
            <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{t('green_tagline')}</Text>
          </View>

          <View style={{ padding: 16 }}>

            {/* ── WHAT YOU CAN JOIN ───────────────────────────────────
                "وجهة green minds معقده جدا — What I can join". It used
                to open on a code of conduct, a quiz, seven country
                chips and a list of ideas, with the things you could
                actually go to somewhere in the middle. Now the first
                thing is the week: day by day, each with a Join button,
                and everything else is one tap away underneath. */}

            {rows === null ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 24 }} />
            ) : rows.length === 0 ? (
              <View style={{ borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: 18, padding: 20, marginBottom: 18, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', textAlign: 'center' }}>
                  {why === 'offline' ? t('lamma_conn_hint') : t('green_week_empty')}
                </Text>
              </View>
            ) : (
              <>
                {/* the days that have something on, and All */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 12 }}>
                  <Chip on={day === null} onPress={() => { tapLight(); setDay(null); }}>{t('green_all_week')}</Chip>
                  {days.map((d) => (
                    <Chip key={d.key} on={day === d.key} onPress={() => { tapLight(); setDay(d.key); }}>
                      {d.label}
                    </Chip>
                  ))}
                </ScrollView>

                {days.filter((d) => day === null || d.key === day).map((d) => (
                  <View key={d.key} style={{ marginBottom: 6 }}>
                    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>
                      {d.long.toUpperCase()}
                    </Text>
                    {d.items.map((g) => {
                      const look = lookOf(g.kind);
                      const mine = user && g.host_id === user.id;
                      return (
                        <View key={g.id} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Pressable onPress={() => setOpen(open === g.id ? null : g.id)} accessibilityRole="button" style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
                              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: look.from + '22', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 20 }}>{look.emoji}</Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                                <Text numberOfLines={1} style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{titleFor(g.title, lang)}</Text>
                                <Text numberOfLines={1} style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>
                                  {[hour(g.starts_at, lang), g.place_name || g.city].filter(Boolean).join(' · ')}
                                </Text>
                                <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>
                                  {[g.going + ' ' + t('green_going'), g.weekly_id ? t('green_every_week') : null, mine ? t('green_hosting') : null].filter(Boolean).join(' · ')}
                                </Text>
                              </View>
                            </Pressable>
                            {mine ? (
                              <Pressable onPress={() => { tapLight(); setManage(g); setConfirmOff(false); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('green_manage')}
                                style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginStart: 10 }}>
                                <Ionicons name="ellipsis-horizontal" size={18} color={C.text} />
                              </Pressable>
                            ) : (
                              <Pressable onPress={() => going(g, !g.im_going)} accessibilityRole="button" style={{ marginStart: 10 }}>
                                <View style={{ backgroundColor: g.im_going ? 'transparent' : GREEN, borderWidth: g.im_going ? 1 : 0, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                                  <Text style={{ color: g.im_going ? C.text : '#FFF', fontSize: 13, fontWeight: '800' }}>
                                    {g.im_going ? '✓ ' + t('green_joined') : t('green_join')}
                                  </Text>
                                </View>
                              </Pressable>
                            )}
                          </View>
                          {open === g.id && g.about ? (
                            <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 10 }}>{g.about}</Text>
                          ) : null}
                          {sent && sent.id === g.id ? (
                            <Text style={{ color: GREEN, fontSize: 12, fontWeight: '800', marginTop: 8 }}>{t('green_sent_to')} {sent.n}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </>
            )}

            {/* ── AND THE REST, ONE TAP AWAY ──────────────────────── */}
            <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 14 }}>
              {[
                { key: 'start', icon: 'plus', label: t('green_start_short'), on: () => startFrom(null) },
                { key: 'ideas', icon: 'lightbulb-on-outline', label: t('green_ideas_btn'), on: () => setMore(more === 'ideas' ? null : 'ideas') },
                { key: 'how', icon: 'hand-heart-outline', label: t('green_how'), on: () => setMore(more === 'how' ? null : 'how') },
              ].map((b, i) => (
                <Pressable key={b.key} onPress={() => { tapLight(); b.on(); }} style={{ flex: 1, marginStart: i ? 8 : 0 }}>
                  <View style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1,
                    borderColor: more === b.key ? GREEN : C.line, backgroundColor: more === b.key ? GREEN_SOFT : C.glass }}>
                    <MaterialCommunityIcons name={b.icon} size={20} color={GREEN} />
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: '900', marginTop: 4 }} numberOfLines={1}>{b.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {more === 'how' ? (
              <View style={{ backgroundColor: GREEN_SOFT, borderWidth: 1, borderColor: 'rgba(31,122,90,0.35)', borderRadius: 18, padding: 15, marginBottom: 14 }}>
                {['green_care_1', 'green_care_2', 'green_care_3', 'green_care_4'].map((k) => (
                  <View key={k} style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <Text style={{ color: GREEN, fontSize: 13, fontWeight: '900', marginEnd: 8 }}>·</Text>
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', lineHeight: 20, flex: 1, minWidth: 0 }}>{t(k)}</Text>
                  </View>
                ))}
                {onPlay ? (
                  <Pressable onPress={() => { tapLight(); onPlay(GREEN_PACK); }} style={{ marginTop: 6 }}>
                    <Text style={{ color: GREEN, fontSize: 13, fontWeight: '900' }}>{t('green_quiz')} ›</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {more === 'ideas' ? sparks.map((s) => {
              const k = kindOf(s.kind);
              return (
                <Pressable key={s.id} onPress={() => startFrom(s)}>
                  <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={k.icon} size={17} color={GREEN} />
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginStart: 9, flex: 1, minWidth: 0 }} numberOfLines={1}>
                      {sparkText(s, lang, 'title')}
                    </Text>
                    <Text style={{ color: GREEN, fontSize: 12, fontWeight: '900' }}>{t('green_start_one')}</Text>
                  </View>
                </Pressable>
              );
            }) : null}
          </View>
        </ScrollView>

        {/* ── HOSTING: invite everyone, or call it off — off the card ── */}
        {manage ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setManage(null)}>
            <Pressable onPress={() => setManage(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
              <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: insets.bottom + 18 }}>
                <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', marginBottom: 6 }} numberOfLines={1}>{titleFor(manage.title, lang)}</Text>
                {manage.announced_at ? (
                  <View style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={19} color={GREEN} />
                    <Text style={{ color: C.dim, fontSize: 16, fontWeight: '600', marginStart: 12 }}>{t('green_invited')}</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => { const g = manage; setManage(null); invite(g); }} accessibilityRole="button" style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="megaphone-outline" size={19} color={C.text} />
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginStart: 12 }}>{t('green_invite_all')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { if (!confirmOff) { tapLight(); setConfirmOff(true); return; } const g = manage; setManage(null); drop(g); }} accessibilityRole="button" style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="close-circle-outline" size={19} color={C.coral} />
                  <Text style={{ color: C.coral, fontSize: 16, fontWeight: '700', marginStart: 12 }}>{confirmOff ? t('green_call_off_sure') : t('green_call_off')}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}

        {/* ── STARTING ONE ── what, when, where (./StartForm.js) */}
        {form ? (
          <StartForm
            form={form} setForm={setForm} kinds={KINDS} busy={busy} t={t} lang={lang}
            places={formPlaces}
            onSubmit={submit}
            onClose={() => { tapLight(); closeForm(); }}
          />
        ) : null}
      </View>
    </Modal>
  );
};
