import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Modal, ScrollView, Pressable, PanResponder, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import {
  SKIN_TONES, HAIR_COLORS, BG_COLORS,
  HAIRS, EYES, BROWS, MOUTHS, NOSES, BEARDS, GLASSES,
  HERITAGES, DEFAULT_DNA,
} from '../services/avatarArt';
import {
  BUILDS, TOPS, BOTTOMS, SHOES, OUTERS, HATS, WEAR_COLORS, CULTURES,
  DEFAULT_LOOK, parseLook, serializeLook,
} from '../services/characterArt';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { updateProfile } from '../services/profiles';
import { tapSelection, tapLight, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';
import { CharacterCanvas } from './CharacterCanvas';

/* ── YOUR CHARACTER · the studio ─────────────────────────────────────
   Everything is live: tap a jacket and it's on, drag the figure and it
   turns, because the character is painted on a canvas right here rather
   than fetched as a picture. Every option shows YOUR character wearing
   it, so you're choosing from what you'll actually look like.

   Every garment, every hairstyle and every colour in here is drawn by
   us in `services/characterArt.js`. Nothing is downloaded and nothing
   is licensed from anybody — which is the whole reason it can ship. */

const TABS = [
  { id: 'body', label: 'Body', icon: 'body-outline' },
  { id: 'face', label: 'Face', icon: 'happy-outline' },
  { id: 'hair', label: 'Hair', icon: 'color-wand-outline' },
  { id: 'top', label: 'Tops', icon: 'shirt-outline' },
  { id: 'bottom', label: 'Bottoms', icon: 'walk-outline' },
  { id: 'shoes', label: 'Shoes', icon: 'footsteps-outline' },
  { id: 'outer', label: 'Jackets', icon: 'snow-outline' },
  { id: 'hat', label: 'Hats', icon: 'glasses-outline' },
  { id: 'culture', label: 'Culture', icon: 'earth-outline' },
  { id: 'style', label: 'Style', icon: 'sparkles-outline' },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const ColorRow = ({ label, colors, value, onPick }) => (
  <View style={{ marginBottom: 18 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {colors.map((hex) => {
        const on = String(value || '').toLowerCase() === hex.toLowerCase();
        return (
          <Pressable key={hex} onPress={() => { tapSelection(); onPick(hex); }} style={{ marginRight: 10 }}>
            <View style={{
              width: 38, height: 38, borderRadius: 19, backgroundColor: hex,
              borderWidth: on ? 3 : 1, borderColor: on ? C.purple : C.line,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {on ? <Ionicons name="checkmark" size={15} color={hex === '#FFFFFF' || hex === '#F5E9D8' ? '#111' : '#FFF'} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

/* Every option previewed on YOUR OWN character — the whole point of a
   studio: you pick what you can see, not a word in a list. */
const WearRow = ({ label, options, field, dna, onPick, crop }) => (
  <View style={{ marginBottom: 18 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {options.map((o) => {
        const on = (dna[field] || '') === o.id;
        return (
          <Pressable key={o.id || 'none'} onPress={() => { tapSelection(); onPick(o.id); }} style={{ marginRight: 10, alignItems: 'center' }}>
            <View style={{
              borderRadius: 14, borderWidth: on ? 2.5 : 1, borderColor: on ? C.purple : C.line,
              backgroundColor: C.glass, width: 74, height: 96, overflow: 'hidden', alignItems: 'center',
            }}>
              {/* the figure slides up or down so the shelf you're
                  shopping shows: shoes near the floor, hats near the top */}
              <View style={{ marginTop: crop === 'head' ? -6 : crop === 'feet' ? -108 : crop === 'legs' ? -74 : -34 }}>
                <CharacterCanvas dna={{ ...dna, [field]: o.id }} width={72} shadow={false} />
              </View>
            </View>
            <Text style={{ color: on ? C.purple : C.faint, fontSize: 10.5, fontWeight: '800', marginTop: 5, maxWidth: 76 }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

export const AvatarBuilderSheet = ({ initialDna, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [dna, setDna] = useState(() => parseLook(
    typeof initialDna === 'string' ? initialDna : { ...DEFAULT_DNA, ...DEFAULT_LOOK, ...(initialDna || {}) }
  ));
  const [tab, setTab] = useState('body');
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (v) => setDna((d) => ({ ...d, [k]: v }));

  /* Drag the figure to walk around it. 150px of travel is a full
     half-turn, which is about the distance a thumb covers comfortably
     without letting go. */
  const turnAt = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > 3,
      onPanResponderGrant: () => { turnAt.current = 0; },
      onPanResponderMove: (_e, gs) => {
        const next = Math.max(-1, Math.min(1, turnAt.current + gs.dx / 150));
        setTurn(next);
      },
      onPanResponderRelease: (_e, gs) => {
        turnAt.current = Math.max(-1, Math.min(1, turnAt.current + gs.dx / 150));
      },
    })
  ).current;

  const nudge = useCallback((dir) => {
    tapLight();
    setTurn((t) => {
      const next = Math.max(-1, Math.min(1, Math.round((t + dir * 0.5) * 2) / 2));
      turnAt.current = next;
      return next;
    });
  }, []);

  const randomize = () => {
    tapLight(); sfxPop();
    setDna((d) => ({
      ...d,
      skin: pick(SKIN_TONES),
      hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS),
      eyes: pick(EYES).id, brows: pick(BROWS).id,
      mouth: pick(MOUTHS).id, nose: pick(NOSES).id,
      beard: d.build === 'f' ? '' : pick(BEARDS).id,
      glasses: pick(GLASSES).id,
      top: pick(TOPS).id, topColor: pick(WEAR_COLORS),
      bottom: pick(BOTTOMS).id, bottomColor: pick(WEAR_COLORS),
      shoes: pick(SHOES).id, shoeColor: pick(WEAR_COLORS),
      outer: pick(OUTERS).id, outerColor: pick(WEAR_COLORS),
      hat: pick(HATS).id, hatColor: pick(WEAR_COLORS),
      bg: pick(BG_COLORS),
    }));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      /* The body choice is also who the person says they are. It's
         stored as its own field because one thing reads it: girls-only
         trips. Nothing else in the app looks at it. */
      if (SUPABASE_READY && user) {
        await updateProfile(user.id, { avatar_dna: serializeLook(dna), gender: dna.build || null });
      }
      setSaved(true); tapSuccess(); sfxSuccess();
      onSaved && onSaved(dna);
      setTimeout(onClose, 550);
    } catch (e) {
      setErr(e.message || 'Could not save your character');
    } finally { setBusy(false); }
  };

  const wearsSkirt = dna.top === 'dress' || dna.top === 'abaya';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '94%', paddingBottom: insets.bottom + 10,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>

        {/* the live figure — drag it to turn it right round */}
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View {...pan.panHandlers} style={{ alignItems: 'center' }}>
            <CharacterCanvas dna={dna} width={124} turn={turn} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Pressable onPress={() => nudge(-1)} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="arrow-undo" size={18} color={C.dim} />
            </Pressable>
            <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '800', marginHorizontal: 8 }}>
              {Platform.OS === 'web' ? 'drag to turn' : 'swipe to turn'}
            </Text>
            <Pressable onPress={() => nudge(1)} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="arrow-redo" size={18} color={C.dim} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <Pressable onPress={randomize} style={{ marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Ionicons name="dice-outline" size={15} color={C.dim} />
                <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800', marginLeft: 6 }}>Surprise me</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); setDna(parseLook({ ...DEFAULT_DNA, ...DEFAULT_LOOK, build: dna.build })); }}>
              <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Reset</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {TABS.map((tb) => {
            const on = tab === tb.id;
            return (
              <Pressable key={tb.id} onPress={() => { tapSelection(); setTab(tb.id); }} style={{ marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purple : C.glassHi, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
                  <Ionicons name={tb.icon} size={14} color={on ? '#FFF' : C.dim} />
                  <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{tb.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14 }} showsVerticalScrollIndicator={false}>
          {tab === 'body' ? (
            <>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>WHO ARE YOU?</Text>
              <View style={{ flexDirection: 'row', marginBottom: 18 }}>
                {BUILDS.map((b) => {
                  const on = dna.build === b.id;
                  return (
                    <Pressable key={b.id} onPress={() => { tapSelection(); set('build')(b.id); }} style={{ flex: 1, marginRight: 8 }}>
                      <View style={{
                        alignItems: 'center', paddingVertical: 12, borderRadius: 16,
                        backgroundColor: on ? C.purple : C.glass,
                        borderWidth: on ? 0 : 1, borderColor: C.line,
                      }}>
                        <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
                        <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '900', marginTop: 4 }}>{b.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginBottom: 16 }}>
                This sets the shape of the figure — shoulders, waist, height. It doesn't
                lock anything: every hairstyle and every piece of clothing is available
                whichever one you pick.
              </Text>
              <ColorRow label="SKIN" colors={SKIN_TONES} value={dna.skin} onPick={set('skin')} />
            </>
          ) : null}

          {tab === 'face' ? (
            <>
              <WearRow label="EYES" options={EYES} field="eyes" dna={dna} onPick={set('eyes')} crop="head" />
              <ColorRow label="EYE COLOUR" colors={['#3B2A1A', '#5C4033', '#2E6B4F', '#2C6FA8', '#6B7280', '#7C3AED']} value={dna.eyeColor} onPick={set('eyeColor')} />
              <WearRow label="EYEBROWS" options={BROWS} field="brows" dna={dna} onPick={set('brows')} crop="head" />
              <WearRow label="MOUTH" options={MOUTHS} field="mouth" dna={dna} onPick={set('mouth')} crop="head" />
              <WearRow label="NOSE" options={NOSES} field="nose" dna={dna} onPick={set('nose')} crop="head" />
              <WearRow label="BEARD" options={BEARDS} field="beard" dna={dna} onPick={set('beard')} crop="head" />
              <WearRow label="GLASSES" options={GLASSES} field="glasses" dna={dna} onPick={set('glasses')} crop="head" />
            </>
          ) : null}

          {tab === 'hair' ? (
            <>
              <WearRow label="HAIRSTYLE" options={HAIRS} field="hair" dna={dna} onPick={set('hair')} crop="head" />
              <ColorRow label="HAIR COLOUR" colors={HAIR_COLORS} value={dna.hairColor} onPick={set('hairColor')} />
            </>
          ) : null}

          {tab === 'top' ? (
            <>
              <WearRow label="TOP" options={TOPS} field="top" dna={dna} onPick={set('top')} />
              <ColorRow label="COLOUR" colors={WEAR_COLORS} value={dna.topColor} onPick={set('topColor')} />
            </>
          ) : null}

          {tab === 'bottom' ? (
            wearsSkirt ? (
              <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 19, paddingVertical: 30, textAlign: 'center' }}>
                {dna.top === 'abaya' ? 'An abaya' : 'A dress'} is the whole piece — there's nothing to put
                underneath it. Pick a different top and the trousers come back.
              </Text>
            ) : (
              <>
                <WearRow label="BOTTOM" options={BOTTOMS} field="bottom" dna={dna} onPick={set('bottom')} crop="legs" />
                <ColorRow label="COLOUR" colors={WEAR_COLORS} value={dna.bottomColor} onPick={set('bottomColor')} />
              </>
            )
          ) : null}

          {tab === 'shoes' ? (
            <>
              <WearRow label="SHOES" options={SHOES} field="shoes" dna={dna} onPick={set('shoes')} crop="feet" />
              <ColorRow label="COLOUR" colors={WEAR_COLORS} value={dna.shoeColor} onPick={set('shoeColor')} />
            </>
          ) : null}

          {tab === 'outer' ? (
            <>
              <WearRow label="JACKET" options={OUTERS} field="outer" dna={dna} onPick={set('outer')} />
              <ColorRow label="COLOUR" colors={WEAR_COLORS} value={dna.outerColor} onPick={set('outerColor')} />
            </>
          ) : null}

          {tab === 'hat' ? (
            dna.hair === 'hijab' ? (
              <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 19, paddingVertical: 30, textAlign: 'center' }}>
                A hijab covers the head already — a hat on top of it would just sit wrong.
                Change the hairstyle and the hats come back.
              </Text>
            ) : (
              <>
                <WearRow label="HAT" options={HATS} field="hat" dna={dna} onPick={set('hat')} crop="head" />
                <ColorRow label="COLOUR" colors={WEAR_COLORS} value={dna.hatColor} onPick={set('hatColor')} />
              </>
            )
          ) : null}

          {tab === 'culture' ? (
            <>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>DRESS FROM WHERE YOU'RE FROM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {CULTURES.map((cu) => {
                  const on = dna.top === cu.look.top;
                  return (
                    <Pressable key={cu.id} onPress={() => { tapSelection(); setDna((d) => ({ ...d, ...cu.look })); }} style={{ marginRight: 10, alignItems: 'center' }}>
                      <View style={{
                        borderRadius: 14, borderWidth: on ? 2.5 : 1, borderColor: on ? C.purple : C.line,
                        backgroundColor: C.glass, width: 82, height: 128, overflow: 'hidden', alignItems: 'center',
                      }}>
                        <CharacterCanvas dna={{ ...dna, ...cu.look }} width={80} shadow={false} />
                      </View>
                      <Text style={{ color: on ? C.purple : C.faint, fontSize: 10.5, fontWeight: '800', marginTop: 5, maxWidth: 84 }} numberOfLines={1}>
                        {cu.emoji} {cu.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ColorRow label="COLOUR" colors={WEAR_COLORS} value={dna.topColor} onPick={set('topColor')} />
              <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17 }}>
                Picking one sets the whole outfit — you can change any piece of it afterwards.
                Every one of these is drawn by us from the same shapes as the rest of the
                wardrobe: nothing traced, nothing borrowed, nothing anybody owns.
              </Text>
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
                A heritage wraps your character in those colours everywhere they appear —
                your space, the map, the games.
              </Text>
            </>
          ) : null}
        </ScrollView>

        {err ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{err}</Text> : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
          <Pressable onPress={save} disabled={busy}>
            <View style={{ backgroundColor: saved ? C.green : C.purple, borderRadius: 16, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>
                {saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save my character'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
