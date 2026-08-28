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
  listGatherings, listSparks, createGathering, joinGathering, cancelGathering, sparkText,
} from '../../services/green';
import { tapLight, tapMedium, tapSuccess } from '../../utils/feedback';
import { PLAY_LANGS } from '../lamma/languages';

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
];

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

export const GreenSheet = ({ onClose, onPlay }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [country, setCountry] = useState(null);
  const [rows, setRows] = useState(null);            // null = still asking
  const [sparks, setSparks] = useState([]);
  const [why, setWhy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);            // the new-gathering sheet

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

  const going = async (row, yes) => {
    tapMedium();
    const r = await joinGathering(row.id, yes);
    if (r && r.ok) load();
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
      startsAt: form.startsAt,
      minutes: form.minutes ? parseInt(form.minutes, 10) : null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      language: lang,
    });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setForm(null); load(); }
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
      kind: spark ? spark.kind : 'cleanup',
      title: spark ? sparkText(spark, lang, 'title') : '',
      about: spark ? sparkText(spark, lang, 'about') : '',
      country: (spark && spark.country) || country || 'EG',
      city: '', place: '',
      startsAt: soon.toISOString(),
      minutes: spark && spark.minutes ? String(spark.minutes) : '60',
      capacity: '',
    });
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

          <LinearGradient
            colors={['#0E3B2E', GREEN]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + 10, paddingBottom: 26, paddingHorizontal: 18,
                     borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          >
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </Pressable>
            <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '900', marginTop: 12 }}>{t('green_title')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginTop: 4 }}>
              {t('green_tagline')}
            </Text>
          </LinearGradient>

          <View style={{ padding: 16 }}>

            {/* ── THE CARE CODE ───────────────────────────────────── */}
            <View style={{
              backgroundColor: GREEN_SOFT, borderWidth: 1, borderColor: 'rgba(31,122,90,0.35)',
              borderRadius: 20, padding: 16, marginBottom: 20,
            }}>
              <Text style={{ color: GREEN, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 10 }}>
                {t('green_care')}
              </Text>
              {['green_care_1', 'green_care_2', 'green_care_3', 'green_care_4'].map((k) => (
                <View key={k} style={{ flexDirection: 'row', marginBottom: 7 }}>
                  <Text style={{ color: GREEN, fontSize: 13, fontWeight: '900', marginEnd: 8 }}>·</Text>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', lineHeight: 20, flex: 1, minWidth: 0 }}>
                    {t(k)}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── THE QUESTIONS THAT GO WITH IT ───────────────────────
                Turning up to a clean-up and knowing why a cigarette end
                matters are two different things, and this corner would
                be half a corner with only one of them. Sixteen
                questions, in the same five languages the rest of لمّة
                is played in — plastic and pollinators, but also what
                Erasmus is and what you do when somebody says something
                you disagree with.

                Offered, not insisted on. It sits above the listings
                because it is the one thing here that always works: the
                gatherings can be empty on a Tuesday, the quiz never
                is. */}
            {onPlay ? (
              <Pressable onPress={() => { tapLight(); onPlay(GREEN_PACK); }} style={{ marginBottom: 20 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                  borderRadius: 20, padding: 14,
                }}>
                  <View style={{
                    width: 42, height: 42, borderRadius: 14, backgroundColor: GREEN,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MaterialCommunityIcons name="head-lightbulb-outline" size={22} color="#FFF" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                    <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }} numberOfLines={1}>
                      {t('green_quiz')}
                    </Text>
                    <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3, lineHeight: 17 }} numberOfLines={2}>
                      {t('green_quiz_sub')}
                    </Text>
                    {/* Spaced, not run together. Flag emoji are pairs of
                        regional-indicator letters, and five pairs with
                        nothing between them get re-paired by the font
                        into flags of countries nobody named. The shelf
                        in لمّة joins them the same way, from the same
                        list. */}
                    <Text style={{ fontSize: 13, letterSpacing: 1, marginTop: 7 }} numberOfLines={1}>
                      {PLAY_LANGS.map((l) => l.flag).join(' ')}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={lang === 'ar' ? 'chevron-left' : 'chevron-right'}
                    size={22} color={C.faint} style={{ marginStart: 6 }} />
                </View>
              </Pressable>
            ) : null}

            {/* where */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
              {PLACES.map((p) => (
                <Chip key={p.code || 'all'} on={country === p.code} onPress={() => { tapLight(); setCountry(p.code); }}>
                  {p.flag + (p.code ? ' ' + p.code : ' ' + t('green_everywhere'))}
                </Chip>
              ))}
            </View>

            {/* ── WHAT IS ACTUALLY ON ─────────────────────────────── */}
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 10 }}>
              {t('green_whats_on')}
            </Text>

            {rows === null ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 20 }} />
            ) : rows.length === 0 ? (
              <View style={{
                borderWidth: 1, borderColor: C.line, borderStyle: 'dashed',
                borderRadius: 18, padding: 20, marginBottom: 22, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 26 }}>🌱</Text>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 8, textAlign: 'center' }}>
                  {why === 'offline' ? t('lamma_conn_hint') : t('green_none')}
                </Text>
              </View>
            ) : (
              rows.map((g) => {
                const k = kindOf(g.kind);
                const mine = user && g.host_id === user.id;
                return (
                  <View key={g.id} style={{
                    backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                    borderRadius: 20, padding: 15, marginBottom: 12,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 38, height: 38, borderRadius: 13, backgroundColor: GREEN_SOFT,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <MaterialCommunityIcons name={k.icon} size={20} color={GREEN} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                        <Text numberOfLines={2} style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{g.title}</Text>
                        <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 3 }}>
                          {when(g.starts_at, lang)}{g.city ? ' · ' + g.city : ''}
                        </Text>
                      </View>
                    </View>

                    {g.about ? (
                      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 10 }}>{g.about}</Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                      <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800', flex: 1, minWidth: 0 }}>
                        {g.going} {t('green_going')}
                        {g.host_name ? ' · ' + t('green_by') + ' ' + g.host_name : ''}
                      </Text>
                      {mine ? (
                        <Pressable onPress={() => drop(g)} hitSlop={8}>
                          <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '900' }}>{t('green_call_off')}</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => going(g, !g.im_going)}>
                          <View style={{
                            backgroundColor: g.im_going ? C.glassHi : GREEN,
                            borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8,
                          }}>
                            <Text style={{ color: g.im_going ? C.text : '#FFF', fontSize: 12.5, fontWeight: '900' }}>
                              {g.im_going ? t('green_not_coming') : t('green_coming')}
                            </Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* ── IDEAS, CALLED IDEAS ─────────────────────────────── */}
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 14, marginBottom: 4 }}>
              {t('green_ideas')}
            </Text>
            <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginBottom: 12 }}>
              {t('green_ideas_sub')}
            </Text>

            {sparks.map((s) => {
              const k = kindOf(s.kind);
              return (
                <Pressable key={s.id} onPress={() => startFrom(s)}>
                  <View style={{
                    backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                    borderRadius: 18, padding: 14, marginBottom: 10,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name={k.icon} size={17} color={GREEN} />
                      <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginStart: 9, flex: 1, minWidth: 0 }}>
                        {sparkText(s, lang, 'title')}
                      </Text>
                      {s.country ? <Text style={{ fontSize: 13 }}>
                        {(PLACES.find((p) => p.code === s.country) || {}).flag || ''}
                      </Text> : null}
                    </View>
                    <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                      {sparkText(s, lang, 'about')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700', flex: 1, minWidth: 0 }}>
                        {s.minutes ? s.minutes + ' ' + t('green_minutes') + ' · ' : ''}{s.people}
                      </Text>
                      <Text style={{ color: GREEN, fontSize: 12.5, fontWeight: '900' }}>{t('green_start_one')}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            <Pressable onPress={() => startFrom(null)} style={{ marginTop: 8 }}>
              <View style={{ backgroundColor: GREEN, borderRadius: 999, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('green_start_own')}</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── STARTING ONE ─────────────────────────────────────────── */}
        {form ? (
          <Modal visible transparent={false} animationType="slide" onRequestClose={() => setForm(null)}>
            <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
                <Pressable onPress={() => { tapLight(); setForm(null); }} hitSlop={10}>
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
                  {PLACES.filter((p) => p.code).map((p) => (
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
                      flex: 1, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
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
                      flex: 1, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
                      color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
                    }}
                  />
                </View>

                {form.err ? (
                  <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '800', marginTop: 12 }}>
                    {form.err === 'no_title' ? t('green_err_title')
                      : form.err === 'in_the_past' ? t('green_err_past')
                      : t('lamma_offline')}
                  </Text>
                ) : null}

                {/* agreed to here, where it is being started */}
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
