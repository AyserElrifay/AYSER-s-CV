import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ImageBackground, Animated, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SoundChip } from './SoundChip';

const { width: W } = Dimensions.get('window');
const STORY_MS = 5000;

/* Full-screen story playback: tap right → next, left → back,
   auto-advances with the familiar progress bars up top. */
export const StoryViewer = ({ stories, startIndex = 0, onClose }) => {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const story = stories[index];

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) {
        if (index < stories.length - 1) setIndex(index + 1);
        else onClose();
      }
    });
    return () => anim.stop();
  }, [index, progress, stories.length, onClose]);

  if (!story) return null;

  const go = (dir) => {
    const next = index + dir;
    if (next < 0 || next >= stories.length) { onClose(); return; }
    setIndex(next);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ImageBackground source={{ uri: story.media }} style={{ flex: 1 }} resizeMode="cover">
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 30 }}>
            {/* progress bars */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {stories.map((_, i) => (
                <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, overflow: 'hidden' }}>
                  <Animated.View
                    style={{
                      height: 3, backgroundColor: '#FFF',
                      width: i < index ? '100%' : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                    }}
                  />
                </View>
              ))}
            </View>
            {/* author row */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: story.user.avatar }} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFF' }} />
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginLeft: 9, flex: 1 }}>
                {story.user.name} <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>· now</Text>
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={26} color="#FFF" />
              </Pressable>
            </View>
          </LinearGradient>

          {/* tap zones */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Pressable style={{ width: W * 0.3 }} onPress={() => go(-1)} />
            <View style={{ flex: 1 }} />
            <Pressable style={{ width: W * 0.3 }} onPress={() => go(1)} />
          </View>

          {/* caption + sound */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={{ padding: 16, paddingBottom: insets.bottom + 22 }}>
            {story.caption ? (
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>{story.caption}</Text>
            ) : null}
            <SoundChip sound={story.sound} />
          </LinearGradient>
        </ImageBackground>
      </View>
    </Modal>
  );
};
