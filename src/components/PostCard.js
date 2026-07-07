import React from 'react';
import { View, Text, Pressable, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { Glass } from './Glass';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { NeonButton } from './NeonButton';

const typeChip = (post) => {
  if (post.type === 'reel') return { label: 'REEL ✦', tint: C.purpleSoft, color: '#CDB4FF' };
  if (post.type === 'vod') return { label: '▶ WATCH · ' + post.duration, tint: 'rgba(18,18,20,0.75)', color: C.text };
  return { label: 'MOMENT', tint: 'rgba(18,18,20,0.75)', color: C.dim };
};

export const PostCard = ({ post, joined, vibed, onJoin, onVibe, onComment, onOpenProfile }) => {
  const mediaH = post.type === 'reel' ? 470 : post.type === 'vod' ? 208 : 250;
  const tc = typeChip(post);
  return (
    <Glass style={{ marginBottom: 20, overflow: 'hidden' }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 13 }}>
        <Pressable onPress={() => onOpenProfile(post.user)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={{ uri: post.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{post.user.name}</Text>
              {post.user.verified ? <Tick /> : null}
            </View>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>
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
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(18,18,20,0.6)', borderWidth: 1, borderColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="play" size={24} color={C.text} style={{ marginLeft: 3 }} />
              </View>
            </View>
          ) : null}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} style={{ padding: 13, paddingTop: 44 }}>
            <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19, fontWeight: '500' }} numberOfLines={3}>
              {post.caption}
            </Text>
          </LinearGradient>
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={[C.purpleSoft, 'rgba(124,58,237,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 18, paddingVertical: 26, minHeight: 120, justifyContent: 'center' }}
        >
          <Text style={{ color: C.text, fontSize: 19, lineHeight: 28, fontWeight: '700' }}>
            {post.caption}
          </Text>
        </LinearGradient>
      )}

      {/* footer */}
      <View style={{ padding: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={onVibe} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, opacity: vibed ? 1 : 0.55 }}>⚡</Text>
            <Text style={{ color: vibed ? C.green : C.dim, fontSize: 12.5, fontWeight: '800', marginLeft: 4 }}>
              {post.vibes + (joined ? 1 : 0) + (vibed ? 1 : 0)}
            </Text>
          </Pressable>
          <Pressable onPress={onComment} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
            <Text style={{ fontSize: 14, opacity: 0.7 }}>💬</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700', marginLeft: 4 }}>{post.comments}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Ionicons name="paper-plane-outline" size={18} color={C.dim} style={{ marginRight: 16 }} />
          <Ionicons name="bookmark-outline" size={18} color={C.dim} />
        </View>
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
    </Glass>
  );
};
