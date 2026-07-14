import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ImageBackground, FlatList, Image, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { REELS, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchFeed } from '../services/posts';
import { mateUp } from '../services/mates';
import { toggleVibe as persistVibe, toggleRepost as persistRepost, fetchEngagement } from '../services/social';
import { SoundChip } from '../components/SoundChip';
import { CommentsSheet } from '../components/CommentsSheet';
import { CaptureModal } from '../components/CaptureModal';
import { tapLight, tapMedium } from '../utils/feedback';
import { sfxStar, sfxPop } from '../utils/sfx';

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
  const [pageH, setPageH] = useState(0);
  const [vibes, setVibes] = useState({});
  const [reposts, setReposts] = useState({});
  const [following, setFollowing] = useState({});
  const [commentsPost, setCommentsPost] = useState(null);
  const [shooting, setShooting] = useState(false);
  const burst = useRef(new Animated.Value(0)).current;
  const [burstId, setBurstId] = useState(null);
  const [realReels, setRealReels] = useState(null); // null until loaded

  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchFeed()
      .then((rows) => setRealReels((rows || [])
        .filter((r) => r.type === 'reel')
        .map((r) => ({
          id: r.id,
          user: { id: r.user_id, name: (r.user && r.user.name) || 'Explorer', avatar: (r.user && r.user.avatar_url) || av(60), verified: !!(r.user && r.user.verified) },
          media: r.media_url,
          caption: r.caption || '',
          sound: r.sound_title ? { title: r.sound_title, artist: r.sound_artist || '', emoji: '🎵' } : null,
          vibes: r.vibes || 0, comments: r.comments || 0, reposts: 0,
        }))))
      .catch(() => setRealReels([]));
  }, []);

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

  // Real mode shows only real reels (with an honest empty state); demo uses the mock set.
  const data = SUPABASE_READY ? (realReels || []) : REELS;
  const isVideo = (uri) => typeof uri === 'string' && /\.(webm|mp4|mov|m4v)(\?|$)/i.test(uri);

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
            <video src={item.media} autoPlay loop muted playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  <Image source={{ uri: item.user.avatar }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#FFF' }} />
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 9 }}>{item.user.name}</Text>
                  {!item.sponsored ? (
                    <Pressable
                      onPress={() => {
                        tapMedium(); sfxPop();
                        setFollowing((f) => ({ ...f, [item.user.id]: !f[item.user.id] }));
                        // real friend request — needs schema_v8_mates.sql
                        if (SUPABASE_READY && user && item.user.id && item.user.id !== user.id) {
                          mateUp(user.id, item.user.id).catch(() => {});
                        }
                      }}
                      style={{ marginLeft: 10, borderWidth: 1, borderColor: following[item.user.id] ? 'rgba(255,255,255,0.45)' : '#FFF', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>
                        {following[item.user.id] ? 'Mates ✓' : '+ Mate up'}
                      </Text>
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
        />
      ) : pageH > 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 40 }}>🎬</Text>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 12, textAlign: 'center' }}>No reels yet</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            Tap the camera to shoot the first one — hold to record 🎥
          </Text>
          <Pressable onPress={() => { tapMedium(); sfxPop(); setShooting(true); }} style={{ marginTop: 18 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Shoot a reel</Text>
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
      {shooting ? <CaptureModal initialMode="reel" onClose={() => setShooting(false)} /> : null}
    </View>
  );
};
