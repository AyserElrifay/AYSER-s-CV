import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { C, R, TEXT_BGS } from '../constants/theme';
import { ME, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { createPost } from '../services/posts';
import { uploadMedia, uploadCapture } from '../services/social';
import { compressImage } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { tapSuccess } from '../utils/feedback';
import { Micro } from './Micro';
import { NeonButton } from './NeonButton';
import { SoundPicker } from './SoundPicker';
import { SoundChip } from './SoundChip';
import { TagPeoplePicker } from './TagPeoplePicker';
import { tagPeople } from '../services/tags';
import { UP_FOR, monthOptions } from '../constants/travel';

/* The creation studio — one place to share a Moment, a Reel, or a
   Story. Shoot from the camera or pick from the gallery, add a sound
   (IG/TikTok style), and go. */

const MODES = [
  { id: 'post', label: 'Moment', emoji: '✨' },
  { id: 'reel', label: 'Reel', emoji: '🎬' },
  { id: 'story', label: 'Story', emoji: '⭕' },
  { id: 'travel', label: 'Travel', emoji: '🧳' },
];

export const ComposeModal = ({ initialMode = 'post', initialCaption = '', onClose, onPosted, onPostedStory, onOpenStudio }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState(initialMode);
  // opened from a topic → the tag is already in the box, cursor after it
  const [caption, setCaption] = useState(initialCaption ? initialCaption + ' ' : '');
  const [place, setPlace] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [textBg, setTextBg] = useState('plain');
  const [sound, setSound] = useState(null);
  const [pickingSound, setPickingSound] = useState(false);
  const [tagged, setTagged] = useState([]);        // real people, in this moment
  const [taggingOpen, setTaggingOpen] = useState(false);
  // travel plan
  const [planTitle, setPlanTitle] = useState('');
  const [planFrom, setPlanFrom] = useState(null);
  const [planTo, setPlanTo] = useState(null);
  const [upFor, setUpFor] = useState([]);
  const MONTHS = React.useMemo(monthOptions, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // a pending hand-off must not fire after this screen has gone
  const doneTimer = React.useRef(null);
  React.useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); }, []);

  const isReel = mode === 'reel';
  const isStory = mode === 'story';
  const isTravel = mode === 'travel';

  // Real, enforced sizes (not just a suggestion): Moment 4:5, Reel/Story
  // 9:16 — the crop UI forces it, so every upload actually matches the
  // shape the feed/reel/story viewer is built for.
  const aspectFor = (m) => (m === 'post' || m === 'travel' ? [4, 5] : [9, 16]);

  const pick = async (fromCamera) => {
    const opts = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: aspectFor(mode) };
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
      setImageMime(result.assets[0].mimeType || 'image/jpeg');
      setError(null);
    }
  };

  /* A plan with no headline and no destination is just a status update,
     and it would show up in the feed as an empty card — so the two
     things the card is built around are the two things we insist on. */
  const planReady = !!planTitle.trim() && !!place.trim();
  const plan = isTravel ? {
    title: planTitle.trim(),
    from: planFrom || null,
    to: planTo || null,
    upFor: upFor.slice(),
  } : null;

  const share = async () => {
    if (busy) return;
    if (isStory && !imageUri) { setError('A story needs a photo — shoot one! 📸'); return; }
    if (isTravel && !planReady) { setError('A plan needs a headline and where you\'re going 🧳'); return; }
    /* A plan's headline is its content, so it does not also need a
       caption. It used to: the button went bright the moment the
       headline and the destination were in, and then this line returned
       without a word, so the button looked broken and nothing posted. */
    if (!isStory && !isTravel && !caption.trim()) return;
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
        if (imageUri) {
          // shrink to feed size before uploading — same look, ~6x fewer bytes
          const small = Platform.OS === 'web' ? await compressImage(imageUri, 1600, 0.85) : imageUri;
          const shrunk = small !== imageUri;
          const ext = shrunk ? 'jpg' : (imageMime.split('/')[1] === 'jpeg' ? 'jpg' : (imageMime.split('/')[1] || 'jpg'));
          mediaUrl = await uploadCapture(user.id, small, ext, shrunk ? 'image/jpeg' : imageMime);
        }
        const row = await createPost({
          userId: user.id,
          type: isReel ? 'reel' : isTravel ? 'travel' : 'post',
          caption: caption.trim(),
          place: place.trim() || null,
          mediaUrl,
          textBg: mediaUrl || textBg === 'plain' ? null : textBg,
          plan,
        });
        /* The tags go on the moment the instant it exists. Each one
           writes a real row and sends that person a real notification —
           a tag they can remove themselves whenever they want. */
        if (tagged.length) {
          try { await tagPeople(row.id, user.id, tagged.map((p) => p.id)); } catch (e) {}
        }
        /* If the database had nowhere to keep the plan, the card must
           not pretend otherwise — showing a travel card that vanishes on
           the next reload is a worse lie than the missing column. */
        const planLost = !!(plan && !row.plan);
        card = {
          id: row.id,
          tagged,
          userId: user.id,
          user: {
            id: user.id,
            name: (row.user && row.user.name) || 'You',
            avatar: (row.user && row.user.avatar_url) || av(60),
            verified: !!(row.user && row.user.verified),
          },
          type: row.type,
          media: row.media_url,
          textBg: row.text_bg,
          caption: row.caption,
          plan: planLost ? null : (row.plan || plan),
          __planLost: planLost,
          place: row.place || 'Somewhere out there',
          startsIn: 'Live now',
          coords: ME.coords,
          sound,
          vibes: 0, comments: 0, squad: 'New Vibe Squad',
        };
      } else {
        card = {
          id: 'local-' + Date.now(),
          tagged,
          user: { name: 'You', avatar: av(60), verified: false },
          type: isReel ? 'reel' : isTravel ? 'travel' : 'post',
          media: imageUri,
          textBg: imageUri ? null : textBg,
          caption: caption.trim(),
          plan,
          place: place.trim() || 'Right here',
          startsIn: 'Live now',
          coords: ME.coords,
          sound,
          vibes: 0, comments: 0, squad: 'New Vibe Squad',
        };
      }
      /* A plan posted into a database that has not been given somewhere
         to keep it goes up as an ordinary moment — which is fine, except
         that saying nothing means somebody writes out their whole trip
         and quietly gets a normal post. Say it, in words that mean
         something to the person reading them. */
      if (isTravel && card && card.__planLost) {
        /* Stay busy while the message is up. Clearing it here let a
           second tap in those two and a half seconds post the whole
           thing twice. */
        setError('Posted — but travel plans are not switched on yet, so this went up as an ordinary moment 🧳');
        doneTimer.current = setTimeout(() => { onPosted(card); onClose(); }, 2600);
        return;
      }
      tapSuccess();
      onPosted(card);
      onClose();
    } catch (e) {
      setError('Could not share. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareLabel = busy ? 'SHARING…'
    : isStory ? 'ADD TO YOUR STORY'
    : isReel ? 'POST REEL 🎬'
    : isTravel ? 'POST YOUR PLAN 🧳'
    : 'SHARE THE MOMENT';
  const canShare = isStory ? !!imageUri : isTravel ? planReady : !!caption.trim();

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
              onPress={() => {
                /* A reel or a story needs the camera: video, filters,
                   lenses, sounds and your library all live there. This
                   sheet only ever did photos, which is why posting a
                   reel from here had no video option and no edits. */
                if ((m.id === 'reel' || m.id === 'story') && onOpenStudio) { onOpenStudio(m.id); return; }
                setMode(m.id);
              }}
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
          {/* ── the plan itself: the headline and the dates ──
              These sit above everything else because they are what the
              card leads with, and seeing them first while you write is
              the difference between filling in a form and writing a
              post. */}
          {isTravel ? (
            <View style={{ marginBottom: 16 }}>
              <TextInput
                placeholder="Solo traveler exploring…"
                placeholderTextColor={C.faint}
                value={planTitle}
                onChangeText={setPlanTitle}
                style={{
                  color: C.text, fontSize: 19, fontWeight: '800',
                  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                  borderRadius: R - 4, paddingHorizontal: 14, paddingVertical: 13,
                }}
              />
              <Text style={{ color: C.faint, fontSize: 11, marginTop: 7, marginLeft: 4 }}>
                The one line people will see first
              </Text>

              <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 16, marginLeft: 2 }}>WHEN</Text>
              {/* Leaving before you arrive is not a trip. Picking one end
                  past the other carries the other along rather than
                  refusing the tap or quietly posting "Dec → Aug". */}
              {[{ k: 'from',
                  label: 'Arriving',
                  val: planFrom,
                  set: (v) => { setPlanFrom(v); if (v && planTo && planTo < v) setPlanTo(v); } },
                { k: 'to',
                  label: 'Leaving',
                  val: planTo,
                  set: (v) => { setPlanTo(v); if (v && planFrom && v < planFrom) setPlanFrom(v); } }].map((rowDef) => (
                <View key={rowDef.k} style={{ marginTop: 8 }}>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 3, marginBottom: 5 }}>{rowDef.label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {MONTHS.map((m) => {
                      const on = rowDef.val === m.key;
                      return (
                        <Pressable key={m.key} onPress={() => rowDef.set(on ? null : m.key)} style={{ marginRight: 8 }}>
                          <View style={{
                            backgroundColor: on ? C.purple : C.glass,
                            borderWidth: 1, borderColor: on ? C.purple : C.line,
                            borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
                          }}>
                            <Text style={{ color: on ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800' }}>{m.label}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}

              <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 18, marginLeft: 2 }}>I'M UP FOR</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {UP_FOR.map((u) => {
                  const on = upFor.indexOf(u.id) >= 0;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => setUpFor((list) => (on ? list.filter((x) => x !== u.id) : list.concat([u.id])))}
                      style={{ marginRight: 8, marginBottom: 8 }}
                    >
                      <View style={{
                        backgroundColor: on ? C.greenSoft : C.glass,
                        borderWidth: 1, borderColor: on ? C.green : C.line,
                        borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9,
                      }}>
                        <Text style={{ color: on ? C.green : C.text, fontSize: 12.5, fontWeight: '800' }}>{u.emoji} {u.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* caption canvas */}
          <LinearGradient
            colors={imageUri || isStory ? ['transparent', 'transparent'] : TEXT_BGS[textBg].colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: R - 4, paddingHorizontal: textBg === 'plain' || imageUri || isStory ? 4 : 16, paddingVertical: textBg === 'plain' || imageUri || isStory ? 0 : 20 }}
          >
            <TextInput
              placeholder={isStory ? 'Say something (optional)…'
                : isReel ? 'Describe your reel…'
                : isTravel ? 'Who you are, what you\u2019re into, and what you\u2019d love to do there…'
                : "What's your moment?"}
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
          {!imageUri && (mode === 'post' || isTravel) ? (
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
              <Ionicons name="location-outline" size={14} color={isTravel && !place.trim() ? C.coral : C.dim} />
              <TextInput
                placeholder={isTravel ? 'Where are you going?' : 'Add a place'}
                placeholderTextColor={C.faint}
                value={place}
                onChangeText={setPlace}
                style={{ flex: 1, color: C.text, fontSize: 12.5, marginLeft: 6, paddingVertical: Platform.OS === 'ios' ? 10 : 8 }}
              />
            </View>
          ) : null}

          {/* who's with you — real accounts, tagged for real */}
          {!isStory ? (
            <Pressable
              onPress={() => setTaggingOpen(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', marginTop: 10,
                backgroundColor: tagged.length ? C.purpleSoft : C.glass,
                borderWidth: 1, borderColor: tagged.length ? 'rgba(124,58,237,0.45)' : C.line,
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
              }}
            >
              <Ionicons name="pricetag-outline" size={14} color={tagged.length ? C.purple : C.dim} />
              <Text style={{ color: tagged.length ? C.purple : C.faint, fontSize: 12.5, fontWeight: '700', marginLeft: 7, flex: 1 }} numberOfLines={1}>
                {tagged.length
                  ? 'With ' + tagged.map((p) => p.name || 'Explorer').join(', ')
                  : 'Tag people'}
              </Text>
              {tagged.length ? (
                <Text style={{ color: C.purple, fontSize: 12, fontWeight: '900' }}>{tagged.length}</Text>
              ) : (
                <Ionicons name="chevron-forward" size={14} color={C.faint} />
              )}
            </Pressable>
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

        {taggingOpen ? (
          <TagPeoplePicker
            selected={tagged}
            onDone={(people) => { setTagged(people); setTaggingOpen(false); }}
            onClose={() => setTaggingOpen(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
};
