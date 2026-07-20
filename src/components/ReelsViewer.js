import React from 'react';
import { View, Text, Modal, Pressable, ImageBackground, FlatList, Dimensions, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, TEXT_BGS } from '../constants/theme';
import { SoundChip } from './SoundChip';

const { height: H } = Dimensions.get('window');

/* TikTok-style full-screen reels: swipe up for the next one, action
   rail on the right, sound tag at the bottom. */
export const ReelsViewer = ({ reels, startIndex = 0, vibes, onVibe, onComment, onClose }) => {
  const insets = useSafeAreaInsets();

  const renderReel = ({ item }) => {
    const vibed = !!vibes[item.id];
    const bg = TEXT_BGS[item.textBg] || null;
    // an uploaded reel VIDEO must actually play — it was being drawn as a
    // still ImageBackground before, which is why reels "wouldn't load"
    const isVideo = typeof item.media === 'string' && /\.(mp4|webm|mov)(\?|#|$)/i.test(item.media);
    const content = item.media ? (
      isVideo && Platform.OS === 'web' ? (
        <View style={{ height: H, justifyContent: 'flex-end' }}>
          {/* muted+playsInline = iOS actually autoplays it */}
          <video
            src={item.media}
            autoPlay muted loop playsInline
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {inner(item, vibed)}
        </View>
      ) : (
      <ImageBackground source={{ uri: item.media }} style={{ height: H, justifyContent: 'flex-end' }} resizeMode="cover">
        {inner(item, vibed)}
      </ImageBackground>
      )
    ) : (
      <LinearGradient colors={bg ? bg.colors : ['#4C1D95', '#7C3AED']} style={{ height: H, justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ color: bg ? bg.text : '#FFF', fontSize: 26, lineHeight: 38, fontWeight: '800', textAlign: 'center' }}>
            {item.caption}
          </Text>
        </View>
        {inner(item, vibed, true)}
      </LinearGradient>
    );
    return <View style={{ height: H }}>{content}</View>;
  };

  const inner = (item, vibed, textMode) => (
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28, paddingTop: 70 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, marginRight: 14 }}>
          {/* author */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Image source={{ uri: item.user.avatar }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#FFF' }} />
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 9 }}>{item.user.name}</Text>
          </View>
          {!textMode ? (
            <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 13.5, lineHeight: 19, marginBottom: 10 }} numberOfLines={3}>
              {item.caption}
            </Text>
          ) : null}
          <SoundChip sound={item.sound} />
        </View>

        {/* action rail */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => onVibe(item)} hitSlop={8} style={{ alignItems: 'center', marginBottom: 18 }}>
            <MaterialCommunityIcons name={vibed ? 'star-four-points' : 'star-four-points-outline'} size={32} color={vibed ? C.gold : '#FFF'} />
            <Text style={{ color: vibed ? C.gold : '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>
              {(item.vibes || 0) + (vibed ? 1 : 0)}
            </Text>
          </Pressable>
          <Pressable onPress={() => onComment(item)} hitSlop={8} style={{ alignItems: 'center', marginBottom: 18 }}>
            <MaterialCommunityIcons name="script-text-outline" size={30} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>{item.comments || 0}</Text>
          </Pressable>
          <Pressable hitSlop={8} style={{ alignItems: 'center' }}>
            <Ionicons name="paper-plane-outline" size={26} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>Share</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={reels}
          keyExtractor={(r) => r.id}
          renderItem={renderReel}
          pagingEnabled
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: H, offset: H * i, index: i })}
          showsVerticalScrollIndicator={false}
          snapToInterval={H}
          decelerationRate="fast"
        />
        {/* header */}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', letterSpacing: 2, flex: 1 }}>REELS ✦</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
