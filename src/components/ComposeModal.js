import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { requestLocationPermission, getCurrentCoords } from '../utils/location';
import { C, R, TEXT_BGS } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
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
import { useSheetBack } from '../hooks/useSheetBack';
import { keptGatherings } from '../services/green';
import { lastFix } from '../services/squadAdmin';
import { placesNear } from '../lib/placePoints';

/* The creation studio — one place to share a Moment, a Reel, or a
   Story. Shoot from the camera or pick from the gallery, add a sound
   (IG/TikTok style), and go. */

const MODES = [
  { id: 'post', label: 'Moment', emoji: '✨' },
  { id: 'story', label: 'Story', emoji: '⭕' },
  { id: 'travel', label: 'Travel', emoji: '🧳' },
];

export const ComposeModal = ({ initialMode = 'post', initialCaption = '', initialPlace = null, onClose, onPosted, onPostedStory, onOpenStudio }) => {
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState(initialMode);
  // opened from a topic → the tag is already in the box, cursor after it
  const [caption, setCaption] = useState(initialCaption ? initialCaption + ' ' : '');
  /* Opened from a place on the map, the moment belongs to that place:
     its name is filled in and its real coordinates go with the post, so
     it shows up on the map and on that place's page. Change the name and
     the coordinates are dropped — a typed name is not a spot. */
  const [place, setPlace] = useState((initialPlace && initialPlace.name) || '');
  /* Or, only if they ask: pinned to where they are standing. Off by
     default — a moment posted from home must not put home on the map. */
  const [here, setHere] = useState(null);           // { lat, lng } | 'busy' | null
  const fromPlace = initialPlace && initialPlace.lat != null && initialPlace.lng != null && place.trim() === String(initialPlace.name || '').trim()
    ? { lat: initialPlace.lat, lng: initialPlace.lng } : null;
  /* ── A MOMENT FROM AN OUTING BELONGS TO THE OUTING ─────────────────
     Ayser: "خلّي إلزامي لما تنزّل صورة Moments تحط اللوكيشن بسهولة،
     وMoments يربط الصورة بأماكن الخروج اللي على الخريطة أو في Together —
     بس لو صورة خروجة". So the first question is whether it is. If it
     is, where it was is required — and one tap: the Together plans you
     joined today, and the places on the map near you. Picking one ties
     the moment to it (its real spot, and the plan), so it shows on that
     place's page. Not from an outing (a thought, something at home):
     no place asked, and nothing goes on the map. */
  const [outing, setOuting] = useState(true);
  const [picked, setPicked] = useState(null);      // { name, lat, lng, gid? } — a real spot chosen from the list
  const pickedNow = picked && place.trim() === picked.name ? picked : null;
  const spot = pickedNow || fromPlace || (here && here !== 'busy' ? here : null);
  const [nearPlaces, setNearPlaces] = useState([]);
  const myPlans = React.useMemo(() => {
    const now = Date.now();
    return (keptGatherings(null) || []).filter((g) => g.im_going && g.lat != null && g.lng != null
      && Math.abs(new Date(g.starts_at).getTime() - now) < 12 * 3600 * 1000).slice(0, 4);
  }, []);
  React.useEffect(() => {
    if (!outing || fromPlace) return undefined;
    const at = (here && here !== 'busy') ? here : lastFix();
    if (!at) { setNearPlaces([]); return undefined; }
    let alive = true;
    /* the list of places is loaded only when it is needed, so the
       composer does not pull the whole map list into every download */
    placesNear(at, 5, 5).then((r) => { if (alive) setNearPlaces(r.map((d) => ({ d, k: d.km }))); }).catch(() => {});
    return () => { alive = false; };
  }, [outing, here && here.lat, here && here.lng]);
  const choose = (name, lat, lng, gid) => { tapSuccess(); setPlace(name); setPicked({ name, lat, lng, gid: gid || null }); setError(null); };
  const pinHere = async () => {
    if (here) { setHere(null); return; }
    setHere('busy');
    try {
      const ok = await requestLocationPermission();
      const c = ok ? await getCurrentCoords() : null;
      setHere(c ? { lat: c.latitude, lng: c.longitude } : null);
    } catch (e) { setHere(null); }
  };
  // what this moment is for — asked first, because it decides what the
  // card asks of everyone else: come here, or help / go somewhere better
  /* Ayser: "خايف من الخيار ده يبقى في طاقة سلبية" — no Heads-up any more:
     every moment is a good one */
  const intent = 'hangout';
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
    /* every moment in the feed is tied to somewhere: that is what makes
       it something to go to rather than something to scroll past */
    if (!isStory && !isTravel && outing && !place.trim()) { setError(t('feed_need_place')); return; }
    // an outing needs a real spot, so it can sit on the map and on the place's page
    if (!isStory && !isTravel && outing && !spot) { setError(t('cmp_need_spot')); return; }
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
          place: (outing || isTravel) && place.trim() ? place.trim() : null,
          lat: outing && spot ? spot.lat : null,
          lng: outing && spot ? spot.lng : null,
          gatheringId: outing && pickedNow ? pickedNow.gid : null,
          mediaUrl,
          textBg: mediaUrl || textBg === 'plain' ? null : textBg,
          plan,
          intent: isTravel ? 'hangout' : intent,
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
          intent: row.intent === 'warning' || (!row.intent && intent === 'warning') ? 'warning' : 'hangout',
          place: row.place || null,
          startsIn: 'Live now',
          coords: row && row.lat != null && row.lng != null ? { latitude: row.lat, longitude: row.lng } : null,
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
          intent: intent === 'warning' ? 'warning' : 'hangout',
          place: (outing || isTravel) && place.trim() ? place.trim() : null,
          startsIn: 'Live now',
          coords: null,
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
      /* you posted a trip: you are in that destination's travellers group */
      if (isTravel && place.trim()) import('../services/squadAdmin').then((m) => m.travelGroupJoin(place.trim())).catch(() => {});
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
           accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
          <Micro color={C.purple}>{t('cmp_create')}</Micro>
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
                placeholder={t('cmp_bio_ph')}
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
                {t('cmp_bio_hint')}
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

              <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 18, marginLeft: 2 }}>{t('cmp_up_for')}</Text>
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
              <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 2 }}>{t('cmp_text_bg')}</Text>
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
              <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 7 }}>{t('cmp_shoot')}</Text>
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
              <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 7 }}>{t('cmp_gallery')}</Text>
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

          {/* from an outing? — and if so, where, in one tap */}
          {!isStory && !isTravel ? (
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              {[[true, '🧭 ' + t('cmp_outing_yes')], [false, '🏠 ' + t('cmp_outing_no')]].map(([v, label]) => (
                <Pressable key={String(v)} onPress={() => { setOuting(v); setError(null); }} accessibilityRole="radio" accessibilityState={{ selected: outing === v }} style={{ marginRight: 8 }}>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: outing === v ? C.purple : C.line, backgroundColor: outing === v ? C.purpleSoft : C.glass, paddingHorizontal: 13, paddingVertical: 7 }}>
                    <Text style={{ color: outing === v ? C.purple : C.dim, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {/* say where a moment that is not from an outing goes, so nobody
              thinks it was deleted */}
          {!isStory && !isTravel && outing === false ? (
            <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 17, marginTop: 8 }}>{t('cmp_outing_no_note')}</Text>
          ) : null}
          {!isStory && !isTravel && outing && !fromPlace && (myPlans.length || nearPlaces.length) ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>
              {myPlans.map((g) => {
                const nm = g.place_name || g.title;
                const on = pickedNow && pickedNow.gid === g.id;
                return (
                  <Pressable key={'g' + g.id} onPress={() => choose(nm, g.lat, g.lng, g.id)} style={{ marginRight: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.line, backgroundColor: on ? C.greenSoft : C.glass, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 230 }}>
                      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1}>{'🌿 ' + (g.title || nm)}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {nearPlaces.map(({ d, k }) => {
                const on = pickedNow && pickedNow.name === d.name;
                return (
                  <Pressable key={'d' + d.id} onPress={() => choose(d.name, d.lat, d.lng)} style={{ marginRight: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.line, backgroundColor: on ? C.greenSoft : C.glass, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1}>{d.emoji + ' ' + d.name + ' · ' + (k < 1 ? Math.round(k * 1000) + ' m' : k.toFixed(1) + ' km')}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* place — for Moments & Reels; only asked for an outing */}
          {!isStory && (outing || isTravel) ? (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', marginTop: 12,
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 999, paddingHorizontal: 14,
              }}
            >
              <Ionicons name="location-outline" size={14} color={!place.trim() ? C.coral : C.dim} />
              <TextInput
                placeholder={isTravel ? 'Where are you going?' : t('feed_where')}
                placeholderTextColor={C.faint}
                value={place}
                onChangeText={setPlace}
                style={{ flex: 1, color: C.text, fontSize: 12.5, marginLeft: 6, paddingVertical: Platform.OS === 'ios' ? 10 : 8 }}
              />
              {/* pin it where you are — only when asked, never by default */}
              {!fromPlace && !isTravel ? (
                <Pressable onPress={pinHere} accessibilityRole="switch" accessibilityState={{ checked: !!(here && here !== 'busy') }} accessibilityLabel={t('pv_pin_here')}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingStart: 8 }}>
                  {here === 'busy' ? <ActivityIndicator size="small" color={C.dim} /> : (
                    <Text style={{ color: here ? C.green : C.dim, fontSize: 12, fontWeight: '800' }}>{here ? '📍 ' + t('pv_pinned') : '📍 ' + t('pv_pin_here')}</Text>
                  )}
                </Pressable>
              ) : fromPlace ? <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', paddingStart: 8 }}>📍</Text> : null}
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
