import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { cachedPoster, derivePoster, posterTint } from '../lib/poster';
import { GreenMark } from '../components/green/GreenMark';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL, PLAY_GAMES } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { openPartner } from '../services/broker';
import { fetchVideos, deletePost } from '../services/posts';
import { fetchFilms, watchOptions } from '../services/films';
import { pickFilms, regionOf } from '../lib/filmPicks';
import { CultureSheet } from '../components/CultureSheet';
import { Glass } from '../components/Glass';
import { Page } from '../components/Page';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { Shortcut, ShortcutRow } from '../components/Shortcut';
import { FilmSheet } from '../components/FilmSheet';
import { BooksShelf } from '../components/BooksShelf';
import { GameHub } from '../components/lamma/GameHub';
/* lazy here as well as in Notifications: one plain import anywhere puts
   the whole sheet back into everybody's first download */
const KitchenSheet = lazyOverlay(() => import('../components/KitchenSheet').then((m) => ({ default: m.KitchenSheet })));
const GreenSheet = lazyOverlay(() => import('../components/green/GreenSheet').then((m) => ({ default: m.GreenSheet })));
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useNavigation } from '@react-navigation/native';
import { trackPlayer } from '../lib/videoSound';
import { sfxSuccess, sfxPop } from '../utils/sfx';

/* Fetched when it is opened, not when the app starts. */
import { lazyOverlay } from '../lib/lazyScreen';
import { getProfile } from '../services/profiles';

/* Fetched when it is opened, not when the app starts. */
const GameRunner = lazyOverlay(() => import('../components/GameRunner').then((m) => ({ default: m.GameRunner })));
const RooftopRush = lazyOverlay(() => import('../components/RooftopRush').then((m) => ({ default: m.RooftopRush })));
const RockPaperScissors = lazyOverlay(() => import('../components/RockPaperScissors').then((m) => ({ default: m.RockPaperScissors })));
const StackGame = lazyOverlay(() => import('../components/StackGame').then((m) => ({ default: m.StackGame })));
const TowerClimb = lazyOverlay(() => import('../components/TowerClimb').then((m) => ({ default: m.TowerClimb })));
const StreetHop = lazyOverlay(() => import('../components/StreetHop').then((m) => ({ default: m.StreetHop })));
const CaptureModal = lazyOverlay(() => import('../components/CaptureModal').then((m) => ({ default: m.CaptureModal })));
const CommentsSheet = lazyOverlay(() => import('../components/CommentsSheet').then((m) => ({ default: m.CommentsSheet })));
/* The country room carries every phrase, dish and custom for thirteen
   countries — 75 KB that has no business being in the download somebody
   waits through to see the feed. It arrives when the room is opened. */
/* Tapping whoever posted a video should open them. It did nothing. */
const ProfileModal = lazyOverlay(() => import('../components/ProfileModal').then((m) => ({ default: m.ProfileModal })));
const CountrySheet = lazyOverlay(() => import('../components/CountrySheet').then((m) => ({ default: m.CountrySheet })));

/* ────────────── TAB 4 · CHILL — WATCH & UNWIND ──────────────
   Long-form videos (YouTube-style, real uploads of type 'vod') up top,
   then "Watch" — a where-to-stream discovery rail that deep-links to the
   real platform and earns an affiliate commission. Nothing fabricated:
   the video list is your community's real uploads with an honest empty
   state, and every "Watch on" link goes to the actual service. */

const isWeb = Platform.OS === 'web';

// Shape a DB 'vod' row (or a local optimistic one) into a video card.
const toVideo = (r) => ({
  id: r.id,
  userId: r.user_id, // owner — enables "delete my video"
  title: r.caption || 'Untitled video',
  media: r.media_url || r.media,
  thumb: r.thumb_url || null,
  author: (r.user && (r.user.name)) || 'Explorer',
  avatar: (r.user && (r.user.avatar_url || r.user.avatar)) || AV_NEUTRAL,
  place: r.place || 'Video',
});

