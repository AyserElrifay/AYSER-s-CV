import React, { useState, useRef } from 'react';
import { View, Text, Modal, ScrollView, Pressable, Image, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import {
  SKIN_TONES, HAIR_COLORS, CLOTHING_COLORS, HAIR_STYLES, CLOTHING_STYLES, EYES, MOUTHS,
  NOSES, FACIAL_HAIR, HERITAGES, GENDER_PRESETS, heritageOf,
  DEFAULT_DNA, serializeDna, parseDna, buildAvatarUrl,
} from '../services/avatarBuilder';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { updateProfile } from '../services/profiles';
import { tapSelection, tapLight, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';
import { Micro } from './Micro';

/* ── YOUR MOMENTS AVATAR — a proper character studio ─────────────────
   A fully custom cartoon persona — outfit, outfit color, hair, hair
   color, skin tone, eyes, nose, mouth, facial hair, heritage outfit —
   that stands in for you on the live map, in games and in chats. This
   redesign: tabbed sections (not one long scroll), a glowing preview
   card with a loading/error-proof image state, a shuffle button, and a
   sticky save bar — playful, private, and unmistakably a Moments
   character, not a copy of anyone else's mascot system. */

const TABS = [
  { id: 'identity', label: 'Identity', icon: 'person-outline' },
  { id: 'face', label: 'Face', icon: 'happy-outline' },
  { id: 'hair', label: 'Hair', icon: 'color-wand-outline' },
  { id: 'outfit', label: 'Outfit', icon: 'shirt-outline' },
];

const ColorRow = ({ label, colors, value, onPick }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
      {colors.map((hex) => {
        const on = value.toLowerCase() === hex.toLowerCase();
        return (
          <Pressable key={hex} onPress={() => { tapSelection(); onPick(hex); }} style={{ marginRight: 12, marginBottom: 10 }}>
            <View style={{
              width: 38, height: 38, borderRadius: 19, backgroundColor: hex,
              borderWidth: on ? 3 : 1, borderColor: on ? C.purple : C.line,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: on ? C.purple : 'transparent', shadowOpacity: on ? 0.4 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
            }}>
              {on ? <Ionicons name="checkmark" size={16} color={/^#f|^#e[0-9a-c]/i.test(hex) ? '#1F2937' : '#FFF'} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const ChipRow = ({ label, options, value, onPick }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable key={o.id || 'none'} onPress={() => { tapSelection(); onPick(o.id); }} style={{ marginRight: 8, marginBottom: 8 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purple : C.glass,
              borderWidth: 1, borderColor: on ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9,
              shadowColor: on ? C.purple : 'transparent', shadowOpacity: on ? 0.3 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
            }}>
              <Text style={{ fontSize: 14, marginRight: 6 }}>{o.emoji}</Text>
              <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const AvatarBuilderSheet = ({ initialDna, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [dna, setDna] = useState(() => ({ ...DEFAULT_DNA, ...(typeof initialDna === 'string' ? parseDna(initialDna) : initialDna || {}) }));
  const [tab, setTab] = useState('identity');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  const set = (k) => (v) => setDna((d) => ({ ...d, [k]: v }));
  const previewUrl = buildAvatarUrl(user ? user.id : 'preview', dna);
  const heritage = heritageOf(dna.heritage);

  // a satisfying pop when the preview finishes loading a new look
  const pop = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    pop.setValue(0.92);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
  };

  const randomize = () => {
    tapLight(); sfxPop();
    setImgLoading(true); setImgFailed(false);
    setDna((d) => ({
      ...d,
      skinColor: pick(SKIN_TONES),
      hair: pick(HAIR_STYLES).id,
      hairColor: pick(HAIR_COLORS),
      clothing: pick(CLOTHING_STYLES).id,
      clothingColor: pick(CLOTHING_COLORS),
      eyes: pick(EYES).id,
      nose: pick(NOSES).id,
      mouth: pick(MOUTHS).id,
    }));
  };

  const save = async () => {
    if (!SUPABASE_READY || !user) { onSaved && onSaved(dna); onClose(); return; }
    setBusy(true); setErr(null);
    try {
      await updateProfile(user.id, { avatar_dna: serializeDna(dna) });
      tapSuccess(); sfxSuccess();
      setSaved(true);
      onSaved && onSaved(dna);
      setTimeout(onClose, 700);
    } catch (e) {
      setErr(e.message || 'Could not save your avatar — try again.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 10, borderTopRightRadius: R + 10,
        borderWidth: 1, borderColor: C.line, maxHeight: '90%',
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Micro>Your Moments Avatar</Micro>
          <Pressable onPress={onClose} hitSlop={8}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color={C.dim} />
            </View>
          </Pressable>
        </View>

        {/* ── the studio preview card ── */}
        <LinearGradient
          colors={['#' + heritage.bg.split(',')[0], '#' + (heritage.bg.split(',')[1] || heritage.bg.split(',')[0])]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ marginHorizontal: 18, marginTop: 10, borderRadius: 24, paddingVertical: 20, alignItems: 'center', overflow: 'hidden' }}
        >
          {/* soft sheen */}
          <View pointerEvents="none" style={{ position: 'absolute', top: -40, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)' }} />

          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <View style={{
              width: 128, height: 128, borderRadius: 64, padding: 4, backgroundColor: 'rgba(255,255,255,0.22)',
              borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)',
              shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
            }}>
              <View style={{ width: '100%', height: '100%', borderRadius: 60, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                {imgFailed ? (
                  <Ionicons name="person" size={54} color="rgba(255,255,255,0.85)" />
                ) : (
                  <Image
                    source={{ uri: previewUrl }}
                    style={{ width: '100%', height: '100%' }}
                    onLoadStart={() => setImgLoading(true)}
                    onLoad={() => { setImgLoading(false); setImgFailed(false); bounce(); }}
                    onError={() => { setImgLoading(false); setImgFailed(true); }}
                  />
                )}
                {imgLoading && !imgFailed ? (
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.25)' }}>
                    <Ionicons name="sparkles-outline" size={22} color="#FFF" />
                  </View>
                ) : null}
              </View>
              {dna.heritage ? (
                <View style={{ position: 'absolute', bottom: -2, right: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 17 }}>{heritage.emblem}</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '700', marginTop: 12, textAlign: 'center', opacity: 0.92 }}>
            This is what shows on the map, in games & chats
          </Text>

          <Pressable onPress={randomize} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontSize: 14 }}>🎲</Text>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900', marginLeft: 6 }}>Surprise me</Text>
            </View>
          </Pressable>
        </LinearGradient>

        {/* ── tab bar ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginTop: 16, marginBottom: 4 }}>
          {TABS.map((tb) => {
            const on = tab === tb.id;
            return (
              <Pressable key={tb.id} onPress={() => { tapSelection(); setTab(tb.id); }} style={{ flex: 1 }}>
                <View style={{ alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: on ? C.purple : 'transparent' }}>
                  <Ionicons name={tb.icon} size={17} color={on ? C.purple : C.faint} />
                  <Text style={{ color: on ? C.purple : C.faint, fontSize: 11, fontWeight: on ? '900' : '700', marginTop: 3 }}>{tb.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 }}>
          {tab === 'identity' ? (
            <>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 }}>QUICK START</Text>
              <View style={{ flexDirection: 'row', marginBottom: 18 }}>
                {GENDER_PRESETS.map((g) => (
                  <Pressable key={g.id} onPress={() => { tapSelection(); setDna((d) => ({ ...d, ...g.dna })); }} style={{ flex: 1, marginRight: g.id === GENDER_PRESETS[0].id ? 10 : 0 }}>
                    <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', marginTop: 4 }}>{g.label}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <ChipRow label="HERITAGE OUTFIT 🏺 — wear a civilization" options={HERITAGES.map((h) => ({ id: h.id, label: h.label, emoji: h.emblem }))} value={dna.heritage} onPick={set('heritage')} />
            </>
          ) : tab === 'face' ? (
            <>
              <ColorRow label="SKIN TONE" colors={SKIN_TONES} value={dna.skinColor} onPick={set('skinColor')} />
              <ChipRow label="EYES" options={EYES} value={dna.eyes} onPick={set('eyes')} />
              <ChipRow label="NOSE" options={NOSES} value={dna.nose} onPick={set('nose')} />
              <ChipRow label="MOUTH" options={MOUTHS} value={dna.mouth} onPick={set('mouth')} />
              <ChipRow label="FACIAL HAIR" options={FACIAL_HAIR} value={dna.facialHair} onPick={set('facialHair')} />
            </>
          ) : tab === 'hair' ? (
            <>
              <ChipRow label="HAIR STYLE" options={HAIR_STYLES} value={dna.hair} onPick={set('hair')} />
              <ColorRow label="HAIR COLOR" colors={HAIR_COLORS} value={dna.hairColor} onPick={set('hairColor')} />
            </>
          ) : (
            <>
              <ChipRow label="OUTFIT" options={CLOTHING_STYLES} value={dna.clothing} onPick={set('clothing')} />
              <ColorRow label="OUTFIT COLOR" colors={CLOTHING_COLORS} value={dna.clothingColor} onPick={set('clothingColor')} />
            </>
          )}
        </ScrollView>

        {/* ── sticky save bar ── */}
        <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 14, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg2 }}>
          {err ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{err}</Text> : null}
          <Pressable onPress={save} disabled={busy}>
            <LinearGradient
              colors={saved ? [C.green, '#0D9488'] : [C.purple, '#5B21B6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ borderRadius: 15, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.7 : 1 }}
            >
              <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>{saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save my avatar'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
