import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Linking, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { COUNTRY_ROOMS } from '../constants/countryRoom';
import { COUNTRY_STORIES, LEARN_PROPERLY, hasStory } from '../constants/countryStory';
import { withAffiliate } from '../services/broker';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../services/profiles';
import { fetchSpeakersOf } from '../services/discover';
import { flagOf } from '../constants/countries';
import { fetchFilms } from '../services/films';
import { tapLight } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { CountryFly } from './CountryFly';
import { WORLD } from '../constants/worldGeo';
import { PLACES } from './worldCulture';

/* ── ONE COUNTRY, ONE PAGE ── Ayser: "حد يفتح بروفيل دولة كامل من غير ما
   يقعد يلف في الأبلكيشن". Heritage used to be a room of its own, two taps
   away; now each place's monument and its custom sit inside its
   country, under Know. The three places that have no country room yet
   (Jordan, India, Japan) still get their page — the map and the
   heritage — rather than disappearing. */
const PLACE_CODE = { Egypt: 'EG', Jordan: 'JO', Morocco: 'MA', Italy: 'IT', India: 'IN', Japan: 'JP' };
const heritageOf = (code) => PLACES.find((p) => PLACE_CODE[p.country] === code) || null;
const ROOMS = COUNTRY_ROOMS.concat(PLACES
  .filter((p) => PLACE_CODE[p.country] && !COUNTRY_ROOMS.some((c) => c.code === PLACE_CODE[p.country]))
  .map((p) => ({ code: PLACE_CODE[p.country], name: p.country, nameAr: p.countryAr, lang: '', langAr: '', say: [], warm: [], eat: [], know: [], hear: [], hello: null, heritageOnly: true })));

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

/* ── THE FIRST WORD, AND WHAT IT ACTUALLY MEANS ──────────────────────
   Ayser: "حجات بسيطه هالو و معنها اي واصلها باي للغه".

   He is right that this is the thing people want, and it is also the
   thing that makes somebody remember the word. "Ahoj" is a fact you
   forget by lunchtime. "Ahoj is the sailors' hail, and the Czechs are
   landlocked and enjoy that about themselves" is a thing you tell
   somebody else that evening — and now you know the word for good.

   Where the origin is disputed the line says "said to have", because
   half of these are folk etymologies that people repeat, and passing
   one off as settled fact is the same failure as inventing a price. */
const Greeting = ({ h, ar, t }) => {
  // the word and how to say it, always; the story behind it on a tap
  const [open, setOpen] = useState(false);
  if (!h) return null;
  return (
    <Pressable onPress={() => { tapLight(); setOpen((o) => !o); }} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ outlineStyle: 'none' }}>
      <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.gold, borderRadius: 18, padding: 15, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>{t('country_hello')}</Text>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginTop: 4 }}>{h.native}</Text>
            <Text style={{ color: C.gold, fontSize: 13.5, fontWeight: '700', marginTop: 1 }}>{h.how}</Text>
          </View>
          {h.bye ? (
            <View style={{ alignItems: 'flex-end', marginStart: 10, maxWidth: '45%' }}>
              <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, textAlign: 'right' }} numberOfLines={1}>{t('country_bye')}</Text>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 4 }}>{h.bye.native}</Text>
              <Text style={{ color: C.gold, fontSize: 12, marginTop: 1 }}>{h.bye.how}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: C.dim, fontSize: 13, marginTop: 10, lineHeight: 19 }} numberOfLines={open ? undefined : 1}>
          {ar ? (h.meansAr || h.means) : h.means}
        </Text>
        {open && h.bye ? (
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 8, lineHeight: 19 }}>{ar ? (h.bye.meansAr || h.bye.means) : h.bye.means}</Text>
        ) : null}
      </View>
    </Pressable>
  );
};

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

/* ── ONE IDEA A CARD ── the name first, on the left, where the eye
   starts (people read a screen in an F: across the top, down the left);
   two lines of the rest, and a tap for the whole of it. Nobody has to
   wade through a paragraph to find the one thing they came for. */
