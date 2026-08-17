import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { tapLight, tapSuccess } from '../../utils/feedback';
import { setFace } from '../../services/lamma';
import { SKINS, HEADS, COLLARS, EYES, BEARDS, DEFAULT_LOOK, bakePharaoh } from './pharaohArt';

/* ─── لمّة · WHO ARE YOU TONIGHT ─────────────────────────────────────
   Ayser asked for the step before the game starts where everybody
   makes themselves a pharaoh. This is it.

   ── THE PREVIEW IS THE THING ITSELF ───────────────────────────────
   There is no separate "preview renderer" here. Every time a chip is
   tapped the character is BAKED — the same function, at the same size,
   producing the same small JPEG that will sit on the seat — and that
   JPEG is what the screen shows. So the picture somebody approves is
   the picture the room gets, down to the byte. A preview drawn by
   different code from the artefact is a preview that will one day
   quietly lie.

   Baking is a few milliseconds of arithmetic on a 224px square, which
   is cheaper than the re-render it happens inside.

   ── AND IT IS OPTIONAL ────────────────────────────────────────────
   A seat with no face shows the first letter of a name, which is not a
   lesser option — it is what a name looks like. Nobody is made to
   build a character before they can play, and there is a way out of
   this screen that changes nothing.                                  */

/* ── A CHOICE SHOWS ITSELF ─────────────────────────────────────────
   Each option is a small render of what tapping it would do — the
   character exactly as it is now, with that one part changed. It began
   as a row of emoji and two of them came out as empty boxes, because
   the hieroglyph for a nemes headcloth is not in any font a phone
   ships with. Which was the useful failure: an emoji was only ever a
   guess at the thing, and the thing itself was already drawable.

   Now nobody has to know what "khat" means to choose it. */
const CHIP = 46;

const LookChip = ({ on, look, onPress }) => {
  const uri = useMemo(() => bakePharaoh(look, CHIP * 2), [
    look.skin, look.head, look.collar, look.eyes, look.beard]);
  return (
    <Pressable onPress={onPress} style={{ marginEnd: 8, marginBottom: 8 }}>
      <View style={{
        borderWidth: on ? 3 : 1, borderColor: on ? C.gold : C.line,
        borderRadius: 14, overflow: 'hidden', backgroundColor: C.glass,
        width: CHIP + 8, height: CHIP + 8, alignItems: 'center', justifyContent: 'center',
      }}>
        {uri ? <Image source={{ uri }} style={{ width: CHIP, height: CHIP, borderRadius: 10 }} /> : null}
      </View>
    </Pressable>
  );
};

/* A skin chip shows the colour, because naming five skin tones in
   thirteen languages is a worse idea than showing them. */
const SkinChip = ({ on, colour, onPress }) => (
  <Pressable onPress={onPress} style={{ marginEnd: 8, marginBottom: 8 }}>
    <View style={{
      width: 46, height: 40, borderRadius: 14, backgroundColor: colour,
      borderWidth: on ? 3 : 1, borderColor: on ? C.gold : C.line,
    }} />
  </Pressable>
);

const Row = ({ label, children }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
      {label}
    </Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>
  </View>
);

export const CharacterSheet = ({ roomId, initial, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [look, setLook] = useState({ ...DEFAULT_LOOK, ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const set = (k, v) => { tapLight(); setLook((L) => ({ ...L, [k]: v })); };

  /* Recomputed only when the look changes, not on every render. */
  const uri = useMemo(() => bakePharaoh(look), [look.skin, look.head, look.collar, look.eyes, look.beard]);

  const surprise = () => {
    tapLight();
    const any = (list) => list[Math.floor(Math.random() * list.length)].id;
    setLook({
      skin: any(SKINS), head: any(HEADS), collar: any(COLLARS),
      eyes: any(EYES), beard: any(BEARDS),
    });
  };

  const save = async () => {
    if (busy || !uri) return;
    setBusy(true); setFailed(false);
    const r = await setFace(roomId, uri);
    setBusy(false);
    if (r && r.ok) {
      tapSuccess();
      onSaved && onSaved(look);
      onClose && onClose();
    } else {
      setFailed(true);
    }
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 12, flex: 1, minWidth: 0 }}>
            {t('lamma_char_title')}
          </Text>
          <Pressable onPress={surprise} hitSlop={10}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: '900' }}>{t('lamma_char_random')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: 168, height: 168, borderRadius: 84, borderWidth: 3, borderColor: C.gold }}
              />
            ) : (
              <View style={{
                width: 168, height: 168, borderRadius: 84, backgroundColor: C.glass,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color={C.gold} />
              </View>
            )}
          </View>
          <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', marginBottom: 18, lineHeight: 18 }}>
            {t('lamma_char_sub')}
          </Text>

          <Row label={t('lamma_char_head')}>
            {HEADS.map((h) => (
              <LookChip key={h.id} on={look.head === h.id} look={{ ...look, head: h.id }}
                onPress={() => set('head', h.id)} />
            ))}
          </Row>

          <Row label={t('lamma_char_skin')}>
            {SKINS.map((s) => (
              <SkinChip key={s.id} on={look.skin === s.id} colour={s.c} onPress={() => set('skin', s.id)} />
            ))}
          </Row>

          <Row label={t('lamma_char_eyes')}>
            {EYES.map((e) => (
              <LookChip key={e.id} on={look.eyes === e.id} look={{ ...look, eyes: e.id }}
                onPress={() => set('eyes', e.id)} />
            ))}
          </Row>

          <Row label={t('lamma_char_collar')}>
            {COLLARS.map((k) => (
              <LookChip key={k.id} on={look.collar === k.id} look={{ ...look, collar: k.id }}
                onPress={() => set('collar', k.id)} />
            ))}
          </Row>

          <Row label={t('lamma_char_beard')}>
            {BEARDS.map((k) => (
              <LookChip key={k.id} on={look.beard === k.id} look={{ ...look, beard: k.id }}
                onPress={() => set('beard', k.id)} />
            ))}
          </Row>

          {failed ? (
            <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '800', marginBottom: 10 }}>
              {t('lamma_offline')}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 14 }}>
          <Pressable onPress={save} disabled={busy || !uri}>
            <View style={{
              backgroundColor: C.gold, borderRadius: 999, paddingVertical: 15,
              alignItems: 'center', opacity: busy || !uri ? 0.6 : 1,
            }}>
              <Text style={{ color: '#1B1030', fontSize: 15.5, fontWeight: '900' }}>
                {busy ? '…' : t('lamma_char_save')}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
