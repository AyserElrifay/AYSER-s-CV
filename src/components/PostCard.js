import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Image, ImageBackground, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R, TEXT_BGS } from '../constants/theme';
import { Glass } from './Glass';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { NeonButton } from './NeonButton';

/* Chips sit on photos, so they stay dark with light text for contrast. */
const typeChip = (post) => {
  if (post.type === 'reel') return { label: 'REEL ✦', tint: 'rgba(124,58,237,0.9)', color: '#FFF' };
  if (post.type === 'vod') return { label: '▶ WATCH · ' + post.duration, tint: 'rgba(17,24,39,0.65)', color: '#FFF' };
  return { label: 'MOMENT', tint: 'rgba(17,24,39,0.65)', color: 'rgba(255,255,255,0.85)' };
};

export const PostCard = ({ post, joined, vibed, onJoin, onVibe, onComment, onOpenProfile, onOpenReel }) => {
  const mediaH = post.type === 'reel' ? 470 : post.type === 'vod' ? 208 : 250;
  const tc = typeChip(post);
  const textBg = TEXT_BGS[post.textBg] || TEXT_BGS.plain;

  /* Instagram-style double-tap to vibe (⚡ burst); a single tap on a
     reel opens the full-screen TikTok-style viewer instead. */
  const lastTap = useRef(0);
  const singleTimer = useRef(null);
  const burst = useRef(new Animated.Value(0)).current;
  const [bursting, setBursting] = useState(false);
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
      <Text style={{ fontSize: 84 }}>⚡</Text>
    </Animated.View>
  ) : null;

  const totalVibes = post.vibes + (joined ? 1 : 0) + (vibed ? 1 : 0);

  return (
    <Glass style={{ marginBottom: 24, overflow: 'hidden' }}>
      {/* header — a touch larger, with room to breathe */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15 }}>
        <Pressable onPress={() => onOpenProfile(post.user)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={{ uri: post.user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          <View style={{ marginLeft: 11, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }}>{post.user.name}</Text>
              {post.user.verified ? <Tick /> : null}
            </View>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
              {post.place} · {post.startsIn}
            </Text>
          </View>
        </Pressable>
        <Ionicons name="ellipsis-horizontal" size={18} color={C.faint} />
      </View>

      {/* media — or a colored text card when the moment is just words.
          Double-tap either one to vibe, Instagram style. */}
      {post.media ? (
        <Pressable onPress={handleMediaTap}>
          <ImageBackground source={{ uri: post.media }} style={{ height: mediaH, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
              <Chip label={tc.label} tint={tc.tint} color={tc.color} />
              {post.startsIn === 'Live now' ? <Chip label="● LIVE" tint="rgba(244,63,94,0.9)" color="#fff" style={{ borderColor: 'transparent' }} /> : null}
            </View>
            {post.type === 'vod' ? (
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(17,24,39,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 3 }} />
                </View>
              </View>
            ) : null}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={{ padding: 14, paddingTop: 44 }}>
              <Text style={{ color: '#FFF', fontSize: 14.5, lineHeight: 21, fontWeight: '500' }} numberOfLines={3}>
                {post.caption}
              </Text>
            </LinearGradient>
            {burstOverlay}
          </ImageBackground>
        </Pressable>
      ) : (
        <Pressable onPress={handleMediaTap}>
          <LinearGradient
            colors={textBg.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 22, paddingVertical: 34, minHeight: 150, justifyContent: 'center' }}
          >
            <Text style={{ color: textBg.text, fontSize: 22, lineHeight: 32, fontWeight: '700', textAlign: 'center' }}>
              {post.caption}
            </Text>
            {burstOverlay}
          </LinearGradient>
        </Pressable>
      )}

      {/* footer — reactions always; JOIN only on real invitations */}
      <View style={{ padding: 15, paddingTop: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onVibe} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, opacity: vibed ? 1 : 0.5 }}>⚡</Text>
            <Text style={{ color: vibed ? C.green : C.dim, fontSize: 13.5, fontWeight: '800', marginLeft: 5 }}>
              {totalVibes}
            </Text>
          </Pressable>
          <Pressable onPress={onComment} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 18 }}>
            <Text style={{ fontSize: 15, opacity: 0.65 }}>💬</Text>
            <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '700', marginLeft: 5 }}>{post.comments}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Ionicons name="paper-plane-outline" size={19} color={C.dim} style={{ marginRight: 16 }} />
          <Ionicons name="bookmark-outline" size={19} color={C.dim} />
        </View>

        {/* social proof, Instagram style */}
        {totalVibes > 0 ? (
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 9 }}>
            ⚡ Vibed by{' '}
            <Text style={{ fontWeight: '800', color: C.text }}>
              {vibed ? 'you' : post.topFan || 'the crew'}
            </Text>
            {totalVibes > 1 ? ' and ' + (totalVibes - 1) + ' others' : ''}
          </Text>
        ) : null}

        {post.joinable ? (
          <View style={{ marginTop: 13 }}>
            {joined ? (
              <Glass tint={C.greenSoft} border="rgba(16,185,129,0.5)" style={{ paddingVertical: 13, alignItems: 'center', borderRadius: R - 4 }}>
                <Text style={{ color: C.green, fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
                  ✓ VIBE JOINED · {post.squad.toUpperCase()} IS LIVE
                </Text>
              </Glass>
            ) : (
              <NeonButton label="JOIN THE VIBE" icon="⚡" onPress={() => onJoin(post)} />
            )}
          </View>
        ) : null}
      </View>
    </Glass>
  );
};