/* ─── A VIDEO'S FIRST FRAME, NEVER A BLACK BOX ───────────────────────
   The other black box in his screenshot. This list drew its own
   <video> on #000 with no cover, so in data saver — or any time the
   browser had not painted a frame yet — it was a black rectangle with
   a play button on it. Same answer as the feed (src/lib/poster.js): the
   still it was posted with, or one taken from the clip once and kept,
   and until then a colour of its own. */
const VideoStill = ({ v }) => {
  const [derived, setDerived] = useState(() => cachedPoster(v.id));
  useEffect(() => {
    if (v.thumb || derived || !v.media) return undefined;
    let alive = true;
    derivePoster(v.id, v.media).then((u) => { if (alive && u) setDerived(u); });
    return () => { alive = false; };
  }, [v.id, v.media, v.thumb, derived]);
  const still = v.thumb || derived;
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: posterTint(v.id) }}>
      {still ? <Image source={{ uri: still }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 3 }} />
        </View>
      </View>
    </View>
  );
};

/* A drawn icon and one accent per game. Six competing gradients with
   an emoji on each is the look Ayser recognised from a mile away — and
   it is what a shelf looks like when nothing on it has been chosen
   over anything else. Declared here, not inside the component, so they
   are not rebuilt on every render. */
const GAME_ICON = {
  rps: 'hand-right', rooftop: 'business', stack: 'layers',
  tower: 'trending-up', hop: 'walk', runner: 'people',
};
/* A FUNCTION, not an object. The palette is mutated in place when the
   theme flips, so a map built at import time keeps whichever theme
   happened to load first — for the whole session. Read it when it is
   drawn. (Caught by check-rerender, which exists for exactly this.) */
const gameTint = (kind) => ({
  rps: C.purple, rooftop: C.gold, stack: C.blue,
  tower: C.coral, hop: C.green, runner: C.blue,
}[kind] || C.purple);

