import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C, R } from '../constants/theme';
import { ME, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { createPost } from '../services/posts';
import { uploadMedia } from '../services/social';
import { useAuth } from '../context/AuthContext';
import { Micro } from './Micro';
import { NeonButton } from './NeonButton';

/* One screen, one thought: what's your moment?
   Text is enough; a photo and a place are optional. */

export const ComposeModal = ({ onClose, onPosted }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const share = async () => {
    if (!caption.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      let card;
      if (SUPABASE_READY && user) {
        let mediaUrl = null;
        if (imageUri) mediaUrl = await uploadMedia(user.id, imageUri);
        const row = await createPost({
          userId: user.id,
          type: 'post',
          caption: caption.trim(),
          place: place.trim() || null,
          mediaUrl,
        });
        card = {
          id: row.id,
          user: {
            name: (row.user && row.user.name) || 'You',
            avatar: (row.user && row.user.avatar_url) || av(60),
            verified: !!(row.user && row.user.verified),
          },
          type: 'post',
          media: row.media_url,
          caption: row.caption,
          place: row.place || 'Somewhere out there',
          startsIn: 'Live now',
          coords: ME.coords,
          vibes: 0, comments: 0, squad: 'New Vibe Squad',
        };
      } else {
        card = {
          id: 'local-' + Date.now(),
          user: { name: 'You', avatar: av(60), verified: false },
          type: 'post',
          media: imageUri,
          caption: caption.trim(),
          place: place.trim() || 'Right here',
          startsIn: 'Live now',
          coords: ME.coords,
          vibes: 0, comments: 0, squad: 'New Vibe Squad',
        };
      }
      onPosted(card);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not share your moment. Try again.');
    } finally {
      setBusy(false);
    }
  };

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
          <Micro color={C.purple}>New Moment ✨</Micro>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <TextInput
            placeholder="What's your moment?"
            placeholderTextColor={C.faint}
            value={caption}
            onChangeText={setCaption}
            multiline
            autoFocus
            style={{
              color: C.text, fontSize: 18, lineHeight: 26, minHeight: 120,
              textAlignVertical: 'top', padding: 4,
            }}
          />

          {imageUri ? (
            <View style={{ marginTop: 12 }}>
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: 260, borderRadius: R }} />
              <Pressable
                onPress={() => setImageUri(null)}
                style={{
                  position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
                  backgroundColor: 'rgba(18,18,20,0.8)', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={16} color={C.text} />
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
            <Pressable
              onPress={pickImage}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10,
              }}
            >
              <Ionicons name="image-outline" size={16} color={C.green} />
              <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 7 }}>
                {imageUri ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>
            <View
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
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
          </View>

          {error ? (
            <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginTop: 14 }}>{error}</Text>
          ) : null}

          <NeonButton
            label={busy ? 'SHARING…' : 'SHARE THE MOMENT'}
            icon="⚡"
            style={{ marginTop: 22, opacity: caption.trim() ? 1 : 0.45 }}
            onPress={busy ? undefined : share}
          />
        </ScrollView>
      </View>
    </Modal>
  );
};
