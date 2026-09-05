import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, Image, ImageBackground, Animated, Easing, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C, R, TEXT_BGS } from '../constants/theme';
import { Glass } from './Glass';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { StarButton } from './StarButton';
import { usePlayer } from '../context/PlayerContext';
import { useLang } from '../context/LanguageContext';
import { sfxLaugh, sfxLaughBig } from '../utils/sfx';
import { translateText } from '../services/bardi';
import { tapLight, tapSuccess } from '../utils/feedback';
import { planWhen, upForLabel } from '../constants/travel';
import { watchLabel } from '../lib/clock';
import { videoPolicy, DEFAULT_DATA_MODE } from '../lib/dataSaver';
import { getPrefs, subscribePrefs } from '../services/prefs';
import { CoverSheet } from './CoverSheet';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { useAuth } from '../context/AuthContext';

/* Chips sit on photos, so they stay dark with light text for contrast. */
const typeChip = (post) => {
  if (post.sponsored) return { label: 'SPONSORED', tint: 'rgba(17,24,39,0.65)', color: 'rgba(255,255,255,0.9)' };
  if (post.type === 'reel') return { label: 'REEL ✦', tint: 'rgba(124,58,237,0.9)', color: '#FFF' };
  /* "▶ WATCH · undefined" was on every video in the feed. See
     src/lib/clock.js — the length is real now, and when there isn't one
     the chip is simply "▶ WATCH". */
  if (post.type === 'vod') return { label: watchLabel(post.durationSec), tint: 'rgba(17,24,39,0.65)', color: '#FFF' };
  if (post.plan) return { label: 'TRAVEL PLAN 🧳', tint: 'rgba(16,185,129,0.9)', color: '#FFF' };
  return { label: 'MOMENT', tint: 'rgba(17,24,39,0.65)', color: 'rgba(255,255,255,0.85)' };
};

const isVideoPost = (post) => post.type === 'vod' || post.type === 'reel';

/* ─── AND IT STARTS PLAYING IF YOU STOP ON IT ─────────────────────────
   "وخلي لو حد وقف علي الريل كتير الريل تشتغل".

   Not the instant it touches the screen — that is the behaviour that
   makes a feed exhausting and eats a bundle while you scroll past
   forty things you did not look at. A clip starts when you have
   actually stopped on it: most of the card on screen, and still there
   most of a second later. Scroll on and it stops and rewinds.

   Muted, always: a phone that shouts in a quiet room is uninstalled by
   lunchtime. The sound is one tap away, in the player.

   Three things switch it off completely, and each one is somebody's
   real preference rather than an edge case:
     • data saver, or a metered connection (src/lib/dataSaver.js);
     • "reduce motion" in the phone's accessibility settings;
     • a browser that refuses to autoplay, which is not an error and
       is not reported as one — the poster simply stays.                */
const VideoBackdrop = ({ post, style, children }) => {
  const holder = useRef(null);
  const vid = useRef(null);
  const timer = useRef(null);
  const [mode, setMode] = useState(getPrefs().dataSaver || DEFAULT_DATA_MODE);
  useEffect(() => subscribePrefs((p) => setMode(p.dataSaver || DEFAULT_DATA_MODE)), []);
  const reduced = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const policy = videoPolicy(mode, { hasPoster: !!post.thumb, reducedMotion: reduced });

  useEffect(() => {
    if (!policy.autoplay || typeof IntersectionObserver === 'undefined') return undefined;
    const el = holder.current;
    if (!el) return undefined;
    const stop = () => {
      clearTimeout(timer.current);
      const v = vid.current;
      if (v && !v.paused) { try { v.pause(); v.currentTime = 0; } catch (e) {} }
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.intersectionRatio > 0.65) {
          clearTimeout(timer.current);
          /* the dwell: you have to still be here in 700ms */
          timer.current = setTimeout(() => {
            const v = vid.current;
            if (!v) return;
            v.muted = true;
            const go = v.play();
            if (go && go.catch) go.catch(() => {});   // a refusal is not a failure
          }, 700);
        } else if (e.intersectionRatio < 0.35) stop();
      });
    }, { threshold: [0, 0.35, 0.65, 1] });
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, [policy.autoplay, post.id]);

  return (
    <View ref={holder} style={[style, { backgroundColor: '#15151B', overflow: 'hidden' }]}>
      <video
        ref={vid}
        /* with a poster there is a picture from the first paint; with
           none, the fragment makes the browser draw a real frame
           instead of a black rectangle */
        src={post.thumb ? post.media : post.media + '#t=0.1'}
        poster={post.thumb || undefined}
        muted
        loop
        playsInline
        preload={policy.preload}
        tabIndex={-1}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />
      {children}
    </View>
  );
};