export const ChillScreen = () => {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  /* FILMS — twelve picked for you, from your hobbies and your vibe and
     what streams in your country (src/lib/filmPicks.js). No shelf to
     scroll, no genre picker, no stars: a film is a reason to meet. */
  const { t, lang } = useLang();
  const [films, setFilms] = useState(null);
  const [film, setFilm] = useState(null);
  const [me, setMe] = useState(null);
  const [movieNight, setMovieNight] = useState(null);   // a film turned into a plan
  useEffect(() => {
    if (!SUPABASE_READY) { setFilms([]); return; }
    let alive = true;
    Promise.all([
      withDeadline(fetchFilms({ limit: 300 })).catch(() => []),
      user ? getProfile(user.id).catch(() => null) : Promise.resolve(null),
    ]).then(([rows, prof]) => {
      if (!alive) return;
      setMe(prof);
      setFilms(pickFilms(rows, prof, { lang }));
    });
    return () => { alive = false; };
  }, [user && user.id, lang]);
  const region = regionOf(me);
  const watchTogether = (f) => {
    const where = watchOptions(f, region).filter((o) => o.here).map((o) => o.name).slice(0, 3).join(', ');
    setFilm(null);
    setMovieNight({
      kind: 'movie', hour: 20, minutes: 150,   // a film and the talk after it
      title: t('film_night_title').replace('{title}', f.title),
      about: (where ? t('film_night_about_on').replace('{where}', where) : t('film_night_about')).replace('{title}', f.title + (f.year ? ' (' + f.year + ')' : '')),
    });
  };
  const [videos, setVideos] = useState(null);     // null until first load
  const [player, setPlayer] = useState(null);     // the video now playing
  const [commentsPost, setCommentsPost] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [game, setGame] = useState(null); // a launched game
  const [lammaOpen, setLammaOpen] = useState(false);
  const [greenOpen, setGreenOpen] = useState(false);
  const [focusPack, setFocusPack] = useState(null);   // a pack to open the shelf on
  /* The heritage room. Six real places and their customs have been in
     this app all along, locked inside two arcade games — which is why
     nobody knew the app kept any heritage at all. See
     components/CultureSheet.js. */
  const [cultureOpen, setCultureOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [videoAuthor, setVideoAuthor] = useState(null);   // whose video you tapped

  // Every real, playable game — surfaced here so they're actually findable
  // (they used to be buried in Search → Play).
  /* Seko Seko is out of the list until it looks the way it should —
     the code stays, it just isn't offered while it's rough. */
  const PLAYABLE = ['runner', 'stack', 'rooftop', 'rps', 'tower', 'hop'];
  const games = PLAY_GAMES.filter((g) => PLAYABLE.includes(g.kind));

  /* The book shelf is a small app of its own — a search box, seven
     shelves, a reader. It was sitting in the middle of this screen
     taking a screenful whether or not anybody wanted a book, and its
     failure state ("Could not open the shelf") was the loudest thing
     on the tab. It opens from the row of buttons now. */
  const [booksOpen, setBooksOpen] = useState(false);


  /* The list row carries only a name and an avatar. The profile needs
     the real row, so it is fetched on the tap rather than kept for
     every video in the list on the chance one is tapped. */
  const openVideoAuthor = async (v) => {
    if (!v || !v.userId) return;
    try {
      const pr = await getProfile(v.userId);
      if (pr) setVideoAuthor({
        id: pr.id,
        name: pr.name || v.author,
        avatar: pr.avatar_url || v.avatar,
        countryFlag: pr.country_flag || null,
        intent: pr.intent || null,
        bio: pr.bio || '',
      });
    } catch (e) { /* a profile that will not load is not worth a crash */ }
  };

  const loadVideos = useCallback(async () => {
    if (!SUPABASE_READY) { setVideos([]); return; }
    try {
      const rows = await withDeadline(fetchVideos());
      setVideos((rows || []).map(toVideo));
    } catch (e) { setVideos([]); }
  }, []);

  /* videos are no longer shown here, so they are no longer fetched */

  const onUploaded = (row) => {
    // optimistic prepend, then reconcile with the server
    setVideos((v) => [toVideo(row), ...(v || [])]);
    loadVideos();
  };

  /* Delete YOUR video — gone from the list instantly, gone from the DB. */
  const onDeleteVideo = (v) => {
    tapLight();
    setVideos((list) => (list || []).filter((x) => x.id !== v.id));
    setPlayer(null);
    if (SUPABASE_READY && user) deletePost(v.id, user.id).catch(() => {});
  };

  return (
    <>
    <Page>
      <ScreenHeader kicker={t('chill_kicker')} title={t('chill_title')} onBack={() => { tapLight(); nav.navigate('TOGETHER'); }} backLabel={t('back')} />

      {/* ── ONE HERO, THEN QUIET ROWS ─────────────────────────────
          Ayser sent a photograph of this screen and said it looked
          like something a machine made. He was right, and the reasons
          were specific rather than a matter of taste:

          three gradient cards stacked in a row, each with an emoji on
          the left, a bold title, a thin subtitle and a pill on the
          right — the same shape three times in three colours. Emoji
          standing in for icons. Emoji inside the headings. A paragraph
          under a section header explaining what the section is for.
          Five gradients competing, so nothing was more important than
          anything else.

          Instagram and Tinder do the opposite: the content is the
          interface, icons are one weight and one colour, nothing
          explains itself, and the screen is DENSE. A menu of features
          is what you build when you have not decided what matters.

          So: لمّة keeps the gradient, because it is the one thing this
          screen is for. Everything else steps down to a quiet row with
          a real icon, and the emoji come out. */}
      <Pressable onPress={() => { tapLight(); sfxPop(); setLammaOpen(true); }} style={{ marginTop: -2, marginBottom: 10 }}>
        <LinearGradient
          colors={['#2B1055', '#7C3AED']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900', letterSpacing: -0.3 }}>{t('lamma_title')}</Text>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, marginTop: 2 }}>
              {t('lamma_tagline')}
            </Text>
          </View>
          <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ color: '#5B21B6', fontSize: 13, fontWeight: '900' }}>{t('lamma_start')}</Text>
          </View>
        </LinearGradient>
      </Pressable>

      {/* ── AND EVERYTHING ELSE IS A BUTTON ─────────────────────────
          "خلي تاب الentertaining تبقي مور simple".

          It was six full sections stacked down the screen, four of
          which were EMPTY BOXES: "No tracks yet", "No videos yet",
          "Could not open the shelf", "The film catalogue hasn't been
          filled yet". Four screenfuls of apology. A person opening
          this tab to be entertained scrolled past four notices that
          there was nothing here.

          The rule now, and it is the same one the Chats tab got: a
          section with nothing in it is not a section, it is a button.
          What there IS shows as itself; what there is not is one round
          button that opens the place where you can go get some. */}
      <ShortcutRow>
        {/* home-cooked food from a neighbour's kitchen — see KitchenSheet */}
        <Shortcut icon={<GreenMark size={26} />} label={t('green_title')} onPress={() => { tapLight(); sfxPop(); setGreenOpen(true); }} />
        <Shortcut emoji="🏛" label={t('culture_title')} onPress={() => { tapLight(); sfxPop(); setCultureOpen(true); }} />
        <Shortcut emoji="🌍" label={t('country_title')} onPress={() => { tapLight(); sfxPop(); setCountryOpen(true); }} />
        <Shortcut emoji="📚" label={t('read_word')} onPress={() => { tapLight(); sfxPop(); setBooksOpen(true); }} />
      </ShortcutRow>

      <View style={{ height: 18 }} />
      <SectionHeader title={t('sec_play')} />

      {/* ── SIX GAMES, ALL OF THEM VISIBLE ─────────────────────────
          They were 150-wide cards in a sideways strip: mostly empty
          space, the icon a small square in one corner, and the third
          card cut off by the edge of the phone so its name read "Rock
          Paper". A grid of two shows all six at once, each as an icon
          and a name — the way a phone shows its own apps. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: -4, marginBottom: 18 }}>
        {games.map((g) => (
          <Pressable key={g.id} onPress={() => { tapLight(); sfxPop(); setGame(g); }} style={{ width: '48.5%', marginBottom: 8 }}>
            {({ pressed }) => (
              <View style={{
                flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, minHeight: 66,
                backgroundColor: pressed ? C.glassHi : C.glass, borderWidth: 1, borderColor: C.line,
              }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: gameTint(g.kind) + '22' }}>
                  <Ionicons name={GAME_ICON[g.kind] || 'game-controller'} size={18} color={gameTint(g.kind)} />
                </View>
                <View style={{ flex: 1, minWidth: 0, marginStart: 10, minHeight: 38, justifyContent: 'center' }}>
                  {/* the name may take two lines — "Catch Your M…" is not a name */}
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 16 }} numberOfLines={2}>{t(g.nameKey)}</Text>
                  <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>{t(g.playersKey)}</Text>
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Long-form videos were here. Removed: Moments is not a place to
         watch; it is a way out of the house. So was LISTEN, a music
         player — the same reason. */}
      {/* ── FILMS — picked for you, each one a reason to get together.
             Shown only when there are films. ── */}
      {films && films.length ? (
      <>
      <SectionHeader title={t('film_for_you')} style={{ marginTop: 8 }} />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 12, lineHeight: 18 }}>
        {t('film_for_you_sub')}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          {films.map((m) => (
              <Pressable key={m.id} onPress={() => { tapLight(); sfxPop(); setFilm(m); }} accessibilityRole="button" accessibilityLabel={m.title}>
                <View style={{ width: 138, marginEnd: 12 }}>
                  <View style={{ height: 196, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi }}>
                    <Image source={{ uri: m.poster_url }} style={{ width: '100%', height: '100%' }} />
                  </View>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', marginTop: 7 }} numberOfLines={1}>{m.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                    {[m.year, (m.genres || [])[0]].filter(Boolean).join(' · ')}
                  </Text>
                  <Pressable onPress={() => watchTogether(m)} accessibilityRole="button" style={{ marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12 }}>🍿</Text>
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', marginStart: 4, textDecorationLine: 'underline' }}>{t('film_watch_together_short')}</Text>
                  </Pressable>
                </View>
              </Pressable>
          ))}
      </ScrollView>
      </>
      ) : null}
    </Page>

    {film ? <FilmSheet film={film} region={region} onClose={() => setFilm(null)} onWatchTogether={watchTogether} /> : null}
    {/* "Watch together": the ordinary start-one form, filled in with the film */}
    {movieNight ? <GreenSheet startNow homeCountry={region || (me && me.country) || 'EG'} prefill={movieNight} onClose={() => setMovieNight(null)} /> : null}

    {/* The shelf, opened on purpose rather than sat in the way */}
    {booksOpen ? (
      <Modal visible transparent={false} animationType="slide" onRequestClose={() => setBooksOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 54, paddingBottom: 8 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', flex: 1 }}>{t('sec_read')}</Text>
            <Pressable onPress={() => { tapLight(); setBooksOpen(false); }} hitSlop={10}>
              <Ionicons name="close" size={24} color={C.dim} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}>
            <BooksShelf />
          </ScrollView>
        </View>
      </Modal>
    ) : null}


    {/* video player — real playback, with a comments button */}
    {player ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => setPlayer(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {/* the player is registered so locking the phone stops it
                too — see src/lib/videoSound.js */}
            {isWeb && player.media ? (
              <video
                src={player.media}
                controls autoPlay playsInline
                ref={(el) => { if (el) trackPlayer(el); }}
                style={{ width: '100%', maxHeight: '80%' }}
              />
            ) : player.media ? (
              <Image source={{ uri: player.media }} style={{ width: '100%', height: '60%' }} resizeMode="contain" />
            ) : null}
          </View>
          <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => { tapLight(); setPlayer(null); }} hitSlop={10}>
              <Ionicons name="close" size={30} color="#FFF" />
            </Pressable>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 12, flex: 1 }} numberOfLines={1}>{player.title}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: player.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800', marginLeft: 10, flex: 1 }}>{player.author}</Text>
              {user && player.userId === user.id ? (
                <Pressable onPress={() => onDeleteVideo(player)} style={{ marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.85)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Ionicons name="trash-outline" size={15} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginLeft: 5 }}>{t('delete')}</Text>
                  </View>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { tapLight(); setCommentsPost({ id: player.id, place: 'Video' }); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Ionicons name="chatbubble-outline" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{t('comments')}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    ) : null}

    {/* "where to watch" sheet — deep-links to the real platform (affiliate) */}

    {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}

    {/* launched game */}
    {game && game.kind === 'stack' ? <StackGame onClose={() => setGame(null)} />
      : game && game.kind === 'tower' ? <TowerClimb onClose={() => setGame(null)} />
      : game && game.kind === 'hop' ? <StreetHop onClose={() => setGame(null)} />
      : game && game.kind === 'rooftop' ? <RooftopRush onClose={() => setGame(null)} />
      : game && game.kind === 'rps' ? <RockPaperScissors onClose={() => setGame(null)} />
      : game ? <GameRunner onClose={() => setGame(null)} /> : null}

    {/* One sheet at a time. The green corner can hand somebody over to
        لمّة with its own pack already at the front of the shelf, so it
        closes itself on the way out rather than leaving two full-screen
        sheets stacked with the back button between them. */}
    {lammaOpen ? <GameHub onClose={() => { setLammaOpen(false); setFocusPack(null); }} focusPack={focusPack} /> : null}
    {videoAuthor ? <ProfileModal user={videoAuthor} onClose={() => setVideoAuthor(null)} /> : null}
    {cultureOpen ? <CultureSheet onClose={() => setCultureOpen(false)} /> : null}
    {countryOpen ? <CountrySheet onClose={() => setCountryOpen(false)} /> : null}
    {foodOpen ? <KitchenSheet onClose={() => setFoodOpen(false)} /> : null}
    {greenOpen ? (
      <GreenSheet
        onClose={() => setGreenOpen(false)}
        onPlay={(packId) => { setGreenOpen(false); setFocusPack(packId); setLammaOpen(true); }}
      />
    ) : null}
    </>
  );
};
