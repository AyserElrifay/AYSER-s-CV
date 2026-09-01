import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Linking, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { COUNTRY_ROOMS } from '../constants/countryRoom';
import { flagOf } from '../constants/countries';
import { fetchFilms } from '../services/films';
import { tapLight } from '../utils/feedback';

/* ─── THE COUNTRY ROOM ───────────────────────────────────────────────
   One country at a time: the words you will need in your first week,
   what people eat, what nobody writes down, and what to watch and
   listen to. Why it is shaped like this and not like a language
   course is written at the top of constants/countryRoom.js.

   ── HOW THE FILMS GET HERE ────────────────────────────────────────
   From our own real catalogue, filtered by the language the film is
   in — not a list I typed out. That matters: a hand-typed list of
   films is a list of films I believe exist, and belief is not good
   enough on a screen somebody trusts. If the catalogue has nothing in
   Czech, this says so rather than inventing a Czech film.

   ── AND WHY THE MUSIC IS ONLY A SEARCH ────────────────────────────
   Because we are not allowed to play it and will not pretend to. Every
   one of these is a real artist with a line saying why they matter,
   and the button opens a real search on a real service. We host
   nothing, cache nothing and stream nothing. The alternative — a play
   button that plays somebody's record — is the copyright problem this
   app has refused from the first day.                                */

const openUrl = (url) => {
  tapLight();
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url);
    }
  } catch (e) { /* a link that will not open is not worth a crash */ }
};

const GROUPS = ['first', 'eat', 'go', 'help'];

const Label = ({ children, style }) => (
  <Text style={[{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }, style]}>
    {children}
  </Text>
);

const Card = ({ children, style }) => (
  <View style={[{
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
    borderRadius: 14, padding: 13, marginBottom: 9,
  }, style]}>
    {children}
  </View>
);

/* One phrase. The native line is the big one because that is the line
   you point at when your mouth fails you — which is most of the time
   in week one, and is a completely respectable way to use this. */
const Phrase = ({ p, ar }) => (
  <Card>
    <Text style={{ color: C.text, fontSize: 17, fontWeight: '800' }}>{p.native}</Text>
    <Text style={{ color: C.gold, fontSize: 12.5, marginTop: 3 }}>{p.how}</Text>
    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 5, lineHeight: 18 }}>{ar ? p.ar : p.en}</Text>
  </Card>
);

const Dish = ({ d, ar }) => (
  <Card>
    <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{ar ? (d.nameAr || d.name) : d.name}</Text>
    {ar && d.nameAr ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{d.name}</Text> : null}
    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6, lineHeight: 19 }}>{ar ? (d.whatAr || d.what) : d.what}</Text>
  </Card>
);

const Custom = ({ k, ar }) => (
  <Card>
    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', lineHeight: 20 }}>{ar ? (k.titleAr || k.title) : k.title}</Text>
    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6, lineHeight: 19 }}>{ar ? (k.bodyAr || k.body) : k.body}</Text>
  </Card>
);