const Fold = ({ title, sub, body }) => {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => { tapLight(); setOpen((o) => !o); }} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ outlineStyle: 'none' }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', lineHeight: 21 }}>{title}</Text>
            {sub ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{sub}</Text> : null}
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.faint} style={{ marginStart: 8, marginTop: 3 }} />
        </View>
        <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 6, lineHeight: 20 }} numberOfLines={open ? undefined : 2}>{body}</Text>
      </Card>
    </Pressable>
  );
};
const Dish = ({ d, ar }) => <Fold title={ar ? (d.nameAr || d.name) : d.name} sub={ar && d.nameAr ? d.name : null} body={ar ? (d.whatAr || d.what) : d.what} />;
const Custom = ({ k, ar }) => <Fold title={ar ? (k.titleAr || k.title) : k.title} body={ar ? (k.bodyAr || k.body) : k.body} />;

/* the monument and the custom, as one card: the place's own colours in
   a thin band, the name first, the custom on a tap */
const HeritageCard = ({ h, ar, t, startOpen }) => {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <Pressable onPress={() => { tapLight(); setOpen((o) => !o); }} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ outlineStyle: 'none' }}>
      <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, marginBottom: 12 }}>
        <View style={{ height: 6, flexDirection: 'row' }}>{h.sky.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}</View>
        <View style={{ padding: 14 }}>
          <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>{t('culture_title').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{ar ? (h.siteAr || h.site) : h.site}</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>{ar ? (h.cityAr || h.city) : h.city}</Text>
            </View>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.faint} style={{ marginStart: 8, marginTop: 3 }} />
          </View>
          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 8 }} numberOfLines={open ? undefined : 2}>{ar ? (h.factAr || h.fact) : h.fact}</Text>
          {open ? (
            <>
              <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '900', letterSpacing: 1, marginTop: 12 }}>{t('culture_the_custom')}</Text>
              <Text style={{ color: C.text, fontSize: 14, lineHeight: 21, marginTop: 4 }}>{ar ? (h.customAr || h.custom) : h.custom}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

/* ── THE DECK ── the phrases as cards you flip: the word first, and you
   try to remember what it means before you tap. Recalling beats
   re-reading (it is how flash cards work, and why), and one card at a
   time is something a tired or scattered mind can still do. */
const FlipCard = ({ p, ar, w }) => {
  const [back, setBack] = useState(false);
  return (
    <Pressable onPress={() => { tapLight(); setBack((b) => !b); }} accessibilityRole="button" accessibilityHint="flip" style={{ width: w, marginEnd: 10, outlineStyle: 'none' }}>
      <View style={{ height: 150, borderRadius: 20, padding: 16, justifyContent: 'space-between', backgroundColor: back ? C.text : C.glass, borderWidth: 1, borderColor: back ? C.text : C.line }}>
        {!back ? (
          <>
            <View>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', lineHeight: 28 }} numberOfLines={2}>{p.native}</Text>
              <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{p.how}</Text>
            </View>
            <Ionicons name="sync-outline" size={16} color={C.faint} />
          </>
        ) : (
          <>
            <Text style={{ color: C.bg, fontSize: 19, fontWeight: '900', lineHeight: 25 }} numberOfLines={3}>{ar ? p.ar : p.en}</Text>
            {p.when ? <Text style={{ color: C.bg, opacity: 0.7, fontSize: 12.5 }} numberOfLines={2}>{'\u2192 ' + (ar ? (p.whenAr || p.when) : p.when)}</Text> : <Text style={{ color: C.bg, opacity: 0.6, fontSize: 12.5 }} numberOfLines={1}>{p.native}</Text>}
          </>
        )}
      </View>
    </Pressable>
  );
};



/* ─── THE SCENE ──────────────────────────────────────────────────────
   One moment at a time, three ways to answer it, and every answer
   teaches — including the wrong ones, which say what would actually
   have happened rather than the word "wrong". That is the difference
   between a story and a quiz, and it is the whole reason this format
   is worth having: nobody remembers being marked, everybody remembers
   being told what the waiter would have done.

   Nothing here is scored and nothing is locked. You can read every
   outcome of every choice — the point is to know the room before you
   are standing in it, not to win. */
