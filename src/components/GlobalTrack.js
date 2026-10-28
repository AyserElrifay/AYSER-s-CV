import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { tw as lw } from '../constants/trackWords';
import { myMomentsLevel, globalApply } from '../services/loop';
import { writePlan } from '../lib/feedGate';
import { goToTab } from '../lib/mapBus';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── MOMENTS LEVEL 1–4 · THE GLOBAL TRACK ────────────────────────────
   Ayser, October 2026: the long game. You go up by going out — English
   Circles, Culture and Table Drops, a few simple volunteering days — and
   Levels 3 and 4 are the Global Citizen Certificate: the record that
   gets you ready to apply for Erasmus+ youth exchanges, international
   volunteering and partner travel programmes. The server counts it all
   from real check-ins (my_moments_level); this only shows where you are
   and what is left. `compact` is the one-line version for Space. */

const Bar = ({ label, have, need }) => {
  const pct = need ? Math.min(1, have / need) : 1;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: pct >= 1 ? C.text : C.dim, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{Math.min(have, need) + ' / ' + need}</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.line, marginTop: 6, overflow: 'hidden' }}>
        <View style={{ height: 5, width: Math.round(pct * 100) + '%', backgroundColor: C.purple }} />
      </View>
    </View>
  );
};

const KINDS = [['exchange', 'gt_k_exchange'], ['volunteer', 'gt_k_volunteer'], ['travel', 'gt_k_travel']];

export const GlobalTrack = ({ compact }) => {
  const { lang } = useLang();
  const [r, setR] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const load = () => myMomentsLevel().then((x) => { if (x && x.ok) { setR(x); writePlan({ level: x.level }); } });
  useEffect(() => { load(); }, []);
  if (!r) return null;
  const lvl = r.level || 1;
  const name = lw(lang, 'gt_l' + lvl);
  const n = r.next;
  const asked = Array.isArray(r.asked) ? r.asked : [];

  if (compact) {
    return (
      <Pressable onPress={() => { tapLight(); goToTab('TOGETHER'); }} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.purple, fontSize: 17, fontWeight: '800' }}>{lang === 'ar' ? '٠١٢٣٤'[lvl] : lvl}</Text>
        </View>
        <View style={{ flex: 1, marginStart: 12 }}>
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700' }}>{lw(lang, 'gt_title')}</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginTop: 1 }}>{name}</Text>
        </View>
        <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={C.faint} />
      </Pressable>
    );
  }

  const send = async () => {
    if (!pick || busy) return;
    setBusy(true); setNote(null);
    const x = await globalApply(pick);
    setBusy(false);
    if (x && x.ok) { tapSuccess(); setNote(lw(lang, 'gt_applied')); setR({ ...r, asked: asked.concat(pick) }); setPick(null); }
    else setNote(lw(lang, 'gt_err'));
  };

  return (
    <View style={{ borderRadius: 24, padding: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 18 }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1 }}>
        {lang === 'ar' ? lw(lang, 'gt_track') : lw(lang, 'gt_track').toUpperCase()}
      </Text>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', marginTop: 6 }}>{name}</Text>
      <Text style={{ color: C.dim, fontSize: 14, marginTop: 2 }}>{lw(lang, 'gt_of', { n: lvl })}</Text>
      {/* four steps, the ones reached filled */}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {[1, 2, 3, 4].map((k) => (
          <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, marginEnd: k < 4 ? 6 : 0, backgroundColor: k <= lvl ? C.purple : C.line }} />
        ))}
      </View>
      <Text style={{ color: C.dim, fontSize: 14, lineHeight: 21, marginTop: 12 }}>{lw(lang, 'gt_sub')}</Text>
      {n ? (
        <View style={{ marginTop: 6 }}>
          <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 8 }}>{lw(lang, 'gt_next', { n: n.level })}</Text>
          <Bar label={lw(lang, 'gt_circles')} have={r.circles || 0} need={n.circles} />
          <Bar label={lw(lang, 'gt_drops')} have={r.drops || 0} need={n.drops} />
          {n.impact ? <Bar label={lw(lang, 'gt_impact')} have={r.impact || 0} need={n.impact} /> : null}
        </View>
      ) : <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginTop: 10 }}>{lw(lang, 'gt_top')}</Text>}
      {lvl >= 4 ? <Text style={{ color: C.text, fontSize: 13.5, marginTop: 10 }}>{lw(lang, 'gt_open')}</Text> : null}

      {/* the certificate, and — from level 3 — telling the team you are ready */}
      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }}>
        <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20 }}>{lw(lang, 'gt_cert')}</Text>
        {lvl < 3 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <Ionicons name="lock-closed-outline" size={15} color={C.faint} />
            <Text style={{ color: C.faint, fontSize: 13.5, fontWeight: '700', marginStart: 6 }}>{lw(lang, 'gt_locked')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{lw(lang, 'gt_pick')}</Text>
            {KINDS.map(([k, key]) => {
              const done = asked.indexOf(k) >= 0;
              const on = pick === k;
              return (
                <Pressable key={k} disabled={done} onPress={() => { tapLight(); setPick(on ? null : k); }} accessibilityRole="radio" accessibilityState={{ checked: on || done }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
                  <Ionicons name={done ? 'checkmark-circle' : on ? 'radio-button-on' : 'radio-button-off'} size={20} color={done || on ? C.purple : C.dim} />
                  <Text style={{ color: done ? C.faint : C.text, fontSize: 14.5, marginStart: 10 }}>{lw(lang, key)}</Text>
                </Pressable>
              );
            })}
            {pick ? (
              <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={{ marginTop: 8 }}>
                <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.purple }}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{lw(lang, 'gt_apply')}</Text>}
                </View>
              </Pressable>
            ) : null}
            {note ? <Text style={{ color: C.text, fontSize: 13.5, marginTop: 10 }}>{note}</Text> : null}
          </View>
        )}
      </View>
    </View>
  );
};
