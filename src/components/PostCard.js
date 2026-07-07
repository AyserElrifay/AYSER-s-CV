import React from 'react';
import { View, Text, Pressable, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
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

export const PostCard = ({ post, joined, vibed, onJoin, onVibe, onComment, onOpenProfile }) => {
  const mediaH = post.type === 'reel' ? 470 : post.type === 'vod' ? 208 : 250;
  const tc = typeChip(post);
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

      {/* media — or a quiet text card when the moment is just words */}
      {post.media ? (
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
        </ImageBackground>
      ) : (
        <View style={{ paddingHorizontal: 18, paddingVertical: 24, minHeight: 110, justifyContent: 'center' }}>
          <Text style={{ color: C.text, fontSize: 21, lineHeight: 31, fontWeight: '700' }}>
            {post.caption}
          </Text>
        </View>
      )}

      {/* footer — reactions always; JOIN only on real invitations */}
      <View style={{ padding: 15, paddingTop: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onVibe} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, opacity: vibed ? 1 : 0.5 }}>⚡</Text>
            <Text style={{ color: vibed ? C.green : C.dim, fontSize: 13.5, fontWeight: '800', marginLeft: 5 }}>
              {post.vibes + (joined ? 1 : 0) + (vibed ? 1 : 0)}
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