/* ─── A VIDEO IS NOT A PICTURE ────────────────────────────────────────
   "ليه الفديوز من بره لونها اسود" — because the card was doing this:

       <ImageBackground source={{ uri: post.media }} />

   with post.media being an .mp4. An <Image> handed a video draws
   nothing at all, so every video in the feed was a dark empty box with
   a play button floating on it. The profile grid had already learned
   this (ProfileScreen's Tile) and the feed had not.

   `pointerEvents: none` on the video matters: the card's own tap
   handler opens the player, and a <video> would otherwise eat it. */
const Backdrop = ({ post, style, children }) => {
  if (Platform.OS === 'web' && isVideoPost(post) && post.media) {
    return <VideoBackdrop post={post} style={style}>{children}</VideoBackdrop>;
  }
  const still = post.thumb || (isVideoPost(post) ? null : post.media);
  if (still) {
    return <ImageBackground source={{ uri: still }} style={style}>{children}</ImageBackground>;
  }
  return (
    <View style={[style, { backgroundColor: '#15151B', overflow: 'hidden' }]}>{children}</View>
  );
};

export const PostCard = ({ post, joined, vibed, laughed, reposted, onRepost, onLaugh: onLaughProp, onRemoveLaugh, isMine, onDelete, onEdit, onShare, onJoin, onVibe, onComment, onOpenProfile, onOpenReel, onOpenLikers, onOpenLaughers, onReport, onOpenTag, onSetCover }) => {
  // Moments are captured at an enforced 4:5 crop (ComposeModal) — sizing
  // the card by aspect ratio, not a fixed height, means the feed shows
  // exactly what was cropped, no extra cover-crop surprise.
  const mediaAspect = post.type === 'post' || post.type === 'travel' ? 4 / 5 : null;
  const mediaH = post.type === 'reel' ? 470 : post.type === 'vod' ? 208 : 250;
  const tc = typeChip(post);
  /* ── A PLAIN POST IS NOT A WHITE POST ─────────────────────────────
     The coloured canvases are content — somebody chose lavender, so
     lavender it stays in either theme. "Plain" is not a choice of
     colour, it is the absence of one, and it was hardcoded to white:
     at night a paragraph of text arrived as a slab of daylight in the
     middle of a black feed. Plain now means the card's own surface,
     read at the moment of drawing so it follows the theme. */
  const textBg = TEXT_BGS[post.textBg] && post.textBg !== 'plain'
    ? TEXT_BGS[post.textBg]
    : { colors: [C.glass, C.glass], text: C.text };
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  /* ── A TRAVEL PLAN ────────────────────────────────────────────────
     Someone saying "I'll be in Romania in August, who's around?" needs
     a card that leads with the plan and ends with a way to reach them.
     It is the same post underneath — same stars, same comments, same
     Edit and Delete in the ⋯ menu — with the plan on top and a real
     message box at the bottom. */
  const plan = post.plan && typeof post.plan === 'object' ? post.plan : null;
  const { user: me } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatSent, setChatSent] = useState(false);
  const [chatErr, setChatErr] = useState(null);

  const sendToTraveller = async () => {
    const body = chatText.trim();
    const to = post.user && post.user.id;
    if (!body || !to || !me || chatBusy) return;
    setChatBusy(true); setChatErr(null);
    try {
      const threadId = await getOrCreateDmThread(to, me.id);
      await sendMessage({ dmThreadId: threadId, userId: me.id, body });
      tapSuccess();
      setChatText(''); setChatSent(true);
      setTimeout(() => { setChatSent(false); setChatOpen(false); }, 1500);
    } catch (e) {
      setChatErr('Could not send that — try again.');
    } finally { setChatBusy(false); }
  };
  const [reported, setReported] = useState(false);
  /* the picture people see before a video plays — see CoverSheet */
  const [coverOpen, setCoverOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [editBusy, setEditBusy] = useState(false);
  // Long posts show a teaser; the rest opens on "See more" (Facebook-style).
  const [capExpanded, setCapExpanded] = useState(false);
  /* Translation, on request only. Nothing is sent anywhere until
     somebody asks for it — a caption isn't shipped off to be read by a
     model just because it scrolled past. */
  const [translated, setTranslated] = useState(null);
  const [translating, setTranslating] = useState(false);
  const doTranslate = async () => {
    if (translating) return;
    if (translated) { setTranslated(null); return; }   // tap again to see the original
    tapLight();
    setTranslating(true);
    try { setTranslated(await translateText(post.caption || '', lang || 'en')); }
    catch (e) { setTranslated('__failed__'); }
    finally { setTranslating(false); }
  };
  /* A hashtag somebody typed is a room in the app, so it should behave
     like one. The caption is split on tags and each one is handed back
     as its own pressable word — the text still wraps and truncates
     exactly as before, it just stopped being inert. */
  const TAG_SPLIT = /(#[\p{L}\p{N}_]{2,30})/gu;
  const withTags = (text, tagColor) => {
    const str = String(text || '');
    if (!onOpenTag || !/#/.test(str)) return str;
    return str.split(TAG_SPLIT).map((part, i) => (
      /^#[\p{L}\p{N}_]{2,30}$/u.test(part) ? (
        <Text
          key={i}
          onPress={() => { tapLight(); onOpenTag(part); }}
          style={{ color: tagColor, fontWeight: '800' }}
        >
          {part}
        </Text>
      ) : part
    ));
  };

  const CAP_LIMIT = 180;
  const fullCap = post.caption || '';
  const capLong = fullCap.length > CAP_LIMIT;
  const teaserCap = capExpanded || !capLong ? fullCap : fullCap.slice(0, CAP_LIMIT).replace(/\s+\S*$/, '') + '… ';
  const saveEdit = async () => {
    if (editBusy) return;
    setEditBusy(true);
    try { onEdit && (await onEdit(post, editCaption.trim())); setEditing(false); }
    catch (e) {} finally { setEditBusy(false); }
  };

  /* Instagram-style double-tap to vibe (⚡ burst); a single tap on a
     reel opens the full-screen TikTok-style viewer instead. */
  const lastTap = useRef(0);
  const singleTimer = useRef(null);
  const burst = useRef(new Animated.Value(0)).current;
  const [bursting, setBursting] = useState(false);
  const laughStreak = useRef({ n: 0, at: 0 });
  const onLaugh = () => {
    tapLight();
    const now = Date.now();
    const s = laughStreak.current;
    s.n = now - s.at < 1200 ? s.n + 1 : 1;
    s.at = now;
    // three quick taps (or more) escalates the giggle into the belly laugh
    if (s.n >= 3) sfxLaughBig(); else sfxLaugh();
    onLaughProp && onLaughProp(); // persisted upstream — survives refresh
  };
  // long-press your own laugh to take it back — Snapchat-style un-react
  const removeLaugh = () => { tapLight(); onRemoveLaugh && onRemoveLaugh(); };

  const totalLaughs = (post.laughs || 0) + (laughed ? 1 : 0);
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (singleTimer.current) { clearTimeout(singleTimer.current); singleTimer.current = null; }
      if (!vibed) onVibe(); // onVibe fires the haptic
      setBursting(true);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(() => setBursting(false));
    } else {
      lastTap.current = now;
      if (post.type === 'reel' && onOpenReel) {
        singleTimer.current = setTimeout(() => { singleTimer.current = null; onOpenReel(post); }, 320);
      }
    }
  };

  const burstOverlay = bursting ? (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        alignItems: 'center', justifyContent: 'center',
        opacity: burst.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.25, 1] }) }],
      }}
    >
      <MaterialCommunityIcons name="star-four-points" size={96} color={C.gold} />
    </Animated.View>
  ) : null;

  const totalVibes = post.vibes + (joined ? 1 : 0) + (vibed ? 1 : 0);

  /* ── the post's sound — really playable, right from the card ── */
  const { playTrack, toggle: togglePlay, current, playing } = usePlayer();
  const { t, lang } = useLang();
  const soundId = 'post-' + post.id;
  const soundOn = current && current.id === soundId;
  const playSound = () => {
    if (!post.sound || !post.sound.audio_url) return;
    tapLight();
    if (soundOn) { togglePlay && togglePlay(); return; }
    /* The moment used fifteen seconds of it; tapping the chip is
       asking for the song, so the window comes off here. */
    playTrack && playTrack({ id: soundId, title: post.sound.title, artist: post.sound.artist || 'indie', emoji: post.sound.emoji || '🎵', audio_url: String(post.sound.audio_url).split('#')[0] }, null, 0, { quiet: true });
  };

  return (
    <Glass style={{ marginBottom: 24, overflow: 'hidden' }}>
      {/* somebody passed this on — their name, above the moment, the
          way a repost is supposed to work */}
      {post.repostedBy ? (
        <Pressable
          onPress={() => { tapLight(); onOpenProfile && onOpenProfile({ id: post.repostedBy.id, name: post.repostedBy.name, avatar: post.repostedBy.avatar }); }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 12, marginBottom: -6 }}
        >
          <MaterialCommunityIcons name="repeat-variant" size={16} color={C.green} />
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
            {t('reposted_by')} {post.repostedBy.name}
          </Text>
        </Pressable>
      ) : null}

      {/* header — a touch larger, with room to breathe */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15 }}>
        <Pressable onPress={() => onOpenProfile(post.user)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={{ uri: post.user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          <View style={{ marginLeft: 11, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }}>
                {post.user.name}{post.user.flag ? ' ' + post.user.flag : ''}
              </Text>
              {post.user.verified ? <Tick /> : null}
            </View>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
              {post.sponsored ? 'Sponsored' : post.place + ' · ' + post.startsIn}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => { tapLight(); setMenuOpen((o) => !o); setConfirmDel(false); }} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={18} color={C.faint} />
        </Pressable>
      </View>

      {/* ── the ⋯ menu — delete your own moment, report someone else's ── */}
      {menuOpen ? (
        <View style={{ marginHorizontal: 15, marginTop: -6, marginBottom: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden' }}>
          {isMine && !post.sponsored ? (
            confirmDel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', flex: 1 }}>{t('delete_forever')}</Text>
                <Pressable onPress={() => { setMenuOpen(false); onDelete && onDelete(post); }} style={{ marginRight: 8 }}>
                  <View style={{ backgroundColor: C.coral, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('delete_word')}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => setMenuOpen(false)}>
                  <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700' }}>{t('keep_word')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Pressable onPress={() => { setEditCaption(post.caption || ''); setEditing(true); setMenuOpen(false); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                    <Ionicons name="create-outline" size={17} color={C.purple} />
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginLeft: 9 }}>{t('edit_caption')}</Text>
                  </View>
                </Pressable>
                {/* a video's cover, changeable after it is posted —
                    only ever on your own, and only on a video */}
                {onSetCover && isVideoPost(post) && post.media ? (
                  <Pressable onPress={() => { setMenuOpen(false); setCoverOpen(true); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <Ionicons name="image-outline" size={17} color={C.purple} />
                      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginLeft: 9 }}>{t('cover_change')}</Text>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setConfirmDel(true)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                    <Ionicons name="trash-outline" size={17} color={C.coral} />
                    <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '800', marginLeft: 9 }}>{t('delete_moment')}</Text>
                  </View>
                </Pressable>
              </>
            )
          ) : (
            <Pressable onPress={() => { setMenuOpen(false); onReport ? onReport(post) : setReported(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <Ionicons name={reported ? 'checkmark-circle' : 'flag-outline'} size={17} color={reported ? C.green : C.dim} />
                <Text style={{ color: reported ? C.green : C.text, fontSize: 13.5, fontWeight: '700', marginLeft: 9 }}>
                  {reported ? 'Thanks — we got it' : 'Report this moment'}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      ) : null}

      {coverOpen ? (
        <CoverSheet
          videoUrl={post.media}
          current={post.thumb}
          onClose={() => setCoverOpen(false)}
          onChoose={(dataUrl) => onSetCover(post, dataUrl)}
        />
      ) : null}

      {/* inline caption editor — edit your own moment's words */}
      {editing ? (
        <View style={{ marginHorizontal: 15, marginBottom: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
          <TextInput
            value={editCaption}
            onChangeText={setEditCaption}
            placeholder={t('say_something')}
            placeholderTextColor={C.faint}
            multiline
            style={{ color: C.text, fontSize: 14, minHeight: 44, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <Pressable onPress={() => setEditing(false)} style={{ marginRight: 10 }}>
              <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700', paddingVertical: 6 }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable onPress={saveEdit}>
              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 }}>
                <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{editBusy ? 'Saving…' : 'Save'}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── the plan, above everything it is about ── */}
      {plan ? (
        <View style={{ paddingHorizontal: 15, paddingBottom: 12 }}>
          <Text style={{ color: C.text, fontSize: 19, lineHeight: 26, fontWeight: '900' }}>{plan.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 }}>
            {planWhen(plan) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 6 }}>
                <Ionicons name="calendar-outline" size={13} color={C.dim} />
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{planWhen(plan)}</Text>
              </View>
            ) : null}
            {post.place ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6 }}>
                <Ionicons name="location-outline" size={13} color={C.dim} />
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{post.place}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* media — or a colored text card when the moment is just words.
          Double-tap either one to vibe, Instagram style. */}
      {post.media ? (
        <Pressable onPress={handleMediaTap}>
          <Backdrop post={post} style={mediaAspect ? { aspectRatio: mediaAspect, justifyContent: 'space-between' } : { height: mediaH, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
              <Chip label={tc.label} tint={tc.tint} color={tc.color} />
              {post.startsIn === 'Live now' ? <Chip label={t('live_badge')} tint="rgba(244,63,94,0.9)" color="#fff" style={{ borderColor: 'transparent' }} /> : null}
            </View>
            {post.type === 'vod' ? (
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(17,24,39,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 3 }} />
                </View>
              </View>
            ) : null}
            {plan ? <View /> : (
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={{ padding: 14, paddingTop: 44 }}>
              <Text style={{ color: '#FFF', fontSize: 14.5, lineHeight: 21, fontWeight: '500' }} numberOfLines={capExpanded ? undefined : 3}>
                {withTags(post.caption, '#C4B5FD')}
              </Text>
              {translating || translated ? (
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, lineHeight: 20, marginTop: 6, fontStyle: 'italic' }}>
                  {translating ? '…' : translated === '__failed__' ? 'Could not translate right now.' : translated}
                </Text>
              ) : null}
              {capLong ? (
                <Pressable onPress={(e) => { e.stopPropagation && e.stopPropagation(); tapLight(); setCapExpanded((v) => !v); }} hitSlop={6} style={{ marginTop: 4 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800' }}>{capExpanded ? t('see_less') : t('see_more')}</Text>
                </Pressable>
              ) : null}
            </LinearGradient>
            )}
            {burstOverlay}
          </Backdrop>
        </Pressable>
      ) : plan ? null : (
        <Pressable onPress={handleMediaTap}>
          <LinearGradient
            colors={textBg.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 22, paddingVertical: 34, minHeight: 150, justifyContent: 'center' }}
          >
            {translating || translated ? (
              <Text style={{ color: textBg.text, fontSize: 15, lineHeight: 23, fontWeight: '600', textAlign: 'center', opacity: 0.85, marginBottom: 10, fontStyle: 'italic' }}>
                {translating ? '…' : translated === '__failed__' ? 'Could not translate right now.' : translated}
              </Text>
            ) : null}
            <Text style={{ color: textBg.text, fontSize: 22, lineHeight: 32, fontWeight: '700', textAlign: 'center' }}>
              {withTags(teaserCap, textBg.text)}
              {capLong ? (
                <Text onPress={() => { tapLight(); setCapExpanded((v) => !v); }} style={{ fontSize: 15, fontWeight: '900', opacity: 0.72 }}>
                  {capExpanded ? '  ' + t('see_less') : t('see_more')}
                </Text>
              ) : null}
            </Text>
            {burstOverlay}
          </LinearGradient>
        </Pressable>
      )}

      {/* ── the plan's own body: the words at full length, what they're
             up for, and a way to actually reach them ── */}
      {plan ? (
        <View style={{ paddingHorizontal: 15, paddingTop: 13 }}>
          {post.caption ? (
            <>
              <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 22 }} numberOfLines={capExpanded ? undefined : 6}>
                {withTags(post.caption, C.purple)}
              </Text>
              {capLong ? (
                <Pressable onPress={() => { tapLight(); setCapExpanded((v) => !v); }} hitSlop={6} style={{ marginTop: 5 }}>
                  <Text style={{ color: C.purple, fontSize: 13, fontWeight: '800' }}>{capExpanded ? t('see_less') : t('see_more')}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {plan.upFor && plan.upFor.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {plan.upFor.map((id) => (
                <View key={id} style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginRight: 7, marginBottom: 7 }}>
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '800' }}>{upForLabel(id)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Your own plan doesn't need a button to message yourself. */}
          {!isMine && me && post.user && post.user.id ? (
            chatOpen ? (
              <View style={{ marginTop: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 }}>
                <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '800' }}>
                  {'Message ' + ((post.user && post.user.name) || 'them')}
                </Text>
                <TextInput
                  value={chatText}
                  onChangeText={setChatText}
                  placeholder={t('say_hello_placeholder')}
                  placeholderTextColor={C.faint}
                  multiline
                  editable={!chatBusy}
                  style={{ color: C.text, fontSize: 14, minHeight: 54, marginTop: 8, textAlignVertical: 'top' }}
                />
                {chatErr ? <Text style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{chatErr}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 }}>
                  {chatSent ? (
                    <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '800' }}>{t('sent_in_chats')}</Text>
                  ) : (
                    <>
                      <Pressable onPress={() => { tapLight(); setChatOpen(false); }} style={{ marginRight: 12 }}>
                        <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700', paddingVertical: 6 }}>{t('cancel')}</Text>
                      </Pressable>
                      <Pressable onPress={sendToTraveller} disabled={chatBusy || !chatText.trim()}>
                        <View style={{ backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, opacity: chatBusy || !chatText.trim() ? 0.5 : 1 }}>
                          <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{chatBusy ? 'Sending…' : 'Send'}</Text>
                        </View>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ) : (
              <Pressable onPress={() => { tapLight(); setChatOpen(true); }} style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.green, borderRadius: 999, paddingVertical: 14 }}>
                  <Ionicons name="chatbubbles-outline" size={17} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', marginLeft: 8 }}>{t('open_chat')}</Text>
                </View>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}

      {/* footer — compact action row; JOIN is a small pill on the right */}
      <View style={{ padding: 15, paddingTop: 13 }}>
        {/* who's in this moment — real people, tagged by whoever shared
            it, each name opening their profile */}
        {post.tagged && post.tagged.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 9 }}>
            <Ionicons name="pricetag" size={12} color={C.faint} />
            <Text style={{ color: C.faint, fontSize: 12, marginLeft: 5 }}>with </Text>
            {post.tagged.slice(0, 3).map((p, i) => (
              <Pressable key={p.id} onPress={() => { tapLight(); onOpenProfile && onOpenProfile({ id: p.id, name: p.name, avatar: p.avatar_url }); }} hitSlop={4}>
                <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}>
                  {p.name}{i < Math.min(3, post.tagged.length) - 1 ? ', ' : ''}
                </Text>
              </Pressable>
            ))}
            {post.tagged.length > 3 ? (
              <Text style={{ color: C.faint, fontSize: 12 }}> +{post.tagged.length - 3}</Text>
            ) : null}
          </View>
        ) : null}
        {/* the sound on this moment — tap to actually hear it */}
        {post.sound && post.sound.audio_url ? (
          <Pressable onPress={playSound} style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: soundOn && playing ? C.purple : C.bg, borderWidth: 1, borderColor: soundOn && playing ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}>
              <Ionicons name={soundOn && playing ? 'pause' : 'play'} size={12} color={soundOn && playing ? '#FFF' : C.purple} />
              <Text style={{ color: soundOn && playing ? '#FFF' : C.text, fontSize: 11.5, fontWeight: '800', marginLeft: 6 }} numberOfLines={1}>
                ♫ {post.sound.title}{post.sound.artist ? ' · ' + post.sound.artist : ''}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Star */}
          <StarButton starred={vibed} onPress={onVibe} size={21} />
          <Pressable onPress={onVibe} hitSlop={8}>
            <Text style={{ color: vibed ? C.gold : C.dim, fontSize: 13, fontWeight: '800', marginLeft: 5, marginRight: 16 }}>
              {totalVibes}
            </Text>
          </Pressable>
          {/* Laugh — tap for a giggle, three quick taps for the belly laugh.
              Long-press YOUR laugh to take it back. Tap the count to see who. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <Pressable
              onPress={laughed ? removeLaugh : onLaugh}
              onLongPress={laughed ? removeLaugh : () => { tapLight(); sfxLaughBig(); onLaughProp && onLaughProp(); }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 17, opacity: laughed ? 1 : 0.55 }}>😂</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (totalLaughs > 0) { tapLight(); onOpenLaughers && onOpenLaughers(post); } }}
              hitSlop={8}
            >
              <Text style={{ color: laughed ? C.text : C.dim, fontSize: 13, fontWeight: '700', marginLeft: 3 }}>
                {totalLaughs}
              </Text>
            </Pressable>
          </View>
          {/* Comment scroll */}
          <Pressable onPress={onComment} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <MaterialCommunityIcons name="script-text-outline" size={20} color={C.dim} />
            <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>{post.comments}</Text>
          </Pressable>
          {/* Repost — persisted upstream, survives refresh */}
          <Pressable onPress={() => { tapLight(); onRepost && onRepost(); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <MaterialCommunityIcons name="repeat-variant" size={22} color={reposted ? C.green : C.dim} />
            <Text style={{ color: reposted ? C.green : C.dim, fontSize: 13, fontWeight: '700', marginLeft: 3 }}>
              {(post.reposts || 0) + (reposted ? 1 : 0)}
            </Text>
          </Pressable>
          {/* Translate — Bardi already speaks every language the app does */}
          {(post.caption || '').trim().length > 3 ? (
            <Pressable onPress={doTranslate} hitSlop={8} style={{ marginRight: 16 }}>
              <Ionicons name="language-outline" size={20} color={translated ? C.purple : C.dim} />
            </Pressable>
          ) : null}
          {/* Share — a real link your friends can open */}
          <Pressable onPress={() => { tapLight(); onShare && onShare(post); }} hitSlop={8}>
            <Ionicons name="paper-plane-outline" size={19} color={C.dim} />
          </Pressable>

          <View style={{ flex: 1 }} />

          {post.sponsored ? (
            <Pressable style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, shadowColor: C.purple, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>{post.cta || 'Learn more'}</Text>
            </Pressable>
          ) : post.joinable ? (
            joined ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                <Ionicons name="checkmark" size={14} color={C.green} />
                <Text style={{ color: C.green, fontSize: 12, fontWeight: '900', marginLeft: 4 }}>{t('joined')}</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => onJoin(post)}
                style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, shadowColor: C.purple, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
              >
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>{t('join_the_vibe')}</Text>
              </Pressable>
            )
          ) : (
            <Ionicons name="bookmark-outline" size={20} color={C.dim} />
          )}
        </View>

        {/* social proof, Instagram style — tap to see who starred it */}
        {totalVibes > 0 ? (
          <Pressable onPress={() => { tapLight(); onOpenLikers && onOpenLikers(post); }} hitSlop={6}>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 10 }}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={C.gold} /> {t('starred_by_label')}{' '}
              <Text style={{ fontWeight: '800', color: C.text }}>
                {vibed ? 'you' : post.topFan || 'the crew'}
              </Text>
              {totalVibes > 1 ? t('and_others_suffix').replace('{n}', totalVibes - 1) : ''}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Glass>
  );
};
