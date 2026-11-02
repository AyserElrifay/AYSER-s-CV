import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { cw, seatNo, interestLine, interestIcon } from '../constants/cardWords';
import { seatCard, sparksDeck, sendTableSpark } from '../services/card';
import { tapLight, tapSuccess, tapCelebrate } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── A SEAT AT THE TABLE ─────────────────────────────────────────────
   Ayser, November 2026: in the table chat everybody is "Seat #04 •
   Coffee & Art" with a line-drawn badge and a blurred face, until you have
   both scanned the table's QR. Tap a seat to peek at their card: three
   photos, blurred — the server sends only the 24-pixel copies until the
   scan (RUN_ME.sql seat_card) — and the lock that says how to open it.
   The organizer is always shown. */
const CHAR = '#2B2B2B';
const blurStyle = Platform.OS === 'web' ? { filter: 'blur(14px)', transform: [{ scale: 1.15 }] } : null;

/* the small line-art badge and the alias, for the chat */
export const SeatBadge = ({ seat, lang, size = 30, onPress }) => {
  if (!seat) return null;
  const open = seat.open;
  const pic = open ? seat.avatar_url : seat.blur;
  return (
    <Pressable testID={'seat-' + seat.seat} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={seatLabel(seat, lang)}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#EDEBE6', alignItems: 'center', justifyContent: 'center' }}>
        {pic ? <Image source={{ uri: pic }} blurRadius={open ? 0 : 12} style={[{ position: 'absolute', width: size, height: size }, open ? null : blurStyle]} /> : null}
        {!open ? <Ionicons name={interestIcon(seat.interests)} size={size * 0.5} color={CHAR} /> : null}
      </View>
    </Pressable>
  );
};
export const seatLabel = (seat, lang) => {
  if (!seat) return '';
  if (seat.host) return (seat.name || '') + ' · ' + cw(lang, 'organizer');
  if (seat.open && seat.name) return seat.name;
  const i = interestLine(seat.interests);
  return cw(lang, 'seat', { n: seatNo(seat.seat) }) + (i ? ' • ' + i : '');
};

