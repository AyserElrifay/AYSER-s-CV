import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C, R, TEXT_BGS } from '../constants/theme';
import { ME, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { createPost } from '../services/posts';
import { uploadMedia } from '../services/social';
import { useAuth } from '../context/AuthContext';
import { tapSuccess } from '../utils/feedback';
import { Micro } from './Micro';
import { NeonButton } from './NeonButton';
import { SoundPicker } from './SoundPicker';
import { SoundChip } from './SoundChip';

/* The creation studio — one place to share a Moment, a Reel, or a
   Story. Shoot from the camera or pick from the gallery, add a sound
   (IG/TikTok style), and go. */

const MODES = [
  { id: 'post', label: 'Moment', emoji: '✨' },
  { id: 'reel', label: 'Reel', emoji: '🎬' },
  { id: 'story', label: 'Story', emoji: '⭕' },
];

export const ComposeModal = ({ initialMode = 'post', onClose, onPosted, onPostedStory }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [textBg, setTextBg] = useState('plain');
  const [sound, setSound] = useState(null);
  const [pickingSound, setPickingSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isReel = mode === 'reel';
  const isStory = mode === 'story';

  const pick = async (fromCamera) => {
    const opts = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true };
    let result;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError('Camera permission needed to shoot 🎥'); return; }
      result = await ImagePicker.launchCameraAsync(opts);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(opts);
    }
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const share = async () => {
    if (busy) return;
    if (isStory && !imageUri) { setError('A story needs a photo — shoot one! 📸'); return; }
    if (!isStory && !caption.trim()) return;
    setError(null);
    setBusy(true);
    try {
      if (isStory) {
        // Stories live in the rail (local for now; stories table is ready in schema.sql)
        onPostedStory({
          user: { id: 'me', name: 'You', avatar: av(60) },
          media: imageUri,
          sound,
          caption: caption.trim() || null,
        });
        tapSuccess();
        onClose();
        return;
      }

      let card;
      if (SUPABASE_READY && user) {
        let mediaUrl = null;
        if (imageUri) mediaUrl = await uploadMedia(user.id, imageUri);
        const row = await createPost({
          userId: user.id,
          type: isReel ? 'reel' : 'post',
          caption: caption.trim(),
          place: place.trim() || null,
          mediaUrl,
          textBg: mediaUrl || textBg === 'plain' ? null : textBg,
        });
        card = {
          id: row.id,
          user: {
            name: (row.user && row.user.name) || 'You',
            avatar: (row.user && row.user.avatar_url) || av(60),
            verified: !!(row.user && row.user.verified),
          },
          type: row.type,
          media: row.media_url,
          textBg: row.text_bg,
          caption: row.caption,
          place: row.place || 'Somewhere out there',
          startsIn: 'Live now',
          coords: ME.coords,
          sound,
          vibes: 0, comments: 0, squad: 'New Vibe Squad',
        };
      } else {
        card = {
          id: 'local-' + Date.now(),
          user: { name: 'You', avatar: av(60), verified: false },
          type: isReel ? 'reel' : 'post',
          media: imageUri,
          textBg: imageUri ? null : textBg,
          caption: caption.trim(),
          place: place.trim() || 'Right here',
          startsIn: 'Live now',
          coords: ME.coords,
          sound,
          vibes: 0, comments: 0, squad: 'New Vibe Squad',
        };
      }
      tapSuccess();
      onPosted(card);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not share. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareLabel = busy ? 'SHARING…' : isStory ? 'ADD TO YOUR STORY' : isReel ? 'POST REEL 🎬' : 'SHARE THE MOMENT';
  const canShare = isStory ? !!imageUri : !!caption.trim();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View
          style={{
            paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={onClose}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
          <Micro color={C.purple}>Create ✨</Micro>
          <View style={{ width: 38 }} />
        </View>

        {/* mode switch: Moment / Reel / Story */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.glassHi, borderRadius: 999, padding: 4 }}>
          {MODES.map((m) => (
            <Pressable
              key={m.id}
              testID={'mode-' + m.id}
              onPress={() => setMode(m.id)}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999,
                backgroundColor: mode === m.id ? '#FFFFFF' : 'transparent',
              }}
            >
              <Text style={{ color: mode === m.id ? C.text : C.dim, fontSize: 13, fontWeight: '800' }}>
                {m.emoji} {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          {/* caption canvas */}
          <LinearGradient
            colors={imageUri || isStory ? ['transparent', 'transparent'] : TEXT_BGS[textBg].colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: R - 4, paddingHorizontal: textBg === 'plain' || imageUri || isStory ? 4 : 16, paddingVertical: textBg === 'plain' || imageUri || isStory ? 0 : 20 }}
          >
            <TextInput
              placeholder={isStory ? 'Say something (optional)…' : isReel ? 'Describe your reel…' : "What's your moment?"}
              placeholderTextColor={imageUri || isStory || textBg === 'plain' ? C.faint : TEXT_BGS[textBg].text + '99'}
              value={caption}
              onChangeText={setCaption}
              multiline
              style={{
                color: imageUri || isStory || textBg === 'plain' ? C.text : TEXT_BGS[textBg].text,
                fontSize: 19, lineHeight: 28, minHeight: isStory ? 60 : 100,
                textAlignVertical: 'top',
                textAlign: imageUri || isStory || textBg === 'plain' ? 'left' : 'center',
                fontWeight: imageUri || isStory || textBg === 'plain' ? '400' : '700',
              }}
            />
          </LinearGradient>

          {/* text backgrounds — only for photo-less Moments */}
          {!imageUri && mode === 'post' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              {Object.keys(TEXT_BGS).map((key) => (
                <Pressable key={key} onPress={() => setTextBg(key)} hitSlop={4}>
                  <LinearGradient
                    colors={TEXT_BGS[key].colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 34, height: 34, borderRadius: 17, marginRight: 10,
                      borderWidth: textBg === key ? 2.5 : 1,
                      borderColor: textBg === key ? C.purple : C.line,
                    }}
                  />
                </Pressable>
              ))}
              <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 2 }}>Text background</Text>
            </View>
          ) : null}

          {imageUri ? (
            <View style={{ marginTop: 12 }}>
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: isStory || isReel ? 340 : 260, borderRadius: R }} />
              <Pressable
                onPress={() => setImageUri(null)}
                style={{
                  position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
                  backgroundColor: 'rgba(17,24,39,0.7)', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#FFF" />
              </Pressable>
              {sound ? (
                <View style={{ position: 'absolute', bottom: 10, left: 10 }}>
                  <SoundChip sound={sound} />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* capture row: camera · gallery · sound */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
            <Pressable
              testID="btn-camera"
              onPress={() => pick(true)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: C.coralSoft, borderWidth: 1, borderColor: 'rgba(244,63,94,0.35)',
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
              }}
            >
              <Ionicons name="camera" size={16} color={C.coral} />
              <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 7 }}>Shoot</Text>
            </Pressable>
            <Pressable
              onPress={() => pick(false)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
              }}
            >
              <Ionicons name="image-outline" size={16} color={C.green} />
              <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 7 }}>Gallery</Text>
            </Pressable>
            {isReel || isStory ? (
              <Pressable
                testID="btn-sound"
                onPress={() => setPickingSound(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: sound ? C.purpleSoft : C.glass,
                  borderWidth: 1, borderColor: sound ? 'rgba(124,58,237,0.45)' : C.line,
                  borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
                }}
              >
                <Text style={{ fontSize: 13 }}>🎵</Text>
                <Text style={{ color: sound ? C.purple : C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 7 }} numberOfLines={1}>
                  {sound ? sound.title : 'Add sound'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* place — for Moments & Reels */}
          {!isStory ? (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', marginTop: 12,
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 999, paddingHorizontal: 14,
              }}
            >
              <Ionicons name="location-outline" size={14} color={C.dim} />
              <TextInput
                placeholder="Add a place"
                placeholderTextColor={C.faint}
                value={place}
                onChangeText={setPlace}
                style={{ flex: 1, color: C.text, fontSize: 12.5, marginLeft: 6, paddingVertical: Platform.OS === 'ios' ? 10 : 8 }}
              />
            </View>
          ) : null}

          {error ? (
            <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginTop: 14 }}>{error}</Text>
          ) : null}

          <NeonButton
            label={shareLabel}
            icon="⚡"
            color={isStory ? C.purple : C.green}
            style={{ marginTop: 22, opacity: canShare ? 1 : 0.45 }}
            onPress={busy ? undefined : share}
          />
        </ScrollView>

        {pickingSound ? (
          <SoundPicker selected={sound} onSelect={setSound} onClose={() => setPickingSound(false)} />
        ) : null}
      </View>
    </Modal>
  );
};
