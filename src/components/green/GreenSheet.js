import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
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

const KINDS = [
  { id: 'cleanup', icon: 'broom',           key: 'green_kind_cleanup' },
  { id: 'circle',  icon: 'account-group',   key: 'green_kind_circle' },
  { id: 'art',     icon: 'palette-outline', key: 'green_kind_art' },
  { id: 'project', icon: 'sprout-outline',  key: 'green_kind_project' },
  { id: 'culture', icon: 'drama-masks',     key: 'green_kind_culture' },
  { id: 'walk',    icon: 'walk',            key: 'green_kind_walk' },
  { id: 'sport',   icon: 'soccer',          key: 'green_kind_sport' },
  { id: 'run',     icon: 'run',             key: 'gn_run' },
  { id: 'coffee',  icon: 'coffee-outline',  key: 'gn_coffee' },
  { id: 'focus',   icon: 'book-open-variant', key: 'gn_focus' },
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
      backgroundColor: on ? GREEN : C.glass,
      borderWidth: 1, borderColor: on ? GREEN : C.line,
      borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    }}>
      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13, fontWeight: '900' }}>{children}</Text>
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
      title: form.title,
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
    const soon = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    soon.setMinutes(0, 0, 0);
    setForm({
      kind: spark ? spark.kind : (prefill ? 'circle' : 'cleanup'),
      title: spark ? sparkText(spark, lang, 'title') : '',
      about: spark ? sparkText(spark, lang, 'about') : '',
      country: (spark && spark.country) || country || homeCountry || 'EG',
      city: '', place: (prefill && prefill.place) || '',
      lat: prefill ? prefill.lat : null, lng: prefill ? prefill.lng : null,
      startsAt: soon.toISOString(),
      minutes: spark && spark.minutes ? String(spark.minutes) : '60',
      capacity: '',
    });
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

          <LinearGradient
            colors={['#0E3B2E', GREEN]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + 10, paddingBottom: 26, paddingHorizontal: 18,
                     borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          >
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <GreenMark size={38} onDark />
              <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '900', marginStart: 10 }}>{t('green_title')}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginTop: 6 }}>
              {t('green_tagline')}
            </Text>
            {/* Our own line, in the spirit of the one Ayser liked on
                EcoQuest's post ("Enjoy your time and stay green") but
                not theirs — their words are their brand. */}
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', marginTop: 14, letterSpacing: 0.2 }}>
              {t('green_motto')}
            </Text>
          </LinearGradient>

          <View style={{ padding: 16 }}>

            {/* ── WHAT YOU CAN JOIN ───────────────────────────────────
                "وجهة green minds معقده جدا — What I can join". It used
                to open on a code of conduct, a quiz, seven country
                chips and a list of ideas, with the things you could
                actually go to somewhere in the middle. Now the first
                thing is the week: day by day, each with a Join button,
                and everything else is one tap away underneath. */}
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>{t('green_join_title')}</Text>

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
                      {d.label + '  ' + d.count}
                    </Chip>
                  ))}
                </ScrollView>

                {days.filter((d) => day === null || d.key === day).map((d) => (
                  <View key={d.key} style={{ marginBottom: 6 }}>
                    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>
                      {d.long.toUpperCase()}
                    </Text>
                    {d.items.map((g) => {
                      const k = kindOf(g.kind);
                      const mine = user && g.host_id === user.id;
                      return (
                        <View key={g.id} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 13, marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: GREEN_SOFT, alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialCommunityIcons name={k.icon} size={21} color={GREEN} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                              <Text numberOfLines={2} style={{ color: C.text, fontSize: 15, fontWeight: '900', lineHeight: 19 }}>{g.title}</Text>
                              <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 3 }}>
                                {hour(g.starts_at, lang)}{g.place_name ? ' · ' + g.place_name : g.city ? ' · ' + g.city : ''}
                              </Text>
                            </View>
                          </View>

                          {open === g.id && g.about ? (
                            <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 10 }}>{g.about}</Text>
                          ) : null}

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11 }}>
                            <Pressable onPress={() => setOpen(open === g.id ? null : g.id)} hitSlop={6} style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1}>
                                {g.going} {t('green_going')}
                                {g.weekly_id ? ' · ' + t('green_every_week') : ''}
                                {g.about ? '  ' + (open === g.id ? '▴' : '▾') : ''}
                              </Text>
                            </Pressable>
                            {mine ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {g.announced_at ? (
                                  <Text style={{ color: GREEN, fontSize: 12.5, fontWeight: '900', marginEnd: 12 }}>{t('green_invited')}</Text>
                                ) : (
                                  <Pressable onPress={() => invite(g)} hitSlop={6} style={{ marginEnd: 12 }}>
                                    <View style={{ backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('green_invite_all')}</Text>
                                    </View>
                                  </Pressable>
                                )}
                                <Pressable onPress={() => drop(g)} hitSlop={8}>
                                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900' }}>{t('green_call_off')}</Text>
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable onPress={() => going(g, !g.im_going)}>
                                <View style={{ backgroundColor: g.im_going ? C.glassHi : GREEN, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
                                  <Text style={{ color: g.im_going ? C.text : '#FFF', fontSize: 13, fontWeight: '900' }}>
                                    {g.im_going ? '✓ ' + t('green_joined') : t('green_join')}
                                  </Text>
                                </View>
                              </Pressable>
                            )}
                          </View>
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

        {/* ── STARTING ONE ─────────────────────────────────────────── */}
        {form ? (
          <Modal visible transparent={false} animationType="slide" onRequestClose={closeForm}>
            <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
                <Pressable onPress={() => { tapLight(); closeForm(); }} hitSlop={10}>
                  <Ionicons name="close" size={25} color={C.text} />
                </Pressable>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 12 }}>{t('green_start_own')}</Text>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                  {KINDS.map((k) => (
                    <Chip key={k.id} on={form.kind === k.id} onPress={() => setForm((f) => ({ ...f, kind: k.id }))}>
                      {t(k.key)}
                    </Chip>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                  {(homeCountry && !PLACES.some((p) => p.code === homeCountry)
                    ? [{ code: homeCountry, flag: flagOf(homeCountry) }, ...PLACES.filter((p) => p.code)]
                    : PLACES.filter((p) => p.code)).map((p) => (
                    <Chip key={p.code} on={form.country === p.code} onPress={() => setForm((f) => ({ ...f, country: p.code }))}>
                      {p.flag + ' ' + p.code}
                    </Chip>
                  ))}
                </View>

                {[
                  ['title', 'green_ph_title', false],
                  ['about', 'green_ph_about', true],
                  ['city', 'green_ph_city', false],
                  ['place', 'green_ph_place', false],
                ].map(([field, ph, multi]) => (
                  <TextInput
                    key={field}
                    placeholder={t(ph)}
                    placeholderTextColor={C.faint}
                    value={form[field]}
                    onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
                    multiline={multi}
                    style={{
                      backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
                      color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
                      marginBottom: 10, minHeight: multi ? 84 : 0, textAlignVertical: multi ? 'top' : 'center',
                    }}
                  />
                ))}

                {/* when: a plain local datetime, because a wheel picker
                    that behaves differently on every browser is worse
                    than a field somebody can read back to themselves */}
                <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>
                  {t('green_when')}
                </Text>
                <TextInput
                  value={String(form.startsAt || '').slice(0, 16).replace('T', ' ')}
                  onChangeText={(v) => {
                    const iso = v.trim().replace(' ', 'T');
                    setForm((f) => ({ ...f, startsAt: iso.length >= 16 ? new Date(iso).toISOString() : f.startsAt }));
                  }}
                  placeholder="YYYY-MM-DD HH:MM"
                  placeholderTextColor={C.faint}
                  style={{
                    backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
                    color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10,
                  }}
                />

                <View style={{ flexDirection: 'row' }}>
                  <TextInput
                    placeholder={t('green_minutes')}
                    placeholderTextColor={C.faint}
                    value={form.minutes}
                    onChangeText={(v) => setForm((f) => ({ ...f, minutes: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    style={{
                      flex: 1, minWidth: 0, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
                      color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginEnd: 10,
                    }}
                  />
                  <TextInput
                    placeholder={t('green_cap')}
                    placeholderTextColor={C.faint}
                    value={form.capacity}
                    onChangeText={(v) => setForm((f) => ({ ...f, capacity: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    style={{
                      flex: 1, minWidth: 0, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
                      color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
                    }}
                  />
                </View>

                {form.err ? (
                  <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '800', marginTop: 12 }}>
                    {form.err === 'no_title' ? t('green_err_title')
                      : form.err === 'in_the_past' ? t('green_err_past')
                      : form.err === 'need_unlock' ? t('vc_why_big')
                      : t('lamma_offline')}
                  </Text>
                ) : null}

                {/* agreed to here, where it is being started — and shown
                    here, so "the care code above" is above */}
                <View style={{ backgroundColor: GREEN_SOFT, borderRadius: 16, padding: 13, marginTop: 16 }}>
                  {['green_care_1', 'green_care_2', 'green_care_3', 'green_care_4'].map((k) => (
                    <Text key={k} style={{ color: C.text, fontSize: 12.5, fontWeight: '700', lineHeight: 18, marginBottom: 3 }}>{'· ' + t(k)}</Text>
                  ))}
                </View>
                <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 16 }}>
                  {t('green_agree')}
                </Text>

                <Pressable onPress={submit} disabled={busy} style={{ marginTop: 14 }}>
                  <View style={{ backgroundColor: GREEN, borderRadius: 999, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('green_publish')}</Text>
                  </View>
                </Pressable>
              </ScrollView>
            </View>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
};
