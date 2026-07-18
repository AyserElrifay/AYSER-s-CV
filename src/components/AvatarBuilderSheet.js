import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';
import { Micro } from './Micro';

/* ── YOUR MOMENTS AVATAR ─────────────────────────────────────────────
   A fully custom cartoon persona — outfit, outfit color, hair, hair
   color, skin tone, eyes, mouth — that stands in for you on the live
   map. This is what "nearby" people see instead of a real photo:
   playful, private, and unmistakably a Moments character (purple/gold
   framing), not a copy of anyone else's mascot system. */

const ColorRow = ({ label, colors, value, onPick }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {colors.map((hex) => {
        const on = value.toLowerCase() === hex.toLowerCase();
        return (
          <Pressable key={hex} onPress={() => { tapSelection(); onPick(hex); }} style={{ marginRight: 10, marginBottom: 8 }}>
            <View style={{
              width: 34, height: 34, borderRadius: 17, backgroundColor: hex,
              borderWidth: on ? 3 : 1, borderColor: on ? C.purple : C.line,
            }} />
          </Pressable>
        );
      })}
    </View>
  </View>
);

const ChipRow = ({ label, options, value, onPick }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 }}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable key={o.id} onPress={() => { tapSelection(); onPick(o.id); }} style={{ marginRight: 8 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purple : C.glass,
              borderWidth: 1, borderColor: on ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
            }}>
              <Text style={{ fontSize: 14, marginRight: 5 }}>{o.emoji}</Text>
              <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

export const AvatarBuilderSheet = ({ initialDna, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [dna, setDna] = useState(() => ({ ...DEFAULT_DNA, ...(typeof initialDna === 'string' ? parseDna(initialDna) : initialDna || {}) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);

  const set = (k) => (v) => setDna((d) => ({ ...d, [k]: v }));
  const previewUrl = buildAvatarUrl(user ? user.id : 'preview', dna);

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
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '86%', paddingBottom: insets.bottom + 14,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Micro>Your Moments Avatar 🎨</Micro>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 14 }}>
          <View style={{ width: 116, height: 116, borderRadius: 58, padding: 4, backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 2, borderColor: C.purple }}>
            <Image source={{ uri: previewUrl }} style={{ width: '100%', height: '100%', borderRadius: 54 }} />
            {dna.heritage ? (
              <View style={{ position: 'absolute', bottom: -4, right: -4, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{heritageOf(dna.heritage).emblem}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: C.faint, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
            Your character on the map, in games & chats — never a photo
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18 }}>
          {/* start with who you are — then fine-tune everything below */}
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {GENDER_PRESETS.map((g) => (
              <Pressable key={g.id} onPress={() => { tapSelection(); setDna((d) => ({ ...d, ...g.dna })); }} style={{ flex: 1, marginHorizontal: 4 }}>
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22 }}>{g.emoji}</Text>
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', marginTop: 3 }}>{g.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <ChipRow label="HERITAGE OUTFIT 🏺 — wear a civilization" options={HERITAGES.map((h) => ({ id: h.id, label: h.label, emoji: h.emblem }))} value={dna.heritage} onPick={set('heritage')} />
          <ColorRow label="SKIN TONE" colors={SKIN_TONES} value={dna.skinColor} onPick={set('skinColor')} />
          <ChipRow label="HAIR STYLE" options={HAIR_STYLES} value={dna.hair} onPick={set('hair')} />
          <ColorRow label="HAIR COLOR" colors={HAIR_COLORS} value={dna.hairColor} onPick={set('hairColor')} />
          <ChipRow label="OUTFIT" options={CLOTHING_STYLES} value={dna.clothing} onPick={set('clothing')} />
          <ColorRow label="OUTFIT COLOR" colors={CLOTHING_COLORS} value={dna.clothingColor} onPick={set('clothingColor')} />
          <ChipRow label="EYES" options={EYES} value={dna.eyes} onPick={set('eyes')} />
          <ChipRow label="NOSE" options={NOSES} value={dna.nose} onPick={set('nose')} />
          <ChipRow label="MOUTH" options={MOUTHS} value={dna.mouth} onPick={set('mouth')} />
          <ChipRow label="FACIAL HAIR" options={FACIAL_HAIR} value={dna.facialHair} onPick={set('facialHair')} />

          {err ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{err}</Text> : null}
          <Pressable onPress={save} disabled={busy} style={{ marginTop: 4 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.7 : 1 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save my avatar'}</Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};
