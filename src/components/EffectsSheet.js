import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { tapLight, tapSelection } from '../utils/feedback';

/* ── THE EFFECTS DRAWER ─────────────────────────────────────────────
   Everything the camera can do to a frame, in one place you pull up
   from the bottom: the lenses, the colour looks, the overlays and the
   games. Categories across the top, a grid underneath, and the thing
   you're wearing right now marked so you always know what's on.

   Nothing in here is downloaded or licensed — every lens and every
   look is drawn or computed by us. */

const TABS = [
  { k: 'you', label: 'For You', icon: 'sparkles' },
  { k: 'faces', label: 'Faces', icon: 'happy-outline' },
  { k: 'colour', label: 'Colour', icon: 'color-palette-outline' },
  { k: 'fun', label: 'Fun', icon: 'flash-outline' },
  { k: 'games', label: 'Games', icon: 'game-controller-outline' },
];

/* One square in the grid — a big emoji or a swatch, its name under it,
   and a ring when it's the one you're wearing. */
const Cell = ({ label, glyph, tint, on, onPress, sub }) => (
  <Pressable onPress={onPress} style={{ width: '25%', padding: 5 }}>
    <View style={{
      aspectRatio: 0.82, borderRadius: 16, overflow: 'hidden',
      borderWidth: on ? 2.5 : 1, borderColor: on ? C.gold : 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    }}>
      {tint ? (
        <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
      <Text style={{ fontSize: 28 }}>{glyph}</Text>
      {sub ? <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9, marginTop: 3 }}>{sub}</Text> : null}
    </View>
    <Text numberOfLines={1} style={{ color: on ? C.gold : 'rgba(255,255,255,0.85)', fontSize: 10.5, fontWeight: on ? '900' : '700', textAlign: 'center', marginTop: 4 }}>
      {label}
    </Text>
  </Pressable>
);

export const EffectsSheet = ({
  lenses = [], filters = [], effects = [], games = [],
  lensId, filterId, effectId, gameId,
  onPickLens, onPickFilter, onPickEffect, onPickGame, onClear, onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('you');
  const [q, setQ] = useState('');

  const term = q.trim().toLowerCase();
  const match = (s) => !term || String(s || '').toLowerCase().includes(term);

  /* "For You" is not a recommendation engine pretending to know you —
     it is a hand-picked front page of the best of each kind. Saying so
     is better than implying a model we don't have. */
  const forYou = [
    ...lenses.slice(0, 8).map((l) => ({ kind: 'lens', item: l })),
    ...filters.filter((f) => f.id !== 'none').slice(0, 8).map((f) => ({ kind: 'filter', item: f })),
    ...effects.filter((e) => e.id !== 'none').slice(0, 4).map((e) => ({ kind: 'effect', item: e })),
  ];

  const rows =
    tab === 'faces' ? lenses.filter((l) => match(l.label)).map((l) => ({ kind: 'lens', item: l }))
    : tab === 'colour' ? filters.filter((f) => f.id !== 'none' && match(f.label)).map((f) => ({ kind: 'filter', item: f }))
    : tab === 'fun' ? effects.filter((e) => e.id !== 'none' && match(e.label)).map((e) => ({ kind: 'effect', item: e }))
    : tab === 'games' ? games.filter((g) => match(g.title)).map((g) => ({ kind: 'game', item: g }))
    : forYou.filter((x) => match(x.item.label || x.item.title));

  const pick = (row) => {
    tapSelection();
    if (row.kind === 'lens') onPickLens && onPickLens(row.item);
    else if (row.kind === 'filter') onPickFilter && onPickFilter(row.item);
    else if (row.kind === 'effect') onPickEffect && onPickEffect(row.item);
    else if (row.kind === 'game') onPickGame && onPickGame(row.item);
  };

  const isOn = (row) =>
    row.kind === 'lens' ? lensId === row.item.id
    : row.kind === 'filter' ? filterId === row.item.id
    : row.kind === 'effect' ? effectId === row.item.id
    : gameId === row.item.id;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={{
        height: '74%', backgroundColor: 'rgba(12,10,22,0.98)',
        borderTopLeftRadius: R + 10, borderTopRightRadius: R + 10,
        borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
        paddingBottom: insets.bottom,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 9 }}>
          <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        </View>

        {/* categories, the way a camera drawer does it */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8 }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ paddingHorizontal: 6 }}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            {TABS.map((t) => (
              <Pressable key={t.k} onPress={() => { tapLight(); setTab(t.k); }} style={{ alignItems: 'center', marginHorizontal: 11 }}>
                <Ionicons name={t.icon} size={17} color={tab === t.k ? '#FFF' : 'rgba(255,255,255,0.45)'} />
                <Text style={{ color: tab === t.k ? '#FFF' : 'rgba(255,255,255,0.45)', fontSize: 12.5, fontWeight: tab === t.k ? '900' : '700', marginTop: 3 }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, marginHorizontal: 14, marginTop: 10, paddingHorizontal: 13 }}>
          <Ionicons name="search" size={14} color="rgba(255,255,255,0.55)" />
          <TextInput
            value={q} onChangeText={setQ}
            placeholder="Search effects" placeholderTextColor="rgba(255,255,255,0.45)"
            style={{ flex: 1, color: '#FFF', fontSize: 13.5, paddingVertical: 9, marginLeft: 8 }}
          />
          {lensId || (filterId && filterId !== 'none') || (effectId && effectId !== 'none') || gameId ? (
            <Pressable onPress={() => { tapLight(); onClear && onClear(); }} hitSlop={8}>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900' }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 9, paddingTop: 12, paddingBottom: 30 }}>
          {rows.length ? rows.map((row, i) => (
            <Cell
              key={row.kind + (row.item.id || i)}
              label={row.item.label || row.item.title}
              glyph={row.item.emoji || '✨'}
              tint={row.kind === 'filter' ? ['rgba(124,58,237,0.35)', 'rgba(236,72,153,0.35)'] : null}
              sub={row.kind === 'game' ? 'game' : null}
              on={isOn(row)}
              onPress={() => pick(row)}
            />
          )) : (
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', width: '100%', paddingVertical: 40 }}>
              Nothing here by that name.
            </Text>
          )}
        </ScrollView>

        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'center', paddingHorizontal: 30, paddingBottom: 8 }}>
          Every lens and look here is drawn or computed by us — nothing downloaded, nothing licensed.
        </Text>
      </View>
    </Modal>
  );
};
