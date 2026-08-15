import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ImageBackground, FlatList, Image, Animated, Easing, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { looksPlayable, watchForBlankVideo } from '../lib/videoCheck';
import { REELS, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { useAuth } from '../context/AuthContext';
import { fetchFeed, deletePost } from '../services/posts';
import { mateUp, fetchMateStates } from '../services/mates';
import { toggleVibe as persistVibe, toggleRepost as persistRepost, fetchEngagement } from '../services/social';
import { SoundChip } from '../components/SoundChip';
import { CommentsSheet } from '../components/CommentsSheet';
import { CaptureModal } from '../components/CaptureModal';
import { ProfileModal } from '../components/ProfileModal';
import { tapLight, tapMedium } from '../utils/feedback';
import { sfxStar, sfxPop } from '../utils/sfx';
import { soundOn, setSoundOn, applySound, trackPlayer, untrackPlayer, stopVideos } from '../lib/videoSound';
import { useIsFocused } from '@react-navigation/native';
import { useLang } from '../context/LanguageContext';

/* ─── TAB 3 · REELS — the standalone vertical feed ───
   TikTok-style full-screen pager with the Moments identity: the gold
   four-point star, the scroll for comments, repost, and a clearly
   labeled sponsored reel every few swipes. */

const RailButton = ({ children, label, color = '#FFF', onPress }) => (
  <Pressable onPress={onPress} hitSlop={8} style={{ alignItems: 'center', marginBottom: 20 }}>
    {children}
    {label != null ? (
      <Text style={{ color, fontSize: 12, fontWeight: '800', marginTop: 3 }}>{label}</Text>
    ) : null}
  </Pressable>
);

export const ReelsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();
  const [pageH, setPageH] = useState(0);
  const [vibes, setVibes] = useState({});
  const [reposts, setReposts] = useState({});
  // real relationship per user id: 'mates' | 'requested' | 'incoming'
  const [mateState, setMateState] = useState({});
  const [commentsPost, setCommentsPost] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [shooting, setShooting] = useState(false);
  const burst = useRef(new Animated.Value(0)).current;
  const [burstId, setBurstId] = useState(null);
  const [realReels, setRealReels] = useState(null); // null until loaded
  const [dead, setDead] = useState({});             // reels whose file has no picture
  /* Reels played silently with no way to change it — see
     src/lib/videoSound.js. One tap, and every reel after it too. */
  const [sound, setSound] = useState(soundOn);
  /* Only the reel you are actually looking at plays. Every clip in the
     list autoplays, which was harmless while they were all silent and a
     mess the moment they were not. */
  const reelVideos = useRef(new Map());
  const activeReel = useRef(null);
  const syncReels = React.useCallback(() => {
    reelVideos.current.forEach((el, id) => {
      if (!el || !el.isConnected) { reelVideos.current.delete(id); return; }
      if (activeReel.current == null || id === activeReel.current) applySound(el);
      else { el.muted = true; try { el.pause(); } catch (e) {} }
    });
  }, []);
  const reelViewCfg = useRef({ itemVisiblePercentThreshold: 60 });
  const onReelViewable = useRef(({ viewableItems }) => {
    const first = viewableItems && viewableItems[0];
    activeReel.current = first && first.item ? first.item.id : null;
    syncReels();
  });
  const toggleSound = () => {
    const next = !sound;
    tapLight();
    setSound(next);
    setSoundOn(next);
    syncReels();
  };

  /* LEAVING THE TAB STOPS IT. A tab is not unmounted when you swipe off
     it, so the reel carried on talking from behind whatever you opened
     next — the phone even showed the app still playing. Nothing plays
     where you cannot see it. */
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) syncReels();
    else stopVideos(new Set(reelVideos.current.values()));
  }, [focused, syncReels]);

  useEffect(() => () => {
    reelVideos.current.forEach((el) => untrackPlayer(el));
    stopVideos(new Set(reelVideos.current.values()));
  }, []);

  const [reelsErr, setReelsErr] = useState(false);
  const loadReels = useCallback(() => {
    if (!SUPABASE_READY) return;
    setReelsErr(false);
    setRealReels(null);
    /* A dead connection never rejects on its own — see src/lib/deadline.js */
    withDeadline(fetchFeed())
      .then((rows) => setRealReels((rows || [])
        .filter((r) => r.type === 'reel')
        .map((r) => ({
          id: r.id,
          user: { id: r.user_id, name: (r.user && r.user.name) || 'Explorer', avatar: (r.user && r.user.avatar_url) || AV_NEUTRAL, verified: !!(r.user && r.user.verified), flag: (r.user && r.user.country_flag) || '' },
          media: r.media_url,
          caption: r.caption || '',
          sound: r.sound_title ? { title: r.sound_title, artist: r.sound_artist || '', emoji: '🎵' } : null,
          vibes: r.vibes || 0, comments: r.comments || 0, reposts: 0,
        }))))
      .catch(() => { setRealReels([]); setReelsErr(true); });
  }, []);
  useEffect(loadReels, [loadReels]);

  // restore YOUR stars after refresh (base counts already include you,
  // so seed the toggle without adding +1 twice)
  const [myInitialVibes, setMyInitialVibes] = useState({});
  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    fetchEngagement(user.id).then((e) => {
      setMyInitialVibes(e.myVibes);
      setVibes((v) => ({ ...e.myVibes, ...v }));
      setReposts((r) => ({ ...e.myReposts, ...r })); // reposts come back too
    }).catch(() => {});
  }, [user]);

  /* Who you are already mates with. Without this the button says
     "+ Mate up" to people who have been your mates for weeks — the
     screen was only remembering taps from this session. */
  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    fetchMateStates(user.id).then(setMateState).catch(() => {});
  }, [user]);

  // Real mode shows only real reels (with an honest empty state); demo uses the mock set.
  const data = SUPABASE_READY ? (realReels || []) : REELS;
  // still asking — see the note by the empty state below
  const loadingReels = SUPABASE_READY && realReels === null;
  /* Every row here came out of the feed with type === 'reel'. A reel
     is a video — so don't make that conditional on the filename. The
     old test wanted the URL to end in .mp4, and anything stored without
     an extension fell through to no video element at all: a black
     screen with nothing to explain it, which is exactly what people
     were seeing. */
  const isVideo = (uri) => looksPlayable(uri, true);

  const toggleVibe = (item) => {
    const next = !vibes[item.id];
    setVibes((v) => ({ ...v, [item.id]: next }));
    // persist — the star is still there after refresh
    if (SUPABASE_READY && user) persistVibe(item.id, user.id, next).catch(() => {});
    if (next) {
      tapLight(); sfxStar();
      setBurstId(item.id);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(() => setBurstId(null));
    }
  };

  /* One person, one truth: the same object shape the rest of the app
     opens a profile with, so a reel author behaves exactly like the
     same person tapped in the feed, the map or a comment thread. */
  const openProfile = (u) => {
    if (!u || !u.id) return;
    setProfileUser({ id: u.id, name: u.name, avatar: u.avatar, verified: !!u.verified, countryFlag: u.flag || null });
  };

  const mateLabel = (id) => {
    const s = mateState[id];
    return s === 'mates' ? 'Mates ✓' : s === 'requested' ? 'Requested' : s === 'incoming' ? 'Accept' : '+ Mate up';
  };

  /* Already mates or already asked? Tapping opens them instead of
     sending a request that would just be ignored. */
  const mateAction = (u) => {
    const s = mateState[u.id];
    if (s === 'mates' || s === 'requested') { tapLight(); openProfile(u); return; }
    tapMedium(); sfxPop();
    const optimistic = s === 'incoming' ? 'mates' : 'requested';
    setMateState((m) => ({ ...m, [u.id]: optimistic }));
    if (SUPABASE_READY && user && u.id && u.id !== user.id) {
      mateUp(user.id, u.id)
        .then((real) => setMateState((m) => ({ ...m, [u.id]: real })))
        // the request didn't land — put the button back rather than lie
        .catch(() => setMateState((m) => { const n = { ...m }; delete n[u.id]; return n; }));
    }
  };

  const lastTap = useRef(0);
  const onMediaTap = (item) => {
    const now = Date.now();
    if (now - lastTap.current < 300) { lastTap.current = 0; if (!vibes[item.id]) toggleVibe(item); }
    else lastTap.current = now;
  };

  const renderReel = ({ item }) => {
    const vibed = !!vibes[item.id];
    const reposted = !!reposts[item.id];
    return (
      <Pressable onPress={() => onMediaTap(item)} style={{ height: pageH }}>
        <ImageBackground source={{ uri: isVideo(item.media) ? undefined : item.media }} style={{ height: pageH, justifyContent: 'flex-end' }} resizeMode="cover">
          {/* real reels can be video — play it fullscreen behind the UI (web) */}
          {isVideo(item.media) && Platform.OS === 'web' ? (
            <video
              src={item.media}
              // no crossOrigin — see the note in ReelsViewer.js: it can
              // only forbid playback, never enable it
              autoPlay loop muted playsInline preload="auto"
              /* iOS starts a video on its own only when muted is a real
                 property and something asks it to play; without this a
                 posted reel shows as a black rectangle that never moves */
              ref={(el) => {
                if (!el || el.__wired) return;
                el.__wired = true;
                reelVideos.current.set(item.id, el);
                trackPlayer(el);
                if (activeReel.current == null) activeReel.current = item.id;
                if (activeReel.current === item.id) applySound(el);
                else { el.muted = true; try { el.pause(); } catch (e) {} }
                el.onerror = () => setDead((d) => ({ ...d, [item.id]: 'broken' }));
                /* Reels recorded before the WebKit fix are black in the
                   file itself. They load fine and report a width and a
                   readyState, which is why asking about those told us
                   nothing — so look at the actual pixels instead. */
                watchForBlankVideo(el, () => setDead((d) => ({ ...d, [item.id]: 'broken' })));
                // a file that won't load at all is a different failure
                setTimeout(() => {
                  if (!el.videoWidth && el.readyState < 2) setDead((d) => ({ ...d, [item.id]: 'broken' }));
                }, 4000);
              }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
          {dead[item.id] ? (
            <View style={{ position: 'absolute', top: '38%', left: 30, right: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>🎞️</Text>
              <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
                This reel didn't record properly
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
                It was shot before the camera bug was fixed, so the file itself has no picture.
              </Text>
              {user && item.user.id === user.id ? (
                <Pressable
                  onPress={() => {
                    tapLight();
                    deletePost(item.id, user.id).catch(() => {});
                    setRealReels((r) => (r || []).filter((x) => x.id !== item.id));
                  }}
                  style={{ marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>Delete it</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* gold star burst on double-tap */}
          {burstId === item.id ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                alignItems: 'center', justifyContent: 'center',
                opacity: burst.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.25, 1] }) }],
              }}
            >
              <MaterialCommunityIcons name="star-four-points" size={110} color={C.gold} />
            </Animated.View>
          ) : null}

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 90 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              {/* caption column */}
              <View style={{ flex: 1, marginRight: 14 }}>
                {item.sponsored ? (
                  <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 9 }}>
                    <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>SPONSORED</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
                  {/* the person — tap the face or the name to open them */}
                  <Pressable
                    onPress={() => { if (!item.sponsored) { tapLight(); openProfile(item.user); } }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    hitSlop={6}
                  >
                    <Image source={{ uri: item.user.avatar }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#FFF' }} />
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 9 }}>{item.user.name}{item.user.flag ? ' ' + item.user.flag : ''}</Text>
                  </Pressable>
                  {!item.sponsored && !(user && item.user.id === user.id) ? (
                    <Pressable
                      onPress={() => mateAction(item.user)}
                      style={{ marginLeft: 10, borderWidth: 1, borderColor: mateState[item.user.id] ? 'rgba(255,255,255,0.45)' : '#FFF', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>{mateLabel(item.user.id)}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 13.5, lineHeight: 19, marginBottom: 10 }} numberOfLines={3}>
                  {item.caption}
                </Text>
                {item.sponsored ? (
                  <Pressable onPress={() => { tapMedium(); sfxPop(); }}>
                    <LinearGradient
                      colors={[C.purple, '#5B21B6']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900', letterSpacing: 0.4 }}>{item.cta}</Text>
                      <Ionicons name="chevron-forward" size={15} color="#FFF" style={{ marginLeft: 4 }} />
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <SoundChip sound={item.sound} />
                )}
              </View>

              {/* action rail — the Moments identity column */}
              <View style={{ alignItems: 'center' }}>
                {isVideo(item.media) ? (
                  <RailButton label={sound ? 'Sound' : 'Muted'} onPress={toggleSound}>
                    <Ionicons name={sound ? 'volume-high' : 'volume-mute'} size={27} color="#FFF" />
                  </RailButton>
                ) : null}
                <RailButton label={Math.max(0, (item.vibes || 0) - (myInitialVibes[item.id] ? 1 : 0)) + (vibed ? 1 : 0)} color={vibed ? C.gold : '#FFF'} onPress={() => toggleVibe(item)}>
                  <MaterialCommunityIcons name={vibed ? 'star-four-points' : 'star-four-points-outline'} size={33} color={vibed ? C.gold : '#FFF'} />
                </RailButton>
                <RailButton label={item.comments || 0} onPress={() => setCommentsPost({ ...item, place: item.place || 'Reels' })}>
                  <MaterialCommunityIcons name="script-text-outline" size={30} color="#FFF" />
                </RailButton>
                <RailButton
                  label={(item.reposts || 0) + (reposted ? 1 : 0)}
                  color={reposted ? C.green : '#FFF'}
                  onPress={() => {
                    tapLight();
                    const next = !reposts[item.id];
                    setReposts((r) => ({ ...r, [item.id]: next }));
                    if (SUPABASE_READY && user) persistRepost(item.id, user.id, next).catch(() => {});
                  }}
                >
                  <MaterialCommunityIcons name="repeat-variant" size={32} color={reposted ? C.green : '#FFF'} />
                </RailButton>
                <RailButton label="Send" onPress={tapLight}>
                  <Ionicons name="paper-plane-outline" size={27} color="#FFF" />
                </RailButton>
                {item.sound ? (
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 15 }}>{item.sound.emoji}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setPageH(e.nativeEvent.layout.height)}>
      {pageH > 0 && data.length ? (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          renderItem={renderReel}
          pagingEnabled
          getItemLayout={(_, i) => ({ length: pageH, offset: pageH * i, index: i })}
          showsVerticalScrollIndicator={false}
          snapToInterval={pageH}
          decelerationRate="fast"
          onViewableItemsChanged={onReelViewable.current}
          viewabilityConfig={reelViewCfg.current}
        />
      ) : reelsErr ? (
        /* An empty shelf and an unreachable server are not the same
           thing, and "No reels yet — shoot the first one" is a lie when
           the truth is that nothing answered. */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 38 }}>📡</Text>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 12, textAlign: 'center' }}>Couldn't load reels</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            This is the connection, not you — everything posted is still there.
          </Text>
          <Pressable onPress={() => { tapMedium(); loadReels(); }} style={{ marginTop: 18 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Try again</Text>
            </View>
          </Pressable>
        </View>
      ) : loadingReels ? (
        /* Nothing has answered yet. "No reels yet" is a statement about
           the world, and we are not entitled to make it until the
           server has actually said so — announcing it and then filling
           the screen a second later is what reads as the app freezing
           and jumping. */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.65)" />
        </View>
      ) : pageH > 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 40 }}>🎬</Text>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 12, textAlign: 'center' }}>{t('no_reels')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            {t('no_reels_hint')}
          </Text>
          <Pressable onPress={() => { tapMedium(); sfxPop(); setShooting(true); }} style={{ marginTop: 18 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{t('shoot_a_reel')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* header — title + create, floating over the reel */}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', letterSpacing: 2, flex: 1 }}>
          REELS <Text style={{ color: C.gold }}>✦</Text>
        </Text>
        <Pressable onPress={() => { tapMedium(); sfxPop(); setShooting(true); }} hitSlop={8}>
          <Ionicons name="camera-outline" size={26} color="#FFF" />
        </Pressable>
      </View>

      {commentsPost ? <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} /> : null}
      {profileUser ? (
        <ProfileModal
          user={profileUser}
          onClose={() => {
            setProfileUser(null);
            // they may have mated up from inside the profile — re-read it
            if (SUPABASE_READY && user) fetchMateStates(user.id).then(setMateState).catch(() => {});
          }}
        />
      ) : null}
      {shooting ? <CaptureModal initialMode="reel" onClose={() => setShooting(false)} /> : null}
    </View>
  );
};