export const CountrySheet = ({ startCode, onClose }) => {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const [code, setCode] = useState(
    () => (COUNTRY_ROOMS.some((c) => c.code === startCode) ? startCode : COUNTRY_ROOMS[0].code)
  );
  const [tab, setTab] = useState('say');
  const room = useMemo(() => COUNTRY_ROOMS.find((c) => c.code === code) || COUNTRY_ROOMS[0], [code]);

  /* Films are only fetched when somebody actually opens that tab, and
     only once per country — this room is mostly read offline material
     and should not spend a request to show words. */
  const [films, setFilms] = useState(null);
  useEffect(() => { setFilms(null); }, [code]);
  useEffect(() => {
    if (tab !== 'watch' || films !== null) return;
    let alive = true;
    fetchFilms({ language: room.filmLang, limit: 12 })
      .then((rows) => alive && setFilms(rows || []))
      .catch(() => alive && setFilms([]));
    return () => { alive = false; };
  }, [tab, code, films, room.filmLang]);

  const TABS = [
    { k: 'say',   label: t('country_tab_say') },
    { k: 'eat',   label: t('country_tab_eat') },
    { k: 'know',  label: t('country_tab_know') },
    { k: 'watch', label: t('country_tab_watch') },
  ];

  return (
    <Pressable
      onPress={onClose}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', zIndex: 34 }}>
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingBottom: insets.bottom + 20, maxHeight: '92%',
        }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 10 }} />

        {/* which country — flags, because a person scanning for Greece
            finds the flag before they finish reading the word */}
        {/* flexShrink: 0 is doing real work here. This strip sits in a
            column with a max height, next to a ScrollView that wants
            all the room there is — without it the picker was squeezed
            to a four-pixel sliver and you could see the tops of the
            flags and nothing else. */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 2 }}>
          {COUNTRY_ROOMS.map((c) => {
            const on = c.code === code;
            return (
              <Pressable key={c.code} onPress={() => { tapLight(); setCode(c.code); setTab('say'); }}>
                <View style={{
                  paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12, marginEnd: 8,
                  backgroundColor: on ? C.text : 'transparent',
                  borderWidth: 1, borderColor: on ? C.text : C.line, flexDirection: 'row', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 15, marginEnd: 6 }}>{flagOf(c.code)}</Text>
                  <Text style={{ color: on ? C.bg : C.dim, fontSize: 12.5, fontWeight: '800' }}>
                    {ar ? c.nameAr : c.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>
            {ar ? room.nameAr : room.name} {flagOf(room.code)}
          </Text>
          <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 2 }}>
            {ar ? room.langAr : room.lang}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
            {TABS.map((x) => {
              const on = x.k === tab;
              return (
                <Pressable key={x.k} onPress={() => { tapLight(); setTab(x.k); }}
                  style={{ marginEnd: 16, paddingBottom: 7, borderBottomWidth: 2, borderBottomColor: on ? C.gold : 'transparent' }}>
                  <Text style={{ color: on ? C.text : C.faint, fontSize: 13.5, fontWeight: '800' }}>{x.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
          {tab === 'say' ? (
            <>
              {GROUPS.map((g) => {
                const rows = room.say.filter((p) => p.g === g);
                if (!rows.length) return null;
                return (
                  <View key={g} style={{ marginBottom: 10 }}>
                    <Label>{t('country_g_' + g)}</Label>
                    {rows.map((p, i) => <Phrase key={g + i} p={p} ar={ar} />)}
                  </View>
                );
              })}
              <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginTop: 4 }}>
                {t('country_how_note')}
              </Text>
            </>
          ) : null}

          {tab === 'eat' ? room.eat.map((d, i) => <Dish key={i} d={d} ar={ar} />) : null}
          {tab === 'know' ? room.know.map((k, i) => <Custom key={i} k={k} ar={ar} />) : null}

          {tab === 'watch' ? (
            <>
              <Label>{t('country_films').replace('{lang}', ar ? room.langAr : room.lang)}</Label>
              {films === null ? (
                <ActivityIndicator color={C.gold} style={{ marginVertical: 18 }} />
              ) : films.length === 0 ? (
                <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginBottom: 18 }}>
                  {t('country_films_none')}
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {films.map((f) => (
                    <View key={f.id} style={{ width: 110, marginEnd: 10 }}>
                      {f.poster_url ? (
                        <Image source={{ uri: f.poster_url }} style={{ width: 110, height: 165, borderRadius: 10, backgroundColor: C.glass }} />
                      ) : (
                        <View style={{ width: 110, height: 165, borderRadius: 10, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }} />
                      )}
                      <Text numberOfLines={2} style={{ color: C.text, fontSize: 12, fontWeight: '800', marginTop: 6 }}>{f.title}</Text>
                      {f.year ? <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>{f.year}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              )}

              <Label>{t('country_music')}</Label>
              {room.hear.map((h, i) => (
                <Pressable key={i} onPress={() => openUrl(
                  'https://www.youtube.com/results?search_query=' +
                  encodeURIComponent(h.artist + ' ' + (h.title && h.title !== 'Anything of hers' && h.title !== 'Anything of his' && h.title !== 'Anything of theirs' ? h.title : ''))
                )}>
                  <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{h.artist}</Text>
                        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                          {h.title}{h.year ? ' · ' + h.year : ''}
                        </Text>
                      </View>
                      <Ionicons name="open-outline" size={17} color={C.faint} />
                    </View>
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 7, lineHeight: 19 }}>{ar ? (h.whyAr || h.why) : h.why}</Text>
                  </Card>
                </Pressable>
              ))}
              <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginTop: 4 }}>
                {t('country_hear_note')}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
