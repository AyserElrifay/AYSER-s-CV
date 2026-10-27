import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { sw, GOALS } from '../constants/scaleWords';
import { cityHubs, hostStatus, tableProfile, tableIcebreakers } from '../services/scale';
import { DECK, cardText } from '../constants/activityDeck';
import { updateProfile } from '../services/profiles';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── MOMENTS AT SCALE, ON THE PHONE ──────────────────────────────────
   Ayser, for the Startup Visa committee: Moments runs itself in any
   city. These are the pieces people see of that (RUN_ME.sql, "MOMENTS
   AT SCALE"); every number on them is the server's.
     CityHubSheet     the cities Moments lives in, with their tables
     TableIcebreakers three questions written for who is at this table
     HostCard         the way to Certified Host, and hosting an official table
     GoalPicker       my Global Track goal (it feeds the Vibe Match) */

/* ── the cities ── */
const HubRow = ({ h, label, sub, on, onPick }) => (
  <Pressable onPress={() => { tapSelection(); onPick(h); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Text style={{ fontSize: 26, width: 40 }}>{h ? h.flag : '📍'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: on ? '800' : '600' }}>{label}</Text>
        {sub ? <Text style={[{ color: C.dim, fontSize: 13, marginTop: 2 }, NUM]}>{sub}</Text> : null}
      </View>
      {on ? <Ionicons name="checkmark-circle" size={22} color={C.purple} /> : null}
    </View>
  </Pressable>
);

export const CityHubSheet = ({ current, onPick, onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [hubs, setHubs] = useState(null);
  useEffect(() => { cityHubs().then(setHubs); }, []);
  const name = (h) => (lang === 'ar' && h.name_ar ? h.name_ar : h.name);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,13,20,0.4)' }} onPress={onClose} accessibilityLabel="close" />
      <View style={{ backgroundColor: C.bg2 || C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingBottom: insets.bottom + 18, maxHeight: '82%' }}>
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 6 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }}>{sw(lang, 'cities')}</Text>
        <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 }}>{sw(lang, 'cities_s')}</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          <HubRow h={null} label={sw(lang, 'near')} on={!current} onPick={onPick} />
          {hubs == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} /> : hubs.map((h) => (
            <HubRow key={h.id} h={h} label={name(h)} sub={sw(lang, 'tables_n', { n: h.tables })} on={current && current.id === h.id} onPick={onPick} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

/* ── three questions for who is at this table ── Papyrus writes them from
   the table in aggregate (languages, goals, hobbies — never a name); when
   it can't, the Warm-up deck stands in, so the card is never empty */
export const TableIcebreakers = ({ kind, id }) => {
  const { lang } = useLang();
  const [lines, setLines] = useState(null);
  const [mine, setMine] = useState(false);     // written for this table (true) or from the deck
  const [busy, setBusy] = useState(false);
  const deck = () => {
    const w = DECK.warm || [];
    const pick = [0, 1, 2].map(() => w[Math.floor(Math.random() * w.length)]).filter(Boolean);
    return pick.map((c) => cardText(c, lang));
  };
  const load = async () => {
    setBusy(true);
    const p = await tableProfile(kind, id);
    if (!p || !p.ok) { setBusy(false); setLines(null); return; }
    const out = await tableIcebreakers(p, lang);
    setBusy(false);
    if (out) { setLines(out); setMine(true); } else { setLines(deck()); setMine(false); }
  };
  useEffect(() => { load(); }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lines && !busy) return null;
  return (
    <View style={{ marginTop: 20, borderRadius: 26, padding: 22, backgroundColor: C.purple }}>
      <Text style={{ color: C.sun, fontSize: 12, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.8 }}>{'✦ ' + sw(lang, 'ice').toUpperCase()}</Text>
      {mine ? <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 4 }}>{sw(lang, 'ice_s')}</Text> : null}
      {busy && !lines ? <ActivityIndicator color="#FFF" style={{ marginTop: 16 }} /> : (lines || []).map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', marginTop: 14 }}>
          <Text style={[{ color: C.sun, fontSize: 16, fontWeight: '800', width: 22 }, NUM]}>{i + 1}</Text>
          <Text style={{ color: '#FFF', fontSize: 16.5, lineHeight: 23, fontWeight: '600', flex: 1 }}>{l}</Text>
        </View>
      ))}
      <Pressable onPress={() => { tapLight(); load(); }} disabled={busy} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.16)' }}>
          <Ionicons name="refresh" size={14} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', marginStart: 6 }}>{sw(lang, 'ice_more')}</Text>
        </View>
      </Pressable>
    </View>
  );
};

/* ── the way to Certified Host ── 5 stamps (or a partner venue, or the owner's
   verification): every plan they start is then an Official Moments Table */
export const HostCard = ({ onHost }) => {
  const { lang } = useLang();
  const [s, setS] = useState(null);
  useEffect(() => { hostStatus().then((x) => x && x.ok && setS(x)); }, []);
  if (!s) return null;
  return (
    <View style={{ marginTop: 18, borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.12)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={s.certified ? 'ribbon' : 'ribbon-outline'} size={20} color={C.sun} />
        <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '800', marginStart: 8 }}>{sw(lang, 'host_t')}</Text>
      </View>
      {s.certified ? (
        <>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, marginTop: 6 }}>{sw(lang, 'host_s')}</Text>
          <Pressable onPress={() => { tapLight(); onHost && onHost(); }} accessibilityRole="button" style={{ marginTop: 14 }}>
            <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.sun }}>
              <Text style={{ color: '#17131F', fontSize: 15.5, fontWeight: '700' }}>{sw(lang, 'host_go')}</Text>
            </View>
          </Pressable>
        </>
      ) : <Text style={[{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 6 }, NUM]}>{sw(lang, 'host_prog', { n: Math.min(5, s.stamps || 0) })}</Text>}
    </View>
  );
};

/* ── my Global Track goal ── one tap; it feeds the Vibe Match */
export const GoalPicker = ({ userId, value }) => {
  const { lang } = useLang();
  const [goal, setGoal] = useState(value || null);
  useEffect(() => { setGoal(value || null); }, [value]);
  const pick = async (g) => {
    const next = goal === g ? null : g;
    tapSelection(); setGoal(next);
    try { await updateProfile(userId, { track_goal: next }); tapSuccess(); } catch (e) { setGoal(goal); }
  };
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', marginBottom: 7 }}>{sw(lang, 'goal')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {GOALS.map((g) => {
          const on = goal === g;
          return (
            <Pressable key={g} onPress={() => pick(g)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ marginEnd: 8, marginBottom: 8 }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: on ? C.purple : C.bg, borderWidth: 1, borderColor: on ? C.purple : C.line }}>
                <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13, fontWeight: '700' }}>{sw(lang, 'g_' + g)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
