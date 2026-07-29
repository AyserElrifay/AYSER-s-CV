import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import {
  SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, BG_COLORS,
  HAIRS, EYES, BROWS, MOUTHS, NOSES, BEARDS, OUTFITS, GLASSES, EXTRAS,
  HERITAGES, DEFAULT_DNA, serializeDna, parseDna,
} from '../services/avatarArt';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { updateProfile } from '../services/profiles';
import { tapSelection, tapLight, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';
import { AvatarCanvas } from './AvatarCanvas';

/* ── YOUR MOMENTS AVATAR · the character studio ──────────────────────
   Everything is live: tap a hair colour and the face changes under your
   finger, because the avatar is drawn right there on a canvas rather
   than fetched as a picture. Each option shows YOUR face wearing it, so
   you're choosing from what you'll actually look like — not from a list
   of words.                                                            */

const TABS = [
  { id: 'face', label: 'Face', icon: 'happy-outline' },
  { id: 'hair', label: 'Hair', icon: 'color-wand-outline' },
  { id: 'outfit', label: 'Outfit', icon: 'shirt-outline' },
  { id: 'extras', label: 'Extras', icon: 'glasses-outline' },
  { id: 'style', label: 'Style', icon: 'sparkles-outline' },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* A row of swatches. */
const ColorRow = ({ label, colors, value, onPick }) => (
  <View style={{ marginBottom: 18 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {colors.map((hex) => {
        const on = String(value || '').toLowerCase() === hex.toLowerCase();
        return (
          <Pressable key={hex} onPress={() => { tapSelection(); onPick(hex); }} style={{ marginRight: 10 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20, backgroundColor: hex,
              borderWidth: on ? 3 : 1, borderColor: on ? C.purple : C.line,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {on ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

/* Every option previewed on YOUR OWN face — the whole point of a
   character studio: you pick what you can see, not a word. */
const FaceRow = ({ label, options, field, dna, onPick }) => (
  <View style={{ marginBottom: 18 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {options.map((o) => {
        const on = (dna[field] || '') === o.id;
        return (
          <Pressable key={o.id || 'none'} onPress={() => { tapSelection(); onPick(o.id); }} style={{ marginRight: 10, alignItems: 'center' }}>
            <View style={{
              borderRadius: 16, padding: 3,
              borderWidth: on ? 2.5 : 1, borderColor: on ? C.purple : C.line,
              backgroundColor: C.glass,
            }}>
              <AvatarCanvas dna={{ ...dna, [field]: o.id, bg: on ? dna.bg : '#3A3A44', heritage: '' }} size={62} />
            </View>
            <Text style={{ color: on ? C.purple : C.faint, fontSize: 10.5, fontWeight: '800', marginTop: 5, maxWidth: 72 }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

export const AvatarBuilderSheet = ({ initialDna, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [dna, setDna] = useState(() =>
    (typeof initialDna === 'string' ? parseDna(initialDna) : { ...DEFAULT_DNA, ...(initialDna || {}) })
  );
  const [tab, setTab] = useState('face');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (v) => setDna((d) => ({ ...d, [k]: v }));

  const randomize = () => {
    tapLight(); sfxPop();
    setDna((d) => ({
      ...d,
      skin: pick(SKIN_TONES),
      hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS),
      eyes: pick(EYES).id, brows: pick(BROWS).id,
      mouth: pick(MOUTHS).id, nose: pick(NOSES).id,
      beard: pick(BEARDS).id,
      outfit: pick(OUTFITS).id, outfitColor: pick(CLOTH_COLORS),
      glasses: pick(GLASSES).id, extra: pick(EXTRAS).id,
      bg: pick(BG_COLORS),
    }));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      if (SUPABASE_READY && user) await updateProfile(user.id, { avatar_dna: serializeDna(dna) });
      setSaved(true); tapSuccess(); sfxSuccess();
      onSaved && onSaved(dna);
      setTimeout(onClose, 550);
    } catch (e) {
      setErr(e.message || 'Could not save your avatar');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '92%', paddingBottom: insets.bottom + 10,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>

        {/* the live preview — this IS the avatar, drawn as you tap */}
        <View style={{ alignItems: 'center', paddingTop: 14 }}>
          <AvatarCanvas dna={dna} size={132} round />
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Pressable onPress={randomize} style={{ marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Ionicons name="dice-outline" size={15} color={C.dim} />
                <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800', marginLeft: 6 }}>Surprise me</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); setDna({ ...DEFAULT_DNA }); }}>
              <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Reset</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {TABS.map((tb) => {
            const on = tab === tb.id;
            return (
              <Pressable key={tb.id} onPress={() => { tapSelection(); setTab(tb.id); }} style={{ marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purple : C.glassHi, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Ionicons name={tb.icon} size={14} color={on ? '#FFF' : C.dim} />
                  <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{tb.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14 }} showsVerticalScrollIndicator={false}>
          {tab === 'face' ? (
            <>
              <ColorRow label="SKIN" colors={SKIN_TONES} value={dna.skin} onPick={set('skin')} />
              <FaceRow label="EYES" options={EYES} field="eyes" dna={dna} onPick={set('eyes')} />
              <ColorRow label="EYE COLOUR" colors={['#3B2A1A', '#5C4033', '#2E6B4F', '#2C6FA8', '#6B7280', '#7C3AED']} value={dna.eyeColor} onPick={set('eyeColor')} />
              <FaceRow label="EYEBROWS" options={BROWS} field="brows" dna={dna} onPick={set('brows')} />
              <FaceRow label="MOUTH" options={MOUTHS} field="mouth" dna={dna} onPick={set('mouth')} />
              <FaceRow label="NOSE" options={NOSES} field="nose" dna={dna} onPick={set('nose')} />
              <FaceRow label="BEARD" options={BEARDS} field="beard" dna={dna} onPick={set('beard')} />
            </>
          ) : null}

          {tab === 'hair' ? (
            <>
              <FaceRow label="HAIRSTYLE" options={HAIRS} field="hair" dna={dna} onPick={set('hair')} />
              <ColorRow label="HAIR COLOUR" colors={HAIR_COLORS} value={dna.hairColor} onPick={set('hairColor')} />
            </>
          ) : null}

          {tab === 'outfit' ? (
            <>
              <FaceRow label="OUTFIT" options={OUTFITS} field="outfit" dna={dna} onPick={set('outfit')} />
              <ColorRow label="OUTFIT COLOUR" colors={CLOTH_COLORS} value={dna.outfitColor} onPick={set('outfitColor')} />
            </>
          ) : null}

          {tab === 'extras' ? (
            <>
              <FaceRow label="GLASSES" options={GLASSES} field="glasses" dna={dna} onPick={set('glasses')} />
              <FaceRow label="ACCESSORIES" options={EXTRAS} field="extra" dna={dna} onPick={set('extra')} />
            </>
          ) : null}

          {tab === 'style' ? (
            <>
              <ColorRow label="BACKGROUND" colors={BG_COLORS} value={dna.bg} onPick={set('bg')} />
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>HERITAGE — wear where you're from</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {HERITAGES.map((h) => {
                  const on = (dna.heritage || '') === h.id;
                  return (
                    <Pressable key={h.id || 'classic'} onPress={() => { tapSelection(); set('heritage')(h.id); }} style={{ marginRight: 8, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purple : C.glass, borderWidth: 1, borderColor: on ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }}>
                        <Text style={{ fontSize: 14, marginRight: 6 }}>{h.emblem}</Text>
                        <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{h.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 10, lineHeight: 17 }}>
                A heritage wraps your avatar in those colours everywhere it appears — your space, the map, the games.
              </Text>
            </>
          ) : null}
        </ScrollView>

        {err ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{err}</Text> : null}

        {/* save */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
          <Pressable onPress={save} disabled={busy}>
            <View style={{ backgroundColor: saved ? C.green : C.purple, borderRadius: 16, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>
                {saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save my avatar'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
