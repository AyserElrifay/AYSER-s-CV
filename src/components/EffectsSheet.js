import React, { useState } from 'react';
import { tNow } from '../context/LanguageContext';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../ui/Gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { tapLight, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ── THE EFFECTS DRAWER ─────────────────────────────────────────────
   Ayser: "حاسسها زحمة أوي ومش عملية". It was tabs, a search box and a
   wall of big cards. Now: four rows you can read at a glance — faces,
   looks, fun, games — each a line of small circles you slide sideways,
   the one you are wearing ringed in gold. No search: nobody types the
   name of a beard. */

const Dot = ({ label, glyph, tint, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ width: 72, alignItems: 'center', outlineStyle: 'none' }}>
    <View style={{
      width: 58, height: 58, borderRadius: 29, overflow: 'hidden',
      borderWidth: on ? 2.5 : 0, borderColor: C.gold,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.10)',
    }}>
      {tint ? <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      <Text style={{ fontSize: 26 }}>{glyph}</Text>
    </View>
    <Text numberOfLines={1} style={{ color: on ? C.gold : 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: on ? '900' : '600', marginTop: 5, maxWidth: 68 }}>{label}</Text>
  </Pressable>
);

const Row = ({ title, children }) => (
  <View style={{ marginTop: 14 }}>
    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginStart: 18, marginBottom: 8 }}>{title.toUpperCase()}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 10 }}>
      {children}
    </ScrollView>
  </View>
);

/* each look shows its own colour, not the same purple for all */
const LOOK_TINT = {
  vivid: ['#FF5F6D', '#FFC371'], warm: ['#F7971E', '#FFD200'], cool: ['#2193B0', '#6DD5ED'],
  retro: ['#C79081', '#DFA579'], bw: ['#1F1F1F', '#9A9A9A'], dream: ['#C471F5', '#FA71CD'],
  noir: ['#000000', '#3A3A3A'], sun: ['#F9D423', '#FF8C42'], golden: ['#F2994A', '#F2C94C'],
  tan: ['#B5651D', '#E0A96D'], film: ['#8E6E53', '#C9B79C'], vhs: ['#3A1C71', '#D76D77'],
  mint: ['#43C6AC', '#B8F5D0'], rose: ['#F4C4F3', '#FC67FA'], candy: ['#FF9A9E', '#FAD0C4'],
  moody: ['#2C3E50', '#4CA1AF'], night: ['#0F2027', '#2C5364'], ice: ['#C9E8F7', '#7FB8DA'],
  faded: ['#BDB6A8', '#E7E1D5'], punch: ['#FF0844', '#FFB199'], sepia: ['#704214', '#C8A27A'],
  invert: ['#00F5D4', '#7B2FF7'],
};

export const EffectsSheet = ({
  lenses = [], filters = [], effects = [], games = [],
  lensId, filterId, effectId, gameId,
  onPickLens, onPickFilter, onPickEffect, onPickGame, onClear, onClose,
  inline = false,
}) => {
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const anyOn = lensId || (filterId && filterId !== 'none') || (effectId && effectId !== 'none') || gameId;
  const go = (fn, item) => { tapSelection(); fn && fn(item); };

  /* `inline` renders this as an overlay in place rather than a second
     Modal — a modal inside a modal lays out against the parent's
     transform instead of the screen, which is how a drawer ends up
     painting a blank page over the whole app. */
  const body = (
    <View style={inline ? [StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 60 }] : { flex: 1, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={{
        backgroundColor: 'rgba(12,10,22,0.97)',
        borderTopLeftRadius: R + 10, borderTopRightRadius: R + 10,
        paddingBottom: insets.bottom + 14,
      }}>
        <SheetHandle onClose={onClose} tint="rgba(255,255,255,0.3)" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 4 }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={tNow('close')} style={{ outlineStyle: 'none' }}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.8)" />
          </Pressable>
          {anyOn ? (
            <Pressable onPress={() => { tapLight(); onClear && onClear(); }} hitSlop={10} accessibilityRole="button" style={{ outlineStyle: 'none' }}>
              <Text style={{ color: C.gold, fontSize: 13, fontWeight: '900' }}>{tNow('fx_clear')}</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 6 }}>
          {lenses.length ? (
            <Row title={tNow('fx_faces')}>
              {lenses.map((l) => <Dot key={l.id} label={l.label} glyph={l.emoji} on={lensId === l.id} onPress={() => go(onPickLens, l)} />)}
            </Row>
          ) : null}
          {filters.length ? (
            <Row title={tNow('fx_looks')}>
              {filters.filter((f) => f.id !== 'none').map((f) => <Dot key={f.id} label={f.label} glyph="" tint={LOOK_TINT[f.id] || ['#7C3AED', '#EC4899']} on={filterId === f.id} onPress={() => go(onPickFilter, f)} />)}
            </Row>
          ) : null}
          {effects.length ? (
            <Row title={tNow('fx_fun')}>
              {effects.filter((e) => e.id !== 'none').map((e) => <Dot key={e.id} label={e.label} glyph={e.emoji} on={effectId === e.id} onPress={() => go(onPickEffect, e)} />)}
            </Row>
          ) : null}
          {games.length ? (
            <Row title={tNow('fx_games')}>
              {games.map((g) => <Dot key={g.id} label={g.title} glyph={g.emoji || '🎮'} on={gameId === g.id} onPress={() => go(onPickGame, g)} />)}
            </Row>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );

  if (inline) return body;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {body}
    </Modal>
  );
};