const Scene = ({ scene, ar, t }) => {
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);
  const beat = scene.beats[at];
  const done = at >= scene.beats.length;

  const choose = (i) => { tapLight(); setPicked(i); };
  const next = () => { tapLight(); setPicked(null); setAt(at + 1); };

  return (
    <View>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>
        {ar ? (scene.titleAr || scene.title) : scene.title}
      </Text>
      <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 4, marginBottom: 16, lineHeight: 18, fontStyle: 'italic' }}>
        {ar ? (scene.setAr || scene.set) : scene.set}
      </Text>

      {done ? (
        <Card style={{ borderColor: C.gold }}>
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', lineHeight: 21 }}>
            {ar ? (scene.endAr || scene.end) : scene.end}
          </Text>
          <Pressable onPress={() => { tapLight(); setAt(0); setPicked(null); }} style={{ marginTop: 12 }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: '800' }}>{t('story_again')}</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
            {String(at + 1)} / {String(scene.beats.length)}
          </Text>
          <Text style={{ color: C.text, fontSize: 15, lineHeight: 23, marginBottom: 14 }}>
            {ar ? (beat.textAr || beat.text) : beat.text}
          </Text>
          <Text style={{ color: C.gold, fontSize: 13.5, fontWeight: '800', marginBottom: 10 }}>
            {ar ? (beat.askAr || beat.ask) : beat.ask}
          </Text>

          {beat.options.map((o, i) => {
            const open = picked === i;
            return (
              <Pressable key={i} onPress={() => choose(i)}>
                <View style={{
                  backgroundColor: C.glass, borderRadius: 14, padding: 13, marginBottom: 9,
                  borderWidth: 1,
                  borderColor: !open ? C.line : o.right ? C.green : C.gold,
                }}>
                  {/* A real phrase stays in its own language — that is the
                      point of it. But an option in brackets is an ACTION,
                      not a phrase, and an Arabic reader was being shown
                      "(send it back)" in English with no way to read it. */}
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>
                    {ar ? (o.nativeAr || o.native) : o.native}
                  </Text>
                  {o.how ? <Text style={{ color: C.gold, fontSize: 12, marginTop: 3 }}>{o.how}</Text> : null}
                  {open ? (
                    <Text style={{
                      color: C.dim, fontSize: 12.5, marginTop: 9, lineHeight: 19,
                      borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9,
                    }}>
                      {ar ? (o.thenAr || o.then) : o.then}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          {picked != null ? (
            <Pressable onPress={next}>
              <View style={{ backgroundColor: C.text, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: C.bg, fontSize: 13.5, fontWeight: '900' }}>{t('story_next')}</Text>
              </View>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
};


/* ─── AND SOMEBODY TO SAY IT TO ──────────────────────────────────────
   Ayser: "ذائد شات مع الأجانب".

   The exchange itself already existed and works — it is in Chats, it
   is the HelloTalk shape, and people can switch it on there. What it
   never had was the moment it is wanted. Nobody opens a Chats screen
   thinking "I would like to practise Czech". They think it three
   seconds after reading twelve Czech phrases, which is here.

   So the room does two small things the exchange screen cannot: it
   fills in the language for you — the field is free text and "Czech",
   "czech" and "Czech / English" were three different people to an
   exact match — and it shows you, right now, who actually speaks it.

   It shows real accounts or it shows nothing. An empty list is a
   truthful answer and an invented one is not. */
const TalkToSomeone = ({ room, ar, t }) => {
  const { user } = useAuth();
  const [mine, setMine] = useState(null);        // my profile, once
  const [people, setPeople] = useState(null);    // null = still asking
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) { setMine(undefined); return () => {}; }
    getProfile(user.id).then((p) => alive && setMine(p || undefined)).catch(() => alive && setMine(undefined));
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    let alive = true;
    setPeople(null);
    fetchSpeakersOf(room.lang, { excludeId: user && user.id })
      .then((r) => alive && setPeople(r || []))
      .catch(() => alive && setPeople([]));
    return () => { alive = false; };
  }, [room.lang, user]);

  const learning = !!(mine && String(mine.learning_language || '').toLowerCase().includes(room.lang.toLowerCase()));

  const toggle = async () => {
    if (!user || busy) return;
    tapLight();
    setBusy(true);
    try {
      const next = learning ? '' : room.lang;
      await updateProfile(user.id, {
        learning_language: next || null,
        learning_visible: next ? true : (mine && mine.learning_visible) || false,
      });
      setMine({ ...(mine || {}), learning_language: next, learning_visible: next ? true : (mine && mine.learning_visible) });
    } catch (e) { /* a failed save is not worth a crash on a reading screen */ }
    finally { setBusy(false); }
  };

  return (
    <View style={{ marginTop: 22 }}>
      <Label>{t('talk_title')}</Label>

      {user ? (
        <Pressable onPress={toggle}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 13, marginBottom: 10,
            backgroundColor: learning ? C.glass : 'transparent',
            borderWidth: 1, borderColor: learning ? C.gold : C.line,
          }}>
            <Ionicons name={learning ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={learning ? C.gold : C.faint} />
            <Text style={{ color: learning ? C.text : C.dim, fontSize: 13.5, fontWeight: '800', marginStart: 10, flex: 1 }}>
              {t('talk_im_learning').replace('{lang}', ar ? room.langAr : room.lang)}
            </Text>
            {busy ? <ActivityIndicator color={C.faint} /> : null}
          </View>
        </Pressable>
      ) : null}

      {people === null ? (
        <ActivityIndicator color={C.faint} style={{ marginVertical: 14 }} />
      ) : people.length === 0 ? (
        <Text style={{ color: C.faint, fontSize: 12, lineHeight: 18 }}>
          {t('talk_nobody').replace('{lang}', ar ? room.langAr : room.lang)}
        </Text>
      ) : (
        <>
          <Text style={{ color: C.faint, fontSize: 11.5, marginBottom: 9 }}>
            {t('talk_count').replace('{n}', String(people.length)).replace('{lang}', ar ? room.langAr : room.lang)}
          </Text>
          {people.slice(0, 6).map((pr) => (
            <Card key={pr.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                    {pr.country_flag ? pr.country_flag + ' ' : ''}{pr.name}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                    {[pr.speaks_language ? '🗣️ ' + pr.speaks_language : null,
                      pr.learning_language ? '📗 ' + pr.learning_language : null]
                      .filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      )}
      <Text style={{ color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 6 }}>
        {t('talk_note')}
      </Text>
    </View>
  );
};

/* The honest end of the room. We do not teach a course, we say so, and
   we point at people who do — and are paid for the introduction, which
   is a business we are allowed to be in. A reshaped copy of somebody's
   lessons is not. */
const LearnProperly = ({ ar, t }) => (
  <View style={{ marginTop: 22 }}>
    <Label>{t('learn_properly')}</Label>
    <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginBottom: 10 }}>
      {t('learn_properly_note')}
    </Text>
    {LEARN_PROPERLY.map((x) => (
      <Pressable key={x.partner} onPress={() => openUrl(withAffiliate(x.partner, x.url))}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 19, marginEnd: 11 }}>{x.emoji}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{x.name}</Text>
              <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
                {ar ? (x.noteAr || x.note) : x.note}
              </Text>
            </View>
            <Ionicons name="open-outline" size={17} color={C.faint} />
          </View>
        </Card>
      </Pressable>
    ))}
  </View>
);

export const CountrySheet = ({ startCode, onClose }) => {
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const [code, setCode] = useState(
    () => (ROOMS.some((c) => c.code === startCode) ? startCode : ROOMS[0].code)
  );
  const [tab, setTab] = useState('say');
  const room = useMemo(() => ROOMS.find((c) => c.code === code) || ROOMS[0], [code]);

  /* "اكتب باللغات الي user عايز يتعلمها" — the room cannot write in a
     language it does not know you want. It knows now: whatever you set
     as the language you are learning comes first in the picker, so the
     room opens on your language instead of on whichever country I
     happened to type first. */
  const { user: me } = useAuth();
  const [myLearning, setMyLearning] = useState('');
  useEffect(() => {
    let alive = true;
    if (!me) return () => {};
    getProfile(me.id).then((p) => alive && setMyLearning((p && p.learning_language) || '')).catch(() => {});
    return () => { alive = false; };
  }, [me]);
  const ordered = useMemo(() => {
    const want = String(myLearning || '').toLowerCase();
    // the country you are in comes first, so the page you need is the first one
    const here = (c) => (c.code === startCode ? 1 : 0);
    if (!want) return [...ROOMS].sort((a, b) => here(b) - here(a));
    const hit = (c) => !!c.lang && (want.includes(c.lang.toLowerCase()) || c.lang.toLowerCase().includes(want));
    return [...ROOMS].sort((a, b) => here(b) - here(a) || (hit(b) ? 1 : 0) - (hit(a) ? 1 : 0));
  }, [myLearning, startCode]);
  /* Not every country has a scene yet, so the tab is not always there.
     Switching from one that has it to one that does not would have left
     you looking at a tab that no longer exists, and an empty screen. */
  const [allOpen, setAllOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  useEffect(() => { setAllOpen(false); setSceneOpen(false); }, [code]);
  // where it is, for the map: the label point of the country
  const spot = useMemo(() => {
    const alias = { Czechia: 'Czech Republic', 'Türkiye': 'Turkey' };
    const w = WORLD.find((x) => x.n === (alias[room.name] || room.name));
    return w ? w.p : null;
  }, [room.name]);
  const deck = useMemo(() => [...(room.warm || []), ...(room.say || [])], [room]);
  const heritage = heritageOf(room.code);
  useEffect(() => { if (room.heritageOnly && tab !== 'know') setTab('know'); }, [room, tab]);

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

  const TABS = room.heritageOnly ? [{ k: 'know', label: t('country_tab_know') }] : [
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
          paddingTop: 10, paddingBottom: insets.bottom + 20, height: '92%',
        }}>
        <SheetHandle onClose={onClose} />

        {/* which country — flags, because a person scanning for Greece
            finds the flag before they finish reading the word */}
        {/* flexShrink: 0 is doing real work here. This strip sits in a
            column with a max height, next to a ScrollView that wants
            all the room there is — without it the picker was squeezed
            to a four-pixel sliver and you could see the tops of the
            flags and nothing else. */}
        <ScrollView keyboardShouldPersistTaps="handled"
          horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 2 }}>
          {ordered.map((c) => {
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

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {spot ? (
            <CountryFly key={room.code} lng={spot[0]} lat={spot[1]} height={150}
              title={(ar ? room.nameAr : room.name) + ' ' + flagOf(room.code)} sub={room.heritageOnly && heritage ? (ar ? heritage.siteAr || heritage.site : heritage.site) : (ar ? room.langAr : room.lang)} />
          ) : (
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{(ar ? room.nameAr : room.name) + ' ' + flagOf(room.code)}</Text>
          )}
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

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
          {tab === 'say' ? (
            <>
              <Greeting h={room.hello} ar={ar} t={t} />
              {/* the deck: one phrase at a time, flip to check */}
              <Label>{t('country_deck').replace('{n}', String(deck.length))}</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" snapToInterval={240} decelerationRate="fast" style={{ marginHorizontal: -16, marginBottom: 18 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {deck.map((p, i) => <FlipCard key={room.code + i} p={p} ar={ar} w={230} />)}
              </ScrollView>
              {/* everything, as a list — only when asked for */}
              <Pressable onPress={() => { tapLight(); setAllOpen((o) => !o); }} accessibilityRole="button" accessibilityState={{ expanded: allOpen }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, outlineStyle: 'none' }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', flex: 1 }}>{t('country_all')}</Text>
                <Ionicons name={allOpen ? 'chevron-up' : 'chevron-down'} size={17} color={C.faint} />
              </Pressable>
              {allOpen ? (
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
                  <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginBottom: 6 }}>{t('country_how_note')}</Text>
                </>
              ) : null}
              {/* a real moment to practise, folded until wanted */}
              {hasStory(room.code) ? (
                <>
                  <Pressable onPress={() => { tapLight(); setSceneOpen((o) => !o); }} accessibilityRole="button" accessibilityState={{ expanded: sceneOpen }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, outlineStyle: 'none' }}>
                    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', flex: 1 }}>{t('country_tab_story')}</Text>
                    <Ionicons name={sceneOpen ? 'chevron-up' : 'chevron-down'} size={17} color={C.faint} />
                  </Pressable>
                  {sceneOpen ? (COUNTRY_STORIES[room.code] || []).map((sc) => (
                    <View key={sc.id} style={{ marginBottom: 24, marginTop: 6 }}><Scene scene={sc} ar={ar} t={t} /></View>
                  )) : null}
                </>
              ) : null}
              <TalkToSomeone room={room} ar={ar} t={t} />
              <LearnProperly ar={ar} t={t} />
            </>
          ) : null}

          {tab === 'eat' ? room.eat.map((d, i) => <Dish key={i} d={d} ar={ar} />) : null}
          {tab === 'know' && heritage ? <HeritageCard key={room.code} h={heritage} ar={ar} t={t} startOpen={room.heritageOnly} /> : null}
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
                <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
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