export const SeatPeek = ({ kind, id, uid, lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [c, setC] = useState(null);
  useEffect(() => { seatCard(kind, id, uid).then((r) => setC(r || { ok: false })); }, [kind, id, uid]);
  const photos = c && Array.isArray(c.photos) ? c.photos : [];
  const n = c ? seatNo(c.seat) : '';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 }}>
        <Pressable onPress={() => {}} testID="seat-peek" style={{ borderRadius: 22, backgroundColor: C.bg, padding: 16, paddingBottom: 18 + insets.bottom * 0 }}>
          {!c ? <ActivityIndicator color={C.text} style={{ marginVertical: 40 }} /> : !c.ok ? (
            <Text style={{ color: C.dim, fontSize: 14 }}>{cw(lang, 'err')}</Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: CHAR, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={interestIcon(c.interests)} size={17} color={CHAR} />
                </View>
                <View style={{ flex: 1, marginStart: 10 }}>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: '800' }}>{c.open && c.name ? c.name : cw(lang, 'seat', { n })}</Text>
                  <Text style={{ color: C.dim, fontSize: 13 }}>{c.host ? cw(lang, 'organizer') : interestLine(c.interests)}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={cw(lang, 'close')}>
                  <Ionicons name="close" size={22} color={C.text} />
                </Pressable>
              </View>
              {photos.length ? (
                <View style={{ flexDirection: 'row', marginTop: 14, marginHorizontal: -3 }}>
                  {photos.slice(0, 3).map((u, k) => (
                    <View key={k} style={{ flex: 1, aspectRatio: 3 / 4, marginHorizontal: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#DAD7D0' }}>
                      <Image source={{ uri: u }} blurRadius={c.open ? 0 : 25} style={[{ width: '100%', height: '100%' }, c.open ? null : blurStyle]} resizeMode="cover" />
                    </View>
                  ))}
                </View>
              ) : <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 12 }}>{cw(lang, 'noCard')}</Text>}
              {c.open && Array.isArray(c.prompts) ? c.prompts.map((p, k) => (
                <View key={k} style={{ marginTop: 10 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700' }}>{p.q}</Text>
                  <Text style={{ color: C.text, fontSize: 15, marginTop: 2 }}>{p.a}</Text>
                </View>
              )) : null}
              {!c.open ? (
                <View testID="seat-lock" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, borderRadius: 14, backgroundColor: '#1A1A1A', padding: 12 }}>
                  <Ionicons name="lock-closed" size={16} color="#FFF" />
                  <Text style={{ flex: 1, color: '#FFF', fontSize: 13.5, fontWeight: '700', lineHeight: 19, marginStart: 8 }}>
                    {c.me_in ? cw(lang, 'lockMe', { n }) : cw(lang, 'lockPeek', { n })}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ─── FRIDAY SPARKS ── after the table, for three hours, three secret Sparks */
export const SparksDeck = ({ kind, id, lang }) => {
  const [d, setD] = useState(null);
  const [note, setNote] = useState(null);
  const [i, setI] = useState(0);
  const load = () => sparksDeck(kind, id).then((r) => setD(r && r.ok ? r : null));
  useEffect(() => { load(); }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const people = Array.isArray(d.people) ? d.people : [];
  const head = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="flame-outline" size={18} color={C.text} />
        <Text style={{ color: C.text, fontSize: 19, fontWeight: '800', marginStart: 6 }}>{cw(lang, 'sparks')}</Text>
        <View style={{ flex: 1 }} />
        {d.open ? <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700' }}>{cw(lang, 'sparksLeft', { n: d.left })}</Text> : null}
      </View>
      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{d.open ? cw(lang, 'sparksSub') : new Date(d.now) < new Date(d.opens_at) ? cw(lang, 'sparksSoon') : cw(lang, 'sparksOver')}</Text>
    </>
  );
  if (!d.open) return <View testID="sparks-deck" style={{ marginTop: 18 }}>{head}</View>;
  if (!people.length) return <View testID="sparks-deck" style={{ marginTop: 18 }}>{head}<Text style={{ color: C.dim, fontSize: 13.5, marginTop: 8 }}>{cw(lang, 'nobody')}</Text></View>;
  const p = people[Math.min(i, people.length - 1)];
  const spark = async () => {
    tapLight(); setNote(null);
    const r = await sendTableSpark(kind, id, p.uid);
    if (r && r.ok) { if (r.mutual) { tapCelebrate(); setNote(cw(lang, 'mutual')); } else { tapSuccess(); setNote(cw(lang, 'sent')); } load(); }
    else setNote(cw(lang, r && r.reason === 'three' ? 'three' : 'err'));
  };
  return (
    <View testID="sparks-deck" style={{ marginTop: 18 }}>
      {head}
      <View style={{ marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 12 }}>
        <ScrollView horizontal pagingEnabled keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
          {(Array.isArray(p.photos) && p.photos.length ? p.photos : [p.avatar_url]).filter(Boolean).slice(0, 3).map((u, k) => (
            <Image key={k} source={{ uri: u }} style={{ width: 150, aspectRatio: 3 / 4, borderRadius: 12, marginEnd: 8, backgroundColor: C.line }} resizeMode="cover" />
          ))}
        </ScrollView>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginTop: 10 }}>{p.name || ''}</Text>
        <Text style={{ color: C.dim, fontSize: 13 }}>{p.host ? cw(lang, 'organizer') : cw(lang, 'seat', { n: seatNo(p.seat) }) + (interestLine(p.interests) ? ' • ' + interestLine(p.interests) : '')}</Text>
        {Array.isArray(p.prompts) ? p.prompts.map((x, k) => (
          <Text key={k} style={{ color: C.text, fontSize: 13.5, marginTop: 6 }}><Text style={{ color: C.dim, fontWeight: '700' }}>{x.q + ' '}</Text>{x.a}</Text>
        )) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Pressable onPress={() => { tapLight(); setI((i - 1 + people.length) % people.length); setNote(null); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="‹" style={{ padding: 6 }}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </Pressable>
          <Pressable testID="spark-send" disabled={p.sent || d.left <= 0} onPress={spark} accessibilityRole="button" style={{ flex: 1, marginHorizontal: 8 }}>
            <View style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: p.mutual ? '#1A1A1A' : p.sent ? C.line : C.purple }}>
              <Ionicons name={p.mutual ? 'link-outline' : 'flame-outline'} size={16} color={p.sent && !p.mutual ? C.dim : '#FFF'} />
              <Text style={{ color: p.sent && !p.mutual ? C.dim : '#FFF', fontSize: 14.5, fontWeight: '800', marginStart: 6 }}>{p.mutual ? cw(lang, 'connected') : p.sent ? cw(lang, 'sent') : cw(lang, 'send')}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => { tapLight(); setI((i + 1) % people.length); setNote(null); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="›" style={{ padding: 6 }}>
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </Pressable>
        </View>
        {note ? <Text style={{ color: C.text, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{note}</Text> : null}
      </View>
    </View>
  );
};
